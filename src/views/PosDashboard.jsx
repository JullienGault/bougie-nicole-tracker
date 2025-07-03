// src/views/PosDashboard.jsx
import React, { useState, useEffect, useMemo, useContext, useCallback } from 'react';
import { db, onSnapshot, doc, collection, query, orderBy, where, updateDoc, arrayUnion, arrayRemove, writeBatch, addDoc, serverTimestamp } from '../../services/firebase';
import { AppContext } from '../contexts/AppContext';

// Icons
import { Truck, PlusCircle, CircleDollarSign, Archive, DollarSign, Percent, Coins, User, Store, Phone, Mail, ChevronDown, ChevronUp, ArchiveRestore, XCircle, AlertTriangle, Check, Trash2, Info, ArrowRightCircle } from 'lucide-react';

// Constants
import { LOW_STOCK_THRESHOLD, DELIVERY_STATUS_STEPS, deliveryStatusOrder, PAYOUT_STATUSES, payoutStatusOrder } from '../constants';

// Utils
import { formatPrice, formatDate, formatPercent, formatPhone } from '../utils/formatters';

// Components
import KpiCard from '../components/common/KpiCard';
import SaleModal from '../components/pos/SaleModal';
import DeliveryRequestModal from '../components/delivery/DeliveryRequestModal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import InfoModal from '../components/common/InfoModal';

const PosDashboard = ({ isAdminView = false, pos, onActionSuccess = () => {} }) => {
    const { products, showToast, loggedInUserData } = useContext(AppContext);

    const currentUserData = isAdminView ? pos : loggedInUserData;
    const posId = currentUserData.uid;

    const [stock, setStock] = useState([]);
    const [salesHistory, setSalesHistory] = useState([]);
    const [posData, setPosData] = useState(null);
    const [deliveryRequests, setDeliveryRequests] = useState([]);
    const [payouts, setPayouts] = useState([]);

    const [showSaleModal, setShowSaleModal] = useState(false);
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [showHistory, setShowHistory] = useState('stock');
    const [saleToDelete, setSaleToDelete] = useState(null);
    const [expandedRequestId, setExpandedRequestId] = useState(null);
    const [deliveryTab, setDeliveryTab] = useState('actives');
    const [requestToCancel, setRequestToCancel] = useState(null);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [payoutToConfirm, setPayoutToConfirm] = useState(null);
    const [isUpdatingPayout, setIsUpdatingPayout] = useState(null);

    // Fetch PoS Data, Stock, Sales, Payouts
    useEffect(() => { if (!posId) return; const unsub = onSnapshot(doc(db, "pointsOfSale", posId), (doc) => { if (doc.exists()) setPosData(doc.data()); }); return unsub; }, [posId]);
    useEffect(() => { if (!posId) return; const q = query(collection(db, `pointsOfSale/${posId}/stock`)); const unsub = onSnapshot(q, (snapshot) => setStock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))); return unsub; }, [posId]);
    useEffect(() => { if (!posId) return; const q = query(collection(db, `pointsOfSale/${posId}/sales`), orderBy('createdAt', 'desc')); const unsub = onSnapshot(q, (snapshot) => setSalesHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))); return unsub;}, [posId]);
    useEffect(() => { if (!posId) return; const q = query(collection(db, `pointsOfSale/${posId}/payouts`), orderBy('createdAt', 'desc')); const unsub = onSnapshot(q, (snapshot) => setPayouts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))); return unsub; }, [posId]);

    // Fetch Delivery Requests (only for client view)
    useEffect(() => {
        if (!posId || isAdminView) return;
        const q = query(collection(db, `deliveryRequests`), where("posId", "==", posId), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snapshot) => { setDeliveryRequests(snapshot.docs.map(d => ({id: d.id, ...d.data()}))); });
        return unsub;
    }, [posId, isAdminView]);

    const handleArchive = async (requestId) => { await updateDoc(doc(db, 'deliveryRequests', requestId), { archivedBy: arrayUnion(posId) }); };
    const handleUnarchive = async (requestId) => { await updateDoc(doc(db, 'deliveryRequests', requestId), { archivedBy: arrayRemove(posId) }); };

    const { activeDeliveries, archivedDeliveries } = useMemo(() => ({
        activeDeliveries: deliveryRequests.filter(req => !req.archivedBy?.includes(posId)),
        archivedDeliveries: deliveryRequests.filter(req => req.archivedBy?.includes(posId))
    }), [deliveryRequests, posId]);

    const deliveriesToDisplay = deliveryTab === 'actives' ? activeDeliveries : archivedDeliveries;

    const toggleExpand = (requestId) => setExpandedRequestId(prevId => (prevId === requestId ? null : requestId));

    const unsettledSales = useMemo(() => salesHistory.filter(s => !s.payoutId), [salesHistory]);

    const kpis = useMemo(() => {
        const totalStock = stock.reduce((acc, item) => acc + item.quantity, 0);
        const totalRevenue = unsettledSales.reduce((acc, sale) => acc + sale.totalAmount, 0);
        const commission = totalRevenue * (posData?.commissionRate || 0);
        const netToBePaid = totalRevenue - commission;
        return { totalStock, totalRevenue, netToBePaid };
    }, [stock, unsettledSales, posData]);

    const handleDeleteSale = async (reason) => {
        if (!saleToDelete) return;
        const sale = saleToDelete;
        setSaleToDelete(null);

        if(sale.payoutId) {
            showToast("Impossible d'annuler une vente qui fait partie d'un paiement déjà clôturé.", "error");
            return;
        }
        const product = products.find(p => p.id === sale.productId);
        if (!product) { showToast("Produit de la vente introuvable.", "error"); return; }

        const stockId = product.hasScents ? `${sale.productId}_${sale.scent}` : sale.productId;
        const stockDocRef = doc(db, `pointsOfSale/${posId}/stock`, stockId);
        const saleDocRef = doc(db, `pointsOfSale/${posId}/sales`, sale.id);
        try {
            const batch = writeBatch(db);
            const currentStockItem = stock.find(item => item.id === stockId);
            const newQuantity = (currentStockItem?.quantity || 0) + sale.quantity;

            if (currentStockItem) { batch.update(stockDocRef, { quantity: newQuantity }); }
            else { batch.set(stockDocRef, { productId: sale.productId, productName: sale.productName, scent: sale.scent, quantity: sale.quantity, price: sale.unitPrice, hasScents: !!product.hasScents }); }

            batch.delete(saleDocRef);
            await batch.commit();
            showToast("Vente annulée et stock restauré.", "success");
        } catch (error) { console.error("Erreur annulation vente: ", error); showToast("Erreur: impossible d'annuler la vente.", "error"); }
    };

    const handleCreatePayout = async () => {
        if (unsettledSales.length === 0) {
            showToast("Aucune vente à régler pour créer un paiement.", "info");
            return;
        }
        setPayoutToConfirm(null);

        const batch = writeBatch(db);
        const payoutDocRef = doc(collection(db, `pointsOfSale/${posId}/payouts`));

        const salesToSettle = [...unsettledSales];
        const grossRevenue = salesToSettle.reduce((acc, sale) => acc + sale.totalAmount, 0);
        const commissionAmount = grossRevenue * (posData?.commissionRate || 0);
        const netAmount = grossRevenue - commissionAmount;

        batch.set(payoutDocRef, {
            createdAt: serverTimestamp(),
            status: 'pending',
            grossRevenue,
            commissionAmount,
            netAmount,
            commissionRateAtTheTime: posData?.commissionRate || 0,
            salesCount: salesToSettle.length,
            paidAt: null
        });

        salesToSettle.forEach(sale => {
            const saleRef = doc(db, `pointsOfSale/${posId}/sales`, sale.id);
            batch.update(saleRef, { payoutId: payoutDocRef.id });
        });

        try {
            await batch.commit();
            showToast("Période de paiement clôturée avec succès !", "success");
            onActionSuccess();
        } catch(error) {
            console.error("Erreur lors de la clôture de la période: ", error);
            showToast("Erreur lors de la création du paiement.", "error");
        }
    };

    const handleUpdatePayoutStatus = async (payout) => {
        if (!isAdminView) return;

        const currentIndex = payoutStatusOrder.indexOf(payout.status);
        if (currentIndex === -1 || currentIndex === payoutStatusOrder.length - 1) return;

        const nextStatus = payoutStatusOrder[currentIndex + 1];
        const payoutDocRef = doc(db, `pointsOfSale/${posId}/payouts`, payout.id);

        setIsUpdatingPayout(payout.id);
        try {
            const dataToUpdate = { status: nextStatus };
            if (nextStatus === 'received') dataToUpdate.paidAt = serverTimestamp();

            await updateDoc(payoutDocRef, dataToUpdate);

            await addDoc(collection(db, 'notifications'), {
                recipientUid: posId,
                message: `Le statut de votre paiement de ${formatPrice(payout.netAmount)} est passé à : "${PAYOUT_STATUSES[nextStatus].text}".`,
                createdAt: serverTimestamp(),
                isRead: false,
                type: 'PAYOUT_UPDATE'
            });

            showToast(`Statut du paiement mis à jour.`, "success");
        } catch (error) {
            console.error("Erreur de mise à jour du statut du paiement: ", error);
            showToast("Une erreur est survenue.", "error");
        } finally {
            setIsUpdatingPayout(null);
        }
    };

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {showSaleModal && <SaleModal posId={posId} stock={stock} onClose={() => setShowSaleModal(false)} />}
            {showDeliveryModal && <DeliveryRequestModal posId={posId} posName={posData?.name} onClose={() => setShowDeliveryModal(false)} />}
            {saleToDelete && <ConfirmationModal title="Confirmer l'annulation" message={`Annuler la vente de ${saleToDelete.quantity} x ${saleToDelete.productName} ${saleToDelete.scent || ''} ?\nLe stock sera automatiquement restauré.`} onConfirm={handleDeleteSale} onCancel={() => setSaleToDelete(null)} confirmText="Annuler la Vente" requiresReason={true} />}
            {payoutToConfirm && <ConfirmationModal title="Clôturer la Période" message={`Vous allez clôturer la période avec un montant net à reverser de ${formatPrice(kpis.netToBePaid)}. Êtes-vous sûr ?`} onConfirm={handleCreatePayout} onCancel={() => setPayoutToConfirm(null)} confirmText="Oui, Clôturer" confirmColor="bg-blue-600 hover:bg-blue-700" />}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
                <div><h2 className="text-3xl font-bold text-white">Tableau de Bord</h2><p className="text-gray-400">Bienvenue, {posData?.name || currentUserData.displayName}</p></div>
                <div className="flex gap-4 mt-4 md:mt-0">
                    {!isAdminView && <>
                        <button onClick={() => setShowDeliveryModal(true)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><Truck size={20} /> Demander une Livraison</button>
                        <button onClick={() => setShowSaleModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><PlusCircle size={20} /> Nouvelle Vente</button>
                    </>}
                    {isAdminView && <button onClick={() => setPayoutToConfirm(true)} disabled={kpis.netToBePaid <= 0} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><CircleDollarSign size={20} /> Clôturer la période</button>}
                </div>
            </div>

            {isAdminView && currentUserData && (
                <div className="bg-gray-800 rounded-2xl p-6 mb-8 animate-fade-in">
                    <h3 className="text-xl font-bold text-white mb-4">Informations de Contact</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-base">
                        <div className="flex items-center gap-3"><User className="text-indigo-400" size={22}/> <span>{currentUserData.firstName} {currentUserData.lastName}</span></div>
                        <div className="flex items-center gap-3"><Store className="text-indigo-400" size={22}/> <span>{currentUserData.displayName}</span></div>
                        <div className="flex items-center gap-3"><Phone className="text-indigo-400" size={22}/> <span>{formatPhone(currentUserData.phone)}</span></div>
                        <div className="flex items-center gap-3"><Mail className="text-indigo-400" size={22}/> <span>{currentUserData.email}</span></div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KpiCard title="Stock Total" value={kpis.totalStock} icon={Archive} color="bg-blue-600" />
                <KpiCard title="CA Brut (période en cours)" value={formatPrice(kpis.totalRevenue)} icon={DollarSign} color="bg-green-600" />
                <KpiCard title="Votre Commission" value={formatPercent(posData?.commissionRate)} icon={Percent} color="bg-purple-600" />
                <KpiCard title="Net à reverser" value={formatPrice(kpis.netToBePaid)} icon={Coins} color="bg-pink-600" />
            </div>

            <div className="lg:col-span-3 bg-gray-800 rounded-2xl p-6 mt-8">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Gestion & Historique</h3>
                </div>
                 <div className="border-b border-gray-700 mb-4">
                    <nav className="-mb-px flex gap-6" aria-label="Tabs">
                        <button onClick={() => setShowHistory('stock')} className={`${showHistory === 'stock' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>Stock</button>
                        <button onClick={() => setShowHistory('sales')} className={`${showHistory === 'sales' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>Ventes</button>
                        <button onClick={() => setShowHistory('payouts')} className={`${showHistory === 'payouts' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>Paiements</button>
                    </nav>
                </div>

                {showHistory === 'stock' && (
                    <div className="animate-fade-in overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-gray-700 text-gray-400 text-sm"><th className="p-3">Produit</th><th className="p-3">Parfum</th><th className="p-3">Stock</th><th className="p-3">Prix Unitaire</th></tr></thead><tbody>{stock.map(item => (<tr key={item.id} className="border-b border-gray-700 hover:bg-gray-700/50"><td className="p-3 font-medium">{item.productName}</td><td className="p-3 text-gray-300">{item.scent || 'N/A'}</td><td className={`p-3 font-bold ${item.quantity <= LOW_STOCK_THRESHOLD ? 'text-yellow-400' : 'text-white'}`}>{item.quantity}</td><td className="p-3">{formatPrice(item.price)}</td></tr>))}</tbody></table></div>
                )}
                {showHistory === 'sales' && (
                    <div className="animate-fade-in overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-gray-700 text-gray-400 text-sm"><th className="p-3">Date</th><th className="p-3">Produit</th><th className="p-3">Qté</th><th className="p-3">Total</th><th className="p-3">Statut</th><th className="p-3">Actions</th></tr></thead><tbody>{salesHistory.map(sale => (<tr key={sale.id} className="border-b border-gray-700 hover:bg-gray-700/50"><td className="p-3">{formatDate(sale.createdAt)}</td><td className="p-3">{sale.productName} <span className="text-gray-400">{sale.scent || ''}</span></td><td className="p-3">{sale.quantity}</td><td className="p-3 font-semibold">{formatPrice(sale.totalAmount)}</td><td className="p-3 text-xs font-semibold">{sale.payoutId ? <span className="text-gray-500">Réglée</span> : <span className="text-green-400">En cours</span>}</td><td className="p-3">{!sale.payoutId && <button onClick={() => setSaleToDelete(sale)} className="text-red-500 hover:text-red-400 p-1"><Trash2 size={18}/></button>}</td></tr>))}</tbody></table></div>
                )}
                {showHistory === 'payouts' && (
                     <div className="animate-fade-in overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-gray-700 text-gray-400 text-sm">
                                    <th className="p-3">Date Clôture</th><th className="p-3">Montant Net</th><th className="p-3">Statut</th><th className="p-3">{isAdminView ? "Action" : "Date Paiement"}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payouts.map(p => (
                                    <tr key={p.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                                        <td className="p-3">{formatDate(p.createdAt)}</td>
                                        <td className="p-3 font-semibold">{formatPrice(p.netAmount)}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 text-xs font-bold rounded-full whitespace-nowrap ${PAYOUT_STATUSES[p.status]?.bg} ${PAYOUT_STATUSES[p.status]?.color}`}>
                                                {PAYOUT_STATUSES[p.status]?.text || p.status}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            {isAdminView && p.status !== 'received' ? (
                                                <button onClick={() => handleUpdatePayoutStatus(p)} disabled={isUpdatingPayout === p.id} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1 px-3 rounded-lg flex items-center gap-2 disabled:opacity-50 whitespace-nowrap">
                                                    {isUpdatingPayout === p.id ? <div className="animate-spin rounded-full h-4 w-4 border-b-2"></div> : <>Étape suivante <ArrowRightCircle size={14}/></>}
                                                </button>
                                            ) : ( p.paidAt ? formatDate(p.paidAt) : '-' )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PosDashboard;
