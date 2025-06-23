import React, { useState, useEffect, useMemo, useCallback } from 'react';

// Importations Firebase
import { initializeApp, deleteApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut 
} from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    doc, 
    onSnapshot, 
    writeBatch,
    query,
    where,
    addDoc,
    setDoc,
    serverTimestamp,
    orderBy,
    getDocs,
    updateDoc,
    deleteDoc
} from 'firebase/firestore';

// Importations des icônes Lucide React
import {
    Package, Flame, Store, User, LogOut, LogIn, AlertTriangle, X, Info, Edit, 
    PlusCircle, MinusCircle, History, CheckCircle, Truck, ShoppingCart, BarChart2,
    DollarSign, Archive, Eye, ChevronDown, ChevronUp, Check, XCircle, Trash2, Send, UserPlus, ToggleLeft, ToggleRight, Percent, Save
} from 'lucide-react';

// =================================================================
// CONFIGURATION & CONSTANTES
// =================================================================

const firebaseConfig = { /* ... */ }; // Votre configuration reste inchangée
const APP_NAME = "Bougie Nicole - Gestion Dépôts";
const APP_TITLE = "Bougie Nicole Tracker";
const PRODUCTS = [ /* ... */ ];
const SCENTS = [ /* ... */ ];
const LOW_STOCK_THRESHOLD = 3;

// =================================================================
// FONCTIONS UTILITAIRES
// =================================================================

const formatPrice = (price) => `${(price || 0).toFixed(2)} €`;
const formatDate = (timestamp) => !timestamp?.toDate ? 'Date inconnue' : timestamp.toDate().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
// NOUVELLE FONCTION UTILITAIRE
const formatPercent = (rate) => `${((rate || 0) * 100).toFixed(0)} %`;

// =================================================================
// COMPOSANTS UI (inchangés pour la plupart)
// ...
// =================================================================

// =================================================================
// MODALE DE CRÉATION DE DÉPÔT-VENTE (MISE À JOUR)
// =================================================================
const CreatePosModal = ({ db, showToast, onClose }) => {
    // ...
    const handleCreateUser = async (e) => {
        // ...
        try {
            // ...
            // ** NOUVEAU : Ajout de la commission par défaut lors de la création **
            await setDoc(doc(db, "pointsOfSale", newUser.uid), {
                name: displayName,
                commissionRate: 0.30, // Commission par défaut de 30%
                createdAt: serverTimestamp()
            });
            // ...
        } catch (error) { /* ... */ }
    };
    // ...
    return (
        {/* Le JSX de la modale reste le même */}
    );
};

// =================================================================
// TABLEAU DE BORD DÉPÔT-VENTE (MIS À JOUR)
// =================================================================

const PosDashboard = ({ db, user, showToast, isAdminView = false }) => {
    const [stock, setStock] = useState([]);
    const [salesHistory, setSalesHistory] = useState([]);
    // ** NOUVEAU : État pour les données spécifiques du point de vente (commission) **
    const [posData, setPosData] = useState(null);
    const [showSaleModal, setShowSaleModal] = useState(false);
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [saleToDelete, setSaleToDelete] = useState(null);
    const posId = user.uid;
    
    // NOUVEAU : Récupère les données du point de vente (nom, commission)
    useEffect(() => {
        if (!db || !posId) return;
        const unsub = onSnapshot(doc(db, "pointsOfSale", posId), (doc) => {
            if (doc.exists()) {
                setPosData(doc.data());
            }
        });
        return unsub;
    }, [db, posId]);

    // Récupération du stock
    useEffect(() => {
        if (!db || !posId) return;
        const q = query(collection(db, `pointsOfSale/${posId}/stock`), orderBy('productName'));
        const unsubscribe = onSnapshot(q, (snapshot) => setStock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))), console.error);
        return unsubscribe;
    }, [db, posId]);

    // Récupération de l'historique des ventes
    useEffect(() => {
        if (!showHistory || !db || !posId) return;
        const q = query(collection(db, `pointsOfSale/${posId}/sales`), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => setSalesHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))), console.error);
        return unsubscribe;
    }, [db, posId, showHistory]);

    // ** MIS À JOUR : Calcul des KPIs avec la commission dynamique **
    const kpis = useMemo(() => {
        const totalStock = stock.reduce((acc, item) => acc + item.quantity, 0);
        const totalRevenue = salesHistory.reduce((acc, sale) => acc + sale.totalAmount, 0);
        const commission = totalRevenue * (posData?.commissionRate || 0);
        const netToBePaid = totalRevenue - commission;
        return { totalStock, totalRevenue, netToBePaid };
    }, [stock, salesHistory, posData]);

    // ... la fonction handleDeleteSale reste identique ...

    // ** NOUVEAU : Section pour l'admin pour modifier la commission **
    const AdminCommissionManager = () => {
        const [rate, setRate] = useState((posData?.commissionRate || 0) * 100);
        const [isSaving, setIsSaving] = useState(false);

        const handleSaveCommission = async () => {
            setIsSaving(true);
            const newRate = parseFloat(rate) / 100;
            if (isNaN(newRate) || newRate < 0 || newRate > 1) {
                showToast("Veuillez entrer un pourcentage valide (0-100).", "error");
                setIsSaving(false);
                return;
            }
            try {
                await updateDoc(doc(db, "pointsOfSale", posId), { commissionRate: newRate });
                showToast("Taux de commission mis à jour !", "success");
            } catch (error) {
                showToast("Erreur lors de la mise à jour.", "error");
            } finally {
                setIsSaving(false);
            }
        };

        return (
            <div className="bg-indigo-900/50 border border-indigo-700 p-4 rounded-lg mt-8">
                <h4 className="text-lg font-bold text-white mb-3">Actions Administrateur</h4>
                <div className="flex items-center gap-4">
                    <label className="text-gray-300">Taux de commission :</label>
                    <div className="relative">
                        <input type="number" value={rate} onChange={(e) => setRate(e.target.value)} className="bg-gray-700 p-2 rounded-lg w-24 text-center"/>
                        <Percent size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                    </div>
                    <button onClick={handleSaveCommission} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50">
                        {isSaving ? <div className="animate-spin rounded-full h-5 w-5 border-b-2"></div> : <Save size={18}/>} Enregistrer
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {/* ... Modales (inchangées) ... */}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
                <div><h2 className="text-3xl font-bold text-white">Tableau de Bord</h2><p className="text-gray-400">Bienvenue, {posData?.name || user.displayName}</p></div>
                {!isAdminView && (
                    <div className="flex gap-4 mt-4 md:mt-0">
                        <button className="bg-gray-600 ..."><Truck size={20} /> Demander une Livraison</button>
                        <button className="bg-indigo-600 ..."><PlusCircle size={20} /> Nouvelle Vente</button>
                    </div>
                )}
            </div>

            {/* ** MIS À JOUR : Affichage des KPIs et de la commission ** */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KpiCard title="Stock Total" value={kpis.totalStock} icon={Archive} color="bg-blue-600" />
                <KpiCard title="Chiffre d'Affaires Brut" value={formatPrice(kpis.totalRevenue)} icon={DollarSign} color="bg-green-600" />
                <KpiCard title="Votre Commission" value={formatPercent(posData?.commissionRate)} icon={Percent} color="bg-purple-600" />
                <KpiCard title="Net à reverser" value={formatPrice(kpis.netToBePaid)} icon={Package} color="bg-pink-600" />
            </div>

            {/* ** NOUVEAU : Affiche la section admin si nécessaire ** */}
            {isAdminView && <AdminCommissionManager />}
            
            {/* Le reste du tableau de bord (alertes, tableau de stock/historique) reste identique */}
        </div>
    );
};

// =================================================================
// TABLEAU DE BORD ADMIN (MIS À JOUR)
// =================================================================
const AdminDashboard = ({ db, user, showToast }) => {
    // ...
    if (selectedPos) {
        return (
            <div className="animate-fade-in">
                 <button onClick={() => setSelectedPos(null)} className="m-4 ml-8 bg-gray-600 ...">&larr; Retour</button>
                 {/* ** NOUVEAU : On passe une prop pour indiquer que c'est la vue admin ** */}
                <PosDashboard db={db} user={selectedPos} showToast={showToast} isAdminView={true} />
            </div>
        );
    }
    // ... Le JSX du dashboard admin reste identique
    return (
        // ...
    );
};

// =================================================================
// COMPOSANT PRINCIPAL DE L'APPLICATION
// =================================================================
const firebaseApp = initializeApp(firebaseConfig);

export default function App() {
    // ... l'état et les fonctions restent les mêmes
    
    const renderContent = () => {
        // ...
        return (
             <div className="bg-gray-900 ...">
                 {/* ... Header ... */}
                <main>
                    {userData.role === 'admin' ? 
                        <AdminDashboard db={db} user={userData} showToast={showToast} /> : 
                        // ** NOUVEAU : isAdminView est false pour un dépôt qui se connecte **
                        <PosDashboard db={db} user={userData} showToast={showToast} isAdminView={false} />
                    }
                </main>
            </div>
        );
    };

    return (
        // ...
    );
}
