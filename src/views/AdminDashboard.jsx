// src/views/AdminDashboard.jsx
import React, { useState, useEffect, useMemo, useContext } from 'react';
import { db, onSnapshot, collection, query, orderBy, where, getDocs, doc, updateDoc, writeBatch, addDoc, serverTimestamp, runTransaction, arrayUnion } from '../services/firebase';
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

    const handleArchiveDelivery = async () => {
        if (!deliveryToArchive) return;
        try {
            const deliveryDocRef = doc(db, "deliveryRequests", deliveryToArchive.id);
            await updateDoc(deliveryDocRef, { archivedBy: arrayUnion('admin') });
            showToast("Demande archivée pour vous.", "success");
        } catch (error) {
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

    // --- MODIFICATION DE LA LOGIQUE D'ARCHIVAGE ---
    const handleCreatePayout = async (reconciledData) => {
        if (!posToReconcile) return;
        try {
            await runTransaction(db, async (transaction) => {
                const payoutRef = doc(collection(db, `pointsOfSale/${posToReconcile.id}/payouts`));
                transaction.set(payoutRef, { ...reconciledData, posId: posToReconcile.id, posName: posToReconcile.name, status: 'pending', createdAt: serverTimestamp() });

                reconciledData.items.forEach(item => {
                    item.originalSaleIds.forEach(saleId => {
                        const saleRef = doc(db, `pointsOfSale/${posToReconcile.id}/sales`, saleId);
                        // On ajoute le champ isArchived en même temps
                        transaction.update(saleRef, { payoutId: payoutRef.id, isArchived: true });
                    });
                });

                reconciledData.items.forEach(item => {
                    const stockRef = doc(db, `pointsOfSale/${posToReconcile.id}/stock`, item.productId);
                    const currentStockItem = reconciliationData.stock.find(s => s.id === item.productId);
                    const currentQuantity = currentStockItem?.quantity || 0;
                    transaction.update(stockRef, { quantity: currentQuantity - (item.originalQuantity - item.finalQuantity) });
                });
            });
            showToast("La période a été clôturée et les ventes archivées !", "success");
            setPosToReconcile(null);
            setRefreshTrigger(p => p + 1);
        } catch (error) { showToast("Une erreur est survenue lors de la clôture.", "error"); }
    };

    const DeliveriesView = () => { /* ... */ };

    if (currentView === 'products') return <ProductManager onBack={() => setCurrentView('dashboard')} />;
    if (currentView === 'analytics') return <><div className="p-4 sm:px-8 sm:py-4 border-b border-gray-700"><button onClick={() => setCurrentView('dashboard')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><ArrowRightCircle className="transform rotate-180" size={20} />Retour</button></div><SalesAnalytics /></>;
    if (selectedPos) return <><button onClick={() => setSelectedPos(null)} className="m-4 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><ArrowRightCircle className="transform rotate-180" size={20} />Retour</button><PosDashboard pos={selectedPos} isAdminView={true} onActionSuccess={() => setRefreshTrigger(p => p + 1)} /></>;

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {/* ... Modales ... */}
        </div>
    );
};

export default AdminDashboard;
