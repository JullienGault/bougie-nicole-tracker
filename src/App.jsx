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
    Package, LogIn, LogOut, Shield, Building, UserPlus, Eye
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
// COMPOSANTS UI
// =================================================================

const AnimationStyles = () => ( <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style> );

const LoginPage = ({ onLogin, error, isLoggingIn }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const handleSubmit = (e) => { e.preventDefault(); if (!isLoggingIn) onLogin(email, password); };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#111827', color: 'white' }}>
            <Package size={48} style={{ color: '#6366F1' }}/>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 'bold', marginTop: '1rem' }}>{APP_NAME}</h1>
            <p style={{ color: '#9CA3AF' }}>Espace de connexion</p>
            <div style={{ backgroundColor: '#1F2937', padding: '2rem', borderRadius: '1rem', marginTop: '2rem', width: '100%', maxWidth: '24rem', border: '1px solid #374151' }}>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Adresse Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#374151', border: '1px solid #4B5563', color: 'white' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Mot de passe</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#374151', border: '1px solid #4B5563', color: 'white' }} />
                    </div>
                    {error && (<p style={{ color: '#F87171', textAlign: 'center' }}>{error}</p>)}
                    <button type="submit" disabled={isLoggingIn} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#4F46E5', fontWeight: 'bold', cursor: 'pointer', opacity: isLoggingIn ? 0.6 : 1 }}>
                        {isLoggingIn ? <div style={{width:'24px', height:'24px', border:'2px solid white', borderBottomColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite'}}></div> : <><LogIn size={20} /> Se connecter</>}
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
        <div style={{position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:40}} onClick={onClose}>
            <div style={{backgroundColor:'#1F2937', padding:'2rem', borderRadius:'1rem', width:'100%', maxWidth:'32rem', border:'1px solid #374151'}} onClick={e => e.stopPropagation()}>
                <h2 style={{fontSize:'1.5rem', fontWeight:'bold', color:'white', marginBottom:'1.5rem'}}>Ajouter un Dépôt-Vente</h2>
                <form onSubmit={handleCreateUser} style={{display:'flex', flexDirection:'column', gap:'1rem'}}>
                    <div><label style={{display:'block', marginBottom:'0.5rem'}}>Nom du Dépôt</label><input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} required style={{width:'100%', padding:'0.75rem', borderRadius:'0.5rem', backgroundColor:'#374151', border:'1px solid #4B5563', color:'white'}}/></div>
                    <div><label style={{display:'block', marginBottom:'0.5rem'}}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={{width:'100%', padding:'0.75rem', borderRadius:'0.5rem', backgroundColor:'#374151', border:'1px solid #4B5563', color:'white'}}/></div>
                    <div><label style={{display:'block', marginBottom:'0.5rem'}}>Mot de passe initial</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{width:'100%', padding:'0.75rem', borderRadius:'0.5rem', backgroundColor:'#374151', border:'1px solid #4B5563', color:'white'}}/></div>
                    <div style={{display:'flex', justifyContent:'flex-end', gap:'1rem', paddingTop:'1rem'}}>
                        <button type="button" onClick={onClose} style={{backgroundColor:'#4B5563', fontWeight:'bold', padding:'0.5rem 1rem', borderRadius:'0.5rem'}}>Annuler</button>
                        <button type="submit" disabled={isLoading} style={{backgroundColor:'#4F46E5', fontWeight:'bold', padding:'0.5rem 1rem', borderRadius:'0.5rem', display:'flex', alignItems:'center', gap:'0.5rem', opacity:isLoading?0.6:1}}>{isLoading?<div style={{width:'20px',height:'20px',border:'2px solid white',borderBottomColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite'}}></div>:<><UserPlus size={18}/>Créer</>}</button>
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
    const [isLoadingList, setIsLoadingList] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        if (!db) return;
        const q = query(collection(db, 'users'), where('role', '==', 'pos'), orderBy('displayName'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const posData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
            setPointsOfSale(posData);
            setIsLoadingList(false);
        }, (error) => {
            console.error("Erreur lecture dépôts:", error);
            setIsLoadingList(false);
        });
        return () => unsubscribe();
    }, [db]);

    return (
        <div style={{padding:'2rem'}}>
            {showCreateModal && <CreatePosModal db={db} showToast={showToast} onClose={() => setShowCreateModal(false)} />}
            
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'2rem'}}>
                <div>
                    <h2 style={{fontSize:'1.875rem', fontWeight:'bold'}}>Tableau de Bord Administrateur</h2>
                    <p style={{color:'#9CA3AF'}}>Bienvenue, {user.displayName || user.email}.</p>
                </div>
                <button onClick={() => setShowCreateModal(true)} style={{backgroundColor:'#4F46E5', fontWeight:'bold', padding:'0.5rem 1rem', borderRadius:'0.5rem', display:'flex', alignItems:'center', gap:'0.5rem'}}>
                    <UserPlus size={18}/> Ajouter un Dépôt-Vente
                </button>
            </div>

            <div style={{backgroundColor:'#1F2937', borderRadius:'1rem', padding:'1.5rem'}}>
                <h3 style={{fontSize:'1.25rem', fontWeight:'bold', marginBottom:'1rem'}}>Liste des Dépôts-Ventes</h3>
                <div style={{display:'flex', flexDirection:'column', gap:'0.75rem'}}>
                    {isLoadingList ? (
                        <p style={{textAlign:'center', color:'#9CA3AF'}}>Chargement...</p>
                    ) : pointsOfSale.length > 0 ? (
                        pointsOfSale.map(pos => (
                            <div key={pos.uid} style={{backgroundColor:'#374151', padding:'1rem', borderRadius:'0.5rem', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                <div>
                                    <p style={{fontWeight:'bold'}}>{pos.displayName}</p>
                                    <p style={{fontSize:'0.875rem', color:'#9CA3AF'}}>{pos.email}</p>
                                </div>
                                <div style={{fontSize:'0.875rem', padding:'0.25rem 0.75rem', borderRadius:'9999px', backgroundColor: pos.status === 'active' ? 'rgba(52, 211, 153, 0.2)' : 'rgba(251, 191, 36, 0.2)', color: pos.status === 'active' ? '#6EE7B7' : '#FBBF24'}}>
                                    {pos.status === 'active' ? 'Actif' : 'Inactif'}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p style={{textAlign:'center', color:'#9CA3AF'}}>Aucun dépôt-vente créé.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

const PosDashboard = ({ user }) => {
    return (
        <div style={{padding:'2rem'}}>
            <div style={{display:'flex', alignItems:'center', gap:'1rem', fontSize:'1.875rem', fontWeight:'bold'}}>
                <Building size={32} />
                <h1>Tableau de Bord Dépôt-Vente</h1>
            </div>
            <p style={{marginTop:'0.5rem', color:'#9CA3AF'}}>Bienvenue, {user.displayName || user.email}.</p>
            <p style={{marginTop:'1rem', textAlign:'center', color:'#6B7280'}}>(Les fonctionnalités arriveront ici)</p>
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
        if (isLoading) { return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#111827'}}><div style={{width:'48px', height:'48px', border:'2px solid white', borderBottomColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite'}}></div></div>; }
        if (!user || !userData) { return <LoginPage onLogin={handleLogin} error={loginError} isLoggingIn={isLoggingIn} />; }
        
        return (
             <div style={{backgroundColor:'#111827', color:'white', minHeight:'100vh'}}>
                 <header style={{backgroundColor:'#1F2937', padding:'1rem', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #374151', position:'sticky', top:0, zIndex:30}}>
                    <div style={{display:'flex', alignItems:'center', gap:'0.75rem'}}>
                        <Package size={24} style={{color:'#6366F1'}}/>
                        <h1 style={{fontWeight:'bold', fontSize:'1.25rem'}}>{APP_NAME}</h1>
                    </div>
                    <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
                        <span style={{fontSize:'0.875rem'}}><span style={{fontWeight:'600'}}>{userData.displayName}</span> ({userData.role})</span>
                        <button onClick={handleLogout} title="Déconnexion"><LogOut size={20} /></button>
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
