// src/views/PosDashboard.jsx
import React, { useState, useEffect, useMemo, useContext } from 'react';
import { db, onSnapshot, doc, collection, query, orderBy, where, updateDoc, writeBatch, addDoc, serverTimestamp } from '../services/firebase';
import { AppContext } from '../contexts/AppContext';

// Icons
import { Truck, PlusCircle, CircleDollarSign, Archive, DollarSign, Percent, Coins, User, Store, Phone, Mail, ArrowRightCircle, Trash2 } from 'lucide-react';

// Constants
import { LOW_STOCK_THRESHOLD, PAYOUT_STATUSES, payoutStatusOrder } from '../constants';

// Utils
import { formatPrice, formatDate, formatPercent, formatPhone } from '../utils/formatters';

// Components
import KpiCard from '../components/common/KpiCard';
import SaleModal from '../components/pos/SaleModal';
import DeliveryRequestModal from '../components/delivery/DeliveryRequestModal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import PayoutReconciliationModal from '../components/payout/PayoutReconciliationModal';

const PosDashboard = ({ isAdminView = false, pos, onActionSuccess = () => {} }) => {
    const { showToast, loggedInUserData } = useContext(AppContext);
    const currentUserData = isAdminView ? pos : loggedInUserData;
    const posId = currentUserData.uid;

    // States
    const [stock, setStock] = useState([]);
    const [salesHistory, setSalesHistory] = useState([]);
    const [posData, setPosData] = useState(null);
    const [payouts, setPayouts] = useState([]);
    const [showHistory, setShowHistory] = useState(isAdminView ? 'payouts' : 'stock');
    const [isUpdatingPayout, setIsUpdatingPayout] = useState(null);
    const [saleToDelete, setSaleToDelete] = useState(null);
    
    // States pour les modales
    const [showSaleModal, setShowSaleModal] = useState(false);
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [showReconciliationModal, setShowReconciliationModal] = useState(false);
    const [payoutToView, setPayoutToView] = useState(null);

    // Listeners Firestore
    useEffect(() => { if (!posId) return; onSnapshot(doc(db, "pointsOfSale", posId), (doc) => { if (doc.exists()) setPosData(doc.data()); }); }, [posId]);
    useEffect(() => { if (!posId) return; onSnapshot(query(collection(db, `pointsOfSale/${posId}/stock`)), (snapshot) => setStock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), productId: doc.id })))); }, [posId]);
    useEffect(() => { if (!posId) return; onSnapshot(query(collection(db, `pointsOfSale/${posId}/sales`), orderBy('createdAt', 'desc')), (snapshot) => setSalesHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))); }, [posId]);
    useEffect(() => { if (!posId) return; onSnapshot(query(collection(db, `pointsOfSale/${posId}/payouts`), orderBy('createdAt', 'desc')), (snapshot) => setPayouts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))); }, [posId]);
    
    // Calculs mémoïsés
    const unsettledSales = useMemo(() => salesHistory.filter(s => !s.payoutId), [salesHistory]);
    const kpis = useMemo(() => {
        const totalStock = stock.reduce((acc, item) => acc + item.quantity, 0);
        const totalRevenue = unsettledSales.reduce((acc, sale) => acc + sale.totalAmount, 0);
        return { totalStock, totalRevenue, netToBePaid: totalRevenue - (totalRevenue * (posData?.commissionRate || 0)) };
    }, [stock, unsettledSales, posData]);

    // Handlers
    const handleCreatePayout = async (reconciledData) => {
        setShowReconciliationModal(false);
        const batch = writeBatch(db);
        const payoutDocRef = doc(collection(db, `pointsOfSale/${posId}/payouts`));
        const adjustments = reconciledData.items
            .filter(item => item.adjustmentReason)
            .map(item => ({ productId: item.productId, productName: item.productName, originalQuantity: item.originalQuantity, finalQuantity: item.finalQuantity, reason: item.adjustmentReason }));

        batch.set(payoutDocRef, {
            createdAt: serverTimestamp(), status: 'pending', grossRevenue: reconciledData.grossRevenue,
            commissionAmount: reconciledData.grossRevenue * reconciledData.commissionRate, netAmount: reconciledData.netAmount,
            commissionRateAtTheTime: reconciledData.commissionRate,
            salesCount: reconciledData.items.reduce((acc, item) => acc + item.finalQuantity, 0),
            items: reconciledData.items.map(i => ({productId: i.productId, productName: i.productName, finalQuantity: i.finalQuantity})),
            adjustments, paidAt: null
        });
        reconciledData.items.flatMap(item => item.originalSaleIds).forEach(saleId => {
            batch.update(doc(db, `pointsOfSale/${posId}/sales`, saleId), { payoutId: payoutDocRef.id });
        });
        reconciledData.items.forEach(item => {
            const stockItem = stock.find(s => s.id === item.productId);
            if (stockItem) {
                const stockDiff = item.originalQuantity - item.finalQuantity;
                batch.update(doc(db, `pointsOfSale/${posId}/stock`, item.productId), { quantity: stockItem.quantity + stockDiff });
            }
        });
        try { await batch.commit(); showToast("Période de paiement clôturée !", "success"); onActionSuccess(); }
        catch(error) { console.error(error); showToast("Erreur lors de la clôture.", "error"); }
    };
    
    const handleUpdatePayoutStatus = async (payout) => {
        if (!isAdminView) return;
        const currentIndex = payoutStatusOrder.indexOf(payout.status);
        if (currentIndex < 0 || currentIndex >= payoutStatusOrder.length - 1) return;
        const nextStatus = payoutStatusOrder[currentIndex + 1];
        const payoutDocRef = doc(db, `pointsOfSale/${posId}/payouts`, payout.id);
        setIsUpdatingPayout(payout.id);
        try {
            const dataToUpdate = { status: nextStatus };
            if (nextStatus === 'received') dataToUpdate.paidAt = serverTimestamp();
            await updateDoc(payoutDocRef, dataToUpdate);
            await addDoc(collection(db, 'notifications'), {
                recipientUid: posId, message: `Le statut de votre paiement de ${formatPrice(payout.netAmount)} est passé à : "${PAYOUT_STATUSES[nextStatus].text}".`,
                createdAt: serverTimestamp(), isRead: false, type: 'PAYOUT_UPDATE'
            });
            showToast(`Statut du paiement mis à jour.`, "success");
        } catch (error) { showToast("Une erreur est survenue.", "error"); }
        finally { setIsUpdatingPayout(null); }
    };
    
    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {/* Modales pour le dépôt-vente */}
            {!isAdminView && showSaleModal && <SaleModal posId={posId} stock={stock} onClose={() => setShowSaleModal(false)} />}
            {!isAdminView && showDeliveryModal && <DeliveryRequestModal posId={posId} posName={posData?.name} onClose={() => setShowDeliveryModal(false)} />}
            
            {/* Modale de réconciliation pour l'admin et de consultation pour le POS */}
            {showReconciliationModal && posData && <PayoutReconciliationModal pos={posData} unsettledSales={unsettledSales} stock={stock} onClose={() => setShowReconciliationModal(false)} onConfirm={handleCreatePayout} />}
            {payoutToView && posData && <PayoutReconciliationModal pos={posData} stock={stock} unsettledSales={[]} payoutData={payoutToView} onClose={() => setPayoutToView(null)} isReadOnly={true} />}
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
                <div><h2 className="text-3xl font-bold text-white">Tableau de Bord</h2><p className="text-gray-400">Bienvenue, {posData?.name || currentUserData.displayName}</p></div>
                
                {/* === SECTION DES BOUTONS RESTAURÉE ET CORRIGÉE === */}
                <div className="flex gap-4 mt-4 md:mt-0">
                    {!isAdminView ? (
                        <>
                            <button onClick={() => setShowDeliveryModal(true)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><Truck size={20} /> Demander une Livraison</button>
                            <button onClick={() => setShowSaleModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><PlusCircle size={20} /> Nouvelle Vente</button>
                        </>
                    ) : (
                        <button onClick={() => setShowReconciliationModal(true)} disabled={unsettledSales.length === 0} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50">
                            <CircleDollarSign size={20} /> Clôturer la période
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-gray-800 rounded-2xl p-6 mb-8 animate-fade-in">
                <h3 className="text-xl font-bold text-white mb-4">Informations de Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-base">
                    <div className="flex items-center gap-3"><User className="text-indigo-400" size={22}/> <span>{currentUserData.firstName} {currentUserData.lastName}</span></div>
                    <div className="flex items-center gap-3"><Store className="text-indigo-400" size={22}/> <span>{currentUserData.displayName}</span></div>
                    <div className="flex items-center gap-3"><Phone className="text-indigo-400" size={22}/> <span>{formatPhone(currentUserData.phone)}</span></div>
                    <div className="flex items-center gap-3"><Mail className="text-indigo-400" size={22}/> <span>{currentUserData.email}</span></div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KpiCard title="Stock Total" value={kpis.totalStock} icon={Archive} color="bg-blue-600" tooltip="Nombre total d'articles actuellement dans votre stock."/>
                <KpiCard title="CA Brut (période)" value={formatPrice(kpis.totalRevenue)} icon={DollarSign} color="bg-green-600" tooltip="Montant total de vos ventes depuis le dernier paiement."/>
                <KpiCard title="Votre Commission" value={formatPercent(posData?.commissionRate)} icon={Percent} color="bg-purple-600" tooltip="Le taux de commission qui vous est appliqué sur chaque vente."/>
                <KpiCard title="Net à reverser" value={formatPrice(kpis.netToBePaid)} icon={Coins} color="bg-pink-600" tooltip="Le montant qui vous sera reversé pour la période de ventes en cours."/>
            </div>

            <div className="bg-gray-800 rounded-2xl p-6">
                <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-white">Gestion & Historique</h3></div>
                <div className="border-b border-gray-700 mb-4">
                    <nav className="-mb-px flex gap-6" aria-label="Tabs">
                        {!isAdminView && <button onClick={() => setShowHistory('stock')} className={`${showHistory === 'stock' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>Stock</button>}
                        <button onClick={() => setShowHistory('sales')} className={`${showHistory === 'sales' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>Ventes</button>
                        <button onClick={() => setShowHistory('payouts')} className={`${showHistory === 'payouts' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>Paiements</button>
                    </nav>
                </div>

                {!isAdminView && showHistory === 'stock' && (
                    <div className="animate-fade-in overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-gray-700 text-gray-400 text-sm"><th className="p-3">Produit</th><th className="p-3">Stock</th><th className="p-3">Prix Unitaire</th></tr></thead><tbody>{stock.map(item => (<tr key={item.id} className="border-b border-gray-700/50"><td className="p-3 font-medium">{item.productName}</td><td className={`p-3 font-bold ${item.quantity <= LOW_STOCK_THRESHOLD ? 'text-yellow-400' : ''}`}>{item.quantity}</td><td className="p-3">{formatPrice(item.price)}</td></tr>))}</tbody></table></div>
                )}
                {showHistory === 'sales' && (
                    <div className="animate-fade-in overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-gray-700 text-gray-400 text-sm"><th className="p-3">Date</th><th className="p-3">Produit</th><th className="p-3">Qté</th><th className="p-3">Total</th><th className="p-3">Statut</th></tr></thead><tbody>{salesHistory.map(sale => (<tr key={sale.id} className="border-b border-gray-700/50"><td className="p-3">{formatDate(sale.createdAt)}</td><td className="p-3">{sale.productName}</td><td className="p-3">{sale.quantity}</td><td className="p-3 font-semibold">{formatPrice(sale.totalAmount)}</td><td className="p-3 text-xs">{sale.payoutId ? 'Réglée' : 'En cours'}</td></tr>))}</tbody></table></div>
                )}
                {showHistory === 'payouts' && (
                     <div className="animate-fade-in overflow-x-auto">
                        <table className="w-full text-left">
                            <thead><tr className="border-b border-gray-700 text-gray-400 text-sm"><th className="p-3">Date Clôture</th><th className="p-3">Montant Net</th><th className="p-3">Statut</th><th className="p-3">Action</th></tr></thead>
                            <tbody>
                                {payouts.map(p => (
                                    <tr key={p.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                                        <td className="p-3">{formatDate(p.createdAt)}</td>
                                        <td className="p-3 font-semibold">{formatPrice(p.netAmount)}</td>
                                        <td className="p-3"><span className={`px-2 py-1 text-xs font-bold rounded-full whitespace-nowrap ${PAYOUT_STATUSES[p.status]?.bg} ${PAYOUT_STATUSES[p.status]?.color}`}>{PAYOUT_STATUSES[p.status]?.text || p.status}</span></td>
                                        <td className="p-3">
                                            {isAdminView && p.status !== 'received' && <button onClick={() => handleUpdatePayoutStatus(p)} disabled={isUpdatingPayout === p.id} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1 px-3 rounded-lg flex items-center gap-2 disabled:opacity-50">Étape suivante <ArrowRightCircle size={14}/></button>}
                                            {!isAdminView && <button onClick={() => setPayoutToView(p)} className="text-indigo-400 text-xs font-bold hover:underline">Voir le détail</button>}
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
