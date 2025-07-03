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

    // CORRECTION / AMÉLIORATION: Implémentation complète de la fonction d'archivage
    const handleArchiveDelivery = async () => {
        if (!deliveryToArchive) return;
        try {
            const deliveryDocRef = doc(db, "deliveryRequests", deliveryToArchive.id);
            await updateDoc(deliveryDocRef, {
                archivedBy: arrayUnion('admin') // Utilise arrayUnion pour ajouter 'admin' au tableau
            });
            showToast("Demande archivée.", "success");
        } catch (error) {
            console.error("Erreur d'archivage:", error);
            showToast("Erreur lors de l'archivage.", "error");
        } finally {
            setDeliveryToArchive(null); // Ferme la modale de confirmation
        }
    };

    const handleCancelDeliveryRequest = async (reason) => { /* ... (inchangé) */ };
    const handleTogglePosStatus = async () => { /* ... (inchangé) */ };
    const handleOpenReconciliation = async (pos) => { /* ... (inchangé) */ };
    const handleCreatePayout = async (reconciledData) => { /* ... (inchangé) */ };

    // Composant pour la vue des livraisons
    const DeliveriesView = () => {
        // NOUVEAUTÉ: Ajout d'un état pour le filtre d'affichage
        const [deliveryFilter, setDeliveryFilter] = useState('active');

        // NOUVEAUTÉ: Logique de filtrage des livraisons
        const filteredDeliveries = useMemo(() => {
            return deliveryRequests.filter(req => {
                const isArchivedByAdmin = req.archivedBy?.includes('admin');
                if (deliveryFilter === 'active') return !isArchivedByAdmin;
                if (deliveryFilter === 'archived') return isArchivedByAdmin;
                return true;
            });
        }, [deliveryRequests, deliveryFilter]);

        return (
            <div className="p-4 sm:p-8 animate-fade-in">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setCurrentView('dashboard')} className="bg-gray-600 hover:bg-gray-500 p-2 rounded-full text-white">
                            <ArrowRightCircle className="transform rotate-180" size={24} />
                        </button>
                        <div>
                            <h2 className="text-3xl font-bold text-white">Demandes de Livraison</h2>
                            <p className="text-gray-400">Gérez toutes les demandes en cours et passées.</p>
                        </div>
                    </div>
                    {/* NOUVEAUTÉ: Ajout des boutons de filtre */}
                    <div className="flex gap-2 p-1 bg-gray-900 rounded-lg mt-4 sm:mt-0">
                        <button onClick={() => setDeliveryFilter('active')} className={`px-4 py-1.5 rounded-md text-sm font-semibold ${deliveryFilter === 'active' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>En cours</button>
                        <button onClick={() => setDeliveryFilter('archived')} className={`px-4 py-1.5 rounded-md text-sm font-semibold ${deliveryFilter === 'archived' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>Archivées</button>
                    </div>
                </div>
                {/* MODIFICATION: Remplacement du grid par un conteneur simple pour une liste verticale */}
                <div className="space-y-4">
                     {filteredDeliveries.map(req => {
                        const statusConfig = DELIVERY_STATUSES[req.status] || DELIVERY_STATUSES.default;
                        const Icon = statusConfig.icon;
                        const isActionable = req.status !== 'delivered' && req.status !== 'cancelled';
                        // NOUVEAUTÉ: Condition pour afficher le bouton d'archivage
                        const isArchivable = !isActionable && deliveryFilter === 'active';

                        return (
                            <div key={req.id} className="bg-gray-800 p-5 rounded-xl border border-gray-700/50 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="font-bold text-white text-lg">{req.posName}</p>
                                        <span className={`flex sm:hidden items-center gap-2 px-2 py-1 text-xs font-bold rounded-full ${statusConfig.bg} ${statusConfig.color}`}><Icon size={14} /><span>{statusConfig.text}</span></span>
                                    </div>
                                    <div className="flex items-baseline gap-4">
                                        <p className="text-base font-semibold">{req.items.reduce((acc, i) => acc + i.quantity, 0)} articles demandés</p>
                                        <p className="text-xs text-gray-400">{formatDate(req.createdAt)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 sm:gap-4">
                                    <span className={`hidden sm:flex items-center gap-2 px-2.5 py-1.5 text-sm font-bold rounded-full ${statusConfig.bg} ${statusConfig.color}`}><Icon size={16} /><span>{statusConfig.text}</span></span>
                                    <div className="flex items-center gap-2">
                                        {isArchivable && <button onClick={() => setDeliveryToArchive(req)} className="p-2 text-yellow-400 hover:bg-yellow-500/10 rounded-md" title="Archiver"><Archive size={18}/></button>}
                                        {isActionable && <button onClick={() => setDeliveryToCancel(req)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-md" title="Annuler la commande"><XCircle size={18}/></button>}
                                        <button onClick={() => setDeliveryToProcess(req)} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 hover:bg-indigo-700"><Truck size={16}/>Gérer</button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                    {filteredDeliveries.length === 0 && 
                        <div className="col-span-full text-center py-16 text-gray-400">
                            <p>Aucune demande de livraison ne correspond à ce filtre.</p>
                        </div>
                    }
                </div>
            </div>
        );
    };
    
    // --- Logique de changement de vue ---
    const BackButton = () => (
        <div className="p-4 sm:px-8 sm:py-4 border-b border-gray-700">
            <button onClick={() => setCurrentView('dashboard')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><ArrowRightCircle className="transform rotate-180" size={20} />Retour</button>
        </div>
    );
    
    if (currentView === 'products') return <><BackButton /><ProductManager onBack={() => setCurrentView('dashboard')} /></>;
    if (currentView === 'analytics') return <><BackButton /><SalesAnalytics /></>;
    if (currentView === 'deliveries') return <DeliveriesView />;
    if (selectedPos) return <><BackButton /><PosDashboard pos={selectedPos} isAdminView={true} /></>;

    // --- Vue principale du Dashboard Admin ---
    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {/* ... Modales (inchangées) ... */}
            {showCreateModal && <CreatePosModal onClose={() => setShowCreateModal(false)} />}
            {posToEdit && <EditPosModal pos={posToEdit} onClose={() => setPosToEdit(null)} onSave={() => setRefreshTrigger(p => p+1)} hasOpenBalance={allPosBalances[posToEdit.id] > 0} />}
            {posToEditUser && <EditPosUserModal posUser={posToEditUser} onClose={() => setPosToEditUser(null)} onSave={() => setRefreshTrigger(p => p+1)} />}
            {posToToggleStatus && <ConfirmationModal title={`Confirmer la ${posToToggleStatus.status === 'active' ? 'désactivation' : 'réactivation'}`} message={`Voulez-vous vraiment ${posToToggleStatus.status === 'active' ? 'désactiver' : 'réactiver'} le compte de "${posToToggleStatus.name}" ?`} onConfirm={handleTogglePosStatus} onCancel={() => setPosToToggleStatus(null)} confirmText={posToToggleStatus.status === 'active' ? 'Oui, désactiver' : 'Oui, réactiver'} />}
            {posToReconcile && <PayoutReconciliationModal pos={posToReconcile} unsettledSales={reconciliationData.sales} stock={reconciliationData.stock} onClose={() => setPosToReconcile(null)} onConfirm={handleCreatePayout} />}
            {deliveryToProcess && <ProcessDeliveryModal request={deliveryToProcess} onClose={() => setDeliveryToProcess(null)} onCancelRequest={setDeliveryToCancel} />}
            {deliveryToCancel && <ReasonPromptModal title="Annuler la commande" message={`Expliquez pourquoi vous annulez la livraison pour ${deliveryToCancel.posName}.`} onConfirm={handleCancelDeliveryRequest} onCancel={() => setDeliveryToCancel(null)} />}
            {deliveryToArchive && <ConfirmationModal title="Archiver la demande" message="Voulez-vous archiver cette demande de votre vue ? Elle restera visible pour le point de vente." onConfirm={handleArchiveDelivery} onCancel={() => setDeliveryToArchive(null)} confirmText="Oui, archiver" confirmColor="bg-yellow-600 hover:bg-yellow-700" />}

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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <KpiCard title="Chiffre d'Affaires (non clôturé)" value={formatPrice(globalStats.revenue)} icon={DollarSign} color="bg-green-600" />
                <KpiCard title="Commissions (non clôturées)" value={formatPrice(globalStats.commission)} icon={HandCoins} color="bg-blue-600" />
                <KpiCard title="Montant total à reverser" value={formatPrice(globalStats.toPay)} icon={Store} color="bg-pink-600" />
            </div>
            
            <div className="bg-gray-800 rounded-2xl p-6">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                    <h3 className="text-xl font-bold text-white mb-4 sm:mb-0">Liste des Dépôts-Vente</h3>
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="relative flex-grow sm:flex-grow-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-gray-700 p-2 pl-10 rounded-lg"/>
                        </div>
                        <select value={listFilter} onChange={e => setListFilter(e.target.value)} className="bg-gray-700 p-2 rounded-lg">
                            <option value="active">Actifs ({activePosCount})</option>
                            <option value="inactive">Inactifs ({inactivePosCount})</option>
                            <option value="archived">Archivés ({archivedPosCount})</option>
                        </select>
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
                                <th className="p-3 text-center">Actions</th>
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
                                        <div className="flex items-center justify-center gap-1 bg-gray-700/50 p-1 rounded-lg">
                                            <button onClick={() => handleOpenReconciliation(pos)} className="px-3 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold flex items-center gap-1.5 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed" title="Clôturer" disabled={isReconLoading || pos.balance <= 0}>
                                                {isReconLoading && posToReconcile?.id === pos.id ? <Loader2 className="animate-spin" size={18}/> : <CircleDollarSign size={18}/>}
                                                <span className="hidden lg:inline">Clôturer</span>
                                            </button>
                                            <button onClick={() => setSelectedPos(pos)} className="p-2 text-gray-300 hover:bg-gray-600 rounded-md" title="Détails"><FileText size={18} /></button>
                                            <button onClick={() => setPosToEditUser(pos)} className="p-2 text-gray-300 hover:bg-gray-600 rounded-md" title="Contact"><User size={18} /></button>
                                            <button onClick={() => setPosToEdit(pos)} className="p-2 text-gray-300 hover:bg-gray-600 rounded-md" title="Paramètres"><Settings size={18} /></button>
                                            <button onClick={() => setPosToToggleStatus(pos)} className={`p-2 rounded-md ${pos.status === 'active' ? 'text-red-500 hover:bg-red-500/10' : 'text-green-500 hover:bg-green-500/10'}`} title={pos.status === 'active' ? 'Désactiver' : 'Activer'}><Power size={18} /></button>
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
