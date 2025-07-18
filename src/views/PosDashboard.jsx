// src/views/PosDashboard.jsx
import React, { useState, useEffect, useMemo, useContext, useCallback } from 'react';
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


// --- DÉFINITION DES COMPOSANTS DE CONTENU DES MODALES ---

const StockModalContent = ({ stockItems }) => (
    <div className="space-y-2">
        <div className="grid grid-cols-4 gap-4 px-4 pb-2 border-b border-gray-700 text-xs text-gray-400 font-semibold uppercase">
            <div className="col-span-2">Produit</div>
            <div className="text-center">Stock Actuel</div>
            <div className="text-center">Statut</div>
        </div>
        {stockItems.length > 0 ? stockItems.map(item => (
            <div key={item.id} className="grid grid-cols-4 items-center gap-4 bg-gray-900/50 hover:bg-gray-900 p-4 rounded-lg">
                <div className="col-span-2 font-semibold text-white">{item.productName}</div>
                <div className="text-center text-2xl font-bold">{item.quantity}</div>
                <div className="flex justify-center">
                    {item.quantity <= LOW_STOCK_THRESHOLD ? 
                        <span className="px-3 py-1 text-xs font-bold rounded-full bg-red-500/10 text-red-400">Stock Bas</span> : 
                        <span className="px-3 py-1 text-xs font-bold rounded-full bg-green-500/10 text-green-400">En Stock</span>}
                </div>
            </div>
        )) : <p className="text-center py-16 text-gray-400">Aucun article en stock.</p>}
    </div>
);

const SalesHistoryModalContent = ({ salesHistoryItems }) => {
    const [salesFilter, setSalesFilter] = useState('active');

    const filteredSales = useMemo(() => {
        if (salesFilter === 'archived') return salesHistoryItems.filter(sale => sale.payoutId);
        return salesHistoryItems.filter(sale => !sale.payoutId);
    }, [salesHistoryItems, salesFilter]);

    return (
        <div>
            <div className="flex justify-end mb-4">
                <div className="flex gap-2 p-1 bg-gray-900 rounded-lg">
                    <button onClick={() => setSalesFilter('active')} className={`px-4 py-1.5 rounded-md text-sm font-semibold ${salesFilter === 'active' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>En cours</button>
                    <button onClick={() => setSalesFilter('archived')} className={`px-4 py-1.5 rounded-md text-sm font-semibold ${salesFilter === 'archived' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>Réglées (Archivées)</button>
                </div>
            </div>
            <div className="grid grid-cols-12 gap-4 px-4 pb-2 border-b border-gray-700 text-xs text-gray-400 font-semibold uppercase">
                <div className="col-span-4 sm:col-span-3">Date</div>
                <div className="col-span-8 sm:col-span-4">Produit</div>
                <div className="hidden sm:block sm:col-span-1 text-center">Qté</div>
                <div className="hidden sm:block sm:col-span-2 text-right">Total</div>
                <div className="hidden sm:block sm:col-span-2 text-center">Statut</div>
            </div>
            <div className="space-y-2 mt-2">
                {filteredSales.length > 0 ? filteredSales.map(sale => (
                    <div key={sale.id} className="grid grid-cols-12 items-center gap-4 bg-gray-900/50 hover:bg-gray-900 p-4 rounded-lg">
                        <div className="col-span-12 sm:col-span-3 text-sm text-gray-300">{formatDate(sale.createdAt)}</div>
                        <div className="col-span-12 sm:col-span-4 font-semibold text-white">{sale.productName}</div>
                        <div className="col-span-4 sm:col-span-1 text-center text-lg font-bold">{sale.quantity}</div>
                        <div className="col-span-4 sm:col-span-2 text-right text-lg font-bold text-green-400">{formatPrice(sale.totalAmount)}</div>
                        <div className="col-span-4 sm:col-span-2 flex justify-center"><span className={`px-3 py-1 text-xs font-bold rounded-full ${sale.payoutId ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>{sale.payoutId ? 'Réglée' : 'En cours'}</span></div>
                    </div>
                )) : (
                    <p className="text-center py-16 text-gray-400">Aucune vente ne correspond à ce filtre.</p>
                )}
            </div>
        </div>
    );
};
    
const PayoutsHistoryModalContent = ({ payoutItems, onShowDetail }) => (
     <div className="space-y-3">
        {payoutItems.length > 0 ? payoutItems.map(payout => {
            return (
                <div key={payout.id} className="bg-gray-900/50 hover:bg-gray-900 p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <p className="text-lg font-bold text-white">Paiement du {formatDate(payout.createdAt)}</p>
                        {payout.period && (
                            <p className="text-sm text-gray-400">
                                Période du {formatDate(payout.period.start)} au {formatDate(payout.period.end)}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <p className="text-xs text-gray-400">Montant Net Reversé</p>
                            <p className="text-2xl font-bold text-green-400">{formatPrice(payout.netAmount)}</p>
                        </div>
                        <button onClick={() => onShowDetail(payout)} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg text-sm hover:bg-indigo-700">Voir Détail</button>
                    </div>
                </div>
            )
        }) : <p className="text-center py-16 text-gray-400">Aucun historique de paiement pour le moment.</p>}
    </div>
);

const DeliveriesSection = React.memo(({ deliveryHistory, posId, onArchiveRequest, isAdminView }) => {
    const [expandedCardId, setExpandedCardId] = useState(null);
    const [deliveryFilter, setDeliveryFilter] = useState('active');

    const filteredDeliveries = useMemo(() => deliveryHistory.filter(req => {
        const hasBeenArchivedByPos = req.archivedBy && req.archivedBy.includes(posId);
        if (deliveryFilter === 'active') return !hasBeenArchivedByPos;
        if (deliveryFilter === 'archived') return hasBeenArchivedByPos;
        return true;
    }), [deliveryHistory, deliveryFilter, posId]);

    const toggleCard = (id) => {
        setExpandedCardId(expandedCardId === id ? null : id);
    };

    return (
        <div className="bg-gray-800 rounded-2xl p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Suivi des Livraisons</h3>
                 <div className="flex gap-2 p-1 bg-gray-900 rounded-lg">
                    <button onClick={() => setDeliveryFilter('active')} className={`px-4 py-1.5 rounded-md text-sm font-semibold ${deliveryFilter === 'active' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>En cours</button>
                    <button onClick={() => setDeliveryFilter('archived')} className={`px-4 py-1.5 rounded-md text-sm font-semibold ${deliveryFilter === 'archived' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>Archivées</button>
                </div>
            </div>

             {filteredDeliveries.length > 0 ? (
                <div className="space-y-4 flex-1">
                    {filteredDeliveries.map(req => {
                        const statusConfig = DELIVERY_STATUSES[req.status] || DELIVERY_STATUSES.default;
                        const Icon = statusConfig.icon;
                        const isArchivable = req.status === 'delivered' || req.status === 'cancelled';
                        const isExpanded = expandedCardId === req.id;
                        
                        return (
                            <div key={req.id} className="bg-gray-900/70 rounded-2xl shadow-lg border border-gray-700/50">
                                <div className="p-5 flex justify-between items-center cursor-pointer" onClick={() => toggleCard(req.id)}>
                                    <div><h4 className="font-bold text-lg text-white">Demande du {formatDate(req.createdAt)}</h4></div>
                                    <div className="flex items-center gap-4">
                                        <span className={`flex items-center gap-2 px-2.5 py-1 text-xs font-bold rounded-full ${statusConfig.bg} ${statusConfig.color}`}><Icon size={14} /><span>{statusConfig.text}</span></span>
                                        <ChevronDown className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    </div>
                                </div>
                                
                                {isExpanded && (
                                    <div className="animate-fade-in border-t border-gray-700/50">
                                        <div className="p-5"><DeliveryDetailsModal request={req} /></div>
                                        {isArchivable && deliveryFilter === 'active' && !isAdminView && (
                                            <div className="p-4 bg-gray-800/50 rounded-b-2xl flex justify-end">
                                                <button onClick={(e) => { e.stopPropagation(); onArchiveRequest(req); }} className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><Archive size={16} /> Archiver</button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-center text-gray-400 py-8">Aucune livraison à afficher.</p>
                </div>
            )}
        </div>
    );
});


// --- COMPOSANT PRINCIPAL ---

const PosDashboard = ({ isAdminView = false, pos }) => {
    const { showToast, loggedInUserData, setShowProfileModal, setViewChangeHandler } = useContext(AppContext);
    const currentUserData = isAdminView ? pos : loggedInUserData;
    const posId = currentUserData.uid;

    const [stock, setStock] = useState([]);
    const [salesHistory, setSalesHistory] = useState([]);
    const [posData, setPosData] = useState(null);
    const [payouts, setPayouts] = useState([]);
    const [deliveryHistory, setDeliveryHistory] = useState([]);
    const [payoutToView, setPayoutToView] = useState(null);
    const [showContactVerificationModal, setShowContactVerificationModal] = useState(false);
    const [isConfirmingContact, setIsConfirmingContact] = useState(false);
    const [deliveryToArchive, setDeliveryToArchive] = useState(null);
    
    const [showSaleModal, setShowSaleModal] = useState(false);
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [showStockModal, setShowStockModal] = useState(false);
    const [showSalesHistoryModal, setShowSalesHistoryModal] = useState(false);
    const [showPayoutsHistoryModal, setShowPayoutsHistoryModal] = useState(false);

    const handlePosViewChange = useCallback((action) => {
        switch(action) {
            case 'VIEW_STOCK':
                setShowStockModal(true);
                break;
            case 'VIEW_PROFILE':
                setShowProfileModal(true);
                break;
            case 'VIEW_DELIVERIES':
                const deliveriesElement = document.getElementById('deliveries-section');
                if (deliveriesElement) {
                    deliveriesElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                break;
            default:
                break;
        }
    }, [setShowProfileModal]);

    useEffect(() => {
        if (!isAdminView && setViewChangeHandler) {
            setViewChangeHandler(() => handlePosViewChange);
        }
        return () => {
            if (!isAdminView && setViewChangeHandler) {
                setViewChangeHandler(null);
            }
        };
    }, [isAdminView, setViewChangeHandler, handlePosViewChange]);

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
            await updateDoc(deliveryDocRef, { archivedBy: arrayUnion(posId) });
            showToast("Demande archivée.", "success");
        } catch (error) { showToast("Erreur lors de l'archivage.", "error"); }
        finally { setDeliveryToArchive(null); }
    };
    
    const { unsettledBalance, totalStock, commissionRate } = useMemo(() => {
        const grossRevenue = salesHistory.filter(s => !s.payoutId).reduce((acc, s) => acc + s.totalAmount, 0);
        const commission = posData?.commissionRate || 0;
        const balance = grossRevenue - (grossRevenue * commission);
        const stockCount = stock.reduce((acc, item) => acc + item.quantity, 0);
        return { unsettledBalance: balance, totalStock: stockCount, commissionRate: commission };
    }, [salesHistory, stock, posData]);

    const handleConfirmContact = async () => {
        setIsConfirmingContact(true);
        try {
            const userDocRef = doc(db, "users", loggedInUserData.uid);
            await updateDoc(userDocRef, { contactInfoLastConfirmedAt: serverTimestamp() });
            showToast("Merci d'avoir confirmé vos informations !", "success");
            setShowContactVerificationModal(false);
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

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {/* --- Modales --- */}
            {!isAdminView && showSaleModal && <SaleModal posId={posId} stock={stock} onClose={() => setShowSaleModal(false)} />}
            {!isAdminView && showDeliveryModal && <DeliveryRequestModal posId={posId} posName={posData?.name} onClose={() => setShowDeliveryModal(false)} />}
            {payoutToView && posData && <PayoutReconciliationModal pos={posData} stock={stock} unsettledSales={[]} payoutData={payoutToView} onClose={() => setPayoutToView(null)} isReadOnly={true} />}
            {showContactVerificationModal && loggedInUserData && (<ContactVerificationModal userData={loggedInUserData} onConfirm={handleConfirmContact} onModify={handleModifyContact} isConfirming={isConfirmingContact} />)}
            {deliveryToArchive && <ConfirmationModal title="Confirmer l'archivage" message="Voulez-vous vraiment archiver cette demande ?" onConfirm={handleArchiveDelivery} onCancel={() => setDeliveryToArchive(null)} confirmText="Oui, archiver" confirmColor="bg-yellow-600 hover:bg-yellow-700" />}
            
            {showStockModal && <FullScreenDataModal isOpen={showStockModal} onClose={() => setShowStockModal(false)} title="Votre Stock Actuel"><StockModalContent stockItems={stock} /></FullScreenDataModal>}
            {showSalesHistoryModal && <FullScreenDataModal isOpen={showSalesHistoryModal} onClose={() => setShowSalesHistoryModal(false)} title="Historique des Ventes"><SalesHistoryModalContent salesHistoryItems={salesHistory} /></FullScreenDataModal>}
            {showPayoutsHistoryModal && <FullScreenDataModal isOpen={showPayoutsHistoryModal} onClose={() => setShowPayoutsHistoryModal(false)} title="Historique des Paiements"><PayoutsHistoryModalContent payoutItems={payouts} onShowDetail={setPayoutToView} /></FullScreenDataModal>}
            
            {/* --- En-tête --- */}
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

            {/* --- Conteneur principal de la grille 2x2 --- */}
            <div className="space-y-8">
                {/* --- Rangée du Haut : KPIs & Infos Contact --- */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <KpiCard title="Montant à reverser" value={formatPrice(unsettledBalance)} icon={DollarSign} color="bg-green-600" />
                        <KpiCard title="Articles en Stock" value={totalStock} icon={Package} color="bg-blue-600" />
                        <KpiCard title="Taux de Commission" value={formatPercent(commissionRate)} icon={Percent} color="bg-pink-600" />
                    </div>
                    
                    <div className="bg-gray-800 rounded-2xl p-6 h-full flex flex-col">
                        <h3 className="text-xl font-bold text-white mb-4">Informations de Contact</h3>
                        <div className="space-y-3 text-base mt-auto">
                            <div className="flex items-center gap-3"><User className="text-indigo-400 flex-shrink-0" size={20}/> <span>{currentUserData.firstName} {currentUserData.lastName}</span></div>
                            <div className="flex items-center gap-3"><Store className="text-indigo-400 flex-shrink-0" size={20}/> <span>{currentUserData.displayName}</span></div>
                            <div className="flex items-center gap-3"><Phone className="text-indigo-400 flex-shrink-0" size={20}/> <span>{formatPhone(currentUserData.phone)}</span></div>
                            <div className="flex items-center gap-3"><Mail className="text-indigo-400 flex-shrink-0" size={20}/> <span>{currentUserData.email}</span></div>
                        </div>
                    </div>
                </div>

                {/* --- Rangée du Bas : Livraisons & Rapports --- */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2" id="deliveries-section">
                        <DeliveriesSection deliveryHistory={deliveryHistory} posId={posId} onArchiveRequest={setDeliveryToArchive} isAdminView={isAdminView} />
                    </div>
                    
                    <div className="bg-gray-800 rounded-2xl p-6 h-full flex flex-col">
                        <h3 className="text-xl font-bold text-white mb-4">Rapports et Historiques</h3>
                        <div className="space-y-3 mt-auto">
                            <button onClick={() => setShowStockModal(true)} className="w-full bg-gray-700 p-4 rounded-lg flex items-center gap-3 hover:bg-gray-600 transition-colors"><Archive size={22} className="text-blue-400" /><span className="font-semibold">Voir le Stock</span></button>
                            <button onClick={() => setShowSalesHistoryModal(true)} className="w-full bg-gray-700 p-4 rounded-lg flex items-center gap-3 hover:bg-gray-600 transition-colors"><History size={22} className="text-purple-400" /><span className="font-semibold">Historique des Ventes</span></button>
                            <button onClick={() => setShowPayoutsHistoryModal(true)} className="w-full bg-gray-700 p-4 rounded-lg flex items-center gap-3 hover:bg-gray-600 transition-colors"><CheckCircle size={22} className="text-green-400" /><span className="font-semibold">Historique des Paiements</span></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default PosDashboard;
