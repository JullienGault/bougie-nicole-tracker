// src/views/PosDashboard.jsx
import React, { useState, useEffect, useMemo, useContext } from 'react';
import { db, onSnapshot, doc, collection, query, orderBy, where, updateDoc, arrayUnion, arrayRemove, writeBatch, addDoc, serverTimestamp, deleteDoc } from '../services/firebase';
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

    useEffect(() => { if (!posId) return; onSnapshot(doc(db, "pointsOfSale", posId), (doc) => { if (doc.exists()) setPosData(doc.data()); }); }, [posId]);
    useEffect(() => { if (!posId) return; onSnapshot(query(collection(db, `pointsOfSale/${posId}/stock`)), (snapshot) => setStock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))); }, [posId]);
    useEffect(() => { if (!posId) return; onSnapshot(query(collection(db, `pointsOfSale/${posId}/sales`), orderBy('createdAt', 'desc')), (snapshot) => setSalesHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))); }, [posId]);
    useEffect(() => { if (!posId) return; onSnapshot(query(collection(db, `pointsOfSale/${posId}/payouts`), orderBy('createdAt', 'desc')), (snapshot) => setPayouts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))); }, [posId]);
    useEffect(() => {
        if (!posId || isAdminView) return;
        const q = query(collection(db, `deliveryRequests`), where("posId", "==", posId), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snapshot) => { setDeliveryRequests(snapshot.docs.map(d => ({id: d.id, ...d.data()}))); });
        return () => unsub();
    }, [posId, isAdminView]);

    const handleArchive = async (requestId) => { await updateDoc(doc(db, 'deliveryRequests', requestId), { archivedBy: arrayUnion(posId) }); };
    const handleUnarchive = async (requestId) => { await updateDoc(doc(db, 'deliveryRequests', requestId), { archivedBy: arrayRemove(posId) }); };
    
    const handleClientCancel = async () => {
        if (!requestToCancel) return;
        try {
            await updateDoc(doc(db, 'deliveryRequests', requestToCancel.id), { status: 'cancelled', cancellationReason: 'Annulée par le client' });
            await addDoc(collection(db, 'notifications'), {
                recipientUid: 'all_admins', message: `La commande de ${posData.name} a été annulée.`,
                createdAt: serverTimestamp(), isRead: false, type: 'DELIVERY_CANCELLED'
            });
            showToast("Commande annulée", "success");
            setRequestToCancel(null);
        } catch(e) { showToast("Erreur lors de l'annulation", "error"); }
    };
    
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
        return { totalStock, totalRevenue, netToBePaid: totalRevenue - (totalRevenue * (posData?.commissionRate || 0)) };
    }, [stock, unsettledSales, posData]);

    const salesStats = useMemo(() => {
        if (salesHistory.length === 0) return [];
        const productSales = salesHistory.reduce((acc, sale) => { const key = sale.productName; acc[key] = (acc[key] || 0) + sale.quantity; return acc; }, {});
        return Object.entries(productSales).sort(([,a],[,b]) => b-a).slice(0, 3);
    }, [salesHistory]);

    const handleDeleteSale = async (reason) => {
        if (!saleToDelete) return;
        const sale = saleToDelete;
        setSaleToDelete(null);
        if(sale.payoutId) { showToast("Impossible d'annuler une vente déjà réglée.", "error"); return; }
        
        const stockId = sale.productId;
        const stockDocRef = doc(db, `pointsOfSale/${posId}/stock`, stockId);
        const saleDocRef = doc(db, `pointsOfSale/${posId}/sales`, sale.id);
        
        try {
            const batch = writeBatch(db);
            const currentStockItem = stock.find(item => item.id === stockId);
            const newQuantity = (currentStockItem?.quantity || 0) + sale.quantity;
            
            if (currentStockItem) { batch.update(stockDocRef, { quantity: newQuantity }); }
            else { batch.set(stockDocRef, { productId: sale.productId, productName: sale.productName, scent: null, quantity: sale.quantity, price: sale.unitPrice }); }
            
            batch.delete(saleDocRef);
            await batch.commit();
            showToast("Vente annulée et stock restauré.", "success");
        } catch (error) { showToast("Erreur lors de l'annulation de la vente.", "error"); }
    };
    
    // Reste des Handlers... (CreatePayout, UpdatePayoutStatus...)

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {showSaleModal && <SaleModal posId={posId} stock={stock} onClose={() => setShowSaleModal(false)} />}
            {showDeliveryModal && <DeliveryRequestModal posId={posId} posName={posData?.name} onClose={() => setShowDeliveryModal(false)} />}
            {saleToDelete && <ConfirmationModal title="Confirmer l'annulation" message={`Annuler la vente de ${saleToDelete.quantity} x ${saleToDelete.productName}? Le stock sera restauré.`} onConfirm={handleDeleteSale} onCancel={() => setSaleToDelete(null)} confirmText="Annuler la Vente" requiresReason={true} />}
            {requestToCancel && <ConfirmationModal title="Annuler la Commande" message="Êtes-vous sûr de vouloir annuler cette commande ?" onConfirm={handleClientCancel} onCancel={() => setRequestToCancel(null)} confirmText="Oui, Annuler"/>}
            {showInfoModal && <InfoModal title="Annulation Impossible" message="Contactez l'administrateur." onClose={() => setShowInfoModal(false)} />}
            {payoutToConfirm && <ConfirmationModal title="Clôturer la Période" message={`Clôturer avec un montant net de ${formatPrice(kpis.netToBePaid)} ?`} onConfirm={() => {}} onCancel={() => setPayoutToConfirm(null)} confirmText="Oui, Clôturer" confirmColor="bg-blue-600 hover:bg-blue-700" />}
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
                <div><h2 className="text-3xl font-bold text-white">Tableau de Bord</h2><p className="text-gray-400">Bienvenue, {posData?.name || currentUserData.displayName}</p></div>
                <div className="flex gap-4 mt-4 md:mt-0">
                    {!isAdminView && <>
                        <button onClick={() => setShowDeliveryModal(true)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><Truck size={20} /> Demander une Livraison</button>
                        <button onClick={() => setShowSaleModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><PlusCircle size={20} /> Nouvelle Vente</button>
                    </>}
                    {isAdminView && <button onClick={() => setPayoutToConfirm(true)} disabled={kpis.netToBePaid <= 0} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50"><CircleDollarSign size={20} /> Clôturer la période</button>}
                </div>
            </div>

            {isAdminView && currentUserData && (
                <div className="bg-gray-800 rounded-2xl p-6 mb-8">
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
                 <KpiCard title="CA Brut (période)" value={formatPrice(kpis.totalRevenue)} icon={DollarSign} color="bg-green-600" />
                 <KpiCard title="Votre Commission" value={formatPercent(posData?.commissionRate)} icon={Percent} color="bg-purple-600" />
                 <KpiCard title="Net à reverser" value={formatPrice(kpis.netToBePaid)} icon={Coins} color="bg-pink-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mt-8">
                <div className="lg:col-span-2 bg-gray-800 rounded-2xl p-6 flex flex-col">
                    <h3 className="text-xl font-bold text-white mb-4">Suivi des Livraisons</h3>
                    <div className="border-b border-gray-700 mb-4">
                        <nav className="-mb-px flex gap-6" aria-label="Tabs">
                            <button onClick={() => setDeliveryTab('actives')} className={`${deliveryTab === 'actives' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>Actives</button>
                            <button onClick={() => setDeliveryTab('archived')} className={`${deliveryTab === 'archived' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>Archives</button>
                        </nav>
                    </div>
                    <div className="flex-grow">
                        {deliveriesToDisplay.length > 0 ? (
                            <div className="space-y-4">
                                {deliveriesToDisplay.map(req => {
                                    const isExpanded = expandedRequestId === req.id;
                                    const isArchivable = (req.status === 'delivered' || req.status === 'cancelled');
                                    const isCancellable = req.status === 'pending';
                                    return (
                                        <div key={req.id} className="bg-gray-900/50 rounded-lg">
                                            <div className='flex'>
                                                <button onClick={() => toggleExpand(req.id)} className="flex-grow w-full p-4 flex justify-between items-center text-left">
                                                    <div>
                                                        <p className="font-bold">Demande du {formatDate(req.createdAt)}</p>
                                                        <p className="text-sm text-gray-400">{DELIVERY_STATUS_STEPS[req.status]}</p>
                                                    </div>
                                                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                </button>
                                                {deliveryTab === 'actives' && isArchivable && <button onClick={() => handleArchive(req.id)} title="Archiver"><ArchiveRestore size={18}/></button>}
                                                {deliveryTab === 'archived' && <button onClick={() => handleUnarchive(req.id)} title="Désarchiver"><ArchiveRestore size={18}/></button>}
                                            </div>
                                            {isExpanded && (
                                                <div className="p-4 border-t border-gray-700">
                                                    {/* Expanded content here */}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : <p className="text-center text-gray-400 pt-8">Aucune demande.</p>}
                    </div>
                </div>

                <div className="lg:col-span-3 bg-gray-800 rounded-2xl p-6">
                    <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-white">Gestion & Historique</h3></div>
                    <div className="border-b border-gray-700 mb-4">
                        <nav className="-mb-px flex gap-6" aria-label="Tabs">
                            <button onClick={() => setShowHistory('stock')} className={`${showHistory === 'stock' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>Stock</button>
                            <button onClick={() => setShowHistory('sales')} className={`${showHistory === 'sales' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>Ventes</button>
                            <button onClick={() => setShowHistory('payouts')} className={`${showHistory === 'payouts' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>Paiements</button>
                        </nav>
                    </div>

                    {showHistory === 'stock' && (
                        <div className="animate-fade-in overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-gray-700 text-gray-400 text-sm"><th className="p-3">Produit</th><th className="p-3">Stock</th><th className="p-3">Prix Unitaire</th></tr></thead><tbody>{stock.map(item => (<tr key={item.id} className="border-b border-gray-700/50"><td className="p-3 font-medium">{item.productName}</td><td className={`p-3 font-bold ${item.quantity <= LOW_STOCK_THRESHOLD ? 'text-yellow-400' : ''}`}>{item.quantity}</td><td className="p-3">{formatPrice(item.price)}</td></tr>))}</tbody></table></div>
                    )}
                    {showHistory === 'sales' && (
                        <div className="animate-fade-in overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-gray-700 text-gray-400 text-sm"><th className="p-3">Date</th><th className="p-3">Produit</th><th className="p-3">Qté</th><th className="p-3">Total</th><th className="p-3">Statut</th><th className="p-3">Actions</th></tr></thead><tbody>{salesHistory.map(sale => (<tr key={sale.id} className="border-b border-gray-700/50"><td className="p-3">{formatDate(sale.createdAt)}</td><td className="p-3">{sale.productName}</td><td className="p-3">{sale.quantity}</td><td className="p-3 font-semibold">{formatPrice(sale.totalAmount)}</td><td className="p-3 text-xs">{sale.payoutId ? 'Réglée' : 'En cours'}</td><td className="p-3">{!sale.payoutId && <button onClick={() => setSaleToDelete(sale)} className="text-red-500"><Trash2 size={18}/></button>}</td></tr>))}</tbody></table></div>
                    )}
                    {showHistory === 'payouts' && ( <div className="animate-fade-in overflow-x-auto"> ... </div> )}
                </div>
            </div>
             <div className="bg-gray-800 rounded-2xl p-6 mt-8">
                <h3 className="text-xl font-bold mb-4">Vos meilleures ventes (toutes périodes)</h3>
                {salesStats.length > 0 ? <ul>{salesStats.map(([name, qty])=><li key={name} className="flex justify-between py-1 border-b border-gray-700"><span>{name}</span><strong>{qty}</strong></li>)}</ul> : <p className="text-gray-400">Aucune vente enregistrée.</p>}
            </div>
        </div>
    );
};
export default PosDashboard;
