// src/views/PosDashboard.jsx
import React, { useState, useEffect, useMemo, useContext } from 'react';
import { db, onSnapshot, doc, collection, query, orderBy, where, updateDoc, serverTimestamp, arrayUnion } from '../services/firebase';
import { AppContext } from '../contexts/AppContext';
import { Truck, PlusCircle, Archive, DollarSign, Percent, Package, History, CheckCircle, User, Store, Phone, Mail, ChevronDown } from 'lucide-react';
import { LOW_STOCK_THRESHOLD, PAYOUT_STATUSES, DELIVERY_STATUSES } from '../constants';
import { formatPrice, formatDate, formatPercent, formatPhone } from '../utils/formatters';
import KpiCard from '../components/common/KpiCard';
import SaleModal from '../components/pos/SaleModal';
import DeliveryRequestModal from '../components/delivery/DeliveryRequestModal';
import PayoutReconciliationModal from '../components/payout/PayoutReconciliationModal';
import ConfirmationModal from '../components/common/ConfirmationModal';
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
    const [deliveryToArchive, setDeliveryToArchive] = useState(null);

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

    const handleArchiveDelivery = async () => {
        if (!deliveryToArchive || !posId) return;
        try {
            const deliveryDocRef = doc(db, "deliveryRequests", deliveryToArchive.id);
            await updateDoc(deliveryDocRef, {
                archivedBy: arrayUnion(posId)
            });
            showToast("Demande archivée.", "success");
        } catch (error) {
            console.error("Erreur d'archivage:", error);
            showToast("Erreur lors de l'archivage.", "error");
        } finally {
            setDeliveryToArchive(null);
        }
    };

    const unsettledSales = useMemo(() => salesHistory.filter(s => !s.payoutId), [salesHistory]);

    const { unsettledBalance, totalStock, commissionRate } = useMemo(() => {
        const grossRevenue = unsettledSales.reduce((acc, s) => acc + s.totalAmount, 0);
        const commission = posData?.commissionRate || 0;
        const balance = grossRevenue - (grossRevenue * commission);
        const stockCount = stock.reduce((acc, item) => acc + item.quantity, 0);
        return { 
            unsettledBalance: balance, 
            totalStock: stockCount, 
            commissionRate: commission,
        };
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

    const DeliveriesSection = () => {
        const [expandedCardId, setExpandedCardId] = useState(null);
        const [deliveryFilter, setDeliveryFilter] = useState('active');

        const filteredDeliveries = deliveryHistory.filter(req => {
            const hasBeenArchivedByPos = req.archivedBy && req.archivedBy.includes(posId);
            if (deliveryFilter === 'active') return !hasBeenArchivedByPos;
            if (deliveryFilter === 'archived') return hasBeenArchivedByPos;
            return true;
        });

        const toggleCard = (id) => {
            setExpandedCardId(expandedCardId === id ? null : id);
        };

        return (
            <div className="bg-gray-800 rounded-2xl p-6 mb-8 animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">Suivi des Livraisons</h3>
                     <div className="flex gap-2 p-1 bg-gray-900 rounded-lg">
                        <button onClick={() => setDeliveryFilter('active')} className={`px-4 py-1.5 rounded-md text-sm font-semibold ${deliveryFilter === 'active' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>En cours</button>
                        <button onClick={() => setDeliveryFilter('archived')} className={`px-4 py-1.5 rounded-md text-sm font-semibold ${deliveryFilter === 'archived' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>Archivées</button>
                    </div>
                </div>

                 {filteredDeliveries.length > 0 ? (
                    <div className="space-y-4">
                        {filteredDeliveries.map(req => {
                            const statusConfig = DELIVERY_STATUSES[req.status] || DELIVERY_STATUSES.default;
                            const Icon = statusConfig.icon;
                            const isArchivable = req.status === 'delivered' || req.status === 'cancelled';
                            const isExpanded = expandedCardId === req.id;
                            
                            return (
                                <div key={req.id} className="bg-gray-900/70 rounded-2xl shadow-lg border border-gray-700/50">
                                    <div className="p-5 flex justify-between items-center cursor-pointer" onClick={() => toggleCard(req.id)}>
                                        <div>
                                            <h4 className="font-bold text-lg text-white">Demande du {formatDate(req.createdAt)}</h4>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={`flex items-center gap-2 px-2.5 py-1 text-xs font-bold rounded-full ${statusConfig.bg} ${statusConfig.color}`}>
                                                <Icon size={14} />
                                                <span>{statusConfig.text}</span>
                                            </span>
                                            <ChevronDown className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                    </div>
                                    
                                    {isExpanded && (
                                        <div className="animate-fade-in border-t border-gray-700/50">
                                            <div className="p-5">
                                                <DeliveryDetailsModal request={req} />
                                            </div>
                                            {isArchivable && deliveryFilter === 'active' && (
                                                <div className="p-4 bg-gray-800/50 rounded-b-2xl flex justify-end">
                                                    <button onClick={(e) => { e.stopPropagation(); setDeliveryToArchive(req); }} className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2">
                                                        <Archive size={16} /> Archiver
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-center text-gray-400 py-8">
                        {deliveryFilter === 'active' ? 'Aucune livraison en cours.' : 'Aucune livraison archivée.'}
                    </p>
                )}
            </div>
        );
    };

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {!isAdminView && showSaleModal && <SaleModal posId={posId} stock={stock} onClose={() => setShowSaleModal(false)} />}
            {!isAdminView && showDeliveryModal && <DeliveryRequestModal posId={posId} posName={posData?.name} onClose={() => setShowDeliveryModal(false)} />}
            {payoutToView && posData && <PayoutReconciliationModal pos={posData} stock={stock} unsettledSales={[]} payoutData={payoutToView} onClose={() => setPayoutToView(null)} isReadOnly={true} />}
            {showContactVerificationModal && loggedInUserData && (<ContactVerificationModal userData={loggedInUserData} onConfirm={handleConfirmContact} onModify={handleModifyContact} isConfirming={isConfirmingContact} />)}
            {deliveryToArchive && <ConfirmationModal title="Confirmer l'archivage" message="Voulez-vous vraiment archiver cette demande ?" onConfirm={handleArchiveDelivery} onCancel={() => setDeliveryToArchive(null)} confirmText="Oui, archiver" confirmColor="bg-yellow-600 hover:bg-yellow-700" />}
            
            <FullScreenDataModal isOpen={!!activeModal} onClose={() => setActiveModal(null)} title={
                    activeModal === 'stock' ? 'Votre Stock Actuel' :
                    activeModal === 'sales' ? 'Historique des Ventes' :
                    activeModal === 'payouts' ? 'Historique des Paiements' : ''
                }>
                 {/* Le contenu de la modale est maintenant géré directement dans le JSX principal si besoin */}
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

            {!isAdminView && <DeliveriesSection />}
            
            <div className="bg-gray-800 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-white mb-4">Rapports et Historiques</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <button onClick={() => setActiveModal('stock')} className="bg-gray-700 p-4 rounded-lg flex items-center gap-3 hover:bg-gray-600 transition-colors"><Archive size={24} className="text-blue-400" /><span className="font-semibold">Voir le Stock</span></button>
                    <button onClick={() => setActiveModal('sales')} className="bg-gray-700 p-4 rounded-lg flex items-center gap-3 hover:bg-gray-600 transition-colors"><History size={24} className="text-purple-400" /><span className="font-semibold">Historique des Ventes</span></button>
                    <button onClick={() => setActiveModal('payouts')} className="bg-gray-700 p-4 rounded-lg flex items-center gap-3 hover:bg-gray-600 transition-colors"><CheckCircle size={24} className="text-green-400" /><span className="font-semibold">Historique des Paiements</span></button>
                </div>
            </div>
        </div>
    );
};
export default PosDashboard;
