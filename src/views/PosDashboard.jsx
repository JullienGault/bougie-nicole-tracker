// src/views/PosDashboard.jsx
import React, { useState, useEffect, useMemo, useContext } from 'react';
import { db, onSnapshot, doc, collection, query, orderBy, updateDoc, serverTimestamp } from '../services/firebase';
import { AppContext } from '../contexts/AppContext';

// Icons
import { Truck, PlusCircle, CircleDollarSign, Archive, DollarSign, Percent, Package, History, CheckCircle, User, Store, Phone, Mail } from 'lucide-react';

// Constants
import { LOW_STOCK_THRESHOLD, PAYOUT_STATUSES } from '../constants';

// Utils
import { formatPrice, formatDate, formatPercent, formatPhone } from '../utils/formatters';

// Components
import KpiCard from '../components/common/KpiCard';
import SaleModal from '../components/pos/SaleModal';
import DeliveryRequestModal from '../components/delivery/DeliveryRequestModal';
import PayoutReconciliationModal from '../components/payout/PayoutReconciliationModal';
import FullScreenDataModal from '../components/common/FullScreenDataModal';
import ContactVerificationModal from '../components/user/ContactVerificationModal'; // NOUVEL IMPORT

const PosDashboard = ({ isAdminView = false, pos }) => {
    const { showToast, loggedInUserData } = useContext(AppContext);
    const currentUserData = isAdminView ? pos : loggedInUserData;
    const posId = currentUserData.uid;

    const [stock, setStock] = useState([]);
    const [salesHistory, setSalesHistory] = useState([]);
    const [posData, setPosData] = useState(null);
    const [payouts, setPayouts] = useState([]);
    
    // States pour les modales
    const [activeModal, setActiveModal] = useState(null);
    const [showSaleModal, setShowSaleModal] = useState(false);
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [showReconciliationModal, setShowReconciliationModal] = useState(false);
    const [payoutToView, setPayoutToView] = useState(null);
    const [showProfileModal, setShowProfileModal] = useState(false); // Ajout pour piloter la modale profil

    // NOUVEAUX ÉTATS POUR LA VÉRIFICATION
    const [showContactVerificationModal, setShowContactVerificationModal] = useState(false);
    const [isConfirmingContact, setIsConfirmingContact] = useState(false);

    // Listeners Firestore
    useEffect(() => { if (!posId) return; const unsub = onSnapshot(doc(db, "pointsOfSale", posId), (doc) => { if (doc.exists()) setPosData(doc.data()); }); return unsub; }, [posId]);
    useEffect(() => { if (!posId) return; const unsub = onSnapshot(query(collection(db, `pointsOfSale/${posId}/stock`)), (snapshot) => setStock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), productId: doc.id })))); return unsub; }, [posId]);
    useEffect(() => { if (!posId) return; const unsub = onSnapshot(query(collection(db, `pointsOfSale/${posId}/sales`), orderBy('createdAt', 'desc')), (snapshot) => setSalesHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))); return unsub; }, [posId]);
    useEffect(() => { if (!posId) return; const unsub = onSnapshot(query(collection(db, `pointsOfSale/${posId}/payouts`), orderBy('createdAt', 'desc')), (snapshot) => setPayouts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))); return unsub; }, [posId]);
    
    // NOUVELLE LOGIQUE : Vérifier la date de confirmation des contacts
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
    
    // NOUVELLES FONCTIONS HANDLER
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

    const renderModalContent = () => { /* ... (contenu inchangé) ... */ };
    
    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {/* Modales */}
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

            {/* En-tête */}
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
            
            {/* NOUVEL AGENCEMENT : INFOS DE CONTACT EN PREMIER */}
            <div className="bg-gray-800 rounded-2xl p-6 mb-8 animate-fade-in">
                <h3 className="text-xl font-bold text-white mb-4">Informations de Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-base">
                    <div className="flex items-center gap-3"><User className="text-indigo-400" size={22}/> <span>{currentUserData.firstName} {currentUserData.lastName}</span></div>
                    <div className="flex items-center gap-3"><Store className="text-indigo-400" size={22}/> <span>{currentUserData.displayName}</span></div>
                    <div className="flex items-center gap-3"><Phone className="text-indigo-400" size={22}/> <span>{formatPhone(currentUserData.phone)}</span></div>
                    <div className="flex items-center gap-3"><Mail className="text-indigo-400" size={22}/> <span>{currentUserData.email}</span></div>
                </div>
            </div>

            {/* KPIs */}
            {!isAdminView && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <KpiCard title="Montant à reverser" value={formatPrice(unsettledBalance)} icon={DollarSign} color="bg-green-600" />
                    <KpiCard title="Articles en Stock" value={totalStock} icon={Package} color="bg-blue-600" />
                    <KpiCard title="Taux de Commission" value={formatPercent(commissionRate)} icon={Percent} color="bg-pink-600" />
                </div>
            )}
            
            {/* Rapports */}
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
