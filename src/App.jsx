import React, { useState, useEffect, useMemo, useCallback } from 'react';

// Importations Firebase
import { initializeApp, deleteApp, getApps } from 'firebase/app';
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
    query,
    where,
    setDoc,
    serverTimestamp,
    orderBy
} from 'firebase/firestore';

// Importations des icônes Lucide React
import {
    Package, LogIn, LogOut, Shield, Building, AlertTriangle, X, CheckCircle, Info, UserPlus, Eye
} from 'lucide-react';

// =================================================================
// CONFIGURATION & CONSTANTES
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

// =================================================================
// INITIALISATION DE FIREBASE (ROBUSTE)
// =================================================================
let firebaseApp;
if (!getApps().length) {
    firebaseApp = initializeApp(firebaseConfig);
} else {
    firebaseApp = getApps()[0];
}

// =================================================================
// COMPOSANTS UI GÉNÉRIQUES
// =================================================================

const AnimationStyles = () => ( <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}.animate-fade-in{animation:fadeIn .5s ease-in-out}@keyframes fadeInUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.animate-fade-in-up{animation:fadeInUp .5s ease-out forwards}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.animate-spin{animation:spin 1s linear infinite}`}</style> );

const Toast = ({ message, type, onClose }) => {
    const typeClasses = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600' };
    const Icon = { success: CheckCircle, error: XCircle, info: Info }[type] || Info;
    useEffect(() => { const timer = setTimeout(onClose, 4000); return () => clearTimeout(timer); }, [onClose]);

    return (
        <div className={`fixed bottom-5 right-5 p-4 rounded-lg shadow-2xl text-white flex items-center gap-3 z-[999] animate-fade-in-up ${typeClasses[type]}`}>
            <Icon size={24} /> <span>{message}</span>
            <button onClick={onClose} className="ml-2 opacity-80 hover:opacity-100"><X size={20} /></button>
        </div>
    );
};

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
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Adresse Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg text-white border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Mot de passe</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg text-white border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                    {error && (<p className="text-red-400 text-sm text-center bg-red-500/10 p-3 rounded-lg">{error}</p>)}
                    <button type="submit" disabled={isLoggingIn} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                        {isLoggingIn ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div> : <><LogIn size={20} /> Se connecter</>}
                    </button>
                </form>
            </div>
        </div>
    );
};

const CreatePosModal = ({ db, showToast, onClose }) => {
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        if (!displayName || !email || password.length < 6) {
            showToast("Nom, email et un mot de passe de 6 caractères minimum sont requis.", "error"); return;
        }
        setIsLoading(true);

        const appName = `secondary-app-${Date.now()}`;
        let secondaryApp;
        try {
            secondaryApp = initializeApp(firebaseConfig, appName);
            const secondaryAuth = getAuth(secondaryApp);
            
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            const newUser = userCredential.user;

            await setDoc(doc(db, "users", newUser.uid), {
                displayName: displayName,
                email: email,
                role: "pos",
                status: "active",
                createdAt: serverTimestamp()
            });
            
            await setDoc(doc(db, "pointsOfSale", newUser.uid), {
                name: displayName,
                commissionRate: 0.30, // Commission par défaut
                createdAt: serverTimestamp()
            });
            
            showToast(`Compte pour ${displayName} créé avec succès !`, "success");
            onClose();

        } catch (error) {
            if (error.code === 'auth/email-already-in-use') { showToast("Cette adresse email est déjà utilisée.", "error"); }
            else if (error.code === 'auth/weak-password') { showToast("Le mot de passe doit faire au moins 6 caractères.", "error"); }
            else { showToast("Erreur lors de la création du compte.", "error"); }
        } finally {
            setIsLoading(false);
            if (secondaryApp) {
                signOut(getAuth(secondaryApp)).then(() => deleteApp(secondaryApp));
            }
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-lg border-gray-700" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-white mb-6">Ajouter un Dépôt-Vente</h2>
                <form onSubmit={handleCreateUser} className="space-y-4">
                    <div><label className="block text-sm">Nom du Dépôt</label><input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/></div>
                    <div><label className="block text-sm">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/></div>
                    <div><label className="block text-sm">Mot de passe initial</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/></div>
                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Annuler</button>
                        <button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-60">{isLoading?<div className="animate-spin rounded-full h-5 w-5 border-b-2"></div>:<><UserPlus size={18}/>Créer</>}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// =================================================================
// TABLEAUX DE BORD (DASHBOARDS)
// =================================================================

const AdminDashboard = ({ db, user, showToast }) => {
    const [pointsOfSale, setPointsOfSale] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        if (!db) return;
        const q = query(collection(db, 'users'), where('role', '==', 'pos'), orderBy('displayName'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const posData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
            setPointsOfSale(posData);
            setIsLoading(false);
        }, (error) => {
            console.error("Erreur de lecture des dépôts:", error);
            setIsLoading(false);
            showToast("Impossible de charger la liste des dépôts.", "error");
        });
        return () => unsubscribe();
    }, [db, showToast]);

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {showCreateModal && <CreatePosModal db={db} showToast={showToast} onClose={() => setShowCreateModal(false)} />}
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white">Tableau de Bord Administrateur</h2>
                    <p className="text-gray-400">Bienvenue, {user.displayName || user.email}.</p>
                </div>
                <button onClick={() => setShowCreateModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 w-full sm:w-auto">
                    <UserPlus size={18}/> Ajouter un Dépôt-Vente
                </button>
            </div>

            <div className="bg-gray-800 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-white mb-4">Liste des Dépôts-Ventes</h3>
                <div className="space-y-3">
                    {isLoading ? (
                        <p className="text-center text-gray-400">Chargement...</p>
                    ) : pointsOfSale.length > 0 ? (
                        pointsOfSale.map(pos => (
                            <div key={pos.uid} className="bg-gray-700/50 p-4 rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="font-bold">{pos.displayName}</p>
                                    <p className="text-sm text-gray-400">{pos.email}</p>
                                </div>
                                <div className="text-sm px-3 py-1 rounded-full bg-green-500/20 text-green-300">
                                    {pos.status === 'active' ? 'Actif' : 'Inactif'}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-gray-400">Aucun dépôt-vente créé pour le moment.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

const PosDashboard = ({ user }) => {
    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            <h2 className="text-3xl font-bold text-white">Tableau de Bord Dépôt-Vente</h2>
            <p className="text-gray-400">Bienvenue, {user.displayName || user.email}.</p>
            <p className="mt-4 text-center text-gray-500">(Les fonctionnalités de gestion de stock et de ventes seront ajoutées ici)</p>
        </div>
    );
};

// =================================================================
// COMPOSANT PRINCIPAL DE L'APPLICATION
// =================================================================

export default function App() {
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loginError, setLoginError] = useState(null);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [toast, setToast] = useState(null);

    const db = useMemo(() => getFirestore(firebaseApp), []);
    const auth = useMemo(() => getAuth(firebaseApp), []);
    
    useEffect(() => { document.title = APP_TITLE; }, []);
    
    const showToast = useCallback((message, type = 'success') => { setToast({ id: Date.now(), message, type }); }, []);
    
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (authUser) => {
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
                return () => unsubUser();
            } else {
                setUser(null); setUserData(null); setIsLoading(false);
            }
        });
        return () => unsubscribe();
    }, [auth, db]);

    const handleLogin = useCallback(async (email, password) => {
        setLoginError(null);
        setIsLoggingIn(true);
        try { await signInWithEmailAndPassword(auth, email, password); }
        catch (error) { setLoginError("Email ou mot de passe incorrect."); }
        finally { setIsLoggingIn(false); }
    }, [auth]);
    
    const handleLogout = useCallback(() => { signOut(auth); }, [auth]);

    const renderContent = () => {
        if (isLoading) { return <div className="bg-gray-900 min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>; }
        if (!user || !userData) { return <LoginPage onLogin={handleLogin} error={loginError} isLoggingIn={isLoggingIn} />; }
        return (
             <div className="bg-gray-900 text-white min-h-screen font-sans">
                 <header className="bg-gray-800/50 p-4 flex justify-between items-center shadow-md sticky top-0 z-30">
                    <div className="flex items-center gap-2"><Package size={24} className="text-indigo-400"/><h1 className="text-xl font-bold">{APP_NAME}</h1></div>
                    <div className="flex items-center gap-4">
                        <span className="text-gray-300 text-sm"><span className="font-semibold">{userData.displayName}</span> ({userData.role})</span>
                        <button onClick={handleLogout} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700"><LogOut size={20} /></button>
                    </div>
                </header>
                <main>
                    {userData.role === 'admin' ? 
                        <AdminDashboard db={db} user={userData} showToast={showToast} /> : 
                        <PosDashboard user={userData} />
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
