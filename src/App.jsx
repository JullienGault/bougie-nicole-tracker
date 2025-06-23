import React, { useState, useEffect, useMemo, useCallback } from 'react';

// Importations Firebase
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';

// Importations des icônes Lucide React
import { Package, LogIn, LogOut, Shield, Building } from 'lucide-react';

// =================================================================
// CONFIGURATION FIREBASE (INCHANGÉE)
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
// PAGE DE CONNEXION (SIMPLE ET AUTONOME)
// =================================================================
const LoginPage = ({ onLogin, error, isLoggingIn }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isLoggingIn) return;
        onLogin(email, password);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#111827', color: 'white' }}>
            <Package size={48} className="text-indigo-400"/>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 'bold', marginTop: '1rem' }}>{APP_NAME}</h1>
            <p style={{ color: '#9CA3AF' }}>Espace de connexion</p>
            <div style={{ backgroundColor: '#1F2937', padding: '2rem', borderRadius: '1rem', marginTop: '2rem', width: '100%', maxWidth: '24rem', border: '1px solid #374151' }}>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Adresse Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#374151', border: 'none', color: 'white' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Mot de passe</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#374151', border: 'none', color: 'white' }} />
                    </div>
                    {error && (<p style={{ color: '#F87171', textAlign: 'center' }}>{error}</p>)}
                    <button type="submit" disabled={isLoggingIn} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#4F46E5', fontWeight: 'bold', cursor: 'pointer', opacity: isLoggingIn ? 0.6 : 1 }}>
                        {isLoggingIn ? <div style={{width:'24px', height:'24px', border:'2px solid white', borderBottomColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite'}}></div> : <><LogIn size={20} /> Se connecter</>}
                    </button>
                </form>
            </div>
             <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

// =================================================================
// TABLEAUX DE BORD (VERSIONS SIMPLIFIÉES)
// =================================================================

const AdminDashboard = ({ user }) => {
    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '1.875rem', fontWeight: 'bold' }}>
                <Shield size={32} />
                <h1>Tableau de Bord Administrateur</h1>
            </div>
            <p style={{ marginTop: '0.5rem', color: '#9CA3AF' }}>Bienvenue, {user.displayName || user.email}.</p>
        </div>
    );
};

const PosDashboard = ({ user }) => {
    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '1.875rem', fontWeight: 'bold' }}>
                <Building size={32} />
                <h1>Tableau de Bord Dépôt-Vente</h1>
            </div>
            <p style={{ marginTop: '0.5rem', color: '#9CA3AF' }}>Bienvenue, {user.displayName || user.email}.</p>
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

    const db = useMemo(() => getFirestore(firebaseApp), []);
    const auth = useMemo(() => getAuth(firebaseApp), []);
    
    useEffect(() => {
        document.title = APP_TITLE;
    }, []);
    
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (authUser) => {
            if (authUser) {
                const userDocRef = doc(db, 'users', authUser.uid);
                const unsubUser = onSnapshot(userDocRef, (doc) => {
                    if (doc.exists()) {
                        setUserData({ uid: authUser.uid, email: authUser.email, ...doc.data() });
                        setUser(authUser);
                    } else {
                        // L'utilisateur existe dans Auth mais pas Firestore, on le déconnecte.
                        signOut(auth);
                    }
                    setIsLoading(false);
                }, () => {
                    // Erreur de lecture, on déconnecte
                    signOut(auth);
                    setIsLoading(false);
                });
                return () => unsubUser();
            } else {
                // Pas d'utilisateur connecté
                setUser(null); 
                setUserData(null);
                setIsLoading(false);
            }
        });
        return () => unsubscribe();
    }, [auth, db]);

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
    }, [auth]);
    
    const handleLogout = useCallback(() => {
        signOut(auth);
    }, [auth]);

    if (isLoading) {
        return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#111827'}}><div style={{width:'48px', height:'48px', border:'2px solid white', borderBottomColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite'}}></div></div>;
    }

    if (!user || !userData) {
        return <LoginPage onLogin={handleLogin} error={loginError} isLoggingIn={isLoggingIn} />;
    }
    
    return (
        <div style={{ backgroundColor: '#111827', color: 'white', minHeight: '100vh' }}>
            <header style={{ backgroundColor: '#1F2937', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #374151' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Package size={24} className="text-indigo-400"/>
                    <h1 style={{ fontWeight: 'bold' }}>{APP_NAME}</h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span>{userData.displayName || userData.email} ({userData.role})</span>
                    <button onClick={handleLogout} title="Déconnexion"><LogOut size={20} /></button>
                </div>
            </header>
            <main>
                {userData.role === 'admin' ? 
                    <AdminDashboard user={userData} /> : 
                    <PosDashboard user={userData} />
                }
            </main>
        </div>
    );
}
