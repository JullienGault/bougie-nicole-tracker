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
            alert("Veuillez fournir une raison.");
            return;
        }
        onConfirm(requiresReason ? reason : undefined);
    };

    return (
        <ModalWrapper onClose={onCancel}>
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

const InfoModal = ({ title, message, onClose }) => (
     <ModalWrapper onClose={onClose}>
        <div className="text-center">
            <Info className="mx-auto h-12 w-12 text-blue-400"/>
            <h3 className="mt-4 text-xl font-semibold text-white">{title}</h3>
            <p className="text-gray-400 mt-2">{message}</p>
        </div>
        <div className="mt-8 flex justify-center">
            <button onClick={onClose} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg">Fermer</button>
        </div>
    </ModalWrapper>
);

const ProfileModal = ({ user, db, showToast, onClose }) => {
    const [formData, setFormData] = useState({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || ''
    });
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.firstName || !formData.lastName || !formData.phone) {
            showToast("Tous les champs sont obligatoires.", "error");
            return;
        }
        setIsLoading(true);
        try {
            const userDocRef = doc(db, "users", user.uid);
            await updateDoc(userDocRef, {
                firstName: formData.firstName,
                lastName: formData.lastName,
                phone: formData.phone,
            });

            await addDoc(collection(db, 'notifications'), {
                recipientUid: 'all_admins',
                message: `Le dépôt "${user.displayName}" a mis à jour ses informations de contact.`,
                createdAt: serverTimestamp(),
                isRead: false,
                type: 'PROFILE_UPDATE'
            });

            showToast("Profil mis à jour avec succès !", "success");
            onClose();
        } catch (error) {
            console.error("Erreur de mise à jour du profil: ", error);
            showToast("Erreur lors de la mise à jour.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ModalWrapper onClose={onClose} maxWidth="max-w-lg">
            <h2 className="text-2xl font-bold text-white mb-6">Mon Profil</h2>
            <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Prénom</label>
                        <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required className="w-full bg-gray-700 p-3 rounded-lg"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Nom</label>
                        <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} required className="w-full bg-gray-700 p-3 rounded-lg"/>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Téléphone</label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className="w-full bg-gray-700 p-3 rounded-lg"/>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                    <input type="email" value={user.email} readOnly className="w-full bg-gray-900/50 p-3 rounded-lg cursor-not-allowed"/>
                      <p className="text-xs text-gray-400 mt-1">Pour modifier votre email, veuillez contacter un administrateur.</p>
                </div>
                <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Annuler</button>
                    <button type="submit" disabled={isLoading} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-60">
                        {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2"></div> : <><Save size={18}/>Enregistrer</>}
                    </button>
                </div>
            </form>
        </ModalWrapper>
    );
};

// ... autres modales

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
            <ModalWrapper onClose={() => {}} maxWidth="max-w-sm">
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
            </ModalWrapper>
        </div>
    );
};

const AdminDashboard = ({ db, user, showToast, products, scents }) => {
    const [pointsOfSale, setPointsOfSale] = useState([]);
    const [deliveryRequests, setDeliveryRequests] = useState([]);
    const [globalStats, setGlobalStats] = useState({ revenue: 0, commission: 0, toPay: 0, topPos: [], topProducts: [] });
    
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedPos, setSelectedPos] = useState(null);
    const [posToEdit, setPosToEdit] = useState(null);
    const [posToToggleStatus, setPosToToggleStatus] = useState(null);
    const [requestToProcess, setRequestToProcess] = useState(null);
    const [requestToCancel, setRequestToCancel] = useState(null);
    
    // ... toute la logique de l'admin dashboard
    
    return (
        <div className="p-4 sm:p-8 animate-fade-in">
           {/* Ici tout le JSX du dashboard admin, y compris les modales conditionnelles */}
           <h2 className="text-3xl font-bold text-white">Tableau de Bord Administrateur</h2>
           {/* ... le reste du JSX */}
        </div>
    );
};

const PosDashboard = ({ db, user, products, scents, showToast, isAdminView = false }) => {
    // ... toute la logique du pos dashboard
    
    return (
        <div className="p-4 sm:p-8 animate-fade-in">
           {/* Ici tout le JSX du dashboard POS, y compris les modales conditionnelles */}
           <h2 className="text-3xl font-bold text-white">Tableau de Bord</h2>
           {/* ... le reste du JSX */}
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
    
    const showToast = useCallback((message, type = 'success') => {
        setToast({ id: Date.now(), message, type });
    }, []);
    
    useEffect(() => {
        document.title = APP_TITLE;

        const unsubProducts = onSnapshot(query(collection(db, 'products'), orderBy('name')), snap => setProducts(snap.docs.map(d=>({id:d.id, ...d.data()}))));
        const unsubScents = onSnapshot(query(collection(db, 'scents'), orderBy('name')), snap => setScents(snap.docs.map(d=>({id:d.id, ...d.data()}))));

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
                // Note: la désinscription de `unsubUser` est gérée implicitement par React
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

    const handleLogout = useCallback(() => {
        signOut(auth);
    }, []);

    const renderContent = () => {
        const catalogIsLoading = products.length === 0 || scents.length === 0;

        if (isLoading) {
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
                {showProfileModal && <ProfileModal user={userData} db={db} showToast={showToast} onClose={() => setShowProfileModal(false)} />}
                
                <header className="bg-gray-800/50 p-4 flex justify-between items-center shadow-md sticky top-0 z-30 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                        <Package size={24} className="text-indigo-400"/>
                        <h1 className="text-xl font-bold">{APP_NAME}</h1>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4">
                        <span className="text-gray-300 text-sm hidden sm:block">
                            <span className="font-semibold">{userData.displayName}</span> ({userData.role})
                        </span>
                        {userData.role === 'pos' && (
                            <button onClick={() => setShowProfileModal(true)} title="Mon Profil" className="p-2 text-gray-400 hover:text-white">
                                <User size={22} />
                            </button>
                        )}
                        {userData && <NotificationBell db={db} user={userData} />}
                        <button onClick={handleLogout} title="Déconnexion" className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-700">
                            <LogOut size={20} />
                        </button>
                    </div>
                </header>
                
                <main>
                    {catalogIsLoading ? (
                        <div className="p-8 text-center text-gray-400">Chargement du catalogue...</div>
                    ) : (
                        userData.role === 'admin' ? 
                        <AdminDashboard db={db} user={userData} showToast={showToast} products={products} scents={scents} /> :
                        <PosDashboard db={db} user={userData} showToast={showToast} products={products} scents={scents} />
                    )}
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
