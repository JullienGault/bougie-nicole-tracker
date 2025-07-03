// src/views/AdminDashboard.jsx
import React, { useState, useEffect, useMemo, useContext } from 'react';
import { db, onSnapshot, collection, query, orderBy, where, getDocs, doc, updateDoc, writeBatch, addDoc, serverTimestamp, runTransaction } from '../services/firebase';
import { AppContext } from '../contexts/AppContext';
import { Package, Store, UserPlus, History, DollarSign, HandCoins, ArrowRightCircle, Search, Settings, User, FileText, Power, CircleDollarSign, Loader2, Truck, XCircle, Archive, ChevronDown } from 'lucide-react';
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
    const [shouldArchive, setShouldArchive] = useState(false);
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
    const [deliveryFilter, setDeliveryFilter] = useState('active');
    const [deliveryToArchive, setDeliveryToArchive] = useState(null);
    const [expandedCardId, setExpandedCardId] = useState(null);

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
        if (!Array.isArray(pointsOfSale)) {
            return { active: 0, inactive: 0, archived: 0 };
        }
        return pointsOfSale.reduce((counts, pos) => {
            if (pos && pos.isArchived) {
                counts.archived++;
            } else if (pos && pos.status === 'active') {
                counts.active++;
            } else {
                counts.inactive++;
            }
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

    const handleArchiveDelivery = async () => {
        if (!deliveryToArchive) return;
        try {
            const deliveryDocRef = doc(db, "deliveryRequests", deliveryToArchive.id);
            await updateDoc(deliveryDocRef, { isArchived: true });
            showToast("Demande archivée avec succès.", "success");
        } catch (error) {
            console.error("Erreur lors de l'archivage:", error);
            showToast("Erreur lors de l'archivage.", "error");
        } finally {
            setDeliveryToArchive(null);
        }
    };

    const handleCancelDeliveryRequest = async (reason) => {
        if (!deliveryToCancel) return;
        try {
            const requestDocRef = doc(db, 'deliveryRequests', deliveryToCancel.id);
            await updateDoc(requestDocRef, { status: 'cancelled', cancellationReason: reason });
            await addDoc(collection(db, 'notifications'), { recipientUid: deliveryToCancel.posId, message: `Votre demande de livraison a été annulée. Motif : ${reason}`, createdAt: serverTimestamp(), isRead: false, type: 'DELIVERY_UPDATE' });
            showToast("La demande a bien été annulée.", "success");
        } catch (error) { showToast("Erreur lors de l'annulation.", "error"); }
        finally { setDeliveryToCancel(null); }
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
        } catch (error) { showToast("Impossible de charger les données de réconciliation.", "error"); }
        finally { setIsReconLoading(false); }
    };

    const handleCreatePayout = async (reconciledData) => {
        if (!posToReconcile) return;
        try {
            await runTransaction(db, async (transaction) => {
                const payoutRef = doc(collection(db, `pointsOfSale/${posToReconcile.id}/payouts`));
                transaction.set(payoutRef, { ...reconciledData, posId: posToReconcile.id, posName: posToReconcile.name, status: 'pending', createdAt: serverTimestamp() });
                reconciledData.items.forEach(item => { item.originalSaleIds.forEach(saleId => { const saleRef = doc(db, `pointsOfSale/${posToReconcile.id}/sales`, saleId); transaction.update(saleRef, { payoutId: payoutRef.id }); }); });
                reconciledData.items.forEach(item => { const stockRef = doc(db, `pointsOfSale/${posToReconcile.id}/stock`, item.productId); const currentStockItem = reconciliationData.stock.find(s => s.id === item.productId); const currentQuantity = currentStockItem?.quantity || 0; transaction.update(stockRef, { quantity: currentQuantity - (item.originalQuantity - item.finalQuantity) }); });
            });
            showToast("La période a été clôturée avec succès !", "success");
            setPosToReconcile(null);
            setRefreshTrigger(p => p + 1);
        } catch (error) { showToast("Une erreur est survenue lors de la clôture.", "error"); }
    };

    const renderDeliveriesView = () => {
        const filteredDeliveries = deliveryRequests.filter(req => {
            if (deliveryFilter === 'active') return !req.isArchived;
            if (deliveryFilter === 'archived') return req.isArchived === true;
            return true;
        });

        const toggleCard = (id) => {
            setExpandedCardId(expandedCardId === id ? null : id);
        };

        return (
            <div className="bg-gray-800 rounded-2xl p-6 mt-8 animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">Demandes de Livraison</h3>
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
                                            <h4 className="font-bold text-lg text-white">{req.posName}</h4>
                                            <p className="text-sm text-gray-400 mt-1">{formatDate(req.createdAt)}</p>
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
                                        <div className="animate-fade-in">
                                            <div className="p-5 border-t border-gray-700/50">
                                                <p className="text-sm text-gray-300">Articles demandés :</p>
                                                <ul className="mt-2 space-y-1 text-sm list-disc list-inside">
                                                    {req.items.map((item, index) => (
                                                        <li key={index} className="text-gray-200"><span className="font-semibold">{item.quantity}x</span> {item.productName}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="p-4 bg-gray-800/50 rounded-b-2xl flex justify-end">
                                                {isArchivable && deliveryFilter === 'active' ? (
                                                    <button onClick={() => setDeliveryToArchive(req)} className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2">
                                                        <Archive size={16} /> Archiver
                                                    </button>
                                                ) : deliveryFilter === 'active' ? (
                                                    <button onClick={() => setDeliveryToProcess(req)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg">Gérer la demande</button>
                                                ) : null}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-center text-gray-400 py-16">
                        {deliveryFilter === 'active' ? 'Aucune demande de livraison en cours.' : 'Aucune demande archivée.'}
                    </p>
                )}
            </div>
        );
    };

    if (currentView === 'products') return <ProductManager onBack={() => setCurrentView('dashboard')} />;
    if (currentView === 'analytics') return <><div className="p-4 sm:px-8 sm:py-4 border-b border-gray-700"><button onClick={() => setCurrentView('dashboard')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><ArrowRightCircle className="transform rotate-180" size={20} />Retour</button></div><SalesAnalytics /></>;
    if (selectedPos) return <><button onClick={() => setSelectedPos(null)} className="m-4 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><ArrowRightCircle className="transform rotate-180" size={20} />Retour</button><PosDashboard pos={selectedPos} isAdminView={true} onActionSuccess={() => setRefreshTrigger(p => p + 1)} /></>;

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {showCreateModal && <CreatePosModal onClose={() => setShowCreateModal(false)} />}
            {posToEdit && <EditPosModal pos={posToEdit} hasOpenBalance={posToEdit.balance > 0} onClose={() => setPosToEdit(null)} onSave={() => { }} />}
            {posToEditUser && <EditPosUserModal posUser={posToEditUser} onClose={() => setPosToEditUser(null)} onSave={() => { }} />}
            {posToToggleStatus && <ConfirmationModal title="Confirmer le changement de statut" message={(<div><p>{`Rendre le compte "${posToToggleStatus.name}" ${posToToggleStatus.status === 'active' ? 'INACTIF' : 'ACTIF'} ?`}</p>{posToToggleStatus.status === 'active' && <div className="flex items-center gap-3 mt-4"><input id="archive-cb" type="checkbox" checked={shouldArchive} onChange={(e) => setShouldArchive(e.target.checked)} /><label htmlFor="archive-cb">Archiver aussi</label></div>}</div>)} onConfirm={handleTogglePosStatus} onCancel={() => { setPosToToggleStatus(null); setShouldArchive(false); }} confirmText="Oui, confirmer" />}
            {posToReconcile && (<PayoutReconciliationModal pos={posToReconcile} unsettledSales={reconciliationData.sales} stock={reconciliationData.stock} onClose={() => setPosToReconcile(null)} onConfirm={handleCreatePayout} />)}
            {deliveryToProcess && <ProcessDeliveryModal request={deliveryToProcess} onClose={() => setDeliveryToProcess(null)} onCancelRequest={() => { setDeliveryToCancel(deliveryToProcess); setDeliveryToProcess(null); }} />}
            {deliveryToCancel && <ReasonPromptModal title="Annuler la livraison" message="Veuillez indiquer le motif de l'annulation." onConfirm={handleCancelDeliveryRequest} onCancel={() => setDeliveryToCancel(null)} />}
            {deliveryToArchive && <ConfirmationModal title="Confirmer l'archivage" message="Voulez-vous vraiment archiver cette demande ? Elle ne sera plus visible dans la liste principale." onConfirm={handleArchiveDelivery} onCancel={() => setDeliveryToArchive(null)} confirmText="Oui, archiver" confirmColor="bg-yellow-600 hover:bg-yellow-700" />}

            <div className="flex flex-col md:flex-row justify-between items-center mb-8">
                <div><h2 className="text-3xl font-bold text-white">Tableau de Bord Admin</h2><p className="text-gray-400">Gestion des dépôts et du catalogue.</p></div>
                <div className="flex flex-wrap gap-4 mt-4 md:mt-0">
                    <button onClick={() => setCurrentView('dashboard')} className={`${currentView === 'dashboard' ? 'bg-indigo-600' : 'bg-gray-600'} hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2`}><Store size={20} /> Dépôts</button>
                    <button onClick={() => setCurrentView('deliveries')} className={`${currentView === 'deliveries' ? 'bg-indigo-600' : 'bg-gray-600'} hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2`}><Truck size={20} /> Livraisons</button>
                    <button onClick={() => setCurrentView('products')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><Package size={20} /> Catalogue</button>
                    <button onClick={() => setCurrentView('analytics')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><History size={20} /> Analyses</button>
                    <button onClick={() => setShowCreateModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><UserPlus size={20} /> Ajouter un Dépôt</button>
                </div>
            </div>

            {currentView === 'dashboard' && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <KpiCard title="CA (Période en cours)" value={formatPrice(globalStats.revenue)} icon={DollarSign} color="bg-green-600" tooltip="Chiffre d'Affaires Brut : Montant total de toutes les ventes non encore réglées." />
                        <KpiCard title="Commissions (Période en cours)" value={formatPrice(globalStats.commission)} icon={HandCoins} color="bg-blue-600" tooltip="Montant total des commissions générées sur les ventes non encore réglées." />
                        <KpiCard title="Net à Reverser (Total)" value={formatPrice(globalStats.toPay)} icon={Package} color="bg-pink-600" tooltip="Somme totale due à tous les dépôts pour les ventes non encore réglées." />
                        <KpiCard title="Dépôts Actifs" value={activePosCount} icon={Store} color="bg-purple-600" tooltip="Nombre total de dépôts-ventes avec un statut 'actif'." />
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
                                <input type="text" placeholder="Rechercher un dépôt..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-gray-700 p-2 pl-10 rounded-lg" />
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
                                            <td className="p-3">
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
                </>
            )}

            {currentView === 'deliveries' && renderDeliveriesView()}
        </div>
    );
};

export default AdminDashboard;
