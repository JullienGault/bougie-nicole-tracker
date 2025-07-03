// src/views/AdminDashboard.jsx
import React, { useState, useEffect, useMemo, useContext } from 'react';
import { db, onSnapshot, collection, query, orderBy, where, getDocs, doc, updateDoc, writeBatch, addDoc, serverTimestamp, runTransaction } from '../services/firebase';
import { AppContext } from '../contexts/AppContext';
import { Package, Store, UserPlus, History, DollarSign, HandCoins, ArrowRightCircle, Search, Settings, User, FileText, Power, CircleDollarSign, Loader2, Truck, XCircle } from 'lucide-react';
import { formatPrice, formatPercent, formatDate } from '../utils/formatters';
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
    const { showToast, setGlobalModal } = useContext(AppContext);

    // États existants
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

    // NOUVEAUX ÉTATS POUR LA GESTION DES LIVRAISONS
    const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'products', 'analytics', 'deliveries'
    const [deliveryRequests, setDeliveryRequests] = useState([]);
    const [deliveryToProcess, setDeliveryToProcess] = useState(null);
    const [deliveryToCancel, setDeliveryToCancel] = useState(null);

    // ... (useEffect pour les points de vente et utilisateurs reste inchangé)
    useEffect(() => {
        const unsubPointsOfSale = onSnapshot(query(collection(db, "pointsOfSale"), orderBy('name')),
            (snapshot) => setPointsOfSale(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
        );
        const unsubUsers = onSnapshot(query(collection(db, "users"), where("role", "==", "pos")),
            (snapshot) => setPosUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
        );

        // NOUVELLE SOUSCRIPTION POUR LES DEMANDES DE LIVRAISON
        const unsubDeliveries = onSnapshot(query(collection(db, "deliveryRequests"), orderBy("createdAt", "desc")),
            (snapshot) => {
                setDeliveryRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }
        );

        return () => {
            unsubPointsOfSale();
            unsubUsers();
            unsubDeliveries(); // Ne pas oublier de se désabonner
        };
    }, []);


    // Mise à jour de la dépendance de l'useEffect pour les balances
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

    // L'injection de la vue de livraison dans l'AppContext
    useEffect(() => {
        setGlobalModal(currentView === 'deliveries' ? () => setCurrentView('dashboard') : null);
    }, [currentView, setGlobalModal]);

    // ... (useMemo pour les statistiques et la liste combinée des POS reste inchangé)
    const { active: activePosCount, inactive: inactivePosCount, archived: archivedPosCount } = useMemo(() => {
        return pointsOfSale.reduce((counts, pos) => {
            if (pos.isArchived) {
                counts.archived++;
            } else if (pos.status === 'active') {
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
            return {
                ...user,
                ...pos,
                uid: pos.id,
                balance: allPosBalances[pos.id] || 0,
                isArchived: pos.isArchived || false
            };
        });

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
        return filteredList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [pointsOfSale, posUsers, allPosBalances, searchTerm, listFilter]);


    // NOUVELLE FONCTION POUR GÉRER L'ANNULATION D'UNE LIVRAISON
    const handleCancelDeliveryRequest = async (reason) => {
        if (!deliveryToCancel) return;
        try {
            const requestDocRef = doc(db, 'deliveryRequests', deliveryToCancel.id);
            await updateDoc(requestDocRef, {
                status: 'cancelled',
                cancellationReason: reason
            });
            await addDoc(collection(db, 'notifications'), {
                recipientUid: deliveryToCancel.posId,
                message: `Votre demande de livraison a été annulée. Motif : ${reason}`,
                createdAt: serverTimestamp(),
                isRead: false,
                type: 'DELIVERY_UPDATE'
            });
            showToast("La demande a bien été annulée.", "success");
        } catch (error) {
            showToast("Erreur lors de l'annulation.", "error");
        } finally {
            setDeliveryToCancel(null);
        }
    };


    // ... (Les fonctions handleTogglePosStatus, handleOpenReconciliation, handleCreatePayout restent inchangées)
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
        } catch (error) {
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

                transaction.set(payoutRef, {
                    ...reconciledData,
                    posId: posToReconcile.id,
                    posName: posToReconcile.name,
                    status: 'pending',
                    createdAt: serverTimestamp(),
                });

                reconciledData.items.forEach(item => {
                    item.originalSaleIds.forEach(saleId => {
                        const saleRef = doc(db, `pointsOfSale/${posToReconcile.id}/sales`, saleId);
                        transaction.update(saleRef, { payoutId: payoutRef.id });
                    });
                });

                reconciledData.items.forEach(item => {
                    const stockRef = doc(db, `pointsOfSale/${posToReconcile.id}/stock`, item.productId);
                    const currentStockItem = reconciliationData.stock.find(s => s.id === item.productId);
                    const currentQuantity = currentStockItem?.quantity || 0;
                    transaction.update(stockRef, { quantity: currentQuantity - (item.originalQuantity - item.finalQuantity) });
                });
            });

            showToast("La période a été clôturée avec succès !", "success");
            setPosToReconcile(null);
            setRefreshTrigger(p => p + 1);

        } catch (error) {
            showToast("Une erreur est survenue lors de la clôture.", "error");
        }
    };


    // NOUVELLE VUE POUR LES LIVRAISONS
    const renderDeliveriesView = () => (
        <div className="bg-gray-800 rounded-2xl p-6 mt-8 animate-fade-in">
            <h3 className="text-xl font-bold text-white mb-4">Demandes de Livraison en Attente</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-gray-700 text-gray-400 text-sm">
                            <th className="p-3">Date</th>
                            <th className="p-3">Dépôt</th>
                            <th className="p-3">Articles</th>
                            <th className="p-3">Statut</th>
                            <th className="p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {deliveryRequests.map(req => (
                            <tr key={req.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                                <td className="p-3">{formatDate(req.createdAt)}</td>
                                <td className="p-3 font-medium">{req.posName}</td>
                                <td className="p-3">{req.items.reduce((acc, item) => acc + item.quantity, 0)}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${req.status === 'delivered' ? 'bg-green-500/10 text-green-400' : req.status === 'cancelled' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                        {req.status}
                                    </span>
                                </td>
                                <td className="p-3">
                                    <button onClick={() => setDeliveryToProcess(req)} className="bg-indigo-600 text-white px-3 py-1.5 rounded-md text-xs font-bold hover:bg-indigo-700">
                                        Gérer
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {deliveryRequests.length === 0 && <p className="text-center text-gray-400 py-8">Aucune demande de livraison.</p>}
            </div>
        </div>
    );

    // GESTION DES VUES
    if (currentView === 'products') return <ProductManager onBack={() => setCurrentView('dashboard')} />;
    if (currentView === 'analytics') return <><div className="p-4 sm:px-8 sm:py-4 border-b border-gray-700"><button onClick={() => setCurrentView('dashboard')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><ArrowRightCircle className="transform rotate-180" size={20} />Retour</button></div><SalesAnalytics /></>;
    if (selectedPos) return <><button onClick={() => setSelectedPos(null)} className="m-4 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><ArrowRightCircle className="transform rotate-180" size={20} />Retour</button><PosDashboard pos={selectedPos} isAdminView={true} onActionSuccess={() => setRefreshTrigger(p => p + 1)} /></>;

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {/* MODALES */}
            {showCreateModal && <CreatePosModal onClose={() => setShowCreateModal(false)} />}
            {posToEdit && <EditPosModal pos={posToEdit} hasOpenBalance={posToEdit.balance > 0} onClose={() => setPosToEdit(null)} onSave={() => { }} />}
            {posToEditUser && <EditPosUserModal posUser={posToEditUser} onClose={() => setPosToEditUser(null)} onSave={() => { }} />}
            {posToToggleStatus && <ConfirmationModal title="Confirmer le changement de statut" message={(<div><p>{`Rendre le compte "${posToToggleStatus.name}" ${posToToggleStatus.status === 'active' ? 'INACTIF' : 'ACTIF'} ?`}</p>{posToToggleStatus.status === 'active' && <div className="flex items-center gap-3 mt-4"><input id="archive-cb" type="checkbox" checked={shouldArchive} onChange={(e) => setShouldArchive(e.target.checked)} /><label htmlFor="archive-cb">Archiver aussi</label></div>}</div>)} onConfirm={handleTogglePosStatus} onCancel={() => { setPosToToggleStatus(null); setShouldArchive(false); }} confirmText="Oui, confirmer" />}
            {posToReconcile && (
                <PayoutReconciliationModal
                    pos={posToReconcile}
                    unsettledSales={reconciliationData.sales}
                    stock={reconciliationData.stock}
                    onClose={() => setPosToReconcile(null)}
                    onConfirm={handleCreatePayout}
                />
            )}
            {/* NOUVELLES MODALES POUR LES LIVRAISONS */}
            {deliveryToProcess && <ProcessDeliveryModal request={deliveryToProcess} onClose={() => setDeliveryToProcess(null)} onCancelRequest={() => { setDeliveryToCancel(deliveryToProcess); setDeliveryToProcess(null); }} />}
            {deliveryToCancel && <ReasonPromptModal title="Annuler la livraison" message="Veuillez indiquer le motif de l'annulation." onConfirm={handleCancelDeliveryRequest} onCancel={() => setDeliveryToCancel(null)} />}


            <div className="flex flex-col md:flex-row justify-between items-center mb-8">
                <div><h2 className="text-3xl font-bold text-white">Tableau de Bord Admin</h2><p className="text-gray-400">Gestion des dépôts et du catalogue.</p></div>
                <div className="flex flex-wrap gap-4 mt-4 md:mt-0">
                    {/* BOUTONS DE NAVIGATION ENTRE LES VUES */}
                    <button onClick={() => setCurrentView('dashboard')} className={`${currentView === 'dashboard' ? 'bg-indigo-600' : 'bg-gray-600'} hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2`}><Store size={20} /> Dépôts</button>
                    <button onClick={() => setCurrentView('deliveries')} className={`${currentView === 'deliveries' ? 'bg-indigo-600' : 'bg-gray-600'} hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2`}><Truck size={20} /> Livraisons</button>
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
