// src/views/AdminDashboard.jsx
import React, { useState, useEffect, useMemo, useContext } from 'react';
import { db, onSnapshot, collection, query, orderBy, where, getDocs, doc, updateDoc, writeBatch, addDoc, serverTimestamp, runTransaction } from '../services/firebase';
import { AppContext } from '../contexts/AppContext';

// Icons
// AJOUT : Nouvelles icônes pour les boutons
import { Package, Store, UserPlus, History, DollarSign, HandCoins, ArrowRightCircle, Search, Settings, User, FileText, Power, CircleDollarSign, Loader2 } from 'lucide-react';

// Utils
import { formatPrice, formatPercent } from '../utils/formatters';

// Components
import KpiCard from '../components/common/KpiCard';
import CreatePosModal from '../components/pos/CreatePosModal';
import EditPosModal from '../components/pos/EditPosModal';
import EditPosUserModal from '../components/pos/EditPosUserModal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import PayoutReconciliationModal from '../components/payout/PayoutReconciliationModal'; // AJOUT
import ProductManager from '../components/product/ProductManager';
import PosDashboard from './PosDashboard';
import SalesAnalytics from './SalesAnalytics';

const AdminDashboard = () => {
    const { showToast } = useContext(AppContext);
    
    // States
    const [pointsOfSale, setPointsOfSale] = useState([]);
    const [posUsers, setPosUsers] = useState([]);
    const [allPosBalances, setAllPosBalances] = useState({});
    const [globalStats, setGlobalStats] = useState({ revenue: 0, commission: 0, toPay: 0 });
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedPos, setSelectedPos] = useState(null);
    const [posToEdit, setPosToEdit] = useState(null);
    const [posToEditUser, setPosToEditUser] = useState(null);
    const [posToToggleStatus, setPosToToggleStatus] = useState(null);
    const [shouldArchive, setShouldArchive] = useState(false);
    const [currentView, setCurrentView] = useState('dashboard');
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [listFilter, setListFilter] = useState('active');

    // AJOUT : États pour la réconciliation
    const [posToReconcile, setPosToReconcile] = useState(null);
    const [reconciliationData, setReconciliationData] = useState({ sales: [], stock: [] });
    const [isReconLoading, setIsReconLoading] = useState(false);

    // Fetching Data
    useEffect(() => {
        const unsubPointsOfSale = onSnapshot(query(collection(db, "pointsOfSale"), orderBy('name')), 
            (snapshot) => setPointsOfSale(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
        );
        const unsubUsers = onSnapshot(query(collection(db, "users"), where("role", "==", "pos")), 
            (snapshot) => setPosUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
        );
        return () => { unsubPointsOfSale(); unsubUsers(); };
    }, []);

    useEffect(() => {
        if (pointsOfSale.length === 0) return;
        const fetchAllCurrentData = async () => {
            const balances = {};
            let currentSales = [];
            for (const pos of pointsOfSale) {
                const salesQuery = query(collection(db, `pointsOfSale/${pos.id}/sales`), where("payoutId", "==", null));
                const salesSnapshot = await getDocs(salesQuery);
                const salesData = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), posName: pos.name, commissionRate: pos.commissionRate }));
                currentSales = [...currentSales, ...salesData];
                const gross = salesData.reduce((acc, sale) => acc + sale.totalAmount, 0);
                balances[pos.id] = gross - (gross * (pos.commissionRate || 0));
            }
            setAllPosBalances(balances);
            const revenue = currentSales.reduce((acc, sale) => acc + sale.totalAmount, 0);
            const commission = currentSales.reduce((acc, sale) => acc + (sale.totalAmount * (sale.commissionRate || 0)), 0);
            setGlobalStats({ revenue, commission, toPay: revenue - commission });
        };
        fetchAllCurrentData();
    }, [pointsOfSale, refreshTrigger]);

    // ... (useMemo inchangés) ...

    const combinedPointsOfSale = useMemo(() => {
        // ... (logique de filtrage et de combinaison inchangée) ...
    }, [pointsOfSale, posUsers, allPosBalances, searchTerm, listFilter]);


    // Handlers
    const handleTogglePosStatus = async () => { /* ... (inchangé) ... */ };
    
    // AJOUT : Handlers pour la réconciliation
    const handleOpenReconciliation = async (pos) => {
        setIsReconLoading(true);
        try {
            const salesQuery = query(collection(db, `pointsOfSale/${pos.id}/sales`), where("payoutId", "==", null));
            const salesSnapshot = await getDocs(salesQuery);
            const sales = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const stockSnapshot = await getDocs(collection(db, `pointsOfSale/${pos.id}/stock`));
            const stock = stockSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            setReconciliationData({ sales, stock });
            setPosToReconcile(pos);
        } catch (error) {
            console.error("Erreur lors de la préparation de la réconciliation :", error);
            showToast("Impossible de charger les données de réconciliation.", "error");
        } finally {
            setIsReconLoading(false);
        }
    };
    
    const handleCreatePayout = async (reconciledData) => {
        if (!posToReconcile) return;
        
        try {
            await runTransaction(db, async (transaction) => {
                const payoutRef = doc(collection(db, `pointsOfSale/${posToReconcile.id}/payouts`));
                
                // 1. Créer le document de paiement
                transaction.set(payoutRef, {
                    ...reconciledData,
                    posId: posToReconcile.id,
                    posName: posToReconcile.name,
                    status: 'pending',
                    createdAt: serverTimestamp(),
                });

                // 2. Mettre à jour toutes les ventes concernées avec l'ID du nouveau paiement
                reconciledData.items.forEach(item => {
                    item.originalSaleIds.forEach(saleId => {
                        const saleRef = doc(db, `pointsOfSale/${posToReconcile.id}/sales`, saleId);
                        transaction.update(saleRef, { payoutId: payoutRef.id });
                    });
                });

                // 3. Mettre à jour le stock en fonction des ajustements
                reconciledData.items.forEach(item => {
                    const adjustment = item.finalQuantity - item.originalQuantity;
                    if (adjustment !== 0) {
                        const stockRef = doc(db, `pointsOfSale/${posToReconcile.id}/stock`, item.productId);
                        // NOTE : L'ajustement est une perte (offert, etc.) donc on soustrait la différence du stock.
                        // Si un produit a été ajouté (ajustement > 0), cela diminue d'autant plus le stock.
                        const currentStockItem = reconciliationData.stock.find(s => s.id === item.productId);
                        const currentQuantity = currentStockItem?.quantity || 0;
                        transaction.update(stockRef, { quantity: currentQuantity - (item.originalQuantity - item.finalQuantity) });
                    }
                });
            });

            showToast("La période a été clôturée avec succès !", "success");
            setPosToReconcile(null);
            setRefreshTrigger(p => p + 1);

        } catch (error) {
            console.error("Erreur lors de la clôture de la période :", error);
            showToast("Une erreur est survenue lors de la clôture.", "error");
        }
    };

    // Render Logic
    if (currentView === 'products') return <ProductManager onBack={() => setCurrentView('dashboard')} />;
    if (currentView === 'analytics') return <><div className="p-4 sm:px-8 sm:py-4 border-b border-gray-700"><button onClick={() => setCurrentView('dashboard')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><ArrowRightCircle className="transform rotate-180" size={20} />Retour</button></div><SalesAnalytics /></>;
    if (selectedPos) return <><button onClick={() => setSelectedPos(null)} className="m-4 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><ArrowRightCircle className="transform rotate-180" size={20} />Retour</button><PosDashboard pos={selectedPos} isAdminView={true} onActionSuccess={() => setRefreshTrigger(p => p + 1)} /></>;

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {/* ... (modales inchangées) ... */}
            {posToReconcile && (
                <PayoutReconciliationModal
                    pos={posToReconcile}
                    unsettledSales={reconciliationData.sales}
                    stock={reconciliationData.stock}
                    onClose={() => setPosToReconcile(null)}
                    onConfirm={handleCreatePayout}
                />
            )}
            {/* ... (reste de l'affichage, KPIs, etc., inchangé) ... */}
            
            <div className="bg-gray-800 rounded-2xl p-6 mt-8">
                {/* ... (Filtres de la liste inchangés) ... */}

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead><tr className="border-b border-gray-700 text-gray-400 text-sm"><th className="p-3">Nom</th><th className="p-3">Solde à Payer</th><th className="p-3">Commission</th><th className="p-3">Actions</th></tr></thead>
                        <tbody>
                            {combinedPointsOfSale.map(pos => (
                                <tr key={pos.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                                    <td className="p-3 font-medium flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${pos.isArchived ? 'bg-gray-500' : (pos.status === 'active' ? 'bg-green-500' : 'bg-red-500')}`} title={pos.isArchived ? 'Archivé' : (pos.status === 'active' ? 'Actif' : 'Inactif')}></span>{pos.name}</td>
                                    <td className={`p-3 font-bold ${pos.balance > 0 ? 'text-yellow-400' : ''}`}>{formatPrice(pos.balance)}</td>
                                    <td className="p-3">{formatPercent(pos.commissionRate)}</td>
                                    <td className="p-3">
                                        {/* AMÉLIORATION : Nouveaux boutons avec icônes */}
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handleOpenReconciliation(pos)} disabled={pos.balance <= 0 || isReconLoading} className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                                                {isReconLoading && posToReconcile?.id === pos.id ? <Loader2 size={14} className="animate-spin" /> : <CircleDollarSign size={14} />}
                                                <span>Clôturer</span>
                                            </button>
                                            <button onClick={() => setSelectedPos(pos)} title="Détails" className="p-2 bg-gray-600 rounded-md hover:bg-gray-500"><FileText size={16} /></button>
                                            <button onClick={() => setPosToEditUser(pos)} title="Infos Contact" className="p-2 bg-gray-600 rounded-md hover:bg-gray-500"><User size={16} /></button>
                                            <button onClick={() => setPosToEdit(pos)} title="Paramètres" className="p-2 bg-gray-600 rounded-md hover:bg-gray-500"><Settings size={16} /></button>
                                            <button onClick={() => setPosToToggleStatus(pos)} title={pos.status === 'active' ? 'Désactiver' : 'Activer'} className={`p-2 rounded-md ${pos.status === 'active' ? 'bg-red-900/50 text-red-400 hover:bg-red-800/50' : 'bg-green-900/50 text-green-400 hover:bg-green-800/50'}`}><Power size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {combinedPointsOfSale.length === 0 && <p className="text-center text-gray-400 py-8">Aucun dépôt-vente ne correspond aux filtres actuels.</p>}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
