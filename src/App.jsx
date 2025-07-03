import React, { useState, useEffect, useCallback } from 'react';
import { Package, User, LogOut } from 'lucide-react';
import { auth, db, onAuthStateChanged, signInWithEmailAndPassword, signOut, onSnapshot, doc, collection, query, orderBy } from './services/firebase';
import { AppProvider } from './contexts/AppContext';
import { APP_NAME, APP_TITLE } from './constants';
import LoginPage from './components/auth/LoginPage';
import InactiveAccountModal from './components/auth/InactiveAccountModal';
import ProfileModal from './components/user/ProfileModal';
import NotificationBell from './components/common/NotificationBell';
import AnimationStyles from './components/common/AnimationStyles';
import AdminDashboard from './views/AdminDashboard';
import PosDashboard from './views/PosDashboard';

export default function App() {
    const [isLoading, setIsLoading] = useState(true);
    const [loggedInUser, setLoggedInUser] = useState(null);
    const [loggedInUserData, setLoggedInUserData] = useState(null);
    const [loginError, setLoginError] = useState(null);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [products, setProducts] = useState([]);

    useEffect(() => { document.title = APP_TITLE; }, []);

    useEffect(() => {
        const unsubProducts = onSnapshot(query(collection(db, 'products'), orderBy('name')), (snapshot) => {
            setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => { unsubProducts(); };
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setLoggedInUser(user);
                const unsubUser = onSnapshot(doc(db, 'users', user.uid), (doc) => {
                    if (doc.exists()) {
                        setLoggedInUserData({ uid: user.uid, email: user.email, ...doc.data() });
                    } else {
                        signOut(auth);
                    }
                    setIsLoading(false);
                });
                return () => unsubUser();
            } else {
                setLoggedInUser(null);
                setLoggedInUserData(null);
                setIsLoading(false);
            }
        });
        return () => unsubscribe();
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

    const providerValue = { db, auth, loggedInUserData, products, scents: [], setShowProfileModal };

    if (isLoading) {
        return <div className="bg-gray-900 min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>;
    }

    return (
        <AppProvider value={providerValue}>
            <AnimationStyles />
            {!loggedInUser || !loggedInUserData ? (
                <LoginPage onLogin={handleLogin} error={loginError} isLoggingIn={isLoggingIn} />
            ) : (
                <>
                    {loggedInUserData.status === 'inactive' && loggedInUserData.role === 'pos' && <InactiveAccountModal onLogout={handleLogout} />}
                    <div className="bg-gray-900 text-white min-h-screen font-sans">
                        {showProfileModal && <ProfileModal onClose={() => setShowProfileModal(false)} />}
                        <header className="bg-gray-800/50 p-4 flex justify-between items-center shadow-md sticky top-0 z-30 backdrop-blur-sm">
                            <div className="flex items-center gap-2">
                                <Package size={24} className="text-indigo-400" />
                                <h1 className="text-xl font-bold">{APP_NAME}</h1>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-4">
                                <span className="text-gray-300 text-sm hidden sm:block">
                                    <span className="font-semibold">{loggedInUserData.displayName}</span> ({loggedInUserData.role})
                                </span>
                                {loggedInUserData.role === 'pos' &&
                                    <button onClick={() => setShowProfileModal(true)} title="Mon Profil" className="p-2 text-gray-400 hover:text-white"><User size={22} /></button>
                                }
                                <NotificationBell />
                                <button onClick={handleLogout} title="Déconnexion" className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700"><LogOut size={20} /></button>
                            </div>
                        </header>
                        <main>
                            {loggedInUserData.role === 'admin' ? <AdminDashboard /> : <PosDashboard />}
                        </main>
                    </div>
                </>
            )}
        </AppProvider>
    );
}
