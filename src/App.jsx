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
    DollarSign, Archive, Eye, ChevronDown, ChevronUp, Check, XCircle, Trash2, Send, UserPlus, ToggleLeft, ToggleRight
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

const PRODUCTS = [
    { id: 'bougie', name: 'Bougie', price: 15.00, icon: Package },
    { id: 'fondant', name: 'Fondant', price: 2.50, icon: Flame },
    { id: 'bruleur', name: 'Brûleur', price: 12.00, icon: Store, hasScents: false }
];

const SCENTS = [ "Vanille Bourbon", "Fleur de Coton", "Monoï de Tahiti", "Bois de Santal", "Citron Meringué", "Feu de Bois", "Fraise des Bois", "Menthe Fraîche", "Lavande Vraie", "Rose Ancienne", "Ambre Précieux", "Patchouli"];
const LOW_STOCK_THRESHOLD = 3;

// =================================================================
// FONCTIONS UTILITAIRES ET COMPOSANTS UI
// =================================================================

const formatPrice = (price) => `${(price || 0).toFixed(2)} €`;
const formatDate = (timestamp) => !timestamp?.toDate ? 'Date inconnue' : timestamp.toDate().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const AnimationStyles = () => ( <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}.animate-fade-in{animation:fadeIn .5s ease-in-out}@keyframes fadeInUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.animate-fade-in-up{animation:fadeInUp .5s ease-out forwards}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.animate-spin{animation:spin 1s linear infinite}.custom-scrollbar::-webkit-scrollbar{width:8px}.custom-scrollbar::-webkit-scrollbar-track{background:#1f2937}.custom-scrollbar::-webkit-scrollbar-thumb{background:#4f46e5;border-radius:10px}`}</style> );
const Toast = ({ message, type, onClose }) => { const C = {s:'bg-green-600',e:'bg-red-600',i:'bg-blue-600'}, I = {s:CheckCircle,e:XCircle,i:Info}[type]||Info; useEffect(()=>{const t=setTimeout(onClose,4000);return()=>clearTimeout(t)},[onClose]); return <div className={`fixed bottom-5 right-5 p-4 rounded-lg shadow-2xl text-white flex items-center gap-3 z-[999] animate-fade-in-up ${C[type]}`}><I size={24}/><span>{message}</span><button onClick={onClose} className="ml-2 opacity-80 hover:opacity-100"><X size={20}/></button></div> };
const ConfirmationModal = ({ title, message, onConfirm, onCancel, confirmText = "Confirmer", cancelText = "Annuler", cColor = "bg-red-600 hover:bg-red-700", requiresReason = false}) => { const [r, setR]=useState(''); const hC = () => {if(requiresReason&&!r.trim()){alert("Veuillez fournir une raison.");return;} onConfirm(requiresReason?r:undefined)}; return <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in" onClick={onCancel}><div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 animate-fade-in-up" onClick={e=>e.stopPropagation()}><div className="text-center"><AlertTriangle className="mx-auto h-12 w-12 text-yellow-400"/><h3 className="mt-4 text-xl font-semibold text-white">{title}</h3><p className="text-gray-400 mt-2 whitespace-pre-line">{message}</p></div>{requiresReason&&<div className="mt-6"><label className="block text-sm font-medium text-gray-300 mb-2">Raison (obligatoire)</label><textarea value={r} onChange={e=>setR(e.target.value)} rows="3" className="w-full bg-gray-700 p-3 rounded-lg" placeholder="Ex: Erreur..."></textarea></div>}<div className="mt-8 flex justify-center gap-4"><button onClick={onCancel} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg">{cancelText}</button><button onClick={hC} className={`${cColor} text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50`} disabled={requiresReason&&!r.trim()}>{confirmText}</button></div></div></div>};
const KpiCard = ({ title, value, icon: Icon, color }) => ( <div className="bg-gray-800 p-5 rounded-xl flex items-center gap-4"><div className={`p-3 rounded-lg ${color}`}><Icon size={28} className="text-white"/></div><div><p className="text-gray-400 text-sm font-medium">{title}</p><p className="text-2xl font-bold text-white">{value}</p></div></div> );
const LoginPage = ({ onLogin, error, isLoggingIn }) => { const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const handleSubmit = (e) => { e.preventDefault(); if (!isLoggingIn) onLogin(email, password); }; return <div className="bg-gray-900 min-h-screen flex flex-col items-center justify-center p-4"><div className="text-center mb-8 animate-fade-in"><Package size={48} className="mx-auto text-indigo-400"/><h1 className="text-4xl font-bold text-white mt-4">{APP_NAME}</h1><p className="text-gray-400">Espace de connexion</p></div><div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-700 animate-fade-in-up"><form onSubmit={handleSubmit} className="space-y-6"><div><label className="block text-sm font-medium text-gray-300 mb-2">Adresse Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg" /></div><div><label className="block text-sm font-medium text-gray-300 mb-2">Mot de passe</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg" /></div>{error && (<p className="text-red-400 text-sm text-center bg-red-500/10 p-3 rounded-lg">{error}</p>)}<button type="submit" disabled={isLoggingIn} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60">{isLoggingIn ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div> : <><LogIn size={20} /> Se connecter</>}</button></form></div></div>;};
const CreatePosModal = ({ db, showToast, onClose }) => { const [displayName, setD]=useState(''); const [email, setE]=useState(''); const [password, setP]=useState(''); const [isLoading, setL]=useState(false); const handleCreate=async(e)=>{e.preventDefault();if(!displayName||!email||password.length<6){showToast("Nom, email et mot de passe (6+ car.) requis.","error");return}setL(true);const appName=`secondary-app-${Date.now()}`;let secondaryApp;try{secondaryApp=initializeApp(firebaseConfig,appName);const secondaryAuth=getAuth(secondaryApp);const userCredential=await createUserWithEmailAndPassword(secondaryAuth,email,password);const newUser=userCredential.user;await setDoc(doc(db,"users",newUser.uid),{displayName,email,role:"pos",status:"active",createdAt:serverTimestamp()});await setDoc(doc(db,"pointsOfSale",newUser.uid),{name:displayName,createdAt:serverTimestamp()});showToast(`Compte pour ${displayName} créé !`,"success");onClose()}catch(error){if(error.code==='auth/email-already-in-use'){showToast("Email déjà utilisé.","error")}else if(error.code==='auth/weak-password'){showToast("Le mot de passe doit faire au moins 6 caractères.","error")}else{showToast("Erreur de création.","error")}}finally{setL(false);if(secondaryApp){signOut(getAuth(secondaryApp)).then(()=>deleteApp(secondaryApp))}}}; return <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40" onClick={onClose}><div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-lg border-gray-700" onClick={e=>e.stopPropagation()}><h2 className="text-2xl font-bold text-white mb-6">Ajouter un Dépôt-Vente</h2><form onSubmit={handleCreate} className="space-y-4"><div><label className="block text-sm">Nom du Dépôt</label><input type="text" value={displayName} onChange={e=>setD(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/></div><div><label className="block text-sm">Email</label><input type="email" value={email} onChange={e=>setE(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/></div><div><label className="block text-sm">Mot de passe initial</label><input type="password" value={password} onChange={e=>setP(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/></div><div className="flex justify-end gap-4 pt-4"><button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Annuler</button><button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-60">{isLoading?<div className="animate-spin rounded-full h-5 w-5 border-b-2"></div>:<><UserPlus size={18}/>Créer</>}</button></div></form></div></div>;};
const SaleModal = ({ db, posId, stock, onClose, showToast }) => { const [pId,setpId]=useState(''); const [s,setS]=useState(''); const [q,setQ]=useState(1); const aS=useMemo(()=>PRODUCTS.find(p=>p.id===pId)?.hasScents!==false?SCENTS:[],[pId]); const maxQ=useMemo(()=>(!pId?0:stock.find(i=>i.productId===pId&&(i.scent===s||aS.length===0))?.quantity||0),[stock,pId,s,aS]); const handleSave=async()=>{const p=PRODUCTS.find(pr=>pr.id===pId);if(!p||(p.hasScents!==false&&!s)||q<=0){showToast("Veuillez remplir tous les champs.","error");return}if(q>maxQ){showToast("Quantité > stock disponible.","error");return}try{const b=writeBatch(db);b.set(doc(collection(db,`pointsOfSale/${posId}/sales`)),{productId:p.id,productName:p.name,scent:p.hasScents!==false?s:null,quantity:Number(q),unitPrice:p.price,totalAmount:p.price*Number(q),createdAt:serverTimestamp()});b.update(doc(db,`pointsOfSale/${posId}/stock`,p.hasScents!==false?`${p.id}_${s}`:p.id),{quantity:maxQ-Number(q)});await b.commit();showToast("Vente enregistrée !","success");onClose()}catch(e){showToast("Échec de l'enregistrement.","error")}}; return <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40" onClick={onClose}><div className="bg-gray-800 p-8 rounded-2xl w-full max-w-lg border-gray-700" onClick={e=>e.stopPropagation()}><h2 className="text-2xl font-bold text-white mb-6">Enregistrer une Vente</h2><div className="space-y-4"><div><label className="block text-sm">Produit</label><select value={pId} onChange={e=>{setpId(e.target.value);setS('')}} className="w-full bg-gray-700 p-3 rounded-lg"><option value="">-- Choisir --</option>{PRODUCTS.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>{aS.length>0&&<div><label className="block text-sm">Parfum</label><select value={s} onChange={e=>setS(e.target.value)} className="w-full bg-gray-700 p-3 rounded-lg" disabled={!pId}><option value="">-- Choisir --</option>{aS.map(sc=><option key={sc} value={sc}>{sc}</option>)}</select></div>}<div><label className="block text-sm">Quantité</label><input type="number" value={q} onChange={e=>setQ(e.target.value)} min="1" max={maxQ} className="w-full bg-gray-700 p-3 rounded-lg"/>{maxQ>0&&<p className="text-xs text-gray-400 mt-1">En stock: {maxQ}</p>}</div></div><div className="mt-8 flex justify-end gap-4"><button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Annuler</button><button onClick={handleSave} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg">Enregistrer</button></div></div></div>};
const DeliveryRequestModal = ({ db, posId, posName, onClose, showToast }) => { const [items,setItems]=useState([{productId:'',scent:'',quantity:10}]); const handleItemChange=(i,f,v)=>{const nI=[...items];nI[i][f]=v;if(f==='productId')nI[i].scent='';setItems(nI)}; const handleAdd=()=>setItems([...items,{productId:'',scent:'',quantity:10}]); const handleRemove=(i)=>setItems(items.filter((_,idx)=>i!==idx)); const handleSend=async()=>{const vI=items.filter(i=>{const p=PRODUCTS.find(pr=>pr.id===i.productId);if(!p||(p.hasScents!==false&&!i.scent)||i.quantity<=0)return false;return true});if(vI.length===0){showToast("Ajoutez au moins un article valide.","error");return}try{await addDoc(collection(db,'deliveryRequests'),{posId,posName,items:vI,status:'pending',createdAt:serverTimestamp()});showToast("Demande de livraison envoyée !","success");onClose()}catch(e){showToast("Échec de l'envoi.","error")}}; return <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40" onClick={onClose}><div className="bg-gray-800 p-8 rounded-2xl w-full max-w-2xl border-gray-700 custom-scrollbar max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}><h2 className="text-2xl font-bold text-white mb-6">Demander une Livraison</h2><div className="space-y-4">{items.map((item,i)=>{const p=PRODUCTS.find(pr=>pr.id===item.productId);const sS=p&&p.hasScents!==false;return(<div key={i} className="bg-gray-700/50 p-4 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-4 items-end"><div className="sm:col-span-1"><label className="text-sm">Produit</label><select value={item.productId} onChange={e=>handleItemChange(i,'productId',e.target.value)} className="w-full bg-gray-600 p-2 rounded-lg"><option value="">-- Choisir --</option>{PRODUCTS.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div className="sm:col-span-1">{sS&&<>
<label className="text-sm">Parfum</label><select value={item.scent} onChange={e=>handleItemChange(i,'scent',e.target.value)} className="w-full bg-gray-600 p-2 rounded-lg"><option value="">-- Choisir --</option>{SCENTS.map(s=><option key={s} value={s}>{s}</option>)}</select></>}</div><div className="flex items-center gap-2"><div className="flex-grow"><label className="text-sm">Quantité</label><input type="number" value={item.quantity} onChange={e=>handleItemChange(i,'quantity',Number(e.target.value))} min="1" className="w-full bg-gray-600 p-2 rounded-lg"/></div>{items.length>1&&<button onClick={()=>handleRemove(i)} className="p-2 bg-red-600 rounded-lg text-white self-end mb-px"><Trash2 size={20}/></button>}</div></div>)})}</div><button type="button" onClick={handleAdd} className="mt-4 flex items-center gap-2 text-indigo-400"><PlusCircle size={20}/>Ajouter un article</button><div className="mt-8 flex justify-end gap-4"><button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Annuler</button><button onClick={handleSend} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><Send size={18}/>Envoyer</button></div></div></div>};

// =================================================================
// TABLEAUX DE BORD (DASHBOARDS)
// =================================================================

const PosDashboard = ({ db, user, showToast }) => {
    const [stock, setStock] = useState([]);
    const [salesHistory, setSalesHistory] = useState([]);
    const [showSaleModal, setShowSaleModal] = useState(false);
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [saleToDelete, setSaleToDelete] = useState(null);
    const posId = user.uid;
    
    useEffect(() => {
        if (!db || !posId) return;
        const q = query(collection(db, `pointsOfSale/${posId}/stock`), orderBy('productName'));
        const unsubscribe = onSnapshot(q, (snapshot) => setStock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))), console.error);
        return unsubscribe;
    }, [db, posId]);

    useEffect(() => {
        if (!showHistory || !db || !posId) return;
        const q = query(collection(db, `pointsOfSale/${posId}/sales`), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => setSalesHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))), console.error);
        return unsubscribe;
    }, [db, posId, showHistory]);

    const kpis = useMemo(() => {
        const totalStock = stock.reduce((acc, item) => acc + item.quantity, 0);
        const totalRevenue = salesHistory.reduce((acc, sale) => acc + sale.totalAmount, 0);
        const commissionRate = 0.30;
        const netToBePaid = totalRevenue * (1 - commissionRate);
        return { totalStock, totalRevenue, netToBePaid };
    }, [stock, salesHistory]);

    const lowStockItems = useMemo(() => stock.filter(item => item.quantity > 0 && item.quantity <= LOW_STOCK_THRESHOLD), [stock]);

    const handleDeleteSale = async (reason) => {
        if (!saleToDelete) return;
        try {
            const batch = writeBatch(db);
            const saleDocRef = doc(db, `pointsOfSale/${posId}/sales`, saleToDelete.id);
            const stockId = saleToDelete.scent ? `${saleToDelete.productId}_${saleToDelete.scent}` : saleToDelete.productId;
            const stockDocRef = doc(db, `pointsOfSale/${posId}/stock`, stockId);
            const currentStockItem = stock.find(s => s.id === stockId);
            if (currentStockItem) batch.update(stockDocRef, { quantity: currentStockItem.quantity + saleToDelete.quantity });
            batch.delete(saleDocRef);
            await batch.commit();
            showToast("Vente supprimée et stock restauré.", "success");
        } catch (error) { showToast("Échec de la suppression.", "error"); } finally { setSaleToDelete(null); }
    };

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {showSaleModal && <SaleModal db={db} posId={posId} stock={stock} onClose={() => setShowSaleModal(false)} showToast={showToast} />}
            {showDeliveryModal && <DeliveryRequestModal db={db} posId={posId} posName={user.displayName} onClose={() => setShowDeliveryModal(false)} showToast={showToast} />}
            {saleToDelete && <ConfirmationModal title="Confirmer la suppression" message={`Supprimer la vente de ${saleToDelete.quantity} x ${saleToDelete.productName} ${saleToDelete.scent || ''}?`} onConfirm={handleDeleteSale} onCancel={() => setSaleToDelete(null)} requiresReason={true}/>}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
                <div><h2 className="text-3xl font-bold text-white">Tableau de Bord</h2><p className="text-gray-400">Bienvenue, {user.displayName}</p></div>
                <div className="flex gap-4 mt-4 md:mt-0">
                    <button onClick={() => setShowDeliveryModal(true)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><Truck size={20} /> Demander une Livraison</button>
                    <button onClick={() => setShowSaleModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><PlusCircle size={20} /> Nouvelle Vente</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <KpiCard title="Stock Total" value={kpis.totalStock} icon={Archive} color="bg-blue-600" />
                <KpiCard title="Chiffre d'Affaires" value={formatPrice(kpis.totalRevenue)} icon={DollarSign} color="bg-green-600" />
                <KpiCard title="À reverser" value={formatPrice(kpis.netToBePaid)} icon={Package} color="bg-pink-600" />
            </div>

            {lowStockItems.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 p-4 rounded-lg mb-8">
                    <div className="flex items-center gap-3"><AlertTriangle className="w-6 h-6"/><h3 className="font-semibold">Stocks Faibles</h3></div>
                    <ul className="list-disc list-inside mt-2 text-sm">{lowStockItems.map(item => <li key={item.id}><strong>{item.productName} {item.scent || ''}</strong> : {item.quantity} restant(s).</li>)}</ul>
                </div>
            )}

            <div className="bg-gray-800 rounded-2xl p-6">
                <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-white">Gestion du Stock Actuel</h3><button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300">{showHistory ? 'Masquer l\'historique' : 'Voir l\'historique'} {showHistory ? <ChevronUp/> : <ChevronDown/>}</button></div>
                {showHistory ? (
                    <div className="animate-fade-in overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-gray-700 text-gray-400 text-sm"><th className="p-3">Date</th><th className="p-3">Produit</th><th className="p-3">Qté</th><th className="p-3">Total</th><th className="p-3">Actions</th></tr></thead><tbody>{salesHistory.map(sale => (<tr key={sale.id} className="border-b border-gray-700 hover:bg-gray-700/50"><td className="p-3">{formatDate(sale.createdAt)}</td><td className="p-3">{sale.productName} <span className="text-gray-400">{sale.scent}</span></td><td className="p-3">{sale.quantity}</td><td className="p-3 font-semibold">{formatPrice(sale.totalAmount)}</td><td className="p-3"><button onClick={() => setSaleToDelete(sale)} className="text-red-500 hover:text-red-400 p-1"><Trash2 size={18}/></button></td></tr>))}</tbody></table></div>
                ) : (
                    <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-gray-700 text-gray-400 text-sm"><th className="p-3">Produit</th><th className="p-3">Parfum</th><th className="p-3">Stock</th><th className="p-3">Prix Unitaire</th></tr></thead><tbody>{stock.map(item => (<tr key={item.id} className="border-b border-gray-700 hover:bg-gray-700/50"><td className="p-3 font-medium">{item.productName}</td><td className="p-3 text-gray-300">{item.scent || 'N/A'}</td><td className={`p-3 font-bold ${item.quantity <= LOW_STOCK_THRESHOLD ? 'text-yellow-400' : 'text-white'}`}>{item.quantity}</td><td className="p-3">{formatPrice(item.price)}</td></tr>))}</tbody></table></div>
                )}
            </div>
        </div>
    );
};

const AdminDashboard = ({ db, user, showToast }) => {
    const [pointsOfSale, setPointsOfSale] = useState([]);
    const [selectedPos, setSelectedPos] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [userToUpdate, setUserToUpdate] = useState(null);
    const [confirmation, setConfirmation] = useState({ isOpen: false });
    const [viewMode, setViewMode] = useState('active'); 

    useEffect(() => {
        if (!db) return;
        const q = query(collection(db, 'users'), where('role', '==', 'pos'), where('status', '==', viewMode));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const posData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
            setPointsOfSale(posData);
        }, console.error);
        return unsubscribe;
    }, [db, viewMode]);

    const handleSetUserStatus = async () => {
        if (!userToUpdate) return;
        const { pos, newStatus } = userToUpdate;
        try {
            await updateDoc(doc(db, "users", pos.uid), { status: newStatus });
            showToast(`Le compte de ${pos.displayName} est maintenant ${newStatus}.`, "success");
        } catch (error) { showToast("Erreur de mise à jour.", "error"); }
        finally { setConfirmation({ isOpen: false }); setUserToUpdate(null); }
    };
    
    const openConfirmation = (pos, newStatus) => {
        setUserToUpdate({ pos, newStatus });
        const modalConfig = newStatus === 'inactive' ? {
            title: `Mettre "${pos.displayName}" en inactif ?`,
            message: `Le compte sera masqué.\nN'oubliez pas de désactiver son accès dans Firebase Authentication pour bloquer sa connexion.`,
            confirmText: "Oui, mettre inactif", cColor: "bg-yellow-600 hover:bg-yellow-700"
        } : {
            title: `Réactiver "${pos.displayName}" ?`,
            message: `Le compte sera de nouveau opérationnel.\nN'oubliez pas de réactiver son accès dans Firebase Authentication.`,
            confirmText: "Oui, réactiver", cColor: "bg-green-600 hover:bg-green-700"
        };
        setConfirmation({ isOpen: true, ...modalConfig, onConfirm: handleSetUserStatus });
    };
    
    if (selectedPos) {
        return (
            <div className="animate-fade-in">
                 <button onClick={() => setSelectedPos(null)} className="m-4 ml-8 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">&larr; Retour à la liste</button>
                <PosDashboard db={db} user={selectedPos} showToast={showToast} />
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {showCreateModal && <CreatePosModal db={db} showToast={showToast} onClose={() => setShowCreateModal(false)} />}
            {confirmation.isOpen && <ConfirmationModal {...confirmation} onCancel={() => setConfirmation({ isOpen: false })} />}
            <div className="mb-8"><h2 className="text-3xl font-bold text-white">Tableau de Bord Administrateur</h2><p className="text-gray-400">Bienvenue, {user.displayName}</p></div>
            
            {/* Ici viendrait la section des demandes de livraison */}

            <div className="bg-gray-800 rounded-2xl p-6 mt-8">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-white">Gérer les Dépôts-Ventes</h3>
                        <div className="flex items-center gap-4 mt-2">
                           <button onClick={() => setViewMode('active')} className={`px-3 py-1 rounded-md text-sm ${viewMode === 'active' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300'}`}>Actifs</button>
                           <button onClick={() => setViewMode('inactive')} className={`px-3 py-1 rounded-md text-sm ${viewMode === 'inactive' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300'}`}>Inactifs</button>
                        </div>
                    </div>
                    <button onClick={() => setShowCreateModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 w-full sm:w-auto"><UserPlus size={18}/> Ajouter un Dépôt-Vente</button>
                 </div>
                 <div className="space-y-3">
                     {pointsOfSale.map(pos => (
                         <div key={pos.uid} className="bg-gray-700/50 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4">
                             <div><p className="font-bold">{pos.displayName}</p><p className="text-sm text-gray-400">{pos.email}</p></div>
                             <div className="flex gap-2">
                                <button onClick={() => setSelectedPos(pos)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-3 rounded-lg flex items-center gap-2 text-xs"><Eye size={16}/> Voir</button>
                                {viewMode === 'active' ? (
                                    <button onClick={() => openConfirmation(pos, 'inactive')} className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-3 rounded-lg flex items-center gap-2 text-xs"><ToggleLeft size={16}/> Mettre inactif</button>
                                ) : (
                                    <button onClick={() => openConfirmation(pos, 'active')} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg flex items-center gap-2 text-xs"><ToggleRight size={16}/> Réactiver</button>
                                )}
                             </div>
                         </div>
                     ))}
                     {pointsOfSale.length === 0 && <p className="text-center text-gray-400 py-4">Aucun compte {viewMode === 'active' ? 'actif' : 'inactif'} trouvé.</p>}
                 </div>
            </div>
        </div>
    );
};

// =================================================================
// COMPOSANT PRINCIPAL DE L'APPLICATION
// =================================================================
const firebaseApp = initializeApp(firebaseConfig);

export default function App() {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loginError, setLoginError] = useState(null);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [toast, setToast] = useState(null);

    useEffect(() => { document.title = APP_TITLE; }, []);

    const db = useMemo(() => getFirestore(firebaseApp), []);
    const auth = useMemo(() => getAuth(firebaseApp), []);
    
    const showToast = useCallback((message, type = 'success') => { setToast({ id: Date.now(), message, type }); }, []);
    
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (authUser) => {
            if (authUser) {
                const userDocRef = doc(db, 'users', authUser.uid);
                const unsubscribeUser = onSnapshot(userDocRef, (doc) => {
                    if (doc.exists()) {
                        setUserData({ uid: authUser.uid, email: authUser.email, ...doc.data() });
                        setUser(authUser);
                    } else {
                        setLoginError("Ce compte n'est pas configuré. Contactez l'administrateur.");
                        signOut(auth);
                    }
                    setIsLoading(false);
                }, () => { setIsLoading(false); setLoginError("Erreur de lecture des données utilisateur."); signOut(auth); });
                return () => unsubscribeUser();
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
                        <PosDashboard db={db} user={userData} showToast={showToast} />
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
