import React, { useState, useEffect, useMemo, useContext } from 'react';
import { db, onSnapshot, doc, collection, query, orderBy, updateDoc, serverTimestamp } from '../services/firebase';
import { AppContext } from '../contexts/AppContext';
import { Truck, PlusCircle, CircleDollarSign, Archive, DollarSign, Percent, Package, History, CheckCircle, User, Store, Phone, Mail, ShoppingBag, Calendar } from 'lucide-react';
import { LOW_STOCK_THRESHOLD, PAYOUT_STATUSES } from '../constants';
import { formatPrice, formatDate, formatPercent, formatPhone } from '../utils/formatters';
import KpiCard from '../components/common/KpiCard';
import SaleModal from '../components/pos/SaleModal';
import DeliveryRequestModal from '../components/delivery/DeliveryRequestModal';
import PayoutReconciliationModal from '../components/payout/PayoutReconciliationModal';
import FullScreenDataModal from '../components/common/FullScreenDataModal';
import ContactVerificationModal from '../components/user/ContactVerificationModal';

const PosDashboard = ({ isAdminView = false, pos }) => {
    const { showToast, loggedInUserData, setShowProfileModal } = useContext(AppContext);
    const currentUserData = isAdminView ? pos : loggedInUserData;
    const posId = currentUserData.uid;

    const [stock, setStock] = useState([]);
    const [salesHistory, setSalesHistory] = useState([]);
    const [posData, setPosData] = useState(null);
    const [payouts, setPayouts] = useState([]);
    const [activeModal, setActiveModal] = useState(null);
    const [showSaleModal, setShowSaleModal] = useState(false);
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [payoutToView, setPayoutToView] = useState(null);
    const [showContactVerificationModal, setShowContactVerificationModal] = useState(false);
    const [isConfirmingContact, setIsConfirmingContact] = useState(false);

    useEffect(() => { if (!posId) return; const unsub = onSnapshot(doc(db, "pointsOfSale", posId), (doc) => { if (doc.exists()) setPosData(doc.data()); }); return unsub; }, [posId]);
    useEffect(() => { if (!posId) return; const unsub = onSnapshot(query(collection(db, `pointsOfSale/${posId}/stock`)), (snapshot) => setStock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), productId: doc.id })))); return unsub; }, [posId]);
    useEffect(() => { if (!posId) return; const unsub = onSnapshot(query(collection(db, `pointsOfSale/${posId}/sales`), orderBy('createdAt', 'desc')), (snapshot) => setSalesHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))); return unsub; }, [posId]);
    useEffect(() => { if (!posId) return; const unsub = onSnapshot(query(collection(db, `pointsOfSale/${posId}/payouts`), orderBy('createdAt', 'desc')), (snapshot) => setPayouts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))); return unsub; }, [posId]);

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
        return {
            unsettledBalance: balance,
            totalStock: stockCount,
            commissionRate: commission
        };
    }, [unsettledSales, stock, posData]);

    const handleConfirmContact = async () => {
        setIsConfirmingContact(true);
        try {
            const userDocRef = doc(db, "users", loggedInUserData.uid);
            await updateDoc(userDocRef, { contactInfoLastConfirmedAt: serverTimestamp() });
            setShowContactVerificationModal(false);
            showToast("Merci d'avoir confirmé vos informations !", "success");
        } catch (error) {
            showToast("Une erreur est survenue.", "error");
        } finally {
            setIsConfirmingContact(false);
        }
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
                    <div className="space-y-4">
                        {salesHistory.map(sale => (
                            <div key={sale.id} className="bg-gray-900/50 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                <div className="flex-grow">
                                    <div className="flex items-center gap-3 mb-2">
                                        <ShoppingBag className="text-indigo-400" size={20} />
                                        <h4 className="font-bold text-lg text-white">{sale.productName}</h4>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-400">
                                        <Calendar size={14} />
                                        <span>{formatDate(sale.createdAt)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6 text-center w-full sm:w-auto">
                                    <div className="flex-1">
                                        <p className="text-xs text-gray-400 uppercase font-semibold">Quantité</p>
                                        <p className="text-lg font-bold">{sale.quantity}</p>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs text-gray-400 uppercase font-semibold">Total</p>
                                        <p className="text-lg font-bold text-green-400">{formatPrice(sale.totalAmount)}</p>
                                    </div>
                                </div>
                                <div className="w-full sm:w-auto text-center sm:text-right mt-2 sm:mt-0">
                                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                                        sale.payoutId 
                                        ? 'bg-green-500/10 text-green-400' 
                                        : 'bg-yellow-500/10 text-yellow-400'
                                    }`}>
                                        {sale.payoutId ? 'Réglée' : 'En cours'}
                                    </span>
                                </div>
                            </div>
                        ))}
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
                                    <td className="p-3">
                                        <button onClick={() => setPayoutToView(p)} className="text-indigo-400 text-xs font-bold hover:underline">Voir le détail</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
            {showContactVerificationModal && loggedInUserData && (
                <ContactVerificationModal 
                    userData={loggedInUserData} 
                    onConfirm={handleConfirmContact} 
                    onModify={handleModifyContact}
                    isConfirming={isConfirmingContact} 
                />
            )}
            
            <FullScreenDataModal
                isOpen={!!activeModal}
                onClose={() => setActiveModal(null)}
                title={
                    activeModal === 'stock' ? 'Votre Stock Actuel' :
                    activeModal === 'sales' ? 'Historique des Ventes' :
                    'Historique des Paiements'
                }
            >
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <button onClick={() => setActiveModal('stock')} className="bg-gray-700 p-4 rounded-lg flex items-center gap-3 hover:bg-gray-600 transition-colors">
                            <Archive size={24} className="text-blue-400" />
                            <span className="font-semibold">Voir le Stock</span>
                        </button>
                    <button onClick={() => setActiveModal('sales')} className="bg-gray-700 p-4 rounded-lg flex items-center gap-3 hover:bg-gray-600 transition-colors">
                        <History size={24} className="text-purple-400" />
                        <span className="font-semibold">Historique des Ventes</span>
                    </button>
                    <button onClick={() => setActiveModal('payouts')} className="bg-gray-700 p-4 rounded-lg flex items-center gap-3 hover:bg-gray-600 transition-colors">
                        <CheckCircle size={24} className="text-green-400" />
                        <span className="font-semibold">Historique des Paiements</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
export default PosDashboard;
