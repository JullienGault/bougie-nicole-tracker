// src/views/AdminDashboard.jsx
import React, { useState, useEffect, useMemo, useContext } from 'react';
import { db, onSnapshot, collection, query, orderBy, where, getDocs, doc, updateDoc, writeBatch, addDoc, serverTimestamp, runTransaction, arrayUnion } from '../services/firebase';
import { AppContext } from '../contexts/AppContext';
import { Package, Store, UserPlus, History, DollarSign, HandCoins, ArrowRightCircle, Search, Settings, User, FileText, Power, CircleDollarSign, Loader2, Truck, XCircle, Archive } from 'lucide-react';
import { formatPrice, formatPercent, formatDate } from '../utils/formatters';
import { DELIVERY_STATUSES } from '../constants';
import KpiCard from '../components/common/KpiCard';
import CreatePosModal from '../components/pos/CreatePosModal';
import EditPosModal from '../components/pos/EditPosModal';
import EditPosUserModal from '../components/pos/EditPosUserModal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import PayoutReconciliationModal from '../components/payout/PayoutReconciliationModal';
import ProcessDeliveryModal from '../components/delivery/ProcessDeliveryModal';
import ReasonPromptModal from '../components/common/ReasonPromptModal';
import ProductManager from '../components/product/ProductManager';
import PosDashboard from './PosDashboard';
import SalesAnalytics from './SalesAnalytics';

const AdminDashboard = () => {
    const { showToast, setChangeAdminView } = useContext(AppContext);

    const [pointsOfSale, setPointsOfSale] = useState([]);
    const [posUsers, setPosUsers] = useState([]);
    const [allPosBalances, setAllPosBalances] = useState({});
    const [globalStats, setGlobalStats] = useState({ revenue: 0, commission: 0, toPay: 0 });
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedPos, setSelectedPos] = useState(null);
    const [posToEdit, setPosToEdit] = useState(null);
    const [posToEditUser, setPosToEditUser] = useState(null);
    const [posToToggleStatus, setPosToToggleStatus] = useState(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [listFilter, setListFilter] = useState('active');
    const [posToReconcile, setPosToReconcile] = useState(null);
    const [reconciliationData, setReconciliationData] = useState({ sales: [], stock: [] });
    const [isReconLoading, setIsReconLoading] = useState(false);
    const [currentView, setCurrentView] = useState('dashboard');
    const [deliveryRequests, setDeliveryRequests] = useState([]);
    const [deliveryToProcess, setDeliveryToProcess] = useState(null);
    const [deliveryToCancel, setDeliveryToCancel] = useState(null);
    const [deliveryToArchive, setDeliveryToArchive] = useState(null);

    useEffect(() => {
        const unsubPointsOfSale = onSnapshot(query(collection(db, "pointsOfSale"), orderBy('name')), (snapshot) => setPointsOfSale(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const unsubUsers = onSnapshot(query(collection(db, "users"), where("role", "==", "pos")), (snapshot) => setPosUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const unsubDeliveries = onSnapshot(query(collection(db, "deliveryRequests"), orderBy("createdAt", "desc")), (snapshot) => { setDeliveryRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); });
        return () => { unsubPointsOfSale(); unsubUsers(); unsubDeliveries(); };
    }, []);

    useEffect(() => {
        setChangeAdminView(() => setCurrentView);
        return () => setChangeAdminView(null);
    }, [setChangeAdminView]);

    useEffect(() => {
        if (pointsOfSale.length === 0 && currentView === 'dashboard') return;
        const fetchAllCurrentData = async () => {
            const balances = {};
            let currentSales = [];
            for (const pos of pointsOfSale) {
                if(!pos || !pos.id) continue;
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
    }, [pointsOfSale, refreshTrigger, currentView]);

    const { active: activePosCount, inactive: inactivePosCount, archived: archivedPosCount } = useMemo(() => {
        if (!Array.isArray(pointsOfSale)) { return { active: 0, inactive: 0, archived: 0 }; }
        return pointsOfSale.reduce((counts, pos) => {
            if (pos && pos.isArchived) { counts.archived++; } 
            else if (pos && pos.status === 'active') { counts.active++; } 
            else { counts.inactive++; }
            return counts;
        }, { active: 0, inactive: 0, archived: 0 });
    }, [pointsOfSale]);
    
    const combinedPointsOfSale = useMemo(() => {
        let combined = pointsOfSale.map(pos => {
            const user = posUsers.find(u => u.id === pos.id) || {};
            return { ...user, ...pos, uid: pos.id, balance: allPosBalances[pos.id] || 0, isArchived: pos.isArchived || false };
        });
        let filteredList;
        if (listFilter === 'active') filteredList = combined.filter(p => p.status === 'active' && !p.isArchived);
        else if (listFilter === 'inactive') filteredList = combined.filter(p => p.status === 'inactive' && !p.isArchived);
        else if (listFilter === 'archived') filteredList = combined.filter(p => p.isArchived);
        else filteredList = combined;
        if (searchTerm) {
            const lowerCaseSearch = searchTerm.toLowerCase();
            filteredList = filteredList.filter(pos => pos.name?.toLowerCase().includes(lowerCaseSearch) || pos.firstName?.toLowerCase().includes(lowerCaseSearch) || pos.lastName?.toLowerCase().includes(lowerCaseSearch));
        }
        return filteredList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [pointsOfSale, posUsers, allPosBalances, searchTerm, listFilter]);
    
    // --- FONCTIONS CORRIGÉES ---

    const handleBackToDashboard = () => {
        setCurrentView('dashboard');
        setSelectedPos(null);
    };

    const handleOpenReconciliation = async (pos) => {
        setIsReconLoading(true);
        setPosToReconcile(pos);
        try {
            const salesQuery = query(collection(db, `pointsOfSale/${pos.id}/sales`), where("payoutId", "==", null));
            const salesSnapshot = await getDocs(salesQuery);
            const sales = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const stockQuery = query(collection(db, `pointsOfSale/${pos.id}/stock`));
            const stockSnapshot = await getDocs(stockQuery);
            const stock = stockSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            setReconciliationData({ sales, stock });
        } catch (error) {
            showToast("Erreur lors de la récupération des données.", "error");
            setPosToReconcile(null);
        }
        setIsReconLoading(false);
    };

    const handleCreatePayout = async (reconciledData) => {
        const { items, netAmount, grossRevenue } = reconciledData;
        const payoutTimestamp = serverTimestamp();
        
        try {
            const batch = writeBatch(db);
            const payoutDocRef = doc(collection(db, `pointsOfSale/${posToReconcile.id}/payouts`));
            const allSaleIds = items.flatMap(item => item.originalSaleIds);
            
            // Logique pour trouver la date de début de la période
            const salesForPeriodQuery = query(collection(db, `pointsOfSale/${posToReconcile.id}/sales`), where('id', 'in', allSaleIds.length > 0 ? allSaleIds : [' ']));
            const salesForPeriodSnap = await getDocs(salesForPeriodQuery);
            const saleDates = salesForPeriodSnap.docs.map(d => d.data().createdAt.toDate());
            const periodStart = saleDates.length > 0 ? new Date(Math.min(...saleDates)) : new Date();

            batch.set(payoutDocRef, {
                createdAt: payoutTimestamp,
                grossRevenue,
                commissionRate: posToReconcile.commissionRate,
                netAmount,
                items: items.map(({ originalSales, ...item }) => item),
                posId: posToReconcile.id,
                posName: posToReconcile.name,
                status: 'pending',
                period: { start: periodStart, end: new Date() }
            });

            allSaleIds.forEach(saleId => {
                const saleDocRef = doc(db, `pointsOfSale/${posToReconcile.id}/sales`, saleId);
                batch.update(saleDocRef, { payoutId: payoutDocRef.id, isArchived: true });
            });

            await batch.commit();
            showToast("Paiement enregistré et ventes clôturées !", "success");
            setPosToReconcile(null);
            setRefreshTrigger(p => p + 1);
        } catch (error) {
            showToast("Erreur lors de la création du paiement.", "error");
        }
    };
    
    // --- AUTRES FONCTIONS (INCHANGÉES) ---
    const handleTogglePosStatus = async () => { /* ... */ };
    const handleCancelDeliveryRequest = async (reason) => { /* ... */ };
    const handleArchiveDelivery = async () => { /* ... */ };


    const BackButton = ({ onBack }) => (
        <div className="p-4 sm:px-8 sm:py-4 border-b border-gray-700">
            <button onClick={onBack} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2">
                <ArrowRightCircle className="transform rotate-180" size={20} />
                Retour
            </button>
        </div>
    );
    
    const DeliveriesView = () => { /* ... */ };
    
    if (currentView === 'products') return <><BackButton onBack={handleBackToDashboard} /><ProductManager onBack={handleBackToDashboard} /></>;
    if (currentView === 'analytics') return <><BackButton onBack={handleBackToDashboard} /><SalesAnalytics /></>;
    if (currentView === 'deliveries') return <DeliveriesView />;
    if (selectedPos) return <><BackButton onBack={handleBackToDashboard} /><PosDashboard pos={selectedPos} isAdminView={true} /></>;

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {/* --- Modales --- */}
            {showCreateModal && <CreatePosModal onClose={() => setShowCreateModal(false)} />}
            {posToEdit && <EditPosModal pos={posToEdit} onClose={() => setPosToEdit(null)} onSave={() => setRefreshTrigger(p => p+1)} hasOpenBalance={allPosBalances[posToEdit.id] > 0} />}
            {posToEditUser && <EditPosUserModal posUser={posToEditUser} onClose={() => setPosToEditUser(null)} onSave={() => setRefreshTrigger(p => p+1)} />}
            {posToToggleStatus && <ConfirmationModal title={`Confirmer la ${posToToggleStatus.status === 'active' ? 'désactivation' : 'réactivation'}`} message={`Voulez-vous vraiment ${posToToggleStatus.status === 'active' ? 'désactiver' : 'réactiver'} le compte de "${posToToggleStatus.name}" ?`} onConfirm={handleTogglePosStatus} onCancel={() => setPosToToggleStatus(null)} confirmText={posToToggleStatus.status === 'active' ? 'Oui, désactiver' : 'Oui, réactiver'} />}
            {posToReconcile && <PayoutReconciliationModal pos={posToReconcile} unsettledSales={reconciliationData.sales} stock={reconciliationData.stock} onClose={() => setPosToReconcile(null)} onConfirm={handleCreatePayout} />}
            {deliveryToProcess && <ProcessDeliveryModal request={deliveryToProcess} onClose={() => setDeliveryToProcess(null)} onCancelRequest={setDeliveryToCancel} />}
            {deliveryToCancel && <ReasonPromptModal title="Annuler la commande" message={`Expliquez pourquoi vous annulez la livraison pour ${deliveryToCancel.posName}.`} onConfirm={handleCancelDeliveryRequest} onCancel={() => setDeliveryToCancel(null)} />}
            {deliveryToArchive && <ConfirmationModal title="Archiver la demande" message="Voulez-vous archiver cette demande de votre vue ?" onConfirm={handleArchiveDelivery} onCancel={() => setDeliveryToArchive(null)} confirmText="Oui, archiver" confirmColor="bg-yellow-600 hover:bg-yellow-700" />}

            {/* --- En-tête --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-white">Tableau de Bord Administrateur</h2>
                    <p className="text-gray-400">Gérez les dépôts, les produits et les livraisons.</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 mt-4 md:mt-0 flex-wrap">
                    <button onClick={() => setCurrentView('deliveries')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><Truck size={20} /> Demandes de Livraison</button>
                    <button onClick={() => setCurrentView('analytics')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><History size={20} /> Analyse des Ventes</button>
                    <button onClick={() => setCurrentView('products')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><Package size={20} /> Gérer le Catalogue</button>
                    <button onClick={() => setShowCreateModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><UserPlus size={20} /> Ajouter un Dépôt</button>
                </div>
            </div>

            {/* --- KPIs --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <KpiCard title="Chiffre d'Affaires (non clôturé)" value={formatPrice(globalStats.revenue)} icon={DollarSign} color="bg-green-600" />
                <KpiCard title="Commissions (non clôturées)" value={formatPrice(globalStats.commission)} icon={HandCoins} color="bg-blue-600" />
                <KpiCard title="Montant total à reverser" value={formatPrice(globalStats.toPay)} icon={Store} color="bg-pink-600" />
            </div>
            
            {/* --- Tableau des Dépôts --- */}
            <div className="bg-gray-800 rounded-2xl p-6">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                    <h3 className="text-xl font-bold text-white mb-4 sm:mb-0">Liste des Dépôts-Vente</h3>
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="relative flex-grow sm:flex-grow-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-gray-700 p-2 pl-10 rounded-lg"/>
                        </div>
                        <div className="flex gap-1 p-1 bg-gray-900 rounded-lg">
                            <button onClick={() => setListFilter('active')} className={`px-3 py-1.5 rounded-md text-sm font-semibold ${listFilter === 'active' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>Actifs ({activePosCount})</button>
                            <button onClick={() => setListFilter('inactive')} className={`px-3 py-1.5 rounded-md text-sm font-semibold ${listFilter === 'inactive' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>Inactifs ({inactivePosCount})</button>
                            <button onClick={() => setListFilter('archived')} className={`px-3 py-1.5 rounded-md text-sm font-semibold ${listFilter === 'archived' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>Archivés ({archivedPosCount})</button>
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-gray-700 text-gray-400 text-sm">
                                <th className="p-3">Nom du Dépôt</th>
                                <th className="p-3">Contact</th>
                                <th className="p-3">Commission</th>
                                <th className="p-3">Solde à Payer</th>
                                <th className="p-3 text-center min-w-[500px]">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {combinedPointsOfSale.map(pos => (
                                <tr key={pos.id} className={`border-b border-gray-700/50 ${pos.status === 'inactive' ? 'opacity-50' : ''}`}>
                                    <td className="p-3 font-semibold">{pos.name}</td>
                                    <td className="p-3">{pos.firstName} {pos.lastName}</td>
                                    <td className="p-3">{formatPercent(pos.commissionRate)}</td>
                                    <td className="p-3 font-bold text-green-400">{formatPrice(pos.balance)}</td>
                                    <td className="p-3">
                                        <div className="flex items-center justify-center gap-2 flex-wrap">
                                            <button onClick={() => handleOpenReconciliation(pos)} className="px-3 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed" title="Clôturer la période" disabled={isReconLoading || pos.balance <= 0}>
                                                {isReconLoading && posToReconcile?.id === pos.id ? <Loader2 className="animate-spin" size={16}/> : <CircleDollarSign size={16}/>}
                                                <span>Clôturer</span>
                                            </button>
                                            <button onClick={() => setSelectedPos(pos)} className="px-3 py-2 bg-gray-600 text-white rounded-md text-sm font-semibold flex items-center gap-2 hover:bg-gray-500" title="Voir le tableau de bord">
                                                <FileText size={16} />
                                                <span>Détails</span>
                                            </button>
                                            <button onClick={() => setPosToEditUser(pos)} className="px-3 py-2 bg-gray-600 text-white rounded-md text-sm font-semibold flex items-center gap-2 hover:bg-gray-500" title="Modifier le contact">
                                                <User size={16} />
                                                <span>Contact</span>
                                            </button>
                                            <button onClick={() => setPosToEdit(pos)} className="px-3 py-2 bg-gray-600 text-white rounded-md text-sm font-semibold flex items-center gap-2 hover:bg-gray-500" title="Modifier les paramètres du dépôt">
                                                <Settings size={16} />
                                                <span>Paramètres</span>
                                            </button>
                                            <button onClick={() => setPosToToggleStatus(pos)} className={`px-3 py-2 rounded-md text-sm font-semibold flex items-center gap-2 ${pos.status === 'active' ? 'bg-red-800 text-white hover:bg-red-700' : 'bg-green-800 text-white hover:bg-green-700'}`} title={pos.status === 'active' ? 'Désactiver' : 'Activer'}>
                                                <Power size={16} />
                                                <span>{pos.status === 'active' ? 'Désactiver' : 'Activer'}</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     {combinedPointsOfSale.length === 0 && <p className="text-center py-8 text-gray-400">Aucun dépôt ne correspond à vos critères.</p>}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
