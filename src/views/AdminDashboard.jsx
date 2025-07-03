// src/views/AdminDashboard.jsx
import React, { useState, useEffect, useMemo, useContext } from 'react';
import { db, onSnapshot, collection, query, orderBy, where, getDocs, doc, updateDoc, writeBatch, addDoc, serverTimestamp, arrayUnion, arrayRemove } from '../services/firebase';
import { AppContext } from '../contexts/AppContext';

// Icons
import { Package, Store, UserPlus, History, DollarSign, HandCoins, ChevronUp, ChevronDown, Wrench, Check, ArrowRightCircle, Search } from 'lucide-react';

// Utils
import { formatPrice, formatPercent, formatDate } from '../utils/formatters';

// Constants
import { DELIVERY_STATUS_STEPS, deliveryStatusOrder } from '../constants';

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
    const [expandedRequestId, setExpandedRequestId] = useState(null);
    const [deliveryTab, setDeliveryTab] = useState('actives');
    const [listFilter, setListFilter] = useState('active');
    const [currentView, setCurrentView] = useState('dashboard');
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');

    // Data Fetching
    useEffect(() => {
        const q = query(collection(db, "pointsOfSale"), orderBy('name'));
        const unsub = onSnapshot(q, (snapshot) => setPointsOfSale(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        return unsub;
    }, []);

    useEffect(() => {
        const q = query(collection(db, "users"), where("role", "==", "pos"));
        const unsub = onSnapshot(q, (snapshot) => setPosUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        return unsub;
    }, []);

    useEffect(() => {
        const q = query(collection(db, "deliveryRequests"), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snapshot) => setDeliveryRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        return unsub;
    }, []);

    useEffect(() => {
        if (pointsOfSale.length === 0) return;
        const fetchAllCurrentData = async () => {
            const balances = {};
            let currentSales = [];
            for (const pos of pointsOfSale) {
                const salesQuery = query(collection(db, `pointsOfSale/${pos.id}/sales`), where("payoutId", "==", null));
                const salesSnapshot = await getDocs(salesQuery);
                const salesData = salesSnapshot.docs.map(doc => ({ ...doc.data(), posName: pos.name, commissionRate: pos.commissionRate }));
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

    const combinedPointsOfSale = useMemo(() => {
        let combined = pointsOfSale.map(pos => {
            const posUser = posUsers.find(u => u.id === pos.id);
            const balance = allPosBalances[pos.id] || 0;
            return { ...posUser, ...pos, uid: pos.id, balance, isArchived: pos.isArchived || false };
        });

        let filteredList;
        if (listFilter === 'active') filteredList = combined.filter(p => p.status === 'active' && !p.isArchived);
        else if (listFilter === 'inactive') filteredList = combined.filter(p => p.status === 'inactive' && !p.isArchived);
        else if (listFilter === 'archived') filteredList = combined.filter(p => p.isArchived);
        else filteredList = combined;

        if (searchTerm) {
            filteredList = filteredList.filter(pos => 
                pos.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                pos.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                pos.lastName?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        return filteredList.sort((a, b) => a.name.localeCompare(b.name));
    }, [pointsOfSale, posUsers, allPosBalances, searchTerm, listFilter]);

    const handleCancelDelivery = async (reason) => {
        if (!requestToCancel) return;
        setIsLoading(true);
        try {
            await updateDoc(doc(db, 'deliveryRequests', requestToCancel.id), { status: 'cancelled', cancellationReason: reason });
            await addDoc(collection(db, 'notifications'), {
                recipientUid: requestToCancel.posId,
                message: `Votre commande du ${formatDate(requestToCancel.createdAt)} a été annulée.`,
                createdAt: serverTimestamp(), isRead: false, type: 'DELIVERY_CANCELLED'
            });
            showToast("Commande annulée avec succès.", "success");
            setRequestToCancel(null); setRequestToProcess(null);
        } catch (error) { showToast("Erreur lors de l'annulation.", "error"); } 
        finally { setIsLoading(false); }
    };

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

    if (currentView === 'analytics') return <><div className="p-4 sm:px-8 sm:py-4 border-b border-gray-700"><button onClick={() => setCurrentView('dashboard')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><ArrowRightCircle className="transform rotate-180" size={20} />Retour</button></div><SalesAnalytics /></>;
    if (currentView === 'products') return <ProductManager onBack={() => setCurrentView('dashboard')} />;
    if (selectedPos) return <><button onClick={() => setSelectedPos(null)} className="m-4 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><ArrowRightCircle className="transform rotate-180" size={20} />Retour</button><PosDashboard pos={selectedPos} isAdminView={true} onActionSuccess={() => setRefreshTrigger(p => p + 1)} /></>;
    
    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {showCreateModal && <CreatePosModal onClose={() => setShowCreateModal(false)} />}
            {posToEdit && <EditPosModal pos={posToEdit} hasOpenBalance={posToEdit.balance > 0} onClose={() => setPosToEdit(null)} onSave={() => {}} />}
            {posToEditUser && <EditPosUserModal posUser={posToEditUser} onClose={() => setPosToEditUser(null)} onSave={() => {}} />}
            
            {/* THIS IS THE CORRECTED PART */}
            {posToToggleStatus && <ConfirmationModal
                title="Confirmer le changement de statut"
                message={(
                    <div>
                        <p className="mb-4">
                            {`Êtes-vous sûr de vouloir rendre le compte "${posToToggleStatus.name}" ${posToToggleStatus.status === 'active' ? 'INACTIF' : 'ACTIF'} ?`}
                        </p>
                        {posToToggleStatus.status === 'active' && (
                            <div className="flex items-center justify-center gap-3 bg-gray-700/50 p-3 rounded-lg">
                                <input
                                    id="archive-checkbox"
                                    type="checkbox"
                                    className="h-4 w-4 rounded bg-gray-600 border-gray-500 text-indigo-600 focus:ring-indigo-500"
                                    checked={shouldArchive}
                                    onChange={(e) => setShouldArchive(e.target.checked)}
                                />
                                <label htmlFor="archive-checkbox" className="text-sm text-gray-300">
                                    Archiver également ce compte
                                </label>
                            </div>
                        )}
                    </div>
                )}
                onConfirm={handleTogglePosStatus}
                onCancel={() => { setPosToToggleStatus(null); setShouldArchive(false); }}
                confirmText="Oui, confirmer"
                confirmColor={posToToggleStatus.status === 'active' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
            />}
            {/* END OF CORRECTION */}

            {requestToProcess && <ProcessDeliveryModal request={requestToProcess} onClose={() => setRequestToProcess(null)} onCancelRequest={() => setRequestToCancel(requestToProcess)} />}
            {requestToCancel && <ConfirmationModal title="Confirmer l'annulation" message={`Vous êtes sur le point d'annuler cette commande. Veuillez fournir un motif (obligatoire).`} confirmText="Confirmer l'Annulation" confirmColor="bg-red-600 hover:bg-red-700" requiresReason={true} onConfirm={handleCancelDelivery} onCancel={() => setRequestToCancel(null)} />}

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
                <KpiCard title="Dépôts Actifs" value={combinedPointsOfSale.filter(p=>p.status==='active').length} icon={Store} color="bg-purple-600" />
            </div>

            <div className="bg-gray-800 rounded-2xl p-6 mt-8">
                <table className="w-full text-left">
                    <thead><tr className="border-b border-gray-700 text-gray-400 text-sm"><th className="p-3">Nom</th><th className="p-3">Solde à Payer</th><th className="p-3">Commission</th><th className="p-3">Actions</th></tr></thead>
                    <tbody>
                        {combinedPointsOfSale.map(pos => (
                            <tr key={pos.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                                <td className="p-3 font-medium flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${pos.isArchived ? 'bg-gray-500' : (pos.status === 'active' ? 'bg-green-500' : 'bg-red-500')}`}></span>{pos.name}</td>
                                <td className={`p-3 font-bold ${pos.balance > 0 ? 'text-yellow-400' : ''}`}>{formatPrice(pos.balance)}</td>
                                <td className="p-3">{formatPercent(pos.commissionRate)}</td>
                                <td className="p-3 space-x-2 text-sm whitespace-nowrap">
                                    <button onClick={() => setSelectedPos(pos)} className="text-indigo-400 p-1">Détails</button>
                                    <button onClick={() => setPosToEditUser(pos)} className="text-cyan-400 p-1">Infos</button>
                                    <button onClick={() => setPosToEdit(pos)} className="text-yellow-400 p-1">Paramètres</button>
                                    <button onClick={() => setPosToToggleStatus(pos)} className={`p-1 ${pos.status === 'active' ? 'text-red-500' : 'text-green-500'}`}>{pos.status === 'active' ? 'Désactiver' : 'Activer'}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminDashboard;
