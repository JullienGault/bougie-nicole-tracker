// src/views/PosDashboard.jsx
import React, { useState, useEffect, useMemo, useContext } from 'react';
import { db, onSnapshot, doc, collection, query, orderBy, where, updateDoc, serverTimestamp } from '../services/firebase';
import { AppContext } from '../contexts/AppContext';
import { Truck, PlusCircle, Archive, DollarSign, Percent, Package, History, CheckCircle, User, Store, Phone, Mail } from 'lucide-react';
import { LOW_STOCK_THRESHOLD, PAYOUT_STATUSES, DELIVERY_STATUSES } from '../constants';
import { formatPrice, formatDate, formatPercent, formatPhone } from '../utils/formatters';
import KpiCard from '../components/common/KpiCard';
import SaleModal from '../components/pos/SaleModal';
import DeliveryRequestModal from '../components/delivery/DeliveryRequestModal';
import PayoutReconciliationModal from '../components/payout/PayoutReconciliationModal';
import FullScreenDataModal from '../components/common/FullScreenDataModal';
import ContactVerificationModal from '../components/user/ContactVerificationModal';
import DeliveryDetailsModal from '../components/delivery/DeliveryDetailsModal';

const PosDashboard = ({ isAdminView = false, pos }) => {
    const { showToast, loggedInUserData, setShowProfileModal } = useContext(AppContext);
    const currentUserData = isAdminView ? pos : loggedInUserData;
    const posId = currentUserData.uid;

    const [stock, setStock] = useState([]);
    const [salesHistory, setSalesHistory] = useState([]);
    const [posData, setPosData] = useState(null);
    const [payouts, setPayouts] = useState([]);
    const [deliveryHistory, setDeliveryHistory] = useState([]);
    const [activeModal, setActiveModal] = useState(null);
    const [showSaleModal, setShowSaleModal] = useState(false);
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [payoutToView, setPayoutToView] = useState(null);
    const [showContactVerificationModal, setShowContactVerificationModal] = useState(false);
    const [isConfirmingContact, setIsConfirmingContact] = useState(false);
    const [deliveryToView, setDeliveryToView] = useState(null);

    useEffect(() => {
        if (!posId) return;
        const unsubPos = onSnapshot(doc(db, "pointsOfSale", posId), (doc) => { if (doc.exists()) setPosData(doc.data()); });
        const unsubStock = onSnapshot(query(collection(db, `pointsOfSale/${posId}/stock`)), (snapshot) => setStock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), productId: doc.id }))));
        const unsubSales = onSnapshot(query(collection(db, `pointsOfSale/${posId}/sales`), orderBy('createdAt', 'desc')), (snapshot) => setSalesHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const unsubPayouts = onSnapshot(query(collection(db, `pointsOfSale/${posId}/payouts`), orderBy('createdAt', 'desc')), (snapshot) => setPayouts(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubDeliveries = onSnapshot(query(collection(db, "deliveryRequests"), where("posId", "==", posId), orderBy("createdAt", "desc")), (snapshot) => { setDeliveryHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); });
        
        return () => { unsubPos(); unsubStock(); unsubSales(); unsubPayouts(); unsubDeliveries(); };
    }, [posId]);

    useEffect(() => {
        if (loggedInUserData && loggedInUserData.role === 'pos' && !isAdminView) {
            const lastConfirmed = loggedInUserData.contactInfoLastConfirmedAt?.toDate();
            const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
            if (!lastConfirmed || (new Date() - lastConfirmed > thirtyDaysInMs)) {
                setShowContactVerificationModal(true);
            }
        }
    }, [loggedInUserData, isAdminView]);

    const unsettledSales = useMemo(() => salesHistory.filter(s => !s.payoutId), [salesHistory]);

    const { unsettledBalance, totalStock, commissionRate } = useMemo(() => {
        const grossRevenue = unsettledSales.reduce((acc, s) => acc + s.totalAmount, 0);
        const commission = posData?.commissionRate || 0;
        const balance = grossRevenue - (grossRevenue * commission);
        const stockCount = stock.reduce((acc, item) => acc + item.quantity, 0);
        return { unsettledBalance: balance, totalStock: stockCount, commissionRate: commission };
    }, [unsettledSales, stock, posData]);

    const handleConfirmContact = async () => {
        setIsConfirmingContact(true);
        try {
            const userDocRef = doc(db, "users", loggedInUserData.uid);
            await updateDoc(userDocRef, { contactInfoLastConfirmedAt: serverTimestamp() });
            setShowContactVerificationModal(false);
            showToast("Merci d'avoir confirmé vos informations !", "success");
        } catch (error) { showToast("Une erreur est survenue.", "error"); }
        finally { setIsConfirmingContact(false); }
    };

    const handleModifyContact = () => {
        setShowContactVerificationModal(false);
        setShowProfileModal(true);
    };

    const renderModalContent = () => {
        switch (activeModal) {
            case 'stock':
                return (
                    <table className="w-full text-left">
                        <thead><tr className="border-b border-gray-700 text-gray-400 text-sm"><th className="p-3">Produit</th><th className="p-3">Stock</th><th className="p-3">Prix Unitaire</th></tr></thead>
                        <tbody>{stock.map(item => (<tr key={item.id} className="border-b border-gray-700/50"><td className="p-3 font-medium">{item.productName}</td><td className={`p-3 font-bold ${item.quantity <= LOW_STOCK_THRESHOLD ? 'text-yellow-400' : ''}`}>{item.quantity}</td><td className="p-3">{formatPrice(item.price)}</td></tr>))}</tbody>
                    </table>
                );
            case 'sales':
                 return (
                    <div>
                        <div className="grid grid-cols-12 gap-4 px-4 pb-2 border-b border-gray-700 text-xs text-gray-400 font-semibold uppercase">
                            <div className="col-span-4 sm:col-span-3">Date</div>
                            <div className="col-span-8 sm:col-span-4">Produit</div>
                            <div className="hidden sm:block sm:col-span-1 text-center">Qté</div>
                            <div className="hidden sm:block sm:col-span-2 text-right">Total</div>
                            <div className="hidden sm:block sm:col-span-2 text-center">Statut</div>
                        </div>
                        <div className="space-y-2 mt-2">
                            {salesHistory.map(sale => (
                                <div key={sale.id} className="grid grid-cols-12 items-center gap-4 bg-gray-900/50 hover:bg-gray-900 p-4 rounded-lg">
                                    <div className="col-span-12 sm:col-span-3 text-sm text-gray-300">{formatDate(sale.createdAt)}</div>
                                    <div className="col-span-12 sm:col-span-4 font-semibold text-white">{sale.productName}</div>
                                    <div className="col-span-4 sm:col-span-1 text-center text-lg font-bold">{sale.quantity}</div>
                                    <div className="col-span-4 sm:col-span-2 text-right text-lg font-bold text-green-400">{formatPrice(sale.totalAmount)}</div>
                                    <div className="col-span-4 sm:col-span-2 flex justify-center">
                                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${sale.payoutId ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                                            {sale.payoutId ? 'Réglée' : 'En cours'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'payouts':
                return (
                     <table className="w-full text-left">
                        <thead><tr className="border-b border-gray-700 text-gray-400 text-sm"><th className="p-3">Date Clôture</th><th className="p-3">Montant Net</th><th className="p-3">Statut</th><th className="p-3">Action</th></tr></thead>
                        <tbody>
                            {payouts.map(p => (
                                <tr key={p.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                                    <td className="p-3">{formatDate(p.createdAt)}</td>
                                    <td className="p-3 font-semibold">{formatPrice(p.netAmount)}</td>
                                    <td className="p-3"><span className={`px-2 py-1 text-xs font-bold rounded-full whitespace-nowrap ${PAYOUT_STATUSES[p.status]?.bg} ${PAYOUT_STATUSES[p.status]?.color}`}>{PAYOUT_STATUSES[p.status]?.text || p.status}</span></td>
                                    <td className="p-3"><button onClick={() => setPayoutToView(p)} className="text-indigo-400 text-xs font-bold hover:underline">Voir le détail</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                );
            case 'deliveries':
                return (
                    <div className="space-y-3">
                        {deliveryHistory.map(req => {
                            const statusConfig = DELIVERY_STATUSES[req.status] || DELIVERY_STATUSES.default;
                            return (
                                <div key={req.id} className="bg-gray-900/50 p-4 rounded-lg hover:bg-gray-900 cursor-pointer" onClick={() => { setDeliveryToView(req); setActiveModal(null); }}>
                                    <div className="flex justify-between items-center">
                                        <p className="font-bold text-white">Demande du {formatDate(req.createdAt)}</p>
                                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${statusConfig.bg} ${statusConfig.color}`}>
                                            {statusConfig.text}
                                        </span>
                                    </div>
                                    <ul className="mt-2 list-disc list-inside text-gray-300 text-sm">
                                        {req.items.map((item, index) => (
                                            <li key={item.productId + index}>{item.quantity} x {item.productName}</li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        })}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {!isAdminView && showSaleModal && <SaleModal posId={posId} stock={stock} onClose={() => setShowSaleModal(false)} />}
            {!isAdminView && showDeliveryModal && <DeliveryRequestModal posId={posId} posName={posData?.name} onClose={() => setShowDeliveryModal(false)} />}
            {payoutToView && posData && <PayoutReconciliationModal pos={posData} stock={stock} unsettledSales={[]} payoutData={payoutToView} onClose={() => setPayoutToView(null)} isReadOnly={true} />}
            {showContactVerificationModal && loggedInUserData && (<ContactVerificationModal userData={loggedInUserData} onConfirm={handleConfirmContact} onModify={handleModifyContact} isConfirming={isConfirmingContact} />)}
            {deliveryToView && <DeliveryDetailsModal request={deliveryToView} onClose={() => setDeliveryToView(null)} />}
            
            <FullScreenDataModal isOpen={!!activeModal} onClose={() => setActiveModal(null)} title={
                    activeModal === 'stock' ? 'Votre Stock Actuel' :
                    activeModal === 'sales' ? 'Historique des Ventes' :
                    activeModal === 'payouts' ? 'Historique des Paiements' : 'Historique des Livraisons'
                }>
                {renderModalContent()}
            </FullScreenDataModal>
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
                <div><h2 className="text-3xl font-bold text-white">Tableau de Bord</h2><p className="text-gray-400">Bienvenue, {posData?.name || currentUserData.displayName}</p></div>
                <div className="flex gap-4 mt-4 md:mt-0">
                    {!isAdminView && (
                        <>
                            <button onClick={() => setShowDeliveryModal(true)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><Truck size={20} /> Demander une Livraison</button>
                            <button onClick={() => setShowSaleModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><PlusCircle size={20} /> Nouvelle Vente</button>
                        </>
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

            {!isAdminView && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <KpiCard title="Montant à reverser" value={formatPrice(unsettledBalance)} icon={DollarSign} color="bg-green-600" />
                    <KpiCard title="Articles en Stock" value={totalStock} icon={Package} color="bg-blue-600" />
                    <KpiCard title="Taux de Commission" value={formatPercent(commissionRate)} icon={Percent} color="bg-pink-600" />
                </div>
            )}
            
            <div className="bg-gray-800 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-white mb-4">Rapports et Historiques</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                     <button onClick={() => setActiveModal('stock')} className="bg-gray-700 p-4 rounded-lg flex items-center gap-3 hover:bg-gray-600 transition-colors"><Archive size={24} className="text-blue-400" /><span className="font-semibold">Voir le Stock</span></button>
                    <button onClick={() => setActiveModal('sales')} className="bg-gray-700 p-4 rounded-lg flex items-center gap-3 hover:bg-gray-600 transition-colors"><History size={24} className="text-purple-400" /><span className="font-semibold">Historique des Ventes</span></button>
                    <button onClick={() => setActiveModal('payouts')} className="bg-gray-700 p-4 rounded-lg flex items-center gap-3 hover:bg-gray-600 transition-colors"><CheckCircle size={24} className="text-green-400" /><span className="font-semibold">Historique des Paiements</span></button>
                    <button onClick={() => setActiveModal('deliveries')} className="bg-gray-700 p-4 rounded-lg flex items-center gap-3 hover:bg-gray-600 transition-colors"><Truck size={24} className="text-orange-400" /><span className="font-semibold">Historique des Livraisons</span></button>
                </div>
            </div>
        </div>
    );
};
export default PosDashboard;
