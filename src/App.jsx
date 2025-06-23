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

// Importations pour l'export PDF
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Importations des icônes Lucide React
import {
    Package, Flame, Store, User, LogOut, LogIn, AlertTriangle, X, Info, Edit, Bell, ArchiveRestore,
    PlusCircle, MinusCircle, History, CheckCircle, Truck, ShoppingCart, BarChart2,
    DollarSign, Archive, Eye, ChevronDown, ChevronUp, Check, XCircle, Trash2, Send, UserPlus, ToggleLeft, ToggleRight, Percent, Save, Download, Wrench, HandCoins, Book, CandlestickChart
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
// FONCTIONS UTILITAIRES ET COMPOSANTS UI
// =================================================================

const formatPrice = (price) => `${(price || 0).toFixed(2)} €`;
const formatDate = (timestamp) => !timestamp?.toDate ? 'Date inconnue' : timestamp.toDate().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const formatPercent = (rate) => `${((rate || 0) * 100).toFixed(0)} %`;

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

// NOUVEAU : Modale simple pour afficher une information
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
                    <p className="text-gray-400 mt-2 whitespace-pre-line">{message}</p>
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

const NotificationBell = ({ db, user }) => {
    const [notifications, setNotifications] = useState([]);
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    useEffect(() => {
        if (!user) return;
        
        const recipientIds = user.role === 'admin' ? [user.uid, 'all_admins'] : [user.uid];

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
    }, [db, user]);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const handleMarkOneAsRead = async (notificationId) => {
        const notifDocRef = doc(db, 'notifications', notificationId);
        await updateDoc(notifDocRef, { isRead: true });
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
        await batch.commit();
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
const CreatePosModal = ({ db, showToast, onClose }) => { const [name, setName]=useState(''); const [email, setEmail]=useState(''); const [password, setPassword]=useState(''); const [isLoading, setIsLoading]=useState(false); const handleCreate=async(ev)=>{ev.preventDefault();if(!name||!email||password.length<6){showToast("Nom, email et mot de passe (6+ car.) requis.","error");return}setIsLoading(true);const appName=`secondary-app-${Date.now()}`;let secondaryApp;try{secondaryApp=initializeApp(firebaseConfig,appName);const secondaryAuth=getAuth(secondaryApp);const userCredential=await createUserWithEmailAndPassword(secondaryAuth,email,password);const nU=userCredential.user;const batch=writeBatch(db);batch.set(doc(db,"users",nU.uid),{displayName:name,email:email,role:"pos",status:"active",createdAt:serverTimestamp()});batch.set(doc(db,"pointsOfSale",nU.uid),{name:name,commissionRate:0.3,createdAt:serverTimestamp(),status:"active"});await batch.commit();showToast(`Compte pour ${name} créé !`,"success");onClose()}catch(err){if(err.code==='auth/email-already-in-use'){showToast("Email déjà utilisé.","error")}else{showToast("Erreur de création.","error")}}finally{setIsLoading(false);if(secondaryApp){signOut(getAuth(secondaryApp)).then(()=>deleteApp(secondaryApp))}}}; return <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40" onClick={onClose}><div className="bg-gray-800 p-8 rounded-2xl w-full max-w-lg" onClick={e=>e.stopPropagation()}><h2 className="text-2xl font-bold text-white mb-6">Ajouter un Dépôt-Vente</h2><form onSubmit={handleCreate} className="space-y-4"><div><label className="block text-sm font-medium text-gray-300 mb-1">Nom du Dépôt</label><input type="text" value={name} onChange={e=>setName(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/></div><div><label className="block text-sm font-medium text-gray-300 mb-1">Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/></div><div><label className="block text-sm font-medium text-gray-300 mb-1">Mot de passe initial</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/></div><div className="flex justify-end gap-4 pt-4"><button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Annuler</button><button type="submit" disabled={isLoading} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-60">{isLoading?<div className="animate-spin rounded-full h-5 w-5 border-b-2"></div>:<><UserPlus size={18}/>Créer</>}</button></div></form></div></div>;};
const EditPosModal = ({ db, pos, showToast, onClose, onSave }) => { const [name, setName] = useState(pos.name); const [commissionRate, setCommissionRate] = useState((pos.commissionRate || 0) * 100); const [isLoading, setIsLoading] = useState(false); const handleSave = async (event) => { event.preventDefault(); setIsLoading(true); const newRate = parseFloat(commissionRate) / 100; if (isNaN(newRate) || newRate < 0 || newRate > 1) { showToast("Le taux de commission doit être entre 0 et 100.", "error"); setIsLoading(false); return; } try { const posDocRef = doc(db, "pointsOfSale", pos.id); await updateDoc(posDocRef, { name: name, commissionRate: newRate, }); showToast("Dépôt mis à jour avec succès !", "success"); onSave(); onClose(); } catch (error) { console.error("Erreur de mise à jour du dépôt : ", error); showToast("Erreur lors de la mise à jour.", "error"); } finally { setIsLoading(false); } }; return ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={onClose}> <div className="bg-gray-800 p-8 rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}> <h2 className="text-2xl font-bold text-white mb-6">Modifier le Dépôt-Vente</h2> <form onSubmit={handleSave} className="space-y-4"> <div> <label className="block text-sm font-medium text-gray-300 mb-1">Nom du Dépôt</label> <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/> </div> <div> <label className="block text-sm font-medium text-gray-300 mb-1">Taux de Commission (%)</label> <input type="number" value={commissionRate} onChange={e => setCommissionRate(e.target.value)} required min="0" max="100" className="w-full bg-gray-700 p-3 rounded-lg"/> </div> <div className="flex justify-end gap-4 pt-4"> <button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Annuler</button> <button type="submit" disabled={isLoading} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-60"> {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2"></div> : <><Save size={18}/>Enregistrer</>} </button> </div> </form> </div> </div> ); };
const InactiveAccountModal = ({ onLogout }) => { return ( <div className="fixed inset-0 bg-gray-900 bg-opacity-95 flex items-center justify-center z-[1000] animate-fade-in"> <div className="bg-gray-800 p-10 rounded-2xl shadow-2xl w-full max-w-lg border border-yellow-500/50 text-center animate-fade-in-up"> <AlertTriangle className="mx-auto h-16 w-16 text-yellow-400 mb-4"/> <h2 className="text-2xl font-bold text-white mb-3">Votre compte est actuellement inactif</h2> <p className="text-gray-300"> Vous pouvez toujours vous connecter, mais l'accès au tableau de bord a été suspendu. </p> <p className="text-gray-300 mt-4"> Pour réactiver votre compte ou pour toute question, veuillez contacter le support : </p> <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4"> <a href="mailto:jullien@bougienicole.fr" className="w-full sm:w-auto bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"> <User size={18} /> Contacter Jullien </a> <button onClick={onLogout} className="w-full sm:w-auto bg-gray-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-500 flex items-center justify-center gap-2"> <LogOut size={18} /> Se déconnecter </button> </div> </div> </div> ); };

const SaleModal = ({ db, posId, stock, onClose, showToast, products, scents }) => {
    const [productId, setProductId] = useState('');
    const [scent, setScent] = useState('');
    const [quantity, setQuantity] = useState(1);

    const availableScents = useMemo(() => {
        const selectedProduct = products.find(p => p.id === productId);
        return selectedProduct?.hasScents !== false ? scents : [];
    }, [productId, products, scents]);

    const maxQuantity = useMemo(() => {
        if (!productId) return 0;
        const stockItem = stock.find(item => 
            item.productId === productId && 
            (item.scent === scent || availableScents.length === 0)
        );
        return stockItem?.quantity || 0;
    }, [stock, productId, scent, availableScents]);

    const handleSaveSale = async () => {
        const product = products.find(p => p.id === productId);
        if (!product || (product.hasScents !== false && !scent) || quantity <= 0) {
            showToast("Veuillez remplir tous les champs correctement.", "error");
            return;
        }
        if (quantity > maxQuantity) {
            showToast("La quantité demandée est supérieure au stock disponible.", "error");
            return;
        }

        try {
            const batch = writeBatch(db);
            const newSaleRef = doc(collection(db, `pointsOfSale/${posId}/sales`));
            batch.set(newSaleRef, {
                productId: product.id,
                productName: product.name,
                scent: product.hasScents !== false ? scent : null,
                quantity: Number(quantity),
                unitPrice: product.price,
                totalAmount: product.price * Number(quantity),
                createdAt: serverTimestamp()
            });

            const stockId = product.hasScents !== false ? `${product.id}_${scent}` : product.id;
            const stockDocRef = doc(db, `pointsOfSale/${posId}/stock`, stockId);
            
            batch.update(stockDocRef, { quantity: maxQuantity - Number(quantity) });
            
            await batch.commit();
            showToast("Vente enregistrée avec succès !", "success");
            onClose();
        } catch (error) {
            console.error("Erreur lors de l'enregistrement de la vente: ", error);
            showToast("Échec de l'enregistrement de la vente.", "error");
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40" onClick={onClose}>
            <div className="bg-gray-800 p-8 rounded-2xl w-full max-w-lg border-gray-700" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-white mb-6">Enregistrer une Vente</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-300 mb-1">Produit</label>
                        <select value={productId} onChange={e => { setProductId(e.target.value); setScent(''); }} className="w-full bg-gray-700 p-3 rounded-lg">
                            <option value="">-- Choisir un produit --</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    {availableScents.length > 0 && (
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">Parfum</label>
                            <select value={scent} onChange={e => setScent(e.target.value)} className="w-full bg-gray-700 p-3 rounded-lg" disabled={!productId}>
                                <option value="">-- Choisir un parfum --</option>
                                {availableScents.map(sc => <option key={sc.id} value={sc.name}>{sc.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm text-gray-300 mb-1">Quantité</label>
                        <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} min="1" max={maxQuantity} className="w-full bg-gray-700 p-3 rounded-lg" />
                        {maxQuantity > 0 && <p className="text-xs text-gray-400 mt-1">Stock disponible : {maxQuantity}</p>}
                    </div>
                </div>
                <div className="mt-8 flex justify-end gap-4">
                    <button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Annuler</button>
                    <button onClick={handleSaveSale} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg">Enregistrer</button>
                </div>
            </div>
        </div>
    );
};

const DeliveryRequestModal = ({ db, posId, posName, onClose, showToast, products, scents }) => { 
    const [items,setItems]=useState([{productId:'',scent:'',quantity:10}]); 
    const handleItemChange=(i,f,v)=>{const nI=[...items];nI[i][f]=v;if(f==='productId')nI[i].scent='';setItems(nI)}; 
    const handleAdd=()=>setItems([...items,{productId:'',scent:'',quantity:10}]); 
    const handleRemove=(i)=>setItems(items.filter((_,idx)=>i!==idx)); 
    const handleSend=async()=>{
        const vI=items.filter(i=>{const p=products.find(pr=>pr.id===i.productId);if(!p||(p.hasScents!==false&&!i.scent)||i.quantity<=0)return false;return true});
        if(vI.length===0){showToast("Ajoutez au moins un article valide.","error");return}
        try{
            await addDoc(collection(db,'deliveryRequests'),{posId,posName,items:vI,status:'pending',createdAt:serverTimestamp(), archivedBy: []});
            await addDoc(collection(db, 'notifications'), {
                recipientUid: 'all_admins',
                message: `Nouvelle demande de livraison reçue de ${posName}.`,
                createdAt: serverTimestamp(),
                isRead: false,
                type: 'NEW_DELIVERY_REQUEST'
            });
            showToast("Demande de livraison envoyée !","success");
            onClose();
        }catch(e){
            console.error("Erreur d'envoi de la demande: ", e);
            showToast("Échec de l'envoi.","error")}
    }; 
    return <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40" onClick={onClose}><div className="bg-gray-800 p-8 rounded-2xl w-full max-w-2xl border-gray-700 custom-scrollbar max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}><h2 className="text-2xl font-bold text-white mb-6">Demander une Livraison</h2><div className="space-y-4">{items.map((item,i)=>{const p=products.find(pr=>pr.id===item.productId);const sS=p&&p.hasScents!==false;return(<div key={i} className="bg-gray-700/50 p-4 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-4 items-end"><div className="sm:col-span-1"><label className="text-sm">Produit</label><select value={item.productId} onChange={e=>handleItemChange(i,'productId',e.target.value)} className="w-full bg-gray-600 p-2 rounded-lg"><option value="">-- Choisir --</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div className="sm:col-span-1">{sS&&<>
<label className="text-sm">Parfum</label><select value={item.scent} onChange={e=>handleItemChange(i,'scent',e.target.value)} className="w-full bg-gray-600 p-2 rounded-lg"><option value="">-- Choisir --</option>{scents.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</select></>}</div><div className="flex items-center gap-2"><div className="flex-grow"><label className="text-sm">Quantité</label><input type="number" value={item.quantity} onChange={e=>handleItemChange(i,'quantity',Number(e.target.value))} min="1" className="w-full bg-gray-600 p-2 rounded-lg"/></div>{items.length>1&&<button onClick={()=>handleRemove(i)} className="p-2 bg-red-600 rounded-lg text-white self-end mb-px"><Trash2 size={20}/></button>}</div></div>)})}</div><button type="button" onClick={handleAdd} className="mt-4 flex items-center gap-2 text-indigo-400"><PlusCircle size={20}/>Ajouter un article</button><div className="mt-8 flex justify-end gap-4"><button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Annuler</button><button onClick={handleSend} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><Send size={18}/>Envoyer</button></div></div></div>
};

const ProcessDeliveryModal = ({ db, request, products, showToast, onClose, onCancelRequest }) => { 
    const [isLoading, setIsLoading] = useState(false); 
    const [editableItems, setEditableItems] = useState(request.items); 
    const [showReasonModal, setShowReasonModal] = useState(false);

    const DeliveryStatusTracker = ({ status }) => { if (status === 'cancelled') { return ( <div className="flex items-center gap-4 bg-red-500/10 p-3 rounded-lg"> <AlertTriangle className="h-8 w-8 text-red-500"/> <div> <h4 className="font-bold text-red-400">Commande Annulée</h4> <p className="text-xs text-gray-400">Cette commande ne sera pas traitée.</p> </div> </div> ); } const currentIndex = deliveryStatusOrder.indexOf(status); return ( <div className="flex items-center space-x-4"> {deliveryStatusOrder.map((step, index) => { const isCompleted = index < currentIndex; const isActive = index === currentIndex; return ( <React.Fragment key={step}> <div className="flex flex-col items-center text-center"> <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${isCompleted ? 'bg-green-600' : isActive ? 'bg-blue-600 animate-pulse' : 'bg-gray-600'}`}> {isCompleted ? <Check size={16} /> : <span className="text-xs font-bold">{index + 1}</span>} </div> <p className={`mt-2 text-xs w-20 ${isActive ? 'text-white font-bold' : 'text-gray-400'}`}>{DELIVERY_STATUS_STEPS[step]}</p> </div> {index < deliveryStatusOrder.length - 1 && (<div className={`flex-1 h-1 rounded-full ${isCompleted ? 'bg-green-600' : 'bg-gray-600'}`}></div>)} </React.Fragment> ); })} </div> ); }; 
    
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
                await runTransaction(db, async (transaction) => { const requestDocRef = doc(db, "deliveryRequests", request.id); for (const item of editableItems) { const product = products.find(p => p.id === item.productId); if (!product) throw new Error(`Produit ID ${item.productId} non trouvé.`); const stockId = product.hasScents !== false ? `${item.productId}_${item.scent}` : item.productId; const stockDocRef = doc(db, `pointsOfSale/${request.posId}/stock`, stockId); const stockDoc = await transaction.get(stockDocRef); if (stockDoc.exists()) { const newQuantity = (stockDoc.data().quantity || 0) + item.quantity; transaction.update(stockDocRef, { quantity: newQuantity }); } else { transaction.set(stockDocRef, { productId: item.productId, productName: product.name, price: product.price, scent: item.scent || null, quantity: item.quantity }); } } transaction.update(requestDocRef, { status: 'delivered', items: editableItems }); }); 
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
// TABLEAUX DE BORD (DASHBOARDS)
// =================================================================

const PosDashboard = ({ db, user, products, scents, showToast, isAdminView = false }) => {
    const [stock, setStock] = useState([]);
    const [salesHistory, setSalesHistory] = useState([]);
    const [posData, setPosData] = useState(null);
    const [deliveryRequests, setDeliveryRequests] = useState([]);
    const [showSaleModal, setShowSaleModal] = useState(false);
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [saleToDelete, setSaleToDelete] = useState(null);
    const [expandedRequestId, setExpandedRequestId] = useState(null);
    const [currentTab, setCurrentTab] = useState('actives');
    const [requestToCancel, setRequestToCancel] = useState(null);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const posId = user.uid;

    const handleArchive = async (requestId) => {
        const reqDoc = doc(db, 'deliveryRequests', requestId);
        await updateDoc(reqDoc, { archivedBy: arrayUnion(user.uid) });
    };

    const handleUnarchive = async (requestId) => {
        const reqDoc = doc(db, 'deliveryRequests', requestId);
        await updateDoc(reqDoc, { archivedBy: arrayRemove(user.uid) });
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
            activeDeliveries: deliveryRequests.filter(req => !req.archivedBy?.includes(user.uid)),
            archivedDeliveries: deliveryRequests.filter(req => req.archivedBy?.includes(user.uid))
        };
    }, [deliveryRequests, user.uid]);
    
    const deliveriesToDisplay = currentTab === 'actives' ? activeDeliveries : archivedDeliveries;

    const toggleExpand = (requestId) => {
        setExpandedRequestId(prevId => (prevId === requestId ? null : requestId));
    };

    const DeliveryStatusTracker = ({ status, reason }) => { if (status === 'cancelled') { return ( <div className="border-l-4 border-red-500 bg-red-500/10 p-4 rounded-r-lg"> <div className="flex items-start gap-3"> <AlertTriangle className="h-6 w-6 text-red-500 flex-shrink-0 mt-1"/> <div className="flex-grow"> <h4 className="font-bold text-red-400">Commande Annulée</h4> {reason && <p className="text-sm text-gray-300 mt-1">Motif : <span className="italic">"{reason}"</span></p>} </div> </div> </div> ) } const currentIndex = deliveryStatusOrder.indexOf(status); return ( <div className="flex items-center space-x-2 sm:space-x-4"> {deliveryStatusOrder.map((step, index) => { const isCompleted = index < currentIndex; const isActive = index === currentIndex; return ( <React.Fragment key={step}> <div className="flex flex-col items-center"> <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white ${isCompleted ? 'bg-green-600' : isActive ? 'bg-blue-600 animate-pulse' : 'bg-gray-600'}`}> {isCompleted ? <Check size={16} /> : <span className="text-xs">{index + 1}</span>} </div> <p className={`mt-2 text-xs text-center ${isActive ? 'text-white font-bold' : 'text-gray-400'}`}>{DELIVERY_STATUS_STEPS[step]}</p> </div> {index < deliveryStatusOrder.length - 1 && ( <div className={`flex-1 h-1 rounded-full ${isCompleted ? 'bg-green-600' : 'bg-gray-600'}`}></div> )} </React.Fragment> ); })} </div> ); };
    
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

    const kpis = useMemo(() => {
        const totalStock = stock.reduce((acc, item) => acc + item.quantity, 0);
        const totalRevenue = salesHistory.reduce((acc, sale) => acc + sale.totalAmount, 0);
        const commission = totalRevenue * (posData?.commissionRate || 0);
        const netToBePaid = totalRevenue - commission;
        return { totalStock, totalRevenue, netToBePaid };
    }, [stock, salesHistory, posData]);

    const salesStats = useMemo(() => {
        if (salesHistory.length === 0) return [];
        const productSales = salesHistory.reduce((acc, sale) => { const key = `${sale.productName} ${sale.scent || ''}`; acc[key] = (acc[key] || 0) + sale.quantity; return acc; }, {});
        return Object.entries(productSales).sort(([,a],[,b]) => b-a).slice(0, 3);
    }, [salesHistory]);

    const handleDeleteSale = async (reason) => {
        if (!saleToDelete) return;
        const sale = saleToDelete;
        setSaleToDelete(null); 
        const product = products.find(p => p.id === sale.productId);
        if (!product) { showToast("Produit de la vente introuvable.", "error"); return; }
        const stockId = product.hasScents !== false ? `${sale.productId}_${sale.scent}` : sale.productId;
        const stockDocRef = doc(db, `pointsOfSale/${posId}/stock`, stockId);
        const saleDocRef = doc(db, `pointsOfSale/${posId}/sales`, sale.id);
        const logDocRef = doc(collection(db, `pointsOfSale/${posId}/logs`));
        try {
            const batch = writeBatch(db);
            const currentStockItem = stock.find(item => item.id === stockId);
            const newQuantity = (currentStockItem?.quantity || 0) + sale.quantity;
            if (currentStockItem) { batch.update(stockDocRef, { quantity: newQuantity }); } 
            else { batch.set(stockDocRef, { productId: sale.productId, productName: sale.productName, scent: sale.scent, quantity: sale.quantity, price: sale.unitPrice }); }
            batch.delete(saleDocRef);
            batch.set(logDocRef, { type: 'SALE_CANCELLED', reason, saleData: sale, cancelledAt: serverTimestamp(), by: user.email });
            await batch.commit();
            showToast("Vente annulée et stock restauré.", "success");
        } catch (error) { console.error("Erreur annulation vente: ", error); showToast("Erreur: impossible d'annuler la vente.", "error"); }
    };

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {showSaleModal && <SaleModal db={db} posId={posId} stock={stock} onClose={() => setShowSaleModal(false)} showToast={showToast} products={products} scents={scents} />}
            {showDeliveryModal && <DeliveryRequestModal db={db} posId={posId} posName={posData?.name} onClose={() => setShowDeliveryModal(false)} showToast={showToast} products={products} scents={scents}/>}
            {saleToDelete && <ConfirmationModal title="Confirmer l'annulation" message={`Annuler la vente de ${saleToDelete.quantity} x ${saleToDelete.productName} ${saleToDelete.scent || ''} ?\nLe stock sera automatiquement restauré.`} onConfirm={handleDeleteSale} onCancel={() => setSaleToDelete(null)} confirmText="Annuler la Vente" requiresReason={true} />}
            {requestToCancel && <ConfirmationModal title="Confirmer l'annulation" message="Êtes-vous sûr de vouloir annuler cette commande ? Cette action est irréversible." onConfirm={handleClientCancel} onCancel={() => setRequestToCancel(null)} confirmText="Oui, Annuler" />}
            {showInfoModal && <InfoModal title="Annulation Impossible" message="Cette commande est déjà en cours de traitement et ne peut plus être annulée. Veuillez contacter l'administrateur en cas de problème." onClose={() => setShowInfoModal(false)} />}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
                <div><h2 className="text-3xl font-bold text-white">Tableau de Bord</h2><p className="text-gray-400">Bienvenue, {posData?.name || user.displayName}</p></div>
                {!isAdminView && (
                    <div className="flex gap-4 mt-4 md:mt-0">
                        <button onClick={() => setShowDeliveryModal(true)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><Truck size={20} /> Demander une Livraison</button>
                        <button onClick={() => setShowSaleModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><PlusCircle size={20} /> Nouvelle Vente</button>
                    </div>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KpiCard title="Stock Total" value={kpis.totalStock} icon={Archive} color="bg-blue-600" />
                <KpiCard title="Chiffre d'Affaires Brut" value={formatPrice(kpis.totalRevenue)} icon={DollarSign} color="bg-green-600" />
                <KpiCard title="Votre Commission" value={formatPercent(posData?.commissionRate)} icon={Percent} color="bg-purple-600" />
                <KpiCard title="Net à reverser" value={formatPrice(kpis.netToBePaid)} icon={Package} color="bg-pink-600" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                <div className="bg-gray-800 rounded-2xl p-6 flex flex-col">
                    <div className="border-b border-gray-700 mb-4">
                        <nav className="-mb-px flex gap-6" aria-label="Tabs">
                            <button onClick={() => setCurrentTab('actives')} className={`${currentTab === 'actives' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-400'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>Actives</button>
                            <button onClick={() => setCurrentTab('archived')} className={`${currentTab === 'archived' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-400'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>Archives</button>
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
                                            {currentTab === 'actives' && isArchivable && <button onClick={() => handleArchive(req.id)} title="Archiver" className="p-4 text-gray-500 hover:text-indigo-400"><Archive size={18}/></button>}
                                            {currentTab === 'archived' && <button onClick={() => handleUnarchive(req.id)} title="Désarchiver" className="p-4 text-gray-500 hover:text-indigo-400"><ArchiveRestore size={18}/></button>}
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
                    ) : <p className="text-center text-gray-400 pt-8">Aucune demande dans les {currentTab === 'actives' ? 'actives' : 'archives'}.</p>}
                    </div>
                </div>
                <div className="bg-gray-800 rounded-2xl p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-white">Gestion du Stock Actuel</h3>
                        <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300">
                            <> {showHistory ? "Masquer l'historique" : "Voir l'historique"} {showHistory ? <ChevronUp/> : <ChevronDown/>} </>
                        </button>
                    </div>
                    {showHistory ? (
                        <div className="animate-fade-in overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-gray-700 text-gray-400 text-sm"><th className="p-3">Date</th><th className="p-3">Produit</th><th className="p-3">Qté</th><th className="p-3">Total</th><th className="p-3">Actions</th></tr></thead><tbody>{salesHistory.map(sale => (<tr key={sale.id} className="border-b border-gray-700 hover:bg-gray-700/50"><td className="p-3">{formatDate(sale.createdAt)}</td><td className="p-3">{sale.productName} <span className="text-gray-400">{sale.scent || ''}</span></td><td className="p-3">{sale.quantity}</td><td className="p-3 font-semibold">{formatPrice(sale.totalAmount)}</td><td className="p-3"><button onClick={() => setSaleToDelete(sale)} className="text-red-500 hover:text-red-400 p-1"><Trash2 size={18}/></button></td></tr>))}</tbody></table></div>
                    ) : (
                        <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-gray-700 text-gray-400 text-sm"><th className="p-3">Produit</th><th className="p-3">Parfum</th><th className="p-3">Stock</th><th className="p-3">Prix Unitaire</th></tr></thead><tbody>{stock.map(item => (<tr key={item.id} className="border-b border-gray-700 hover:bg-gray-700/50"><td className="p-3 font-medium">{item.productName}</td><td className="p-3 text-gray-300">{item.scent || 'N/A'}</td><td className={`p-3 font-bold ${item.quantity <= LOW_STOCK_THRESHOLD ? 'text-yellow-400' : 'text-white'}`}>{item.quantity}</td><td className="p-3">{formatPrice(item.price)}</td></tr>))}</tbody></table></div>
                    )}
                </div>
            </div>
             <div className="bg-gray-800 rounded-2xl p-6 mt-8">
                <h3 className="text-xl font-bold mb-4">Vos meilleures ventes</h3>
                {salesStats.length > 0 ? <ul>{salesStats.map(([name, qty])=><li key={name} className="flex justify-between py-1 border-b border-gray-700"><span>{name}</span><strong>{qty}</strong></li>)}</ul> : <p className="text-gray-400">Aucune vente enregistrée.</p>}
            </div>
        </div>
    );
};

const AdminDashboard = ({ db, user, showToast, products, scents }) => {
    const [pointsOfSale, setPointsOfSale] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedPos, setSelectedPos] = useState(null);
    const [posToEdit, setPosToEdit] = useState(null);
    const [posToToggleStatus, setPosToToggleStatus] = useState(null);
    const [requestToProcess, setRequestToProcess] = useState(null);
    const [requestToCancel, setRequestToCancel] = useState(null);
    const [globalStats, setGlobalStats] = useState({ revenue: 0, commission: 0, toPay: 0, topPos: [], topProducts: [] });
    const [deliveryRequests, setDeliveryRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [expandedRequestId, setExpandedRequestId] = useState(null);
    const [currentTab, setCurrentTab] = useState('actives');

    const handleArchive = async (requestId) => {
        const reqDoc = doc(db, 'deliveryRequests', requestId);
        await updateDoc(reqDoc, { archivedBy: arrayUnion(user.uid) });
    };

    const handleUnarchive = async (requestId) => {
        const reqDoc = doc(db, 'deliveryRequests', requestId);
        await updateDoc(reqDoc, { archivedBy: arrayRemove(user.uid) });
    };

    const { activeDeliveries, archivedDeliveries } = useMemo(() => {
        return {
            activeDeliveries: deliveryRequests.filter(req => !req.archivedBy?.includes(user.uid)),
            archivedDeliveries: deliveryRequests.filter(req => req.archivedBy?.includes(user.uid))
        };
    }, [deliveryRequests, user.uid]);

    const deliveriesToDisplay = currentTab === 'actives' ? activeDeliveries : archivedDeliveries;


    const toggleExpand = (requestId) => {
        setExpandedRequestId(prevId => (prevId === requestId ? null : requestId));
    };
    
    const DeliveryStatusTracker = ({ status }) => {
      const currentIndex = deliveryStatusOrder.indexOf(status);
      return (
        <div className="flex items-center space-x-2 sm:space-x-4 p-2">
          {deliveryStatusOrder.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isActive = index === currentIndex;
            return (
              <React.Fragment key={step}>
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white ${ isCompleted ? 'bg-green-600' : isActive ? 'bg-blue-600 animate-pulse' : 'bg-gray-600'}`}>
                    {isCompleted ? <Check size={16} /> : <span className="text-xs">{index + 1}</span>}
                  </div>
                  <p className={`mt-2 text-xs text-center w-20 ${isActive ? 'text-white font-bold' : 'text-gray-400'}`}>{DELIVERY_STATUS_STEPS[step]}</p>
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

    useEffect(() => {
        const q = query(collection(db, "pointsOfSale"), orderBy('name'));
        const unsub = onSnapshot(q, (snapshot) => {
            setPointsOfSale(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return unsub;
    }, [db]);

    useEffect(() => {
        const q = query(collection(db, "deliveryRequests"), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snapshot) => {
            setDeliveryRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => {
            console.error("Erreur Firestore (pensez aux index!) : ", error);
        });
        return unsub;
    }, [db]);

    useEffect(() => {
        if (pointsOfSale.length === 0) return;
        const fetchAllSales = async () => {
            let allSales = [];
            for (const pos of pointsOfSale) {
                const salesQuery = query(collection(db, `pointsOfSale/${pos.id}/sales`));
                const salesSnapshot = await getDocs(salesQuery);
                const salesData = salesSnapshot.docs.map(doc => ({ ...doc.data(), posName: pos.name, commissionRate: pos.commissionRate }));
                allSales = [...allSales, ...salesData];
            }
            return allSales;
        };

        fetchAllSales().then(allSales => {
            const revenue = allSales.reduce((acc, sale) => acc + sale.totalAmount, 0);
            const commission = allSales.reduce((acc, sale) => acc + (sale.totalAmount * (sale.commissionRate || 0)), 0);
            const toPay = revenue - commission;
            const salesByPos = allSales.reduce((acc, sale) => { acc[sale.posName] = (acc[sale.posName] || 0) + sale.totalAmount; return acc; }, {});
            const topPos = Object.entries(salesByPos).sort(([,a],[,b]) => b-a).slice(0, 3);
            const salesByProduct = allSales.reduce((acc, sale) => { const key = `${sale.productName} ${sale.scent || ''}`.trim(); acc[key] = (acc[key] || 0) + sale.quantity; return acc; }, {});
            const topProducts = Object.entries(salesByProduct).sort(([,a],[,b]) => b-a).slice(0, 3);
            setGlobalStats({ revenue, commission, toPay, topPos, topProducts });
        });
    }, [pointsOfSale, db]);

    const handleCancelDelivery = async (reason) => {
        if (!requestToCancel) return;
        setIsLoading(true);
        const requestDocRef = doc(db, 'deliveryRequests', requestToCancel.id);
        try {
            await updateDoc(requestDocRef, { status: 'cancelled', cancellationReason: reason });
            await addDoc(collection(db, 'notifications'), {
                recipientUid: requestToCancel.posId,
                message: `Votre commande du ${formatDate(requestToCancel.createdAt)} a été annulée.`,
                createdAt: serverTimestamp(),
                isRead: false,
                type: 'DELIVERY_CANCELLED'
            });
            showToast("Commande annulée avec succès.", "success");
            setRequestToCancel(null);
            setRequestToProcess(null);
        } catch (error) {
            showToast("Erreur lors de l'annulation.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleTogglePosStatus = async () => {
        if (!posToToggleStatus) return;
        const pos = posToToggleStatus;
        const newStatus = pos.status === 'active' ? 'inactive' : 'active';
        try {
            const batch = writeBatch(db);
            const posDocRef = doc(db, "pointsOfSale", pos.id);
            const userDocRef = doc(db, "users", pos.id);
            batch.update(posDocRef, { status: newStatus });
            batch.update(userDocRef, { status: newStatus });
            await batch.commit();
            showToast(`Le compte "${pos.name}" est maintenant ${newStatus === 'active' ? 'actif' : 'inactif'}.`, "success");
        } catch (error) {
            console.error("Erreur de changement de statut: ", error);
            showToast("Erreur lors du changement de statut.", "error");
        } finally {
            setPosToToggleStatus(null);
        }
    };
    
    if (selectedPos) {
        return (
            <div>
                 <button onClick={() => setSelectedPos(null)} className="m-4 bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">← Retour à la liste</button>
                 <PosDashboard db={db} user={{uid: selectedPos.id, ...selectedPos}} products={products} scents={scents} showToast={showToast} isAdminView={true} />
            </div>
        );
    }
    
    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {showCreateModal && <CreatePosModal db={db} showToast={showToast} onClose={() => setShowCreateModal(false)} />}
            {posToEdit && <EditPosModal db={db} pos={posToEdit} showToast={showToast} onClose={() => setPosToEdit(null)} onSave={() => {}} />}
            {posToToggleStatus && <ConfirmationModal title="Confirmer le changement de statut" message={`Êtes-vous sûr de vouloir rendre le compte "${posToToggleStatus.name}" ${posToToggleStatus.status === 'active' ? 'INACTIF' : 'ACTIF'} ?`} onConfirm={handleTogglePosStatus} onCancel={() => setPosToToggleStatus(null)} confirmText="Oui, confirmer" confirmColor={posToToggleStatus.status === 'active' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} />}
            {requestToProcess && <ProcessDeliveryModal db={db} request={requestToProcess} products={products} showToast={showToast} onClose={() => setRequestToProcess(null)} onCancelRequest={() => setRequestToCancel(requestToProcess)} />}
            {requestToCancel && <ConfirmationModal title="Confirmer l'annulation" message={`Vous êtes sur le point d'annuler cette commande. Veuillez fournir un motif (obligatoire).`} confirmText="Confirmer l'Annulation" confirmColor="bg-red-600 hover:bg-red-700" requiresReason={true} onConfirm={handleCancelDelivery} onCancel={() => setRequestToCancel(null)} />}
            
            <div className="flex justify-between items-center mb-8">
                <div><h2 className="text-3xl font-bold text-white">Tableau de Bord Administrateur</h2><p className="text-gray-400">Gestion des dépôts-ventes et du catalogue.</p></div>
                <button onClick={() => setShowCreateModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><UserPlus size={20} /> Ajouter un Dépôt</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KpiCard title="Chiffre d'Affaires Total" value={formatPrice(globalStats.revenue)} icon={DollarSign} color="bg-green-600" />
                <KpiCard title="Commissions Totales" value={formatPrice(globalStats.commission)} icon={HandCoins} color="bg-blue-600" />
                <KpiCard title="Total à Reverser" value={formatPrice(globalStats.toPay)} icon={Package} color="bg-pink-600" />
                <KpiCard title="Dépôts Actifs" value={pointsOfSale.length} icon={Store} color="bg-purple-600" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
                <div className="lg:col-span-2 bg-gray-800 rounded-2xl p-6 flex flex-col">
                     <div className="border-b border-gray-700 mb-4">
                        <nav className="-mb-px flex gap-6" aria-label="Tabs">
                            <button onClick={() => setCurrentTab('actives')} className={`${currentTab === 'actives' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-400'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>Actives</button>
                            <button onClick={() => setCurrentTab('archived')} className={`${currentTab === 'archived' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-400'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>Archives</button>
                        </nav>
                    </div>
                    <div className="flex-grow">
                    {deliveriesToDisplay.length > 0 ? (
                        <div className="space-y-4">
                            {deliveriesToDisplay.map(req => {
                                const isExpanded = expandedRequestId === req.id;
                                const isArchivable = (req.status === 'delivered' || req.status === 'cancelled');
                                return (
                                    <div key={req.id} className="bg-gray-700/50 rounded-lg transition-all duration-300">
                                        <div className='flex'>
                                            <button onClick={() => toggleExpand(req.id)} className="w-full p-4 flex justify-between items-center text-left flex-grow">
                                                <div>
                                                    <p className="font-bold">{req.posName}</p>
                                                    <p className="text-sm text-gray-400">{formatDate(req.createdAt)} - <span className="font-semibold text-blue-400">{DELIVERY_STATUS_STEPS[req.status]}</span></p>
                                                </div>
                                                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                            </button>
                                            {currentTab === 'actives' && isArchivable && <button onClick={() => handleArchive(req.id)} title="Archiver" className="p-4 text-gray-500 hover:text-indigo-400"><Archive size={18}/></button>}
                                            {currentTab === 'archived' && <button onClick={() => handleUnarchive(req.id)} title="Désarchiver" className="p-4 text-gray-500 hover:text-indigo-400"><ArchiveRestore size={18}/></button>}
                                        </div>
                                        {isExpanded && (
                                            <div className="p-4 border-t border-gray-600 animate-fade-in">
                                                <DeliveryStatusTracker status={req.status} />
                                                <div className="mt-4 flex justify-end">
                                                     <button onClick={() => setRequestToProcess(req)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 text-sm">
                                                        <Wrench size={16}/> Gérer la Demande
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    ) : <p className="text-center text-gray-400 pt-8">Aucune demande dans les {currentTab}.</p>}
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="bg-gray-800 rounded-2xl p-6">
                        <h3 className="text-xl font-bold mb-4">Top 3 Dépôts (par CA)</h3>
                        {globalStats.topPos.length > 0 ? <ul>{globalStats.topPos.map(([name, val])=><li key={name} className="flex justify-between py-1 border-b border-gray-700"><span>{name}</span><strong>{formatPrice(val)}</strong></li>)}</ul> : <p className="text-gray-400">Aucune donnée.</p>}
                    </div>
                    <div className="bg-gray-800 rounded-2xl p-6">
                        <h3 className="text-xl font-bold mb-4">Top 3 Produits (par Qté)</h3>
                        {globalStats.topProducts.length > 0 ? <ul>{globalStats.topProducts.map(([name, qty])=><li key={name} className="flex justify-between py-1 border-b border-gray-700"><span>{name}</span><strong>{qty}</strong></li>)}</ul> : <p className="text-gray-400">Aucune donnée.</p>}
                    </div>
                </div>
            </div>
            <div className="bg-gray-800 rounded-2xl p-6 mt-8">
                <h3 className="text-xl font-bold text-white mb-4">Liste des Dépôts-Ventes</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead><tr className="border-b border-gray-700 text-gray-400 text-sm"><th className="p-3">Nom</th><th className="p-3">Commission</th><th className="p-3">Date de création</th><th className="p-3">Actions</th></tr></thead>
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
                                        <button onClick={() => setPosToEdit(pos)} className="text-yellow-400 p-1 hover:text-yellow-300">Modifier</button>
                                        <button onClick={() => setPosToToggleStatus(pos)} className={`p-1 ${pos.status === 'active' ? 'text-red-500 hover:text-red-400' : 'text-green-500 hover:text-green-400'}`}>
                                            {pos.status === 'active' ? 'Désactiver' : 'Activer'}
                                        </button>
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
// COMPOSANT PRINCIPAL DE L'APPLICATION
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
    
    useEffect(() => { document.title = APP_TITLE; }, []);

    useEffect(() => {
        if(!db) return;
        const unsubProducts = onSnapshot(query(collection(db, 'products'), orderBy('name')), snap => setProducts(snap.docs.map(d=>({id:d.id, ...d.data()}))));
        const unsubScents = onSnapshot(query(collection(db, 'scents'), orderBy('name')), snap => setScents(snap.docs.map(d=>({id:d.id, ...d.data()}))));
        return () => { unsubProducts(); unsubScents(); };
    }, [db]);
    
    const showToast = useCallback((message, type = 'success') => { setToast({ id: Date.now(), message, type }); }, []);
    
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (authUser) => {
            if (authUser) {
                const userDocRef = doc(db, 'users', authUser.uid);
                const unsubUser = onSnapshot(userDocRef, (doc) => {
                    if (doc.exists()) {
                        setUserData({ uid: authUser.uid, email: authUser.email, ...doc.data() });
                        setUser(authUser);
                    } else { signOut(auth); }
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
        setLoginError(null); setIsLoggingIn(true);
        try { await signInWithEmailAndPassword(auth, email, password); }
        catch (error) { setLoginError("Email ou mot de passe incorrect."); }
        finally { setIsLoggingIn(false); }
    }, [auth]);
    
    const handleLogout = useCallback(() => { signOut(auth); }, [auth]);

    const renderContent = () => {
        const catalogIsLoading = products.length === 0 || scents.length === 0;

        if (isLoading) { return <div className="bg-gray-900 min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>; }
        if (!user || !userData) { return <LoginPage onLogin={handleLogin} error={loginError} isLoggingIn={isLoggingIn} />; }
        
        if (userData.role === 'pos' && userData.status === 'inactive') {
            return ( <InactiveAccountModal onLogout={handleLogout} /> );
        }
        
        return (
             <div className="bg-gray-900 text-white min-h-screen font-sans">
                 <header className="bg-gray-800/50 p-4 flex justify-between items-center shadow-md sticky top-0 z-30 backdrop-blur-sm">
                     <div className="flex items-center gap-2"><Package size={24} className="text-indigo-400"/><h1 className="text-xl font-bold">{APP_NAME}</h1></div>
                     <div className="flex items-center gap-4">
                         <span className="text-gray-300 text-sm hidden sm:block"><span className="font-semibold">{userData.displayName}</span> ({userData.role})</span>
                         
                         {userData && <NotificationBell db={db} user={userData} />}

                         <button onClick={handleLogout} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700"><LogOut size={20} /></button>
                     </div>
                 </header>
                 <main>
                     {catalogIsLoading ?
                         <div className="p-8 text-center text-gray-400">Chargement du catalogue...</div>
                         :
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
