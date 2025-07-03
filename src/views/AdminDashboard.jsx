// src/views/AdminDashboard.jsx
import React, { useState, useEffect, useMemo, useContext } from 'react';
import { db, onSnapshot, collection, query, orderBy, where, getDocs, doc, updateDoc, writeBatch, addDoc, serverTimestamp, arrayUnion, arrayRemove } from '../services/firebase';
import { AppContext } from '../contexts/AppContext';

// Icons
import { Package, Store, UserPlus, History, DollarSign, HandCoins, ArrowRightCircle, Search, Wrench } from 'lucide-react';

// Utils
import { formatPrice, formatPercent, formatDate } from '../utils/formatters';

// Components
import KpiCard from '../components/common/KpiCard';
import CreatePosModal from '../components/pos/CreatePosModal';
import EditPosModal from '../components/pos/EditPosModal';
import EditPosUserModal from '../components/pos/EditPosUserModal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import ProcessDeliveryModal from '../components/delivery/ProcessDeliveryModal';
import ProductManager from '../components/product/ProductManager';
import PosDashboard from './PosDashboard';
import SalesAnalytics from './SalesAnalytics';

const AdminDashboard = () => {
    const { loggedInUserData, showToast, products } = useContext(AppContext);
    
    // States
    const [pointsOfSale, setPointsOfSale] = useState([]);
    const [posUsers, setPosUsers] = useState([]);
    const [deliveryRequests, setDeliveryRequests] = useState([]);
    const [allPosBalances, setAllPosBalances] = useState({});
    const [globalStats, setGlobalStats] = useState({ revenue: 0, commission: 0, toPay: 0 });
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedPos, setSelectedPos] = useState(null);
    const [posToEdit, setPosToEdit] = useState(null);
    const [posToEditUser, setPosToEditUser] = useState(null);
    const [posToToggleStatus, setPosToToggleStatus] = useState(null);
    const [shouldArchive, setShouldArchive] = useState(false);
    const [requestToProcess, setRequestToProcess] = useState(null);
    const [requestToCancel, setRequestToCancel] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [currentView, setCurrentView] = useState('dashboard');
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [listFilter, setListFilter] = useState('active');

    // Fetching Data
    useEffect(() => {
        const unsubPointsOfSale = onSnapshot(query(collection(db, "pointsOfSale"), orderBy('name')), 
            (snapshot) => setPointsOfSale(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
        );
        const unsubUsers = onSnapshot(query(collection(db, "users"), where("role", "==", "pos")), 
            (snapshot) => setPosUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
        );
        const unsubRequests = onSnapshot(query(collection(db, "deliveryRequests"), orderBy('createdAt', 'desc')), 
            (snapshot) => setDeliveryRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
        );
        return () => { // Cleanup listeners on component unmount
            unsubPointsOfSale();
            unsubUsers();
            unsubRequests();
        };
    }, []);
    
    // =======================================================
    // CORRECTION APPLIQUÉE ICI
    // J'ai renommé les variables pour qu'elles correspondent
    // =======================================================
    const { active: activePosCount, inactive: inactivePosCount, archived: archivedPosCount } = useMemo(() => {
        return pointsOfSale.reduce((counts, pos) => {
            if (pos.isArchived) {
                counts.archived++;
            } else if (pos.status === 'active') {
                counts.active++;
            } else if (pos.status === 'inactive') {
                counts.inactive++;
            }
            return counts;
        }, { active: 0, inactive: 0, archived: 0 });
    }, [pointsOfSale]);

    const combinedPointsOfSale = useMemo(() => {
        let combined = pointsOfSale.map(pos => ({
            ...posUsers.find(u => u.id === pos.id),
            ...pos,
            uid: pos.id,
            balance: allPosBalances[pos.id] || 0,
            isArchived: pos.isArchived || false
        }));

        let filteredList;
        if (listFilter === 'active') filteredList = combined.filter(p => p.status === 'active' && !p.isArchived);
        else if (listFilter === 'inactive') filteredList = combined.filter(p => p.status === 'inactive' && !p.isArchived);
        else if (listFilter === 'archived') filteredList = combined.filter(p => p.isArchived);
        else filteredList = combined;

        if (searchTerm) {
            const lowerCaseSearch = searchTerm.toLowerCase();
            filteredList = filteredList.filter(pos =>
                pos.name?.toLowerCase().includes(lowerCaseSearch) ||
                pos.firstName?.toLowerCase().includes(lowerCaseSearch) ||
                pos.lastName?.toLowerCase().includes(lowerCaseSearch)
            );
        }
        return filteredList.sort((a, b) => a.name.localeCompare(b.name));
    }, [pointsOfSale, posUsers, allPosBalances, searchTerm, listFilter]);

    // Handlers
    const handleTogglePosStatus = async () => {
        if (!posToToggleStatus) return;
        const { id, name, status } = posToToggleStatus;
        const newStatus = status === 'active' ? 'inactive' : 'active';
        try {
            const batch = writeBatch(db);
            const posUpdate = { status: newStatus };
            if (newStatus === 'inactive' && shouldArchive) posUpdate.isArchived = true;
            if (newStatus === 'active') posUpdate.isArchived = false;
            batch.update(doc(db, "pointsOfSale", id), posUpdate);
            batch.update(doc(db, "users", id), { status: newStatus });
            await batch.commit();
            showToast(`Le compte "${name}" est maintenant ${newStatus}.`, "success");
        } catch (error) { showToast("Erreur lors du changement de statut.", "error"); }
        finally { setPosToToggleStatus(null); setShouldArchive(false); }
    };

    // Render Logic
    if (currentView === 'products') return <ProductManager onBack={() => setCurrentView('dashboard')} />;
    if (currentView === 'analytics') return <><div className="p-4 sm:px-8 sm:py-4 border-b border-gray-700"><button onClick={() => setCurrentView('dashboard')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><ArrowRightCircle className="transform rotate-180" size={20} />Retour</button></div><SalesAnalytics /></>;
    if (selectedPos) return <><button onClick={() => setSelectedPos(null)} className="m-4 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><ArrowRightCircle className="transform rotate-180" size={20} />Retour</button><PosDashboard pos={selectedPos} isAdminView={true} onActionSuccess={() => setRefreshTrigger(p => p + 1)} /></>;

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {showCreateModal && <CreatePosModal onClose={() => setShowCreateModal(false)} />}
            {posToEdit && <EditPosModal pos={posToEdit} hasOpenBalance={posToEdit.balance > 0} onClose={() => setPosToEdit(null)} onSave={() => {}} />}
            {posToEditUser && <EditPosUserModal posUser={posToEditUser} onClose={() => setPosToEditUser(null)} onSave={() => {}} />}
            {posToToggleStatus && <ConfirmationModal title="Confirmer le changement de statut" message={(<div><p>{`Rendre le compte "${posToToggleStatus.name}" ${posToToggleStatus.status === 'active' ? 'INACTIF' : 'ACTIF'} ?`}</p>{posToToggleStatus.status === 'active' && <div className="flex items-center gap-3 mt-4"><input id="archive-cb" type="checkbox" checked={shouldArchive} onChange={(e) => setShouldArchive(e.target.checked)} /><label htmlFor="archive-cb">Archiver aussi</label></div>}</div>)} onConfirm={handleTogglePosStatus} onCancel={() => {setPosToToggleStatus(null); setShouldArchive(false);}} confirmText="Oui, confirmer" />}
            {requestToProcess && <ProcessDeliveryModal request={requestToProcess} onClose={() => setRequestToProcess(null)} onCancelRequest={() => setRequestToCancel(requestToProcess)} />}

            <div className="flex flex-col md:flex-row justify-between items-center mb-8">
                <div><h2 className="text-3xl font-bold text-white">Tableau de Bord Admin</h2><p className="text-gray-400">Gestion des dépôts et du catalogue.</p></div>
                <div className="flex flex-wrap gap-4 mt-4 md:mt-0">
                    <button onClick={() => setCurrentView('products')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><Package size={20} /> Catalogue</button>
                    <button onClick={() => setCurrentView('analytics')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><History size={20} /> Analyses</button>
                    <button onClick={() => setShowCreateModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><UserPlus size={20} /> Ajouter un Dépôt</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KpiCard title="CA (Période en cours)" value={formatPrice(globalStats.revenue)} icon={DollarSign} color="bg-green-600" />
                <KpiCard title="Commissions (Période en cours)" value={formatPrice(globalStats.commission)} icon={HandCoins} color="bg-blue-600" />
                <KpiCard title="Net à Reverser (Total)" value={formatPrice(globalStats.toPay)} icon={Package} color="bg-pink-600" />
                <KpiCard title="Dépôts Actifs" value={activePosCount} icon={Store} color="bg-purple-600" />
            </div>

            <div className="bg-gray-800 rounded-2xl p-6 mt-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                     <div className="border-b border-gray-700">
                        <nav className="-mb-px flex gap-6" aria-label="Tabs">
                            <button onClick={() => setListFilter('active')} className={`${listFilter === 'active' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-400'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>Actifs ({activePosCount})</button>
                            <button onClick={() => setListFilter('inactive')} className={`${listFilter === 'inactive' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-400'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>Inactifs ({inactivePosCount})</button>
                            <button onClick={() => setListFilter('archived')} className={`${listFilter === 'archived' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-400'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>Archivés ({archivedPosCount})</button>
                        </nav>
                    </div>
                    <div className="relative w-full sm:w-auto sm:max-w-xs mt-4 sm:mt-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input type="text" placeholder="Rechercher un dépôt..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-gray-700 p-2 pl-10 rounded-lg"/>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead><tr className="border-b border-gray-700 text-gray-400 text-sm"><th className="p-3">Nom</th><th className="p-3">Solde à Payer</th><th className="p-3">Commission</th><th className="p-3">Actions</th></tr></thead>
                        <tbody>
                            {combinedPointsOfSale.map(pos => (
                                <tr key={pos.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                                    <td className="p-3 font-medium flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${pos.isArchived ? 'bg-gray-500' : (pos.status === 'active' ? 'bg-green-500' : 'bg-red-500')}`} title={pos.isArchived ? 'Archivé' : (pos.status === 'active' ? 'Actif' : 'Inactif')}></span>{pos.name}</td>
                                    <td className={`p-3 font-bold ${pos.balance > 0 ? 'text-yellow-400' : ''}`}>{formatPrice(pos.balance)}</td>
                                    <td className="p-3">{formatPercent(pos.commissionRate)}</td>
                                    <td className="p-3 space-x-2 text-sm whitespace-nowrap">
                                        <button onClick={() => setSelectedPos(pos)} className="text-indigo-400 p-1 hover:text-indigo-300">Détails</button>
                                        <button onClick={() => setPosToEditUser(pos)} className="text-cyan-400 p-1 hover:text-cyan-300">Infos Contact</button>
                                        <button onClick={() => setPosToEdit(pos)} className="text-yellow-400 p-1 hover:text-yellow-300">Paramètres</button>
                                        <button onClick={() => setPosToToggleStatus(pos)} className={`p-1 ${pos.status === 'active' ? 'text-red-500 hover:text-red-400' : 'text-green-500 hover:text-green-400'}`}>{pos.status === 'active' ? 'Désactiver' : 'Activer'}</button>
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
