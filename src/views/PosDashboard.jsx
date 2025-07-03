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
import PayoutReconciliationModal from '../components/payout/PayoutReconciliationModal';

const PosDashboard = ({ isAdminView = false, pos, onActionSuccess = () => {} }) => {
    const { products, showToast, loggedInUserData } = useContext(AppContext);
    const currentUserData = isAdminView ? pos : loggedInUserData;
    const posId = currentUserData.uid;

    const [stock, setStock] = useState([]);
    const [salesHistory, setSalesHistory] = useState([]);
    const [posData, setPosData] = useState(null);
    const [payouts, setPayouts] = useState([]);
    const [showHistory, setShowHistory] = useState(isAdminView ? 'payouts' : 'stock'); // Par défaut sur paiements pour l'admin
    const [showReconciliationModal, setShowReconciliationModal] = useState(false);
    const [isUpdatingPayout, setIsUpdatingPayout] = useState(null);

    useEffect(() => { if (!posId) return; const unsub = onSnapshot(doc(db, "pointsOfSale", posId), (doc) => { if (doc.exists()) setPosData(doc.data()); }); return unsub; }, [posId]);
    useEffect(() => { if (!posId) return; const unsub = onSnapshot(query(collection(db, `pointsOfSale/${posId}/stock`)), (snapshot) => setStock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), productId: doc.id })))); return unsub; }, [posId]);
    useEffect(() => { if (!posId) return; const unsub = onSnapshot(query(collection(db, `pointsOfSale/${posId}/sales`), orderBy('createdAt', 'desc')), (snapshot) => setSalesHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))); return unsub; }, [posId]);
    useEffect(() => { if (!posId) return; const unsub = onSnapshot(query(collection(db, `pointsOfSale/${posId}/payouts`), orderBy('createdAt', 'desc')), (snapshot) => setPayouts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))); return unsub; }, [posId]);

    const unsettledSales = useMemo(() => salesHistory.filter(s => !s.payoutId), [salesHistory]);
    const kpis = useMemo(() => {
        const totalStock = stock.reduce((acc, item) => acc + item.quantity, 0);
        const totalRevenue = unsettledSales.reduce((acc, sale) => acc + sale.totalAmount, 0);
        return { totalStock, totalRevenue, netToBePaid: totalRevenue - (totalRevenue * (posData?.commissionRate || 0)) };
    }, [stock, unsettledSales, posData]);

    const handleCreatePayout = async (reconciledData) => {
        const batch = writeBatch(db);
        const payoutDocRef = doc(collection(db, `pointsOfSale/${posId}/payouts`));
        
        const adjustments = reconciledData.items
            .filter(item => item.adjustmentReason)
            .map(item => ({
                productId: item.productId,
                productName: item.productName,
                originalQuantity: item.originalQuantity,
                finalQuantity: item.finalQuantity,
                reason: item.adjustmentReason
            }));

        batch.set(payoutDocRef, {
            createdAt: serverTimestamp(), status: 'pending',
            grossRevenue: reconciledData.grossRevenue,
            commissionAmount: reconciledData.grossRevenue * reconciledData.commissionRate,
            netAmount: reconciledData.netAmount,
            commissionRateAtTheTime: reconciledData.commissionRate,
            salesCount: reconciledData.items.reduce((acc, item) => acc + item.finalQuantity, 0),
            adjustments: adjustments,
            paidAt: null
        });

        const allOriginalSaleIds = reconciledData.items.flatMap(item => item.originalSaleIds);
        allOriginalSaleIds.forEach(saleId => {
            batch.update(doc(db, `pointsOfSale/${posId}/sales`, saleId), { payoutId: payoutDocRef.id });
        });
        
        reconciledData.items.forEach(item => {
            const stockItem = stock.find(s => s.id === item.productId);
            if (stockItem) {
                const stockDiff = item.originalQuantity - item.finalQuantity;
                const newStock = stockItem.quantity + stockDiff;
                batch.update(doc(db, `pointsOfSale/${posId}/stock`, item.productId), { quantity: newStock });
            }
        });

        try {
            await batch.commit();
            showToast("Période de paiement clôturée avec succès !", "success");
            onActionSuccess();
        } catch(error) {
            console.error("Erreur lors de la clôture : ", error);
            showToast("Erreur lors de la création du paiement.", "error");
        } finally {
            setShowReconciliationModal(false);
        }
    };
    
    const handleUpdatePayoutStatus = async (payout) => {
        // ... (Cette fonction reste identique à la version précédente)
    };

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {/* La modale est maintenant appelée ici, avec la logique de lecture seule */}
            {showReconciliationModal && posData && (
                <PayoutReconciliationModal
                    pos={posData}
                    unsettledSales={unsettledSales}
                    stock={stock}
                    onClose={() => setShowReconciliationModal(false)}
                    onConfirm={handleCreatePayout}
                    isReadOnly={!isAdminView} // L'admin peut éditer, le client est en lecture seule
                />
            )}
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
                <div><h2 className="text-3xl font-bold text-white">Tableau de Bord</h2><p className="text-gray-400">Bienvenue, {posData?.name || currentUserData.displayName}</p></div>
                {isAdminView && (
                    <div className="flex gap-4 mt-4 md:mt-0">
                        <button onClick={() => setShowReconciliationModal(true)} disabled={unsettledSales.length === 0} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50">
                            <CircleDollarSign size={20} /> Clôturer la période
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-gray-800 rounded-2xl p-6">
                <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-white">Gestion & Historique</h3></div>
                <div className="border-b border-gray-700 mb-4">
                    <nav className="-mb-px flex gap-6" aria-label="Tabs">
                        {/* L'onglet Stock est maintenant conditionnel */}
                        {!isAdminView && <button onClick={() => setShowHistory('stock')} className={`${showHistory === 'stock' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>Stock</button>}
                        <button onClick={() => setShowHistory('sales')} className={`${showHistory === 'sales' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>Ventes</button>
                        <button onClick={() => setShowHistory('payouts')} className={`${showHistory === 'payouts' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>Paiements</button>
                    </nav>
                </div>
                {/* ... le reste du composant (tables, etc.) reste le même ... */}
            </div>
        </div>
    );
};
export default PosDashboard;
