import React, { useState, useEffect, useMemo, useCallback } from 'react';

// --- SECTION 1: IMPORTATIONS ---

// Firebase
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import {
    getAuth, onAuthStateChanged, signInWithEmailAndPassword,
    createUserWithEmailAndPassword, signOut
} from 'firebase/auth';
import {
    getFirestore, collection, doc, onSnapshot, writeBatch, query, where,
    addDoc, setDoc, serverTimestamp, orderBy, getDocs, updateDoc, deleteDoc,
    runTransaction, arrayUnion, arrayRemove
} from 'firebase/firestore';

// Icônes (Lucide React)
import {
    Package, Store, User, LogOut, LogIn, AlertTriangle, X, Info, Edit, Bell,
    ArchiveRestore, Phone, PlusCircle, History, CheckCircle, Truck, DollarSign,
    Archive, ChevronDown, ChevronUp, Check, XCircle, Trash2, Send, UserPlus,
    Percent, Save, Wrench, HandCoins
} from 'lucide-react';

// =================================================================
// SECTION 2: CONFIGURATION & CONSTANTES
// =================================================================

const firebaseConfig = {
    apiKey: "AIzaSyDUmxNBMQ2gWvCHWMrk0iowFpYVE1wMpMo", // IMPORTANT: Pour la production, utilisez des variables d'environnement !
    authDomain: "bougienicole.firebaseapp.com",
    projectId: "bougienicole",
    storageBucket: "bougienicole.appspot.com",
    messagingSenderId: "319062939476",
    appId: "1:319062939476:web:ba2235b7ab762c37a39ac1"
};

const APP_NAME = "Bougie Nicole - Gestion Dépôts";
const APP_TITLE = "Bougie Nicole Tracker";
const LOW_STOCK_THRESHOLD = 3;

const DELIVERY_STATUS_STEPS = {
    pending: 'En attente',
    processing: 'En traitement',
    shipping: 'En cours de livraison',
    delivered: 'Livrée',
    cancelled: 'Annulée'
};
const deliveryStatusOrder = ['pending', 'processing', 'shipping', 'delivered'];

// =================================================================
// SECTION 3: INITIALISATION FIREBASE
// =================================================================

const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

// =================================================================
// SECTION 4: FONCTIONS UTILITAIRES
// =================================================================

const formatPrice = (price) => `${(price || 0).toFixed(2)} €`;
const formatDate = (timestamp) => !timestamp?.toDate ? 'Date inconnue' : timestamp.toDate().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const formatPercent = (rate) => `${((rate || 0) * 100).toFixed(0)} %`;
const formatRelativeTime = (timestamp) => {
    if (!timestamp?.toDate) return "date inconnue";
    const now = new Date();
    const seconds = Math.floor((now - timestamp.toDate()) / 1000);
    if (seconds < 60) return "à l'instant";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `il y a ${days} j`;
    const months = Math.floor(days / 30);
    if (months < 12) return `il y a ${months} mois`;
    return `il y a ${Math.floor(days / 365)} an(s)`;
};

// =================================================================
// SECTION 5: COMPOSANTS UI GÉNÉRIQUES
// =================================================================

const AnimationStyles = () => (
    <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        .animate-fade-in { animation: fadeIn .5s ease-in-out; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
        .animate-fade-in-up { animation: fadeInUp .5s ease-out forwards; }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .animate-spin { animation: spin 1s linear infinite; }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #1f2937; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #4f46e5; border-radius: 10px; }
    `}</style>
);

const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const styles = useMemo(() => ({
        success: { bg: 'bg-green-600', icon: CheckCircle },
        error: { bg: 'bg-red-600', icon: XCircle },
        info: { bg: 'bg-blue-600', icon: Info },
    }), []);

    const { bg, icon: Icon } = styles[type] || styles.info;

    return (
        <div className={`fixed bottom-5 right-5 p-4 rounded-lg shadow-2xl text-white flex items-center gap-3 z-[999] animate-fade-in-up ${bg}`}>
            <Icon size={24} />
            <span>{message}</span>
            <button onClick={onClose} className="ml-2 opacity-80 hover:opacity-100"><X size={20}/></button>
        </div>
    );
};

const KpiCard = ({ title, value, icon: Icon, color }) => (
    <div className="bg-gray-800 p-5 rounded-xl flex items-center gap-4">
        <div className={`p-3 rounded-lg ${color}`}>
            <Icon size={28} className="text-white"/>
        </div>
        <div>
            <p className="text-gray-400 text-sm font-medium">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
        </div>
    </div>
);

const AppLoader = () => (
    <div className="bg-gray-900 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
    </div>
);

const InactiveAccountModal = ({ onLogout }) => (
    <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center text-center p-4">
        <AlertTriangle className="h-16 w-16 text-yellow-400 mb-6"/>
        <h2 className="text-2xl font-bold text-white mb-2">Compte Inactif</h2>
        <p className="text-gray-400 max-w-md mb-8">Votre compte a été désactivé par un administrateur. Veuillez le contacter pour plus d'informations.</p>
        <button onClick={onLogout} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg flex items-center gap-2">
            <LogOut size={20}/> Se déconnecter
        </button>
    </div>
);

// Composant unique et réutilisable pour suivre le statut des livraisons
const DeliveryStatusTracker = ({ status, reason }) => {
    if (status === 'cancelled') {
        return (
            <div className="border-l-4 border-red-500 bg-red-500/10 p-4 rounded-r-lg">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="h-6 w-6 text-red-500 flex-shrink-0 mt-1"/>
                    <div className="flex-grow">
                        <h4 className="font-bold text-red-400">Commande Annulée</h4>
                        {reason && <p className="text-sm text-gray-300 mt-1">Motif : <span className="italic">"{reason}"</span></p>}
                    </div>
                </div>
            </div>
        );
    }
    
    const currentIndex = deliveryStatusOrder.indexOf(status);

    return (
        <div className="flex items-center space-x-2 sm:space-x-4">
            {deliveryStatusOrder.map((step, index) => {
                const isCompleted = index < currentIndex;
                const isActive = index === currentIndex;
                return (
                    <React.Fragment key={step}>
                        <div className="flex flex-col items-center text-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${isCompleted ? 'bg-green-600' : isActive ? 'bg-blue-600 animate-pulse' : 'bg-gray-600'}`}>
                                {isCompleted ? <Check size={16} /> : <span className="text-xs font-bold">{index + 1}</span>}
                            </div>
                            <p className={`mt-2 text-xs w-20 ${isActive ? 'text-white font-bold' : 'text-gray-400'}`}>{DELIVERY_STATUS_STEPS[step]}</p>
                        </div>
                        {index < deliveryStatusOrder.length - 1 && (
                            <div className={`flex-1 h-1 rounded-full ${isCompleted ? 'bg-green-600' : 'bg-gray-600'}`}></div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

// =================================================================
// SECTION 6: MODALES
// =================================================================

// Un composant de base pour toutes les modales, gérant la fermeture et le style
const ModalWrapper = ({ children, onClose, maxWidth = 'max-w-md', extraClasses = '' }) => (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
        <div 
            className={`bg-gray-800 p-8 rounded-2xl shadow-2xl w-full ${maxWidth} border border-gray-700 animate-fade-in-up ${extraClasses}`} 
            onClick={e => e.stopPropagation()}
        >
            {children}
        </div>
    </div>
);

const ConfirmationModal = ({ title, message, onConfirm, onCancel, confirmText = "Confirmer", cancelText = "Annuler", confirmColor = "bg-red-600 hover:bg-red-700", requiresReason = false}) => {
    const [reason, setReason] = useState('');
    
    const handleConfirm = () => {
        if (requiresReason && !reason.trim()) {
            alert("Veuillez fournir une raison."); // Pourrait être remplacé par un toast pour une meilleure UX
            return;
        }
        onConfirm(requiresReason ? reason : undefined);
    };

    return (
        <ModalWrapper onClose={onCancel} maxWidth="max-w-md">
            <div className="text-center">
                <AlertTriangle className="mx-auto h-12 w-12 text-yellow-400"/>
                <h3 className="mt-4 text-xl font-semibold text-white">{title}</h3>
                <p className="text-gray-400 mt-2 whitespace-pre-line">{message}</p>
            </div>
            {requiresReason && (
                <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Raison (obligatoire)</label>
                    <textarea value={reason} onChange={e => setReason(e.target.value)} rows="3" className="w-full bg-gray-700 p-3 rounded-lg" placeholder="Ex: Rupture de stock..."></textarea>
                </div>
            )}
            <div className="mt-8 flex justify-center gap-4">
                <button onClick={onCancel} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg">{cancelText}</button>
                {onConfirm && (
                    <button onClick={handleConfirm} className={`${confirmColor} text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50`} disabled={requiresReason && !reason.trim()}>
                        {confirmText}
                    </button>
                )}
            </div>
        </ModalWrapper>
    );
};

// ... autres modales existantes (CreatePosModal, ProfileModal, etc.)

// =================================================================
// SECTION 7: PAGES & COMPOSANTS PRINCIPAUX
// =================================================================

const LoginPage = ({ onLogin, error, isLoggingIn }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!isLoggingIn) onLogin(email, password);
    };

    return (
        <div className="bg-gray-900 min-h-screen flex flex-col items-center justify-center p-4">
            <div className="text-center mb-8 animate-fade-in">
                <Package size={48} className="mx-auto text-indigo-400"/>
                <h1 className="text-4xl font-bold text-white mt-4">{APP_NAME}</h1>
                <p className="text-gray-400">Espace de connexion</p>
            </div>
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-700 animate-fade-in-up">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Adresse Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Mot de passe</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg" />
                    </div>
                    {error && (<p className="text-red-400 text-sm text-center bg-red-500/10 p-3 rounded-lg">{error}</p>)}
                    <button type="submit" disabled={isLoggingIn} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60">
                        {isLoggingIn ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div> : <><LogIn size={20} /> Se connecter</>}
                    </button>
                </form>
            </div>
        </div>
    );
};

const PosDashboard = ({ db, user, products, scents, showToast, isAdminView = false }) => {
    const posId = user.uid;
    const [stock, setStock] = useState([]);
    const [salesHistory, setSalesHistory] = useState([]);
    const [posData, setPosData] = useState(null);
    const [deliveryRequests, setDeliveryRequests] = useState([]);
    
    // ** LA CORRECTION EST ICI **
    const [contactInfo, setContactInfo] = useState(isAdminView ? null : user); // État pour les infos de la collection 'users'

    // ... autres états ...
    // [showSaleModal, showDeliveryModal, etc.]

    // Récupère les données commerciales du dépôt
    useEffect(() => {
        if (!db || !posId) return;
        const unsub = onSnapshot(doc(db, "pointsOfSale", posId), (doc) => {
            if (doc.exists()) setPosData({ id: doc.id, ...doc.data() });
        });
        return () => unsub();
    }, [db, posId]);

    // ** LA CORRECTION EST ICI **
    // Si c'est la vue admin, on doit aussi récupérer les infos de contact de la collection 'users'
    useEffect(() => {
        if (isAdminView && db && posId) {
            const unsub = onSnapshot(doc(db, "users", posId), (doc) => {
                if (doc.exists()) {
                    setContactInfo(doc.data());
                }
            });
            return () => unsub();
        }
    }, [db, posId, isAdminView]);
    
    // ... autres useEffects pour le stock, les ventes, les livraisons ...

    const kpis = useMemo(() => {
        const totalStock = stock.reduce((acc, item) => acc + item.quantity, 0);
        const totalRevenue = salesHistory.reduce((acc, sale) => acc + sale.totalAmount, 0);
        const commission = totalRevenue * (posData?.commissionRate || 0);
        const netToBePaid = totalRevenue - commission;
        return { totalStock, totalRevenue, netToBePaid };
    }, [stock, salesHistory, posData]);

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {/* ... Modales ... */}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-white">Tableau de Bord</h2>
                    <p className="text-gray-400">Bienvenue, {posData?.name || user.displayName}</p>
                </div>
                {!isAdminView && (
                    <div className="flex gap-4 mt-4 md:mt-0">
                        {/* ... Boutons Nouvelle Vente / Demander Livraison ... */}
                    </div>
                )}
            </div>

            {/* ** LA CORRECTION EST ICI ** */}
            {isAdminView && contactInfo && posData && (
                <div className="bg-gray-800 rounded-2xl p-6 mb-8 animate-fade-in">
                    <h3 className="text-xl font-bold text-white mb-4">Informations de Contact</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-3"><User className="text-indigo-400" size={20}/> <span>{contactInfo.firstName} {contactInfo.lastName}</span></div>
                        <div className="flex items-center gap-3"><Store className="text-indigo-400" size={20}/> <span>{posData.name}</span></div>
                        <div className="flex items-center gap-3"><Phone className="text-indigo-400" size={20}/> <span>{contactInfo.phone}</span></div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KpiCard title="Stock Total" value={kpis.totalStock} icon={Archive} color="bg-blue-600" />
                <KpiCard title="Chiffre d'Affaires Brut" value={formatPrice(kpis.totalRevenue)} icon={DollarSign} color="bg-green-600" />
                <KpiCard title="Votre Commission" value={formatPercent(posData?.commissionRate)} icon={Percent} color="bg-purple-600" />
                <KpiCard title="Net à reverser" value={formatPrice(kpis.netToBePaid)} icon={Package} color="bg-pink-600" />
            </div>

            {/* ... Le reste du JSX du dashboard (listes, tables, etc.) ... */}
        </div>
    );
};

const AdminDashboard = ({ db, showToast, products, scents }) => {
    const [pointsOfSale, setPointsOfSale] = useState([]);
    const [selectedPos, setSelectedPos] = useState(null);
    // ... autres états ...

    useEffect(() => {
        const q = query(collection(db, "pointsOfSale"), orderBy('name'));
        const unsub = onSnapshot(q, (snapshot) => {
            setPointsOfSale(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsub();
    }, [db]);

    // ... autres logiques ...

    if (selectedPos) {
        return (
            <div>
                <button onClick={() => setSelectedPos(null)} className="m-4 bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">← Retour à la liste</button>
                {/* On passe un objet `user` avec seulement l'UID. Le composant se chargera de fetch le reste. */}
                <PosDashboard 
                    db={db} 
                    user={{ uid: selectedPos.id, displayName: selectedPos.name }} 
                    products={products} 
                    scents={scents} 
                    showToast={showToast} 
                    isAdminView={true} 
                />
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
             {/* ... Reste du JSX de l'admin dashboard, y compris la table des dépôts */}
             {/* La table contient le bouton qui exécute `setSelectedPos(pos)` */}
             <div className="bg-gray-800 rounded-2xl p-6 mt-8">
                 <h3 className="text-xl font-bold text-white mb-4">Liste des Dépôts-Ventes</h3>
                 <div className="overflow-x-auto">
                     <table className="w-full text-left">
                         <thead>
                            <tr className="border-b border-gray-700 text-gray-400 text-sm">
                                <th className="p-3">Nom</th>
                                <th className="p-3">Commission</th>
                                <th className="p-3">Date de création</th>
                                <th className="p-3">Actions</th>
                            </tr>
                        </thead>
                         <tbody>
                             {pointsOfSale.map(pos => (
                                 <tr key={pos.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                                     <td className="p-3 font-medium flex items-center gap-2">
                                         <span className={`h-2 w-2 rounded-full ${pos.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                         {pos.name}
                                     </td>
                                     <td className="p-3">{formatPercent(pos.commissionRate)}</td>
                                     <td className="p-3">{formatDate(pos.createdAt)}</td>
                                     <td className="p-3 space-x-2">
                                         <button onClick={() => setSelectedPos(pos)} className="text-indigo-400 p-1 hover:text-indigo-300">Détails</button>
                                         {/* ... autres boutons ... */}
                                     </td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                 </div>
             </div>
        </div>
    );
};

// =================================================================
// SECTION 8: COMPOSANT RACINE DE L'APPLICATION
// =================================================================

export default function App() {
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loginError, setLoginError] = useState(null);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [toast, setToast] = useState(null);
    const [products, setProducts] = useState([]);
    const [scents, setScents] = useState([]);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [isCatalogLoading, setIsCatalogLoading] = useState(true);

    const showToast = useCallback((message, type = 'success') => {
        setToast({ id: Date.now(), message, type });
    }, []);
    
    useEffect(() => {
        document.title = APP_TITLE;

        const unsubProducts = onSnapshot(query(collection(db, 'products'), orderBy('name')), snap => setProducts(snap.docs.map(d=>({id:d.id, ...d.data()}))));
        const unsubScents = onSnapshot(query(collection(db, 'scents'), orderBy('name')), snap => setScents(snap.docs.map(d=>({id:d.id, ...d.data()}))) , () => setIsCatalogLoading(false));

        const unsubAuth = onAuthStateChanged(auth, (authUser) => {
            if (authUser) {
                const userDocRef = doc(db, 'users', authUser.uid);
                const unsubUser = onSnapshot(userDocRef, (doc) => {
                    if (doc.exists()) {
                        setUserData({ uid: authUser.uid, email: authUser.email, ...doc.data() });
                        setUser(authUser);
                    } else {
                        signOut(auth); 
                    }
                    setIsLoading(false);
                }, () => { setIsLoading(false); signOut(auth); });
            } else {
                setUser(null); 
                setUserData(null); 
                setIsLoading(false);
            }
        });

        return () => { 
            unsubProducts(); 
            unsubScents(); 
            unsubAuth();
        };
    }, []);

    const handleLogin = useCallback(async (email, password) => {
        setLoginError(null);
        setIsLoggingIn(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            setLoginError("Email ou mot de passe incorrect.");
        } finally {
            setIsLoggingIn(false);
        }
    }, []);

    const handleLogout = useCallback(() => signOut(auth), []);

    const renderContent = () => {
        if (isLoading || (user && (products.length === 0 || scents.length === 0))) {
            return <AppLoader />;
        }
        
        if (!user || !userData) {
            return <LoginPage onLogin={handleLogin} error={loginError} isLoggingIn={isLoggingIn} />;
        }
        
        if (userData.role === 'pos' && userData.status === 'inactive') {
            return <InactiveAccountModal onLogout={handleLogout} />;
        }
        
        return (
            <div className="bg-gray-900 text-white min-h-screen font-sans">
                {/* ... Modales ... */}
                
                <header className="bg-gray-800/50 p-4 flex justify-between items-center shadow-md sticky top-0 z-30 backdrop-blur-sm">
                    {/* ... Contenu du header ... */}
                </header>
                
                <main>
                    {
                        userData.role === 'admin' ? 
                        <AdminDashboard db={db} user={userData} showToast={showToast} products={products} scents={scents} /> :
                        <PosDashboard db={db} user={userData} showToast={showToast} products={products} scents={scents} />
                    }
                </main>
            </div>
        );
    };

    return (
        <>
            <AnimationStyles />
            {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {renderContent()}
        </>
    );
}
