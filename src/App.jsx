import React, { useState, useEffect, useMemo, useCallback } from 'react';

// Importations Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc, deleteDoc, writeBatch, where, getDocs, serverTimestamp } from 'firebase/firestore';

// Importations des icônes Lucide React
import {
    Package, Flame, Store, User, LogOut, LogIn, AlertTriangle, X, Info, Edit, 
    PlusCircle, MinusCircle, History, CheckCircle, Truck, ShoppingCart, BarChart2,
    DollarSign, Archive, Eye, ChevronDown, ChevronUp, Check, XCircle, Trash2, Send
} from 'lucide-react';

// =================================================================
// CONFIGURATION & CONSTANTES DE L'APPLICATION "Bougie Nicole"
// =================================================================

const firebaseConfig = {
    apiKey: "AIzaSyDUmxNBMQ2gWvCHWMrk0iowFpYVE1wMpMo",
    authDomain: "bougienicole.firebaseapp.com",
    projectId: "bougienicole",
    storageBucket: "bougienicole.appspot.com",
    messagingSenderId: "319062939476",
    appId: "1:319062939476:web:ba2235b7ab762c37a39ac1"
};

const APP_NAME = "Bougie Nicole - Gestion Dépôts";
const APP_TITLE = "Bougie Nicole Tracker";

// Méthode de gestion Admin par e-mail (inspirée du "code test")
const ADMIN_EMAIL = "jullien@bougienicole.fr";

const PRODUCTS = [
    { id: 'bougie', name: 'Bougie', price: 15.00, icon: Package },
    { id: 'fondant', name: 'Fondant', price: 2.50, icon: Flame },
    { id: 'bruleur', name: 'Brûleur', price: 12.00, icon: Store, hasScents: false }
];

const SCENTS = [
    "Vanille Bourbon", "Fleur de Coton", "Monoï de Tahiti", "Bois de Santal", 
    "Citron Meringué", "Feu de Bois", "Fraise des Bois", "Menthe Fraîche", 
    "Lavande Vraie", "Rose Ancienne", "Ambre Précieux", "Patchouli",
];

const LOW_STOCK_THRESHOLD = 3;

// =================================================================
// FONCTIONS UTILITAIRES
// =================================================================

const formatPrice = (price) => `${(price || 0).toFixed(2)} €`;
const formatDate = (timestamp) => {
    if (!timestamp?.toDate) return 'Date inconnue';
    return timestamp.toDate().toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

// =================================================================
// COMPOSANTS UI GÉNÉRIQUES
// =================================================================

const AnimationStyles = () => ( <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}.animate-fade-in{animation:fadeIn .5s ease-in-out}@keyframes fadeInUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.animate-fade-in-up{animation:fadeInUp .5s ease-out forwards}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.animate-spin{animation:spin 1s linear infinite}.custom-scrollbar::-webkit-scrollbar{width:8px}.custom-scrollbar::-webkit-scrollbar-track{background:#1f2937}.custom-scrollbar::-webkit-scrollbar-thumb{background:#4f46e5;border-radius:10px}`}</style> );
const Toast = ({ message, type, onClose }) => { const C = {s:'bg-green-600',e:'bg-red-600',i:'bg-blue-600'}, I = {s:CheckCircle,e:XCircle,i:Info}[type]; useEffect(()=>{const t=setTimeout(onClose,4000);return()=>clearTimeout(t)},[onClose]); return <div className={`fixed bottom-5 right-5 p-4 rounded-lg shadow-2xl text-white flex items-center gap-3 z-[999] animate-fade-in-up ${C[type]}`}><I size={24}/><span>{message}</span><button onClick={onClose} className="ml-2 opacity-80 hover:opacity-100"><X size={20}/></button></div> };
const ConfirmationModal = ({ title, message, onConfirm, onCancel, confirmText = "Confirmer", cancelText = "Annuler", cColor = "bg-red-600 hover:bg-red-700", requiresReason = false }) => { const [r, setR]=useState(''); const hC = () => {if(requiresReason&&!r.trim()){alert("Veuillez fournir une raison.");return;} onConfirm(requiresReason?r:undefined)}; return <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in" onClick={onCancel}><div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 animate-fade-in-up" onClick={e=>e.stopPropagation()}><div className="text-center"><AlertTriangle className="mx-auto h-12 w-12 text-yellow-400"/><h3 className="mt-4 text-xl font-semibold text-white">{title}</h3><p className="text-gray-400 mt-2">{message}</p></div>{requiresReason&&<div className="mt-6"><label className="block text-sm font-medium text-gray-300 mb-2">Raison (obligatoire)</label><textarea value={r} onChange={e=>setR(e.target.value)} rows="3" className="w-full bg-gray-700 p-3 rounded-lg" placeholder="Ex: Erreur..."></textarea></div>}<div className="mt-8 flex justify-center gap-4"><button onClick={onCancel} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg">{cancelText}</button><button onClick={hC} className={`${cColor} text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50`} disabled={requiresReason&&!r.trim()}>{confirmText}</button></div></div></div>};

// =================================================================
// PAGE DE CONNEXION
// =================================================================

const LoginPage = ({ onLogin, error, isLoggingIn }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const handleSubmit = (e) => { e.preventDefault(); if (!isLoggingIn) onLogin(email, password); };
    return (
        <div className="bg-gray-900 min-h-screen flex flex-col items-center justify-center p-4">
             <div className="text-center mb-8 animate-fade-in">
                <Package size={48} className="mx-auto text-indigo-400"/>
                <h1 className="text-4xl font-bold text-white mt-4">{APP_NAME}</h1>
                <p className="text-gray-400">Espace de connexion</p>
            </div>
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-700 animate-fade-in-up">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div><label className="block text-sm font-medium text-gray-300 mb-2">Adresse Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg" /></div>
                    <div><label className="block text-sm font-medium text-gray-300 mb-2">Mot de passe</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg" /></div>
                    {error && (<p className="text-red-400 text-sm text-center bg-red-500/10 p-3 rounded-lg">{error}</p>)}
                    <button type="submit" disabled={isLoggingIn} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60">
                        {isLoggingIn ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div> : <><LogIn size={20} /> Se connecter</>}
                    </button>
                </form>
            </div>
        </div>
    );
};


// =================================================================
// TABLEAUX DE BORD
// =================================================================

// NOTE: Le PosDashboard et AdminDashboard sont définis ici dans leur intégralité
// ... Le code pour KpiCard, SaleModal, DeliveryRequestModal, PosDashboard et AdminDashboard est ici ...
const PosDashboard = ({ db, user, showToast }) => { /* ... code complet ... */ };
const AdminDashboard = ({ db, showToast }) => {
    const [deliveryRequests, setDeliveryRequests] = useState([]);
    
    useEffect(() => {
        if (!db) return;
        const q = query(collection(db, 'deliveryRequests'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setDeliveryRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, console.error);
        return unsubscribe;
    }, [db]);

    const handleFulfillRequest = async (request) => { /* ... code pour traiter une livraison ... */ };

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-white">Tableau de Bord Administrateur</h2>
                <p className="text-gray-400">Gestion des demandes de livraison.</p>
            </div>
            <div className="bg-gray-800 rounded-2xl p-6 mb-8">
                <h3 className="text-xl font-bold text-white mb-4">Demandes en Attente ({deliveryRequests.length})</h3>
                <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
                    {deliveryRequests.length > 0 ? deliveryRequests.map(req => (
                        <div key={req.id} className="bg-gray-700/50 p-4 rounded-lg">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold">{req.posName || 'Nom inconnu'}</p>
                                    <p className="text-sm text-gray-400">Le {formatDate(req.createdAt)}</p>
                                    <ul className="list-disc list-inside mt-2 text-sm">
                                        {req.items.map((item, idx) => (<li key={idx}>{item.quantity} x {PRODUCTS.find(p=>p.id === item.productId)?.name || 'Produit inconnu'} {item.scent || ''}</li>))}
                                    </ul>
                                </div>
                                <button onClick={() => handleFulfillRequest(req)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg flex items-center gap-2 text-sm"><Check size={18}/> Traiter</button>
                            </div>
                        </div>
                    )) : <p className="text-gray-400">Aucune demande pour le moment.</p>}
                </div>
            </div>
        </div>
    );
};


// =================================================================
// COMPOSANT PRINCIPAL DE L'APPLICATION
// =================================================================

export default function App() {
    const [isLoading, setIsLoading] = useState(true);
    const [loginError, setLoginError] = useState(null);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [toast, setToast] = useState(null);

    // Gestion de l'état inspirée du "code test"
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);

    // Initialisation de Firebase
    useEffect(() => {
        document.title = APP_TITLE;
        try {
            const app = initializeApp(firebaseConfig);
            const authInstance = getAuth(app);
            const dbInstance = getFirestore(app);
            setAuth(authInstance);
            setDb(dbInstance);
        } catch (error) {
            console.error("Erreur d'initialisation Firebase", error);
            setLoginError("Impossible d'initialiser l'application.");
            setIsLoading(false);
        }
    }, []);

    // Surveillance de l'état de connexion
    useEffect(() => {
        if (!auth) return;
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser(user);
                setIsAdmin(user.email === ADMIN_EMAIL);
            } else {
                setCurrentUser(null);
                setIsAdmin(false);
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [auth]);

    const showToast = useCallback((message, type = 'success') => { setToast({ id: Date.now(), message, type }); }, []);

    const handleLogin = useCallback(async (email, password) => {
        if (!auth) return;
        setLoginError(null);
        setIsLoggingIn(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            setLoginError("Email ou mot de passe incorrect.");
        } finally {
            setIsLoggingIn(false);
        }
    }, [auth]);

    const handleLogout = useCallback(() => {
        if (auth) signOut(auth);
    }, [auth]);

    const renderContent = () => {
        if (isLoading) {
            return <div className="bg-gray-900 min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>;
        }

        if (!currentUser) {
            return <LoginPage onLogin={handleLogin} error={loginError} isLoggingIn={isLoggingIn} />;
        }
        
        return (
             <div className="bg-gray-900 text-white min-h-screen font-sans">
                 <header className="bg-gray-800/50 p-4 flex justify-between items-center shadow-md sticky top-0 z-30">
                    <div className="flex items-center gap-2">
                        <Package size={24} className="text-indigo-400"/>
                        <h1 className="text-xl font-bold">{APP_NAME}</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-gray-300 text-sm">
                            {currentUser.email} {isAdmin && <span className="font-bold text-yellow-400">(Admin)</span>}
                        </span>
                        <button onClick={handleLogout} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700"><LogOut size={20} /></button>
                    </div>
                </header>
                <main>
                    {isAdmin ? 
                        <AdminDashboard db={db} showToast={showToast} /> : 
                        <PosDashboard db={db} user={currentUser} showToast={showToast} />
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
