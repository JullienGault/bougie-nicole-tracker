import React, { useState, useEffect, useMemo, useCallback, useContext } from 'react';

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
    collectionGroup,
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
    deleteDoc,
    runTransaction,
    arrayUnion,
    arrayRemove
} from 'firebase/firestore';

// Importations des icônes Lucide React
import {
    Package, Store, User, LogOut, LogIn, AlertTriangle, X, Info, Bell, ArchiveRestore, Phone, Mail,
    PlusCircle, CheckCircle, Truck, DollarSign, Archive, ChevronDown, ChevronUp, Check, XCircle, Trash2,
    Send, UserPlus, Percent, Save, Wrench, HandCoins, CalendarCheck, Coins, History, CircleDollarSign, ArrowRightCircle, Edit, ImageOff, Search
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
const LOW_STOCK_THRESHOLD = 3;

const DELIVERY_STATUS_STEPS = {
    pending: 'En attente',
    processing: 'En traitement',
    shipping: 'En cours de livraison',
    delivered: 'Livrée',
    cancelled: 'Annulée'
};
const deliveryStatusOrder = ['pending', 'processing', 'shipping', 'delivered'];

const PAYOUT_STATUSES = {
    pending: { text: 'En attente', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    processing: { text: 'En traitement', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    received: { text: 'Reçu', color: 'text-green-400', bg: 'bg-green-500/10' },
};
const payoutStatusOrder = ['pending', 'processing', 'received'];

// =================================================================
// INITIALISATION DE FIREBASE
// =================================================================
let firebaseApp;
if (!getApps().length) {
    firebaseApp = initializeApp(firebaseConfig);
} else {
    firebaseApp = getApps()[0];
}

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

// =================================================================
// CONTEXTE DE L'APPLICATION
// =================================================================
const AppContext = React.createContext(null);

// =================================================================
// FONCTIONS UTILITAIRES ET COMPOSANTS UI
// =================================================================

const formatPrice = (price) => `${(price || 0).toFixed(2)} €`;
const formatDate = (timestamp) => !timestamp?.toDate ? 'Date inconnue' : timestamp.toDate().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const formatPercent = (rate) => `${((rate || 0) * 100).toFixed(0)} %`;
const formatPhone = (phoneStr) => {
    if (!phoneStr) return '';
    const cleaned = ('' + phoneStr).replace(/\D/g, '');
    const match = cleaned.match(/.{1,2}/g);
    return match ? match.join(' ') : '';
};

const formatRelativeTime = (timestamp) => {
    if (!timestamp?.toDate) return null;
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
    const years = Math.floor(days / 365);
    return `il y a ${years} an(s)`;
};

const AnimationStyles = () => ( <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}.animate-fade-in{animation:fadeIn .5s ease-in-out}@keyframes fadeInUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.animate-fade-in-up{animation:fadeInUp .5s ease-out forwards}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.animate-spin{animation:spin 1s linear infinite}.custom-scrollbar::-webkit-scrollbar{width:8px}.custom-scrollbar::-webkit-scrollbar-track{background:#1f2937}.custom-scrollbar::-webkit-scrollbar-thumb{background:#4f46e5;border-radius:10px}`}</style> );

const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const getToastStyle = () => {
        switch (type) {
            case 'success': return 'bg-green-600';
            case 'error': return 'bg-red-600';
            case 'info':
            default: return 'bg-blue-600';
        }
    };

    const getToastIcon = () => {
        const IconComponent = {
            success: CheckCircle,
            error: XCircle,
            info: Info
        }[type] || Info;
        return <IconComponent size={24} />;
    };

    return (
        <div className={`fixed bottom-5 right-5 p-4 rounded-lg shadow-2xl text-white flex items-center gap-3 z-[999] animate-fade-in-up ${getToastStyle()}`}>
            {getToastIcon()}
            <span>{message}</span>
            <button onClick={onClose} className="ml-2 opacity-80 hover:opacity-100"><X size={20}/></button>
        </div>
    );
};

const InfoModal = ({ title, message, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
        <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="text-center">
                <Info className="mx-auto h-12 w-12 text-blue-400"/>
                <h3 className="mt-4 text-xl font-semibold text-white">{title}</h3>
                <p className="text-gray-400 mt-2">{message}</p>
            </div>
            <div className="mt-8 flex justify-center">
                <button onClick={onClose} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg">Fermer</button>
            </div>
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
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in" onClick={onCancel}>
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <div className="text-center">
                    <AlertTriangle className="mx-auto h-12 w-12 text-yellow-400"/>
                    <h3 className="mt-4 text-xl font-semibold text-white">{title}</h3>
                    <div className="text-gray-400 mt-2 whitespace-pre-line">{message}</div>
                </div>
                {requiresReason && (
                    <div className="mt-6">
                        <label className="block text-sm font-medium text-gray-300 mb-2">Raison (obligatoire)</label>
                        <textarea value={reason} onChange={e=>setReason(e.target.value)} rows="3" className="w-full bg-gray-700 p-3 rounded-lg" placeholder="Ex: Rupture de stock, demande client..."></textarea>
                    </div>
                )}
                <div className="mt-8 flex justify-center gap-4">
                    <button onClick={onCancel} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg">{cancelText}</button>
                    {onConfirm && <button onClick={handleConfirm} className={`${confirmColor} text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50`} disabled={requiresReason && !reason.trim()}>
                        {confirmText}
                    </button>}
                </div>
            </div>
        </div>
    );
};

const ReasonPromptModal = ({ title, message, onConfirm, onCancel }) => {
    const [reason, setReason] = useState('');

    const handleConfirm = () => {
        if (!reason.trim()) {
            alert("Le motif est obligatoire.");
            return;
        }
        onConfirm(reason);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60]" onClick={onCancel}>
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-700 animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-semibold text-white">{title}</h3>
                <p className="text-gray-400 mt-2">{message}</p>
                <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Motif (obligatoire)</label>
                    <textarea
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        rows="4"
                        className="w-full bg-gray-700 p-3 rounded-lg"
                        placeholder="Ex: Rupture de stock sur un produit...">
                    </textarea>
                </div>
                <div className="mt-8 flex justify-end gap-4">
                    <button onClick={onCancel} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg">Annuler</button>
                    <button onClick={handleConfirm} className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50" disabled={!reason.trim()}>
                        Valider et Enregistrer
                    </button>
                </div>
            </div>
        </div>
    );
};

const SaleModal = ({ posId, stock, onClose }) => {
    const { db, showToast } = useContext(AppContext);
    const [items, setItems] = useState([{ stockId: '', quantity: 1, maxQuantity: 0 }]);
    const [isLoading, setIsLoading] = useState(false);

    const availableStock = useMemo(() => stock.filter(s => s.quantity > 0), [stock]);

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
        if (field === 'stockId') {
            const selectedStock = stock.find(s => s.id === value);
            newItems[index].maxQuantity = selectedStock ? selectedStock.quantity : 0;
            newItems[index].quantity = 1;
        }
        if (field === 'quantity') {
            newItems[index].quantity = Math.max(1, Math.min(Number(value), newItems[index].maxQuantity));
        }
        setItems(newItems);
    };

    const addItem = () => setItems([...items, { stockId: '', quantity: 1, maxQuantity: 0 }]);
    const removeItem = (index) => setItems(items.filter((_, i) => i !== index));

    const handleConfirmSale = async () => {
        const validItems = items.filter(item => item.stockId && item.quantity > 0);
        if (validItems.length === 0) {
            showToast("Veuillez ajouter au moins un produit à la vente.", "error");
            return;
        }
        setIsLoading(true);

        const batch = writeBatch(db);
        let allSucceeded = true;

        for (const item of validItems) {
            const stockItem = stock.find(s => s.id === item.stockId);
            if (!stockItem || stockItem.quantity < item.quantity) {
                showToast(`Stock insuffisant pour ${stockItem.productName}.`, "error");
                allSucceeded = false;
                break;
            }

            const stockDocRef = doc(db, `pointsOfSale/${posId}/stock`, item.stockId);
            batch.update(stockDocRef, { quantity: stockItem.quantity - item.quantity });

            const saleDocRef = doc(collection(db, `pointsOfSale/${posId}/sales`));
            
            // On s'assure que posId est toujours inclus pour les requêtes futures
            batch.set(saleDocRef, {
                posId: posId, 
                productId: stockItem.productId,
                productName: stockItem.productName,
                scent: stockItem.scent,
                quantity: item.quantity,
                unitPrice: stockItem.price,
                totalAmount: stockItem.price * item.quantity,
                createdAt: serverTimestamp(),
                payoutId: null
            });
        }

        if (allSucceeded) {
            try {
                await batch.commit();
                showToast("Vente enregistrée avec succès !", "success");
                onClose();
            } catch (error) {
                console.error("Erreur lors de la vente :", error);
                showToast("Une erreur est survenue.", "error");
            }
        }
        setIsLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 p-8 rounded-2xl w-full max-w-2xl border-gray-700 custom-scrollbar max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-white mb-6">Enregistrer une Vente</h2>
                <div className="space-y-3">
                    {items.map((item, index) => (
                        <div key={index} className="bg-gray-700/50 p-4 rounded-lg flex gap-4 items-end">
                            <div className="flex-grow">
                                <label className="text-sm">Produit</label>
                                <select value={item.stockId} onChange={e => handleItemChange(index, 'stockId', e.target.value)} className="w-full bg-gray-600 p-2 rounded-lg mt-1">
                                    <option value="">-- Choisir un produit en stock --</option>
                                    {availableStock.map(s => <option key={s.id} value={s.id}>{s.productName} {s.scent && `(${s.scent})`} - Stock: {s.quantity}</option>)}
                                </select>
                            </div>
                            <div className="w-32">
                                <label className="text-sm">Quantité</label>
                                <input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} min="1" max={item.maxQuantity} className="w-full bg-gray-600 p-2 rounded-lg mt-1" disabled={!item.stockId} />
                            </div>
                            {items.length > 1 && <button onClick={() => removeItem(index)} className="p-2 bg-red-600 rounded-lg text-white mb-px"><Trash2 size={20} /></button>}
                        </div>
                    ))}
                </div>
                <button type="button" onClick={addItem} className="mt-4 flex items-center gap-2 text-indigo-400"><PlusCircle size={20}/>Ajouter un article</button>
                <div className="flex justify-end gap-4 mt-8">
                    <button onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Annuler</button>
                    <button onClick={handleConfirmSale} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-60" disabled={isLoading}>
                        {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2"></div> : <><CheckCircle size={18} /> Valider la vente</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

const NotificationBell = ({ onLogout }) => {
    const { db, loggedInUserData } = useContext(AppContext);
    const [notifications, setNotifications] = useState([]);
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    useEffect(() => {
        if (!loggedInUserData || !db) return;

        const recipientIds = loggedInUserData.role === 'admin'
            ? [loggedInUserData.uid, 'all_admins']
            : [loggedInUserData.uid];

        const q = query(
            collection(db, 'notifications'),
            where('recipientUid', 'in', recipientIds),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => {
            console.error("Erreur de lecture des notifications (vérifiez les index Firestore): ", error);
        });

        return () => unsubscribe();
    }, [db, loggedInUserData]);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const handleMarkOneAsRead = async (notificationId) => {
        const notifDocRef = doc(db, 'notifications', notificationId);
        try {
            await updateDoc(notifDocRef, { isRead: true });
        } catch (error) {
            console.error("Erreur lors de la mise à jour de la notification: ", error);
        }
    };

    const handleMarkAllAsRead = async () => {
        if (unreadCount === 0) return;
        const batch = writeBatch(db);
        notifications.forEach(notif => {
            if (!notif.isRead) {
                const notifDocRef = doc(db, 'notifications', notif.id);
                batch.update(notifDocRef, { isRead: true });
            }
        });
        try {
            await batch.commit();
        } catch (error) {
            console.error("Erreur lors de la mise à jour des notifications: ", error);
        }
    };

    return (
        <div className="relative">
            <button onClick={() => setIsPanelOpen(!isPanelOpen)} className="relative p-2 text-gray-400 hover:text-white">
                <Bell size={22} />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                )}
            </button>

            {isPanelOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-gray-800 rounded-lg shadow-2xl border border-gray-700 animate-fade-in-up z-50">
                    <div className="p-3 flex justify-between items-center border-b border-gray-700">
                        <h4 className="font-bold text-white">Notifications</h4>
                        {unreadCount > 0 &&
                            <button onClick={handleMarkAllAsRead} className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold">
                                Marquer tout comme lu
                            </button>
                        }
                    </div>
                    <div className="max-h-96 overflow-y-auto custom-scrollbar">
                        {notifications.length > 0 ? notifications.map(notif => (
                            <div key={notif.id}
                                 onClick={() => handleMarkOneAsRead(notif.id)}
                                 className={`p-4 border-b border-gray-700/50 cursor-pointer hover:bg-gray-900/50 ${!notif.isRead ? 'bg-indigo-900/20' : ''}`}>
                                <p className="text-sm text-gray-200">{notif.message}</p>
                                <p className="text-xs text-gray-400 mt-1.5">{formatRelativeTime(notif.createdAt)}</p>
                            </div>
                        )) : <p className="p-4 text-sm text-center text-gray-400">Aucune nouvelle notification.</p>}
                    </div>
                </div>
            )}
        </div>
    );
};

const KpiCard = ({ title, value, icon: Icon, color }) => ( <div className="bg-gray-800 p-5 rounded-xl flex items-center gap-4"><div className={`p-3 rounded-lg ${color}`}><Icon size={28} className="text-white"/></div><div><p className="text-gray-400 text-sm font-medium">{title}</p><p className="text-2xl font-bold text-white">{value}</p></div></div> );

const LoginPage = ({ onLogin, error, isLoggingIn }) => { const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const handleSubmit = (e) => { e.preventDefault(); if (!isLoggingIn) onLogin(email, password); }; return <div className="bg-gray-900 min-h-screen flex flex-col items-center justify-center p-4"><div className="text-center mb-8 animate-fade-in"><Package size={48} className="mx-auto text-indigo-400"/><h1 className="text-4xl font-bold text-white mt-4">{APP_NAME}</h1><p className="text-gray-400">Espace de connexion</p></div><div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-700 animate-fade-in-up"><form onSubmit={handleSubmit} className="space-y-6"><div><label className="block text-sm font-medium text-gray-300 mb-2">Adresse Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg" /></div><div><label className="block text-sm font-medium text-gray-300 mb-2">Mot de passe</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg" /></div>{error && (<p className="text-red-400 text-sm text-center bg-red-500/10 p-3 rounded-lg">{error}</p>)}<button type="submit" disabled={isLoggingIn} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60">{isLoggingIn ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div> : <><LogIn size={20} /> Se connecter</>}</button></form></div></div>;};

const InactiveAccountModal = ({ onLogout }) => (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50 animate-fade-in">
        <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 text-center animate-fade-in-up">
            <AlertTriangle className="mx-auto h-12 w-12 text-yellow-400"/>
            <h3 className="mt-4 text-xl font-semibold text-white">Compte Inactif</h3>
            <p className="text-gray-400 mt-2">Votre compte a été désactivé. Veuillez contacter un administrateur pour plus d'informations.</p>
            <div className="mt-8">
                <button onClick={onLogout} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg">Déconnexion</button>
            </div>
        </div>
    </div>
);

const CreatePosModal = ({ onClose }) => {
    const { db, showToast } = useContext(AppContext);
    const [depotName, setDepotName] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleCreate = async (ev) => {
        ev.preventDefault();
        if(!depotName || !firstName || !lastName || !email || !phone || password.length < 6){
            showToast("Tous les champs sont obligatoires. Le mot de passe doit faire 6+ caractères.", "error");
            return;
        }
        setIsLoading(true);
        const appName = `secondary-app-${Date.now()}`;
        let secondaryApp;
        try {
            secondaryApp = initializeApp(firebaseConfig, appName);
            const secondaryAuth = getAuth(secondaryApp);
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            const newUser = userCredential.user;

            const batch = writeBatch(db);

            const userDocRef = doc(db, "users", newUser.uid);
            batch.set(userDocRef, {
                displayName: depotName,
                email: email,
                firstName: firstName,
                lastName: lastName,
                phone: phone,
                role: "pos",
                status: "active",
                createdAt: serverTimestamp()
            });

            const posDocRef = doc(db, "pointsOfSale", newUser.uid);
            batch.set(posDocRef, {
                name: depotName,
                commissionRate: 0.3,
                createdAt: serverTimestamp(),
                status: "active",
                isArchived: false
            });

            await batch.commit();
            showToast(`Compte pour ${depotName} créé avec succès !`, "success");
            onClose();
        } catch(err) {
            if (err.code === 'auth/email-already-in-use') {
                showToast("Cette adresse email est déjà utilisée.", "error");
            } else {
                console.error(err);
                showToast("Erreur lors de la création du compte.", "error");
            }
        } finally {
            setIsLoading(false);
            if (secondaryApp) {
                signOut(getAuth(secondaryApp)).then(() => deleteApp(secondaryApp));
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40" onClick={onClose}>
            <div className="bg-gray-800 p-8 rounded-2xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-white mb-6">Ajouter un Dépôt-Vente</h2>
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Nom du Dépôt-Vente</label>
                        <input type="text" value={depotName} onChange={e=>setDepotName(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Prénom du Contact</label>
                            <input type="text" value={firstName} onChange={e=>setFirstName(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Nom du Contact</label>
                            <input type="text" value={lastName} onChange={e=>setLastName(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Téléphone</label>
                            <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/>
                        </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Mot de passe initial</label>
                        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/>
                    </div>
                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Annuler</button>
                        <button type="submit" disabled={isLoading} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-60">
                            {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2"></div> : <><UserPlus size={18}/>Créer</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ProfileModal = ({ onClose }) => {
    const { loggedInUserData, db, showToast } = useContext(AppContext);
    const [formData, setFormData] = useState({
        firstName: loggedInUserData.firstName || '',
        lastName: loggedInUserData.lastName || '',
        phone: loggedInUserData.phone || ''
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
            const userDocRef = doc(db, "users", loggedInUserData.uid);
            await updateDoc(userDocRef, {
                firstName: formData.firstName,
                lastName: formData.lastName,
                phone: formData.phone,
            });

            await addDoc(collection(db, 'notifications'), {
                recipientUid: 'all_admins',
                message: `Le dépôt "${loggedInUserData.displayName}" a mis à jour ses informations de contact.`,
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
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-gray-800 p-8 rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
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
                        <input type="email" value={loggedInUserData.email} readOnly className="w-full bg-gray-900/50 p-3 rounded-lg cursor-not-allowed"/>
                         <p className="text-xs text-gray-400 mt-1">Pour modifier votre email, veuillez contacter un administrateur.</p>
                    </div>
                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Annuler</button>
                        <button type="submit" disabled={isLoading} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-60">
                            {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2"></div> : <><Save size={18}/>Enregistrer</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const EditPosUserModal = ({ posUser, onClose, onSave }) => {
    const { db, showToast } = useContext(AppContext);
    const [formData, setFormData] = useState({
        firstName: posUser.firstName || '',
        lastName: posUser.lastName || '',
        phone: posUser.phone || '',
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
            const userDocRef = doc(db, "users", posUser.id);
            await updateDoc(userDocRef, {
                firstName: formData.firstName,
                lastName: formData.lastName,
                phone: formData.phone,
            });

            showToast("Informations de contact mises à jour !", "success");
            onSave();
            onClose();
        } catch (error) {
            console.error("Erreur de mise à jour du contact du dépôt: ", error);
            showToast("Erreur lors de la mise à jour.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 p-8 rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-white mb-6">Modifier les infos de "{posUser.name}"</h2>
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Prénom du Contact</label>
                            <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required className="w-full bg-gray-700 p-3 rounded-lg"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Nom du Contact</label>
                            <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} required className="w-full bg-gray-700 p-3 rounded-lg"/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Téléphone</label>
                        <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className="w-full bg-gray-700 p-3 rounded-lg"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                        <input type="email" value={posUser.email} readOnly className="w-full bg-gray-900/50 p-3 rounded-lg cursor-not-allowed"/>
                    </div>
                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Annuler</button>
                        <button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-60">
                            {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2"></div> : <><Save size={18}/>Enregistrer</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const EditPosModal = ({ pos, onClose, onSave, hasOpenBalance }) => {
    const { db, showToast } = useContext(AppContext);
    const [name, setName] = useState(pos.name);
    const [commissionRate, setCommissionRate] = useState((pos.commissionRate || 0) * 100);
    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async (event) => {
        event.preventDefault();

        if (hasOpenBalance && pos.commissionRate * 100 !== parseFloat(commissionRate)) {
            showToast("Clôturez la période de paiement en cours avant de modifier la commission.", "error");
            return;
        }

        setIsLoading(true);
        const newRate = parseFloat(commissionRate) / 100;
        if (isNaN(newRate) || newRate < 0 || newRate > 1) {
            showToast("Le taux de commission doit être entre 0 et 100.", "error");
            setIsLoading(false);
            return;
        }
        try {
            const batch = writeBatch(db);
            const posDocRef = doc(db, "pointsOfSale", pos.id);
            const userDocRef = doc(db, "users", pos.id);

            batch.update(posDocRef, { name: name, commissionRate: newRate });
            batch.update(userDocRef, { displayName: name }); // Keep name and displayName consistent

            await batch.commit();

            if (pos.commissionRate !== newRate) {
              await addDoc(collection(db, 'notifications'), {
                  recipientUid: pos.id,
                  message: `Le taux de votre commission a été mis à jour à ${formatPercent(newRate)}.`,
                  createdAt: serverTimestamp(),
                  isRead: false,
                  type: 'COMMISSION_UPDATE'
              });
            }

            showToast("Dépôt mis à jour avec succès !", "success");
            onSave();
            onClose();
        } catch (error) {
            console.error("Erreur de mise à jour du dépôt : ", error);
            showToast("Erreur lors de la mise à jour.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-gray-800 p-8 rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-white mb-6">Paramètres du Dépôt-Vente</h2>
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Nom du Dépôt</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Taux de Commission (%)</label>
                        <input
                            type="number"
                            value={commissionRate}
                            onChange={e => setCommissionRate(e.target.value)}
                            required
                            min="0"
                            max="100"
                            className={`w-full bg-gray-700 p-3 rounded-lg ${hasOpenBalance ? 'cursor-not-allowed bg-gray-900/50' : ''}`}
                            disabled={hasOpenBalance}
                        />
                        {hasOpenBalance && (
                             <p className="text-xs text-yellow-400 mt-2">
                                 <Info size={14} className="inline mr-1" />
                                 Vous devez clôturer la période de paiement en cours pour modifier ce taux.
                              </p>
                        )}
                    </div>
                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Annuler</button>
                        <button type="submit" disabled={isLoading} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50">
                            {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2"></div> : <><Save size={18}/>Enregistrer</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const DeliveryRequestModal = ({ posId, posName, onClose }) => {
    const { db, showToast, products, scents } = useContext(AppContext);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [requestedQuantities, setRequestedQuantities] = useState({});

    const handleQuantityChange = (productId, scentName, quantityStr) => {
        const quantity = parseInt(quantityStr, 10);
        const key = scentName ? `${productId}_${scentName}` : productId;

        setRequestedQuantities(prev => {
            const newQuantities = { ...prev };
            if (isNaN(quantity) || quantity <= 0) {
                delete newQuantities[key];
            } else {
                newQuantities[key] = quantity;
            }
            return newQuantities;
        });
    };

    const handleSend = async () => {
        const itemsToSend = Object.entries(requestedQuantities)
            .map(([key, quantity]) => {
                if (quantity > 0) {
                    const parts = key.split('_');
                    const productId = parts[0];
                    const scent = parts.length > 1 ? parts.slice(1).join('_') : null;
                    return { productId, scent, quantity };
                }
                return null;
            })
            .filter(Boolean);

        if (itemsToSend.length === 0) {
            showToast("Veuillez demander une quantité pour au moins un produit.", "error");
            return;
        }

        setIsLoading(true);
        try {
            await addDoc(collection(db, 'deliveryRequests'), {
                posId,
                posName,
                items: itemsToSend,
                status: 'pending',
                createdAt: serverTimestamp(),
                archivedBy: []
            });

            await addDoc(collection(db, 'notifications'), {
                recipientUid: 'all_admins',
                message: `Nouvelle demande de livraison reçue de ${posName}.`,
                createdAt: serverTimestamp(),
                isRead: false,
                type: 'NEW_DELIVERY_REQUEST'
            });

            showToast("Demande de livraison envoyée avec succès !", "success");
            onClose();
        } catch (error) {
            console.error("Erreur lors de l'envoi de la demande de livraison: ", error);
            showToast("Une erreur est survenue lors de l'envoi.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const filteredProducts = useMemo(() => {
        if (!searchTerm) return products;
        return products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [products, searchTerm]);
    
    const totalItems = Object.values(requestedQuantities).reduce((sum, qty) => sum + qty, 0);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-2xl w-full max-w-4xl border-gray-700 flex flex-col h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-700">
                    <h2 className="text-2xl font-bold text-white">Demander une Livraison</h2>
                    <p className="text-gray-400">Parcourez le catalogue et indiquez les quantités souhaitées.</p>
                     <div className="relative mt-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Rechercher un produit..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-700 p-2 pl-10 rounded-lg"
                        />
                    </div>
                </div>

                <div className="flex-grow p-6 overflow-y-auto custom-scrollbar">
                    {filteredProducts.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredProducts.map(p => {
                                const key_noscent = p.id;
                                return (
                                <div key={p.id} className="bg-gray-900/50 rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between animate-fade-in-up">
                                    {p.imageUrl ? (
                                        <img src={p.imageUrl} alt={p.name} className="w-full h-48 object-cover"/>
                                    ) : (
                                        <div className="w-full h-48 bg-gray-700 flex items-center justify-center">
                                            <ImageOff size={48} className="text-gray-500"/>
                                        </div>
                                    )}
                                    <div className="p-4 flex-grow">
                                        <h3 className="font-bold text-lg text-white">{p.name}</h3>
                                        <p className="text-indigo-400 font-semibold text-xl mt-1">{formatPrice(p.price)}</p>
                                    </div>
                                    <div className="p-4 pt-2">
                                        {!p.hasScents ? (
                                             <div>
                                                <label className="text-sm font-medium text-gray-300 block mb-1">Quantité</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    placeholder="0"
                                                    value={requestedQuantities[key_noscent] || ''}
                                                    onChange={e => handleQuantityChange(p.id, null, e.target.value)}
                                                    className="w-full bg-gray-700 p-2 rounded-lg text-center font-bold text-lg"
                                                />
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <p className="text-sm font-medium text-gray-300 -mb-1">Quantités par parfum :</p>
                                                {scents.map(scent => {
                                                    const key_scent = `${p.id}_${scent.name}`;
                                                    return (
                                                        <div key={scent.id} className="flex items-center justify-between gap-2">
                                                            <label htmlFor={key_scent} className="text-gray-300 text-sm">{scent.name}</label>
                                                            <input
                                                                id={key_scent}
                                                                type="number"
                                                                min="0"
                                                                placeholder="0"
                                                                value={requestedQuantities[key_scent] || ''}
                                                                onChange={e => handleQuantityChange(p.id, scent.name, e.target.value)}
                                                                className="w-20 bg-gray-700 p-1 rounded-md text-center"
                                                            />
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    ) : (
                         <div className="text-center py-16 text-gray-400">
                             <p>Aucun produit ne correspond à votre recherche "{searchTerm}".</p>
                         </div>
                    )}
                </div>
                
                <div className="p-6 border-t border-gray-700 bg-gray-800 flex justify-between items-center">
                     <div>
                        <span className="font-bold text-lg">{totalItems}</span>
                        <span className="text-gray-400"> article(s) dans la demande.</span>
                    </div>
                    <div className="flex gap-4">
                        <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg">Annuler</button>
                        <button onClick={handleSend} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg flex items-center gap-2" disabled={isLoading || totalItems === 0}>
                            {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2"></div> : <><Send size={18}/>Envoyer la demande</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


const ProcessDeliveryModal = ({ request, onClose, onCancelRequest }) => {
    const { db, products, showToast } = useContext(AppContext);
    const [isLoading, setIsLoading] = useState(false);
    const [editableItems, setEditableItems] = useState(request.items);
    const [showReasonModal, setShowReasonModal] = useState(false);

    const DeliveryStatusTracker = ({ status }) => {
        if (status === 'cancelled') {
            return (
                <div className="flex items-center gap-4 bg-red-500/10 p-3 rounded-lg">
                    <AlertTriangle className="h-8 w-8 text-red-500"/>
                    <div>
                        <h4 className="font-bold text-red-400">Commande Annulée</h4>
                        <p className="text-xs text-gray-400">Cette commande ne sera pas traitée.</p>
                    </div>
                </div>
            );
        }
        const currentIndex = deliveryStatusOrder.indexOf(status);
        return (
            <div className="flex items-center space-x-4">
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
                            {index < deliveryStatusOrder.length - 1 && (<div className={`flex-1 h-1 rounded-full ${isCompleted ? 'bg-green-600' : 'bg-gray-600'}`}></div>)}
                        </React.Fragment>
                    );
                })}
            </div>
        );
    };

    const handleQuantityChange = (index, quantity) => { const newItems = [...editableItems]; newItems[index].quantity = Math.max(0, Number(quantity)); setEditableItems(newItems); };
    const handleRemoveItem = (index) => { setEditableItems(editableItems.filter((_, i) => i !== index)); };

    const handleSaveChanges = async (reason) => {
        setShowReasonModal(false);
        setIsLoading(true);
        try {
            const requestDocRef = doc(db, 'deliveryRequests', request.id);
            const dataToUpdate = {
                items: editableItems,
                modificationReason: reason
            };
            if (!request.originalItems) {
                dataToUpdate.originalItems = request.items;
            }
            await updateDoc(requestDocRef, dataToUpdate);
            await addDoc(collection(db, 'notifications'), {
                recipientUid: request.posId,
                message: `Votre demande de livraison du ${formatDate(request.createdAt)} a été modifiée.`,
                createdAt: serverTimestamp(),
                isRead: false,
                type: 'DELIVERY_MODIFIED'
            });
            showToast("Modifications enregistrées !", "success");
        } catch (error) {
            showToast("Erreur lors de la sauvegarde.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAdvanceStatus = async () => {
        setIsLoading(true);
        const currentIndex = deliveryStatusOrder.indexOf(request.status);
        if (currentIndex >= deliveryStatusOrder.length - 1) { setIsLoading(false); return; }
        const nextStatus = deliveryStatusOrder[currentIndex + 1];
        try {
            if (nextStatus === 'delivered') {
                await runTransaction(db, async (transaction) => {
                    const requestDocRef = doc(db, "deliveryRequests", request.id);
                    for (const item of editableItems) {
                        const product = products.find(p => p.id === item.productId);
                        if (!product) throw new Error(`Produit ID ${item.productId} non trouvé.`);
                        
                        // Adapt stockId creation based on whether the product uses scents
                        const stockId = product.hasScents ? `${item.productId}_${item.scent}` : item.productId;
                        
                        const stockDocRef = doc(db, `pointsOfSale/${request.posId}/stock`, stockId);
                        const stockDoc = await transaction.get(stockDocRef);
                        
                        if (stockDoc.exists()) {
                            const newQuantity = (stockDoc.data().quantity || 0) + item.quantity;
                            transaction.update(stockDocRef, { quantity: newQuantity });
                        } else {
                            transaction.set(stockDocRef, { 
                                productId: item.productId, 
                                productName: product.name, 
                                price: product.price, 
                                scent: item.scent || null, 
                                quantity: item.quantity,
                                hasScents: !!product.hasScents // Make sure this is stored in stock too
                            });
                        }
                    }
                    transaction.update(requestDocRef, { status: 'delivered', items: editableItems });
                });
                showToast("Livraison confirmée et stock mis à jour !", "success");
            } else {
                const requestDocRef = doc(db, 'deliveryRequests', request.id);
                await updateDoc(requestDocRef, { status: nextStatus });
                showToast(`Statut mis à jour : ${DELIVERY_STATUS_STEPS[nextStatus]}`, "success");
            }
            await addDoc(collection(db, 'notifications'), {
                recipientUid: request.posId,
                message: `Le statut de votre commande est maintenant : "${DELIVERY_STATUS_STEPS[nextStatus]}".`,
                createdAt: serverTimestamp(),
                isRead: false,
                type: 'DELIVERY_UPDATE'
            });
            onClose();
        } catch (error) {
            console.error("Erreur: ", error);
            showToast(error.message || "Erreur lors de la mise à jour.", "error");
        } finally {
            setIsLoading(false);
        }
    };
    const isLastStep = request.status === 'shipping'; const canAdvance = request.status !== 'delivered' && request.status !== 'cancelled';

    return (
    <>
        {showReasonModal && (
            <ReasonPromptModal
                title="Justifier les modifications"
                message="Veuillez expliquer pourquoi la commande est modifiée. Ce motif sera visible par le client."
                onConfirm={handleSaveChanges}
                onCancel={() => setShowReasonModal(false)}
            />
        )}
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-gray-800 p-8 rounded-2xl w-full max-w-3xl" onClick={e=>e.stopPropagation()}>
                <div className="flex justify-between items-start mb-6">
                    <div> <h2 className="text-2xl font-bold text-white mb-2">Gérer la livraison pour :</h2> <p className="text-indigo-400 text-xl font-semibold">{request.posName}</p> </div>
                    {request.status !== 'delivered' && request.status !== 'cancelled' && <button onClick={() => onCancelRequest(request)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"> <XCircle size={18}/> Annuler la Commande </button>}
                </div>
                <div className="mb-8"> <DeliveryStatusTracker status={request.status} /> </div>
                <div className="bg-gray-700/50 p-4 rounded-lg max-h-64 overflow-y-auto custom-scrollbar"> <table className="w-full text-left"> <thead><tr className="border-b border-gray-600"><th className="p-2">Produit / Parfum</th><th className="p-2 w-32">Quantité</th><th className="p-2 w-16">Actions</th></tr></thead> <tbody> {editableItems.map((item, index) => { const product = products.find(p => p.id === item.productId); return ( <tr key={index} className="border-b border-gray-700/50"> <td className="p-2">{product?.name || 'Inconnu'} <span className="text-gray-400">{item.scent || ''}</span></td> <td className="p-2"><input type="number" value={item.quantity} onChange={(e) => handleQuantityChange(index, e.target.value)} className="w-20 bg-gray-600 p-1 rounded-md text-center" disabled={!canAdvance} /></td> <td className="p-2">{canAdvance ? <button onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-400 p-1"><Trash2 size={18}/></button> : null}</td> </tr> ); })} </tbody> </table> </div>
                <div className="mt-8 flex justify-between items-center">
                    {canAdvance ? <button onClick={() => setShowReasonModal(true)} disabled={isLoading} className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50"> {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2"></div> : <><Save size={18}/> Enregistrer Modifications</>} </button> : <div></div>}
                    <div className="flex gap-4">
                        <button type="button" onClick={onClose} className="bg-gray-600 font-bold py-2 px-4 rounded-lg">Fermer</button>
                        {canAdvance && ( <button onClick={handleAdvanceStatus} disabled={isLoading} className={`${isLastStep ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50`}> {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2"></div> : isLastStep ? <><CheckCircle size={18}/>Confirmer la Livraison</> : <><Truck size={18}/>Étape Suivante</>} </button> )}
                    </div>
                </div>
            </div>
        </div>
    </>
    );
};


// =================================================================
// ============== COMPOSANTS PRODUITS (VOTRE SECTION) ==============
// =================================================================

const ProductFormModal = ({ product, onClose }) => {
    const { db, showToast } = useContext(AppContext);
    const isEditing = !!product?.id;

    const [name, setName] = useState(product?.name || '');
    const [price, setPrice] = useState(product?.price || 0);
    const [imageUrl, setImageUrl] = useState(product?.imageUrl || '');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name || price <= 0) {
            showToast("Veuillez remplir le nom et un prix valide.", "error");
            return;
        }
        setIsLoading(true);
        
        const productData = {
            name,
            price: Number(price),
            imageUrl: imageUrl.trim(), // On enregistre l'URL de l'image
            updatedAt: serverTimestamp(),
        };

        try {
            if (isEditing) {
                const productDocRef = doc(db, "products", product.id);
                await updateDoc(productDocRef, productData);
                showToast("Produit mis à jour avec succès !", "success");
            } else {
                productData.createdAt = serverTimestamp();
                // L'appel à addDoc déclenchera le listener onSnapshot dans App.js
                await addDoc(collection(db, "products"), productData);
                showToast("Produit ajouté avec succès !", "success");
            }
            onClose();
        } catch (error) {
            console.error("Erreur lors de la sauvegarde du produit :", error);
            showToast("Une erreur est survenue.", "error");
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 p-8 rounded-2xl w-full max-w-lg border-gray-700" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-white mb-6">{isEditing ? "Modifier le Produit" : "Ajouter un Produit"}</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Nom du produit</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg" placeholder="ex: Bougie 100g"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Prix de vente (€)</label>
                        <input type="number" value={price} onChange={e => setPrice(e.target.value)} required min="0.01" step="0.01" className="w-full bg-gray-700 p-3 rounded-lg" />
                    </div>
                    <div>
            _C_U_T_P_A_S_T_E_D_T_O_P_R_E_V_E_N_T_L_O_N_G_M_E_S_S_A_G_E_S
                        <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Annuler</button>
                        <button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-60">
                           {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2"></div> : <><Save size={18}/> {isEditing ? "Enregistrer" : "Créer"}</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ProductManager = ({ onBack }) => {
    // 1. On récupère la liste des produits via le contexte.
    // Cette liste est toujours à jour car elle provient de l'état global de App.js,
    // qui est lui-même mis à jour par le listener onSnapshot.
    const { products, showToast, db } = useContext(AppContext);
    const [productToEdit, setProductToEdit] = useState(null);
    const [productToDelete, setProductToDelete] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const handleDelete = async () => {
        if (!productToDelete) return;

        try {
            // TODO: Ajouter une vérification pour savoir si le produit est en stock quelque part avant de supprimer.
            // L'appel à deleteDoc déclenchera aussi le listener onSnapshot dans App.js
            await deleteDoc(doc(db, 'products', productToDelete.id));
            showToast("Produit supprimé avec succès.", "success");
        } catch (error) {
            console.error("Erreur lors de la suppression :", error);
            showToast("Erreur lors de la suppression du produit.", "error");
        } finally {
            setProductToDelete(null);
        }
    };

    // 2. On utilise useMemo pour filtrer les produits.
    // Ce calcul ne sera refait que si la liste `products` (du contexte) ou `searchTerm` change.
    const filteredProducts = useMemo(() => {
        return products.filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [products, searchTerm]);

    // 3. Le rendu utilise `filteredProducts`. Chaque fois que `products` change dans le contexte,
    // `filteredProducts` est recalculé, et le composant se met à jour pour afficher la nouvelle liste.
    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {productToEdit && <ProductFormModal product={productToEdit.id ? productToEdit : null} onClose={() => setProductToEdit(null)} />}
            {productToDelete && <ConfirmationModal 
                title="Confirmer la suppression" 
                message={`Êtes-vous sûr de vouloir supprimer le produit "${productToDelete.name}" ? Cette action est irréversible.`} 
                onConfirm={handleDelete} 
                onCancel={() => setProductToDelete(null)}
                confirmText="Oui, supprimer"
            />}

            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="bg-gray-600 hover:bg-gray-500 p-2 rounded-full text-white">
                        <ArrowRightCircle className="transform rotate-180" size={24} />
                    </button>
                    <div>
                        <h2 className="text-3xl font-bold text-white">Gestion du Catalogue</h2>
                        <p className="text-gray-400">Ajoutez, modifiez ou supprimez des produits.</p>
                    </div>
                </div>
                <button onClick={() => setProductToEdit({})} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2">
                    <PlusCircle size={20} /> Ajouter un produit
                </button>
            </div>

            <div className="mb-8 max-w-md">
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Rechercher dans le catalogue..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-700 p-3 pl-10 rounded-lg"
                    />
                </div>
    _C_U_T_P_A_S_T_E_D_T_O_P_R_E_V_E_N_T_L_O_N_G_M_E_S_S_A_G_E_S
                    </div>
                         <div className="p-4 pt-0 flex justify-end items-center gap-2">
                            <button onClick={() => setProductToEdit(p)} title="Modifier" className="p-2 text-yellow-400 hover:text-yellow-300 bg-gray-700/50 rounded-lg"><Edit size={18}/></button>
                            <button onClick={() => setProductToDelete(p)} title="Supprimer" className="p-2 text-red-500 hover:text-red-400 bg-gray-700/50 rounded-lg"><Trash2 size={18}/></button>
                         </div>
                    </div>
                ))}
            </div>
            {filteredProducts.length === 0 && <p className="text-center text-gray-400 py-16">Aucun produit ne correspond à votre recherche.</p>}
        </div>
    );
};

// =================================================================
// ============== FIN DES COMPOSANTS MODIFIÉS ======================
// =================================================================


// =================================================================
// TABLEAUX DE BORD (DASHBOARDS)
// =================================================================

const PosDashboard = ({ pos, isAdminView = false, onActionSuccess = () => {} }) => {
    const { db, products, showToast, loggedInUserData } = useContext(AppContext);

    const currentUserData = isAdminView ? pos : loggedInUserData;
    const posId = currentUserData.uid;

    const [stock, setStock] = useState([]);
    const [salesHistory, setSalesHistory] = useState([]);
    const [posData, setPosData] = useState(null);
    const [deliveryRequests, setDeliveryRequests] = useState([]);
    const [showSaleModal, setShowSaleModal] = useState(false);
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [showHistory, setShowHistory] = useState('stock');
    const [saleToDelete, setSaleToDelete] = useState(null);
    const [expandedRequestId, setExpandedRequestId] = useState(null);
    const [deliveryTab, setDeliveryTab] = useState('actives');
    const [requestToCancel, setRequestToCancel] = useState(null);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [payouts, setPayouts] = useState([]);
    const [payoutToConfirm, setPayoutToConfirm] = useState(null);
    const [isUpdatingPayout, setIsUpdatingPayout] = useState(null);

    useEffect(() => {
        if (!db || !posId) return;
        const q = query(collection(db, `pointsOfSale/${posId}/payouts`), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snapshot) => setPayouts(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));
        return unsub;
    }, [db, posId]);

    const handleArchive = async (requestId) => {
        const reqDoc = doc(db, 'deliveryRequests', requestId);
        await updateDoc(reqDoc, { archivedBy: arrayUnion(posId) });
    };

    const handleUnarchive = async (requestId) => {
        const reqDoc = doc(db, 'deliveryRequests', requestId);
        await updateDoc(reqDoc, { archivedBy: arrayRemove(posId) });
    };

    const handleClientCancel = async () => {
        if (!requestToCancel) return;
        const reqDoc = doc(db, 'deliveryRequests', requestToCancel.id);
        try {
            await updateDoc(reqDoc, {
                status: 'cancelled',
                cancellationReason: 'Annulée par le client'
            });
            await addDoc(collection(db, 'notifications'), {
                recipientUid: 'all_admins',
                message: `La commande de ${posData.name} du ${formatDate(requestToCancel.createdAt)} a été annulée par le client.`,
                createdAt: serverTimestamp(),
                isRead: false,
                type: 'DELIVERY_CANCELLED'
            });
            showToast("Commande annulée avec succès", "success");
            setRequestToCancel(null);
        } catch(e) {
            showToast("Erreur lors de l'annulation", "error");
        }
    };

    const { activeDeliveries, archivedDeliveries } = useMemo(() => {
        return {
            activeDeliveries: deliveryRequests.filter(req => !req.archivedBy?.includes(posId)),
            archivedDeliveries: deliveryRequests.filter(req => req.archivedBy?.includes(posId))
        };
    }, [deliveryRequests, posId]);

    const deliveriesToDisplay = deliveryTab === 'actives' ? activeDeliveries : archivedDeliveries;

    const toggleExpand = (requestId) => {
        setExpandedRequestId(prevId => (prevId === requestId ? null : requestId));
    };

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
                            <div className="flex flex-col items-center">
                                <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white ${isCompleted ? 'bg-green-600' : isActive ? 'bg-blue-600 animate-pulse' : 'bg-gray-600'}`}>
                                    {isCompleted ? <Check size={16} /> : <span className="text-xs">{index + 1}</span>}
                                </div>
                                <p className={`mt-2 text-xs text-center ${isActive ? 'text-white font-bold' : 'text-gray-400'}`}>{DELIVERY_STATUS_STEPS[step]}</p>
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

    useEffect(() => { if (!db || !posId) return; const unsub = onSnapshot(doc(db, "pointsOfSale", posId), (doc) => { if (doc.exists()) setPosData(doc.data()); }); return unsub; }, [db, posId]);
    useEffect(() => { if (!db || !posId) return; const q = query(collection(db, `pointsOfSale/${posId}/stock`)); const unsub = onSnapshot(q, (snapshot) => setStock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))); return unsub; }, [db, posId]);
    useEffect(() => { if (!db || !posId) return; const q = query(collection(db, `pointsOfSale/${posId}/sales`), orderBy('createdAt', 'desc')); const unsub = onSnapshot(q, (snapshot) => setSalesHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))); return unsub;}, [db, posId]);

    useEffect(() => {
        if (!db || !posId || isAdminView) return;
        const q = query(
            collection(db, `deliveryRequests`),
            where("posId", "==", posId),
            orderBy('createdAt', 'desc')
        );
        const unsub = onSnapshot(q, (snapshot) => {
            setDeliveryRequests(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
        }, (error) => {
            console.error("Erreur Firestore (pensez à l'index pour le dashboard client!) : ", error);
        });
        return unsub;
    }, [db, posId, isAdminView]);

    const unsettledSales = useMemo(() => salesHistory.filter(s => !s.payoutId), [salesHistory]);

    const kpis = useMemo(() => {
        const totalStock = stock.reduce((acc, item) => acc + item.quantity, 0);
        const totalRevenue = unsettledSales.reduce((acc, sale) => acc + sale.totalAmount, 0);
        const commission = totalRevenue * (posData?.commissionRate || 0);
        const netToBePaid = totalRevenue - commission;
        return { totalStock, totalRevenue, netToBePaid };
    }, [stock, unsettledSales, posData]);

    const salesStats = useMemo(() => {
        if (salesHistory.length === 0) return [];
        const productSales = salesHistory.reduce((acc, sale) => { const key = `${sale.productName} ${sale.scent || ''}`.trim(); acc[key] = (acc[key] || 0) + sale.quantity; return acc; }, {});
        return Object.entries(productSales).sort(([,a],[,b]) => b-a).slice(0, 3);
    }, [salesHistory]);

    const handleDeleteSale = async (reason) => {
        if (!saleToDelete) return;
        const sale = saleToDelete;
        setSaleToDelete(null);

        if(sale.payoutId) {
            showToast("Impossible d'annuler une vente qui fait partie d'un paiement déjà clôturé.", "error");
            return;
        }

        const product = products.find(p => p.id === sale.productId);
        if (!product) { showToast("Produit de la vente introuvable.", "error"); return; }
        
        const stockId = product.hasScents ? `${sale.productId}_${sale.scent}` : sale.productId;
        
        const stockDocRef = doc(db, `pointsOfSale/${posId}/stock`, stockId);
        const saleDocRef = doc(db, `pointsOfSale/${posId}/sales`, sale.id);
        const logDocRef = doc(collection(db, `pointsOfSale/${posId}/logs`));
        try {
            const batch = writeBatch(db);
            const currentStockItem = stock.find(item => item.id === stockId);
            const newQuantity = (currentStockItem?.quantity || 0) + sale.quantity;
            if (currentStockItem) { batch.update(stockDocRef, { quantity: newQuantity }); }
            else { batch.set(stockDocRef, { productId: sale.productId, productName: sale.productName, scent: sale.scent, quantity: sale.quantity, price: sale.unitPrice, hasScents: !!product.hasScents }); }
            batch.delete(saleDocRef);
            batch.set(logDocRef, { type: 'SALE_CANCELLED', reason, saleData: sale, cancelledAt: serverTimestamp(), by: currentUserData.email });
            await batch.commit();
            showToast("Vente annulée et stock restauré.", "success");
        } catch (error) { console.error("Erreur annulation vente: ", error); showToast("Erreur: impossible d'annuler la vente.", "error"); }
    };

    const handleCreatePayout = async () => {
        if (unsettledSales.length === 0) {
            showToast("Aucune vente à régler pour créer un paiement.", "info");
            return;
        }
        setPayoutToConfirm(null);

        const batch = writeBatch(db);
        const payoutDocRef = doc(collection(db, `pointsOfSale/${posId}/payouts`));

        const salesToSettle = [...unsettledSales];
        const grossRevenue = salesToSettle.reduce((acc, sale) => acc + sale.totalAmount, 0);
        const commissionAmount = grossRevenue * (posData?.commissionRate || 0);
        const netAmount = grossRevenue - commissionAmount;

        batch.set(payoutDocRef, {
            createdAt: serverTimestamp(),
            status: 'pending',
            grossRevenue,
            commissionAmount,
            netAmount,
            commissionRateAtTheTime: posData?.commissionRate || 0,
            salesCount: salesToSettle.length,
            paidAt: null
        });

        salesToSettle.forEach(sale => {
            const saleRef = doc(db, `pointsOfSale/${posId}/sales`, sale.id);
            batch.update(saleRef, { payoutId: payoutDocRef.id });
        });

        try {
            await batch.commit();
            showToast("Période de paiement clôturée avec succès !", "success");
            onActionSuccess();
        } catch(error) {
            console.error("Erreur lors de la clôture de la période: ", error);
            showToast("Erreur lors de la création du paiement.", "error");
        }
    };

    const handleUpdatePayoutStatus = async (payout) => {
        if (!isAdminView) return;

        const currentIndex = payoutStatusOrder.indexOf(payout.status);
        if (currentIndex === -1 || currentIndex === payoutStatusOrder.length - 1) {
            return;
        }

        const nextStatus = payoutStatusOrder[currentIndex + 1];
        const payoutDocRef = doc(db, `pointsOfSale/${posId}/payouts`, payout.id);

        setIsUpdatingPayout(payout.id);
        try {
            const dataToUpdate = { status: nextStatus };
            if (nextStatus === 'received') {
                dataToUpdate.paidAt = serverTimestamp();
            }

            await updateDoc(payoutDocRef, dataToUpdate);

            await addDoc(collection(db, 'notifications'), {
                recipientUid: posId,
                message: `Le statut de votre paiement de ${formatPrice(payout.netAmount)} est passé à : "${PAYOUT_STATUSES[nextStatus].text}".`,
                createdAt: serverTimestamp(),
                isRead: false,
                type: 'PAYOUT_UPDATE'
            });

            showToast(`Statut du paiement mis à jour.`, "success");
        } catch (error) {
            console.error("Erreur de mise à jour du statut du paiement: ", error);
            showToast("Une erreur est survenue.", "error");
        } finally {
            setIsUpdatingPayout(null);
        }
    };

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {showSaleModal && <SaleModal posId={posId} stock={stock} onClose={() => setShowSaleModal(false)} />}
            {showDeliveryModal && <DeliveryRequestModal posId={posId} posName={posData?.name} onClose={() => setShowDeliveryModal(false)} />}
            {saleToDelete && <ConfirmationModal title="Confirmer l'annulation" message={`Annuler la vente de ${saleToDelete.quantity} x ${saleToDelete.productName} ${saleToDelete.scent || ''} ?\nLe stock sera automatiquement restauré.`} onConfirm={handleDeleteSale} onCancel={() => setSaleToDelete(null)} confirmText="Annuler la Vente" requiresReason={true} />}
            {requestToCancel && <ConfirmationModal title="Confirmer l'annulation" message="Êtes-vous sûr de vouloir annuler cette commande ? Cette action est irréversible." onConfirm={handleClientCancel} onCancel={() => setRequestToCancel(null)} confirmText="Oui, Annuler" confirmColor="bg-red-600 hover:bg-red-700"/>}
            {showInfoModal && <InfoModal title="Annulation Impossible" message="Cette commande est déjà en cours de traitement et ne peut plus être annulée. Veuillez contacter l'administrateur en cas de problème." onClose={() => setShowInfoModal(false)} />}
            {payoutToConfirm && <ConfirmationModal title="Clôturer la Période" message={`Vous allez clôturer la période avec un montant net à reverser de ${formatPrice(kpis.netToBePaid)}. Un nouveau paiement sera créé avec le statut 'En attente'. Êtes-vous sûr ?`} onConfirm={handleCreatePayout} onCancel={() => setPayoutToConfirm(null)} confirmText="Oui, Clôturer" confirmColor="bg-blue-600 hover:bg-blue-700" />}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
                <div><h2 className="text-3xl font-bold text-white">Tableau de Bord</h2><p className="text-gray-400">Bienvenue, {posData?.name || currentUserData.displayName}</p></div>
                <div className="flex gap-4 mt-4 md:mt-0">
                    {!isAdminView && <>
                        <button onClick={() => setShowDeliveryModal(true)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><Truck size={20} /> Demander une Livraison</button>
                        <button onClick={() => setShowSaleModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><PlusCircle size={20} /> Nouvelle Vente</button>
                    </>}
                    {isAdminView && <button onClick={() => setPayoutToConfirm(true)} disabled={kpis.netToBePaid <= 0} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><CircleDollarSign size={20} /> Clôturer la période</button>}
                </div>
            </div>

            {isAdminView && currentUserData && (
                <div className="bg-gray-800 rounded-2xl p-6 mb-8 animate-fade-in">
                    <h3 className="text-xl font-bold text-white mb-4">Informations de Contact</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-base">
                        <div className="flex items-center gap-3"><User className="text-indigo-400" size={22}/> <span>{currentUserData.firstName} {currentUserData.lastName}</span></div>
                        <div className="flex items-center gap-3"><Store className="text-indigo-400" size={22}/> <span>{currentUserData.displayName}</span></div>
                        <div className="flex items-center gap-3"><Phone className="text-indigo-400" size={22}/> <span>{formatPhone(currentUserData.phone)}</span></div>
                        <div className="flex items-center gap-3"><Mail className="text-indigo-400" size={22}/> <span>{currentUserData.email}</span></div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KpiCard title="Stock Total" value={kpis.totalStock} icon={Archive} color="bg-blue-600" />
                <KpiCard title="CA Brut (période en cours)" value={formatPrice(kpis.totalRevenue)} icon={DollarSign} color="bg-green-600" />
                <KpiCard title="Votre Commission" value={formatPercent(posData?.commissionRate)} icon={Percent} color="bg-purple-600" />
                <KpiCard title="Net à reverser" value={formatPrice(kpis.netToBePaid)} icon={Coins} color="bg-pink-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mt-8">
                <div className="lg:col-span-2 bg-gray-800 rounded-2xl p-6 flex flex-col">
                    <h3 className="text-xl font-bold text-white mb-4">Suivi des Livraisons</h3>
                    <div className="border-b border-gray-700 mb-4">
                        <nav className="-mb-px flex gap-6" aria-label="Tabs">
                            <button onClick={() => setDeliveryTab('actives')} className={`${deliveryTab === 'actives' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-400'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>Actives</button>
                            <button onClick={() => setDeliveryTab('archived')} className={`${deliveryTab === 'archived' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-400'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>Archives</button>
                        </nav>
                    </div>
                    <div className="flex-grow">
                        {deliveriesToDisplay.length > 0 ? (
                            <div className="space-y-4">
                                {deliveriesToDisplay.map(req => {
                                    const isExpanded = expandedRequestId === req.id;
                                    const isArchivable = (req.status === 'delivered' || req.status === 'cancelled');
                                    const isCancellable = req.status === 'pending';
                                    return (
                                        <div key={req.id} className="bg-gray-900/50 rounded-lg transition-all duration-300">
                                            <div className='flex'>
                                                <button onClick={() => toggleExpand(req.id)} className="flex-grow w-full p-4 flex justify-between items-center text-left">
                                                    <div>
                                                        <p className="font-bold">Demande du {formatDate(req.createdAt)}</p>
                                                        <p className="text-sm text-gray-400">{req.items.length} article(s) - <span className={`font-semibold ${req.status === 'delivered' ? 'text-green-400' : 'text-blue-400'}`}>{DELIVERY_STATUS_STEPS[req.status]}</span></p>
                                                    </div>
                                                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                </button>
                                                {deliveryTab === 'actives' && isArchivable && <button onClick={() => handleArchive(req.id)} title="Archiver" className="p-4 text-gray-500 hover:text-indigo-400"><Archive size={18}/></button>}
                                                {deliveryTab === 'archived' && <button onClick={() => handleUnarchive(req.id)} title="Désarchiver" className="p-4 text-gray-500 hover:text-indigo-400"><ArchiveRestore size={18}/></button>}
                                            </div>

                                            {isExpanded && (
                                                <div className="p-4 border-t border-gray-700 animate-fade-in">
                                                    <div className="mb-4"><DeliveryStatusTracker status={req.status} reason={req.cancellationReason} /></div>
                                                    {req.modificationReason && (<div className="bg-yellow-500/10 border-l-4 border-yellow-400 p-4 rounded-r-lg mb-4 text-sm"><div className="flex items-start gap-3"><Info className="h-5 w-5 text-yellow-300 flex-shrink-0 mt-0.5"/><div><h4 className="font-bold text-yellow-300">Cette commande a été modifiée :</h4><p className="text-gray-300 mt-1 italic">"{req.modificationReason}"</p></div></div></div>)}
                                                    {req.status !== 'cancelled' && (<div className="bg-gray-700/50 p-3 rounded-lg"><table className="w-full text-sm"><thead><tr className="border-b border-gray-600 text-gray-400"><th className="text-left p-2">Produit</th><th className="text-right p-2">Quantité</th></tr></thead><tbody>
                                                        {req.items.map((item, index) => {
                                                            const originalItem = req.originalItems?.find(oi => oi.productId === item.productId && oi.scent === item.scent);
                                                            const wasModified = originalItem && originalItem.quantity !== item.quantity;
                                                            const product = products.find(p => p.id === item.productId);
                                                            return (<tr key={index} className="border-b border-gray-800 last:border-none"><td className="p-2">{product?.name || 'Produit inconnu'}{item.scent && <span className="text-gray-400 ml-2">({item.scent})</span>}</td><td className="p-2 text-right font-mono">{wasModified ? (<span><s className="text-red-400">{originalItem.quantity}</s><span className="ml-3 text-green-400 font-bold">{item.quantity}</span></span>) : (<span>{item.quantity}</span>)}</td></tr>);
                                                        })}
                                                    </tbody></table></div>)}
                                                    <div className="mt-4 pt-4 border-t border-gray-700/50 flex justify-end">
                                                        <button onClick={() => isCancellable ? setRequestToCancel(req) : setShowInfoModal(true)}
                                                                className={`font-bold py-2 px-4 rounded-lg flex items-center gap-2 text-sm ${isCancellable ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}>
                                                            <XCircle size={16} /> Annuler la commande
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : <p className="text-center text-gray-400 pt-8">Aucune demande de livraison.</p>}
                    </div>
                </div>
                <div className="lg:col-span-3 bg-gray-800 rounded-2xl p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-white">Gestion & Historique</h3>
                    </div>
                     <div className="border-b border-gray-700 mb-4">
                        <nav className="-mb-px flex gap-6" aria-label="Tabs">
                            <button onClick={() => setShowHistory('stock')} className={`${showHistory === 'stock' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>Stock</button>
                            <button onClick={() => setShowHistory('sales')} className={`${showHistory === 'sales' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>Ventes</button>
                            <button onClick={() => setShowHistory('payouts')} className={`${showHistory === 'payouts' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>Paiements</button>
                        </nav>
                    </div>

                    {showHistory === 'stock' && (
                        <div className="animate-fade-in overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-gray-700 text-gray-400 text-sm"><th className="p-3">Produit</th><th className="p-3">Parfum</th><th className="p-3">Stock</th><th className="p-3">Prix Unitaire</th></tr></thead><tbody>{stock.map(item => (<tr key={item.id} className="border-b border-gray-700 hover:bg-gray-700/50"><td className="p-3 font-medium">{item.productName}</td><td className="p-3 text-gray-300">{item.scent || 'N/A'}</td><td className={`p-3 font-bold ${item.quantity <= LOW_STOCK_THRESHOLD ? 'text-yellow-400' : 'text-white'}`}>{item.quantity}</td><td className="p-3">{formatPrice(item.price)}</td></tr>))}</tbody></table></div>
                    )}
                    {showHistory === 'sales' && (
                        <div className="animate-fade-in overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-gray-700 text-gray-400 text-sm"><th className="p-3">Date</th><th className="p-3">Produit</th><th className="p-3">Qté</th><th className="p-3">Total</th><th className="p-3">Statut</th><th className="p-3">Actions</th></tr></thead><tbody>{salesHistory.map(sale => (<tr key={sale.id} className="border-b border-gray-700 hover:bg-gray-700/50"><td className="p-3">{formatDate(sale.createdAt)}</td><td className="p-3">{sale.productName} <span className="text-gray-400">{sale.scent || ''}</span></td><td className="p-3">{sale.quantity}</td><td className="p-3 font-semibold">{formatPrice(sale.totalAmount)}</td><td className="p-3 text-xs font-semibold">{sale.payoutId ? <span className="text-gray-500">Réglée</span> : <span className="text-green-400">En cours</span>}</td><td className="p-3">{!sale.payoutId && <button onClick={() => setSaleToDelete(sale)} className="text-red-500 hover:text-red-400 p-1"><Trash2 size={18}/></button>}</td></tr>))}</tbody></table></div>
                    )}
                    {showHistory === 'payouts' && (
                         <div className="animate-fade-in overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-700 text-gray-400 text-sm">
                                        <th className="p-3">Date Clôture</th>
                                        <th className="p-3">Montant Net</th>
                                        <th className="p-3">Statut</th>
                                        <th className="p-3">{isAdminView ? "Action" : "Date Paiement"}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payouts.map(p => (
                                        <tr key={p.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                                            <td className="p-3">{formatDate(p.createdAt)}</td>
                                            <td className="p-3 font-semibold">{formatPrice(p.netAmount)}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 text-xs font-bold rounded-full whitespace-nowrap ${PAYOUT_STATUSES[p.status]?.bg} ${PAYOUT_STATUSES[p.status]?.color}`}>
                                                    {PAYOUT_STATUSES[p.status]?.text || p.status}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                {isAdminView && p.status !== 'received' ? (
                                                    <button
                                                        onClick={() => handleUpdatePayoutStatus(p)}
                                                        disabled={isUpdatingPayout === p.id}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1 px-3 rounded-lg flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
                                                    >
                                                        {isUpdatingPayout === p.id
                                                            ? <div className="animate-spin rounded-full h-4 w-4 border-b-2"></div>
                                                            : <>Étape suivante <ArrowRightCircle size={14}/></>
                                                        }
                                                    </button>
                                                ) : (
                                                    p.paidAt ? formatDate(p.paidAt) : '-'
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
             <div className="bg-gray-800 rounded-2xl p-6 mt-8">
                <h3 className="text-xl font-bold mb-4">Vos meilleures ventes (toutes périodes)</h3>
                {salesStats.length > 0 ? <ul>{salesStats.map(([name, qty])=><li key={name} className="flex justify-between py-1 border-b border-gray-700"><span>{name}</span><strong>{qty}</strong></li>)}</ul> : <p className="text-gray-400">Aucune vente enregistrée.</p>}
            </div>
        </div>
    );
};

const SalesAnalytics = () => {
    const { db } = useContext(AppContext);
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth());
    const [isLoading, setIsLoading] = useState(true);
    const [monthlyData, setMonthlyData] = useState({ revenue: 0, commission: 0, netIncome: 0, salesCount: 0, topPos: [], topProducts: [] });

    const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

    useEffect(() => {
        const fetchMonthlySales = async () => {
            setIsLoading(true);
            const startDate = new Date(year, month, 1);
            const endDate = new Date(year, month + 1, 1);

            try {
                // 1. Récupérer tous les points de vente
                const posSnapshot = await getDocs(collection(db, 'pointsOfSale'));
                const pointsOfSale = posSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                let allSales = [];

                // 2. Boucler sur chaque point de vente pour récupérer ses ventes du mois
                for (const pos of pointsOfSale) {
                    const salesQuery = query(
                        collection(db, `pointsOfSale/${pos.id}/sales`),
                        where('createdAt', '>=', startDate),
                        where('createdAt', '<', endDate)
                    );
                    const salesSnapshot = await getDocs(salesQuery);
                    const monthSales = salesSnapshot.docs.map(doc => ({
                        ...doc.data(),
                        posName: pos.name, // Attacher le nom du PoS pour l'analyse
                        commissionRate: pos.commissionRate // Attacher le taux pour le calcul
                    }));
                    allSales = allSales.concat(monthSales);
                }
                
                if (allSales.length === 0) {
                    setMonthlyData({ revenue: 0, commission: 0, netIncome: 0, salesCount: 0, topPos: [], topProducts: [] });
                    setIsLoading(false);
                    return;
                }

                // 3. Traiter les ventes agrégées
                let revenue = 0;
                let commission = 0;
                const salesByPos = {};
                const salesByProduct = {};

                allSales.forEach(sale => {
                    revenue += sale.totalAmount;
                    commission += sale.totalAmount * (sale.commissionRate || 0);

                    salesByPos[sale.posName] = (salesByPos[sale.posName] || 0) + sale.totalAmount;
                    
                    const productKey = `${sale.productName} ${sale.scent || ''}`.trim();
                    salesByProduct[productKey] = (salesByProduct[productKey] || 0) + sale.quantity;
                });
                
                const topPos = Object.entries(salesByPos).sort(([,a],[,b]) => b-a).slice(0, 5);
                const topProducts = Object.entries(salesByProduct).sort(([,a],[,b]) => b-a).slice(0, 5);
                
                setMonthlyData({
                    revenue,
                    salesCount: allSales.length,
                    commission,
                    netIncome: revenue - commission,
                    topPos,
                    topProducts
                });

            } catch (error) {
                console.error("Erreur lors de la récupération des ventes mensuelles : ", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (db) {
            fetchMonthlySales();
        }
    }, [db, year, month]);

    return (
        <div className="animate-fade-in">
             <div className="flex flex-col md:flex-row justify-between items-center mb-8 px-4 sm:px-8">
                <div>
                    <h2 className="text-3xl font-bold text-white">Analyse des Ventes Mensuelles</h2>
                    <p className="text-gray-400">Suivi du chiffre d'affaires global par mois.</p>
                </div>
                <div className="flex gap-4 mt-4 md:mt-0">
                     <select value={month} onChange={e => setMonth(Number(e.target.value))} className="bg-gray-700 p-2 rounded-lg">
                        {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <select value={year} onChange={e => setYear(Number(e.target.value))} className="bg-gray-700 p-2 rounded-lg">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>
