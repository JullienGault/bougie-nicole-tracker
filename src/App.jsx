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
    deleteDoc
} from 'firebase/firestore';

// Importations pour l'export PDF
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Importations des icônes Lucide React
import {
    Package, Flame, Store, User, LogOut, LogIn, AlertTriangle, X, Info, Edit, 
    PlusCircle, MinusCircle, History, CheckCircle, Truck, ShoppingCart, BarChart2,
    DollarSign, Archive, Eye, ChevronDown, ChevronUp, Check, XCircle, Trash2, Send, UserPlus, ToggleLeft, ToggleRight, Percent, Save, Download, Wrench, HandCoins, Book, CandlestickChart
} from 'lucide-react';

// =================================================================
// CONFIGURATION & CONSTANTES
// =================================================================

// ⚠️ ATTENTION : Il est fortement déconseillé de laisser les clés API en clair dans le code source.
// Pour un projet en production, utilisez des variables d'environnement (fichier .env).
const firebaseConfig = {
    apiKey: "AIzaSyDUmxNBMQ2gWvCHWMrk0iowFpYVE1wMpMo", // Remplacez par votre vraie clé
    authDomain: "bougienicole.firebaseapp.com",
    projectId: "bougienicole",
    storageBucket: "bougienicole.appspot.com",
    messagingSenderId: "319062939476",
    appId: "1:319062939476:web:ba2235b7ab762c37a39ac1"
};

const APP_NAME = "Bougie Nicole - Gestion Dépôts";
const APP_TITLE = "Bougie Nicole Tracker";
const LOW_STOCK_THRESHOLD = 3;

// =================================================================
// INITIALISATION DE FIREBASE
// =================================================================
let firebaseApp;
if (!getApps().length) {
    firebaseApp = initializeApp(firebaseConfig);
} else {
    firebaseApp = getApps()[0];
}

// =================================================================
// FONCTIONS UTILITAIRES ET COMPOSANTS UI
// =================================================================

const formatPrice = (price) => `${(price || 0).toFixed(2)} €`;
const formatDate = (timestamp) => !timestamp?.toDate ? 'Date inconnue' : timestamp.toDate().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const formatPercent = (rate) => `${((rate || 0) * 100).toFixed(0)} %`;
const AnimationStyles = () => ( <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}.animate-fade-in{animation:fadeIn .5s ease-in-out}@keyframes fadeInUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.animate-fade-in-up{animation:fadeInUp .5s ease-out forwards}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.animate-spin{animation:spin 1s linear infinite}.custom-scrollbar::-webkit-scrollbar{width:8px}.custom-scrollbar::-webkit-scrollbar-track{background:#1f2937}.custom-scrollbar::-webkit-scrollbar-thumb{background:#4f46e5;border-radius:10px}`}</style> );
const Toast = ({ message, type, onClose }) => { const C = {s:'bg-green-600',e:'bg-red-600',i:'bg-blue-600'}, I = {s:CheckCircle,e:XCircle,i:Info}[type]||Info; useEffect(()=>{const t=setTimeout(onClose,4000);return()=>clearTimeout(t)},[onClose]); return <div className={`fixed bottom-5 right-5 p-4 rounded-lg shadow-2xl text-white flex items-center gap-3 z-[999] animate-fade-in-up ${C[type]}`}><I size={24}/><span>{message}</span><button onClick={onClose} className="ml-2 opacity-80 hover:opacity-100"><X size={20}/></button></div> };
const ConfirmationModal = ({ title, message, onConfirm, onCancel, confirmText = "Confirmer", cancelText = "Annuler", confirmColor = "bg-red-600 hover:bg-red-700", requiresReason = false}) => { const [reason, setReason]=useState(''); const handleConfirm = () => {if(requiresReason&&!reason.trim()){alert("Veuillez fournir une raison.");return;} onConfirm(requiresReason?reason:undefined)}; return <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in" onClick={onCancel}><div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 animate-fade-in-up" onClick={e=>e.stopPropagation()}><div className="text-center"><AlertTriangle className="mx-auto h-12 w-12 text-yellow-400"/><h3 className="mt-4 text-xl font-semibold text-white">{title}</h3><p className="text-gray-400 mt-2 whitespace-pre-line">{message}</p></div>{requiresReason&&<div className="mt-6"><label className="block text-sm font-medium text-gray-300 mb-2">Raison (obligatoire)</label><textarea value={reason} onChange={e=>setReason(e.target.value)} rows="3" className="w-full bg-gray-700 p-3 rounded-lg" placeholder="Ex: Casse produit, erreur de saisie..."></textarea></div>}<div className="mt-8 flex justify-center gap-4"><button onClick={onCancel} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg">{cancelText}</button><button onClick={handleConfirm} className={`${confirmColor} text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50`} disabled={requiresReason&&!reason.trim()}>{confirmText}</button></div></div></div>};
const KpiCard = ({ title, value, icon: Icon, color }) => ( <div className="bg-gray-800 p-5 rounded-xl flex items-center gap-4"><div className={`p-3 rounded-lg ${color}`}><Icon size={28} className="text-white"/></div><div><p className="text-gray-400 text-sm font-medium">{title}</p><p className="text-2xl font-bold text-white">{value}</p></div></div> );
const LoginPage = ({ onLogin, error, isLoggingIn }) => { const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const handleSubmit = (e) => { e.preventDefault(); if (!isLoggingIn) onLogin(email, password); }; return <div className="bg-gray-900 min-h-screen flex flex-col items-center justify-center p-4"><div className="text-center mb-8 animate-fade-in"><Package size={48} className="mx-auto text-indigo-400"/><h1 className="text-4xl font-bold text-white mt-4">{APP_NAME}</h1><p className="text-gray-400">Espace de connexion</p></div><div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-700 animate-fade-in-up"><form onSubmit={handleSubmit} className="space-y-6"><div><label className="block text-sm font-medium text-gray-300 mb-2">Adresse Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg" /></div><div><label className="block text-sm font-medium text-gray-300 mb-2">Mot de passe</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg" /></div>{error && (<p className="text-red-400 text-sm text-center bg-red-500/10 p-3 rounded-lg">{error}</p>)}<button type="submit" disabled={isLoggingIn} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60">{isLoggingIn ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div> : <><LogIn size={20} /> Se connecter</>}</button></form></div></div>;};
const CreatePosModal = ({ db, showToast, onClose }) => { const [name, setName]=useState(''); const [email, setEmail]=useState(''); const [password, setPassword]=useState(''); const [isLoading, setIsLoading]=useState(false); const handleCreate=async(ev)=>{ev.preventDefault();if(!name||!email||password.length<6){showToast("Nom, email et mot de passe (6+ car.) requis.","error");return}setIsLoading(true);const appName=`secondary-app-${Date.now()}`;let secondaryApp;try{secondaryApp=initializeApp(firebaseConfig,appName);const secondaryAuth=getAuth(secondaryApp);const userCredential=await createUserWithEmailAndPassword(secondaryAuth,email,password);const nU=userCredential.user;const batch=writeBatch(db);batch.set(doc(db,"users",nU.uid),{displayName:name,email:email,role:"pos",status:"active",createdAt:serverTimestamp()});batch.set(doc(db,"pointsOfSale",nU.uid),{name:name,commissionRate:0.3,createdAt:serverTimestamp(),status:"active"});await batch.commit();showToast(`Compte pour ${name} créé !`,"success");onClose()}catch(err){if(err.code==='auth/email-already-in-use'){showToast("Email déjà utilisé.","error")}else{showToast("Erreur de création.","error")}}finally{setIsLoading(false);if(secondaryApp){signOut(getAuth(secondaryApp)).then(()=>deleteApp(secondaryApp))}}}; return <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40" onClick={onClose}><div className="bg-gray-800 p-8 rounded-2xl w-full max-w-lg" onClick={e=>e.stopPropagation()}><h2 className="text-2xl font-bold text-white mb-6">Ajouter un Dépôt-Vente</h2><form onSubmit={handleCreate} className="space-y-4"><div><label className="block text-sm font-medium text-gray-300 mb-1">Nom du Dépôt</label><input type="text" value={name} onChange={e=>setName(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/></div><div><label className="block text-sm font-medium text-gray-300 mb-1">Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/></div><div><label className="block text-sm font-medium text-gray-300 mb-1">Mot de passe initial</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/></div><div className="flex justify-end gap-4 pt-4"><button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Annuler</button><button type="submit" disabled={isLoading} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-60">{isLoading?<div className="animate-spin rounded-full h-5 w-5 border-b-2"></div>:<><UserPlus size={18}/>Créer</>}</button></div></form></div></div>;};
const EditPosModal = ({ db, pos, showToast, onClose, onSave }) => { const [name, setName] = useState(pos.name); const [commissionRate, setCommissionRate] = useState((pos.commissionRate || 0) * 100); const [isLoading, setIsLoading] = useState(false); const handleSave = async (event) => { event.preventDefault(); setIsLoading(true); const newRate = parseFloat(commissionRate) / 100; if (isNaN(newRate) || newRate < 0 || newRate > 1) { showToast("Le taux de commission doit être entre 0 et 100.", "error"); setIsLoading(false); return; } try { const posDocRef = doc(db, "pointsOfSale", pos.id); await updateDoc(posDocRef, { name: name, commissionRate: newRate, }); showToast("Dépôt mis à jour avec succès !", "success"); onSave(); onClose(); } catch (error) { console.error("Erreur de mise à jour du dépôt : ", error); showToast("Erreur lors de la mise à jour.", "error"); } finally { setIsLoading(false); } }; return ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={onClose}> <div className="bg-gray-800 p-8 rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}> <h2 className="text-2xl font-bold text-white mb-6">Modifier le Dépôt-Vente</h2> <form onSubmit={handleSave} className="space-y-4"> <div> <label className="block text-sm font-medium text-gray-300 mb-1">Nom du Dépôt</label> <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/> </div> <div> <label className="block text-sm font-medium text-gray-300 mb-1">Taux de Commission (%)</label> <input type="number" value={commissionRate} onChange={e => setCommissionRate(e.target.value)} required min="0" max="100" className="w-full bg-gray-700 p-3 rounded-lg"/> </div> <div className="flex justify-end gap-4 pt-4"> <button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Annuler</button> <button type="submit" disabled={isLoading} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-60"> {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2"></div> : <><Save size={18}/>Enregistrer</>} </button> d... </div> </form> </div> </div> ); };
const InactiveAccountModal = () => { return ( <div className="fixed inset-0 bg-gray-900 bg-opacity-95 flex items-center justify-center z-[1000] animate-fade-in"> <div className="bg-gray-800 p-10 rounded-2xl shadow-2xl w-full max-w-lg border border-yellow-500/50 text-center animate-fade-in-up"> <AlertTriangle className="mx-auto h-16 w-16 text-yellow-400 mb-4"/> <h2 className="text-2xl font-bold text-white mb-3">Votre compte est actuellement inactif</h2> <p className="text-gray-300"> Vous pouvez toujours vous connecter, mais l'accès au tableau de bord a été suspendu. </p> <p className="text-gray-300 mt-4"> Pour réactiver votre compte ou pour toute question, veuillez contacter le support à l'adresse suivante : </p> <a href="mailto:jullien@bougienicole.fr" className="mt-6 inline-block bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700"> jullien@bougienicole.fr </a> </div> </div> ); };
const SaleModal = ({ db, posId, stock, onClose, showToast, products, scents }) => { const [pId,setpId]=useState(''); const [s,setS]=useState(''); const [q,setQ]=useState(1); const aS=useMemo(()=>products.find(p=>p.id===pId)?.hasScents!==false?scents:[],[pId, products, scents]); const maxQ=useMemo(()=>(!pId?0:stock.find(i=>i.productId===pId&&(i.scent===s||aS.length===0))?.quantity||0),[stock,pId,s,aS]); const handleSave=async()=>{const p=products.find(pr=>pr.id===pId);if(!p||(p.hasScents!==false&&!s)||q<=0){showToast("Veuillez remplir tous les champs.","error");return}if(q>maxQ){showToast("Quantité > stock disponible.","error");return}try{const b=writeBatch(db);b.set(doc(collection(db,`pointsOfSale/${posId}/sales`)),{productId:p.id,productName:p.name,scent:p.hasScents!==false?s:null,quantity:Number(q),unitPrice:p.price,totalAmount:p.price*Number(q),createdAt:serverTimestamp()});const stockDocRef=doc(db,`pointsOfSale/${posId}/stock`,p.hasScents!==false?`${p.id}_${s}`:p.id);const currentStockItem=stock.find(i=>i.id===stockDocRef.id);if(currentStockItem){b.update(stockDocRef,{quantity:maxQ-Number(q)})}else{b.set(stockDocRef,{productId:p.id,productName:p.name,scent:p.hasScents!==false?s:null,quantity:-(Number(q)),price:p.price})}await b.commit();showToast("Vente enregistrée !","success");onClose()}catch(e){showToast("Échec de l'enregistrement.","error")}}; return <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40" onClick={onClose}><div className="bg-gray-800 p-8 rounded-2xl w-full max-w-lg border-gray-700" onClick={e=>e.stopPropagation()}><h2 className="text-2xl font-bold text-white mb-6">Enregistrer une Vente</h2><div className="space-y-4"><div><label className="block text-sm">Produit</label><select value={pId} onChange={e=>{setpId(e.target.value);setS('')}} className="w-full bg-gray-700 p-3 rounded-lg"><option value="">-- Choisir --</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>{aS.length>0&&<div><label className="block text-sm">Parfum</label><select value={s} onChange={e=>setS(e.target.value)} className="w-full bg-gray-700 p-3 rounded-lg" disabled={!pId}><option value="">-- Choisir --</option>{aS.map(sc=><option key={sc.id} value={sc.name}>{sc.name}</option>)}</select></div>}<div><label className="block text-sm">Quantité</label><input type="number" value={q} onChange={e=>setQ(Number(e.target.value))} min="1" max={maxQ} className="w-full bg-gray-700 p-3 rounded-lg"/>{maxQ>0&&<p className="text-xs text-gray-400 mt-1">En stock: {maxQ}</p>}</div></div><div className="mt-8 flex justify-end gap-4"><button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Annuler</button><button onClick={handleSave} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg">Enregistrer</button></div></div></div>};
const DeliveryRequestModal = ({ db, posId, posName, onClose, showToast, products, scents }) => { const [items,setItems]=useState([{productId:'',scent:'',quantity:10}]); const handleItemChange=(i,f,v)=>{const nI=[...items];nI[i][f]=v;if(f==='productId')nI[i].scent='';setItems(nI)}; const handleAdd=()=>setItems([...items,{productId:'',scent:'',quantity:10}]); const handleRemove=(i)=>setItems(items.filter((_,idx)=>i!==idx)); const handleSend=async()=>{const vI=items.filter(i=>{const p=products.find(pr=>pr.id===i.productId);if(!p||(p.hasScents!==false&&!i.scent)||i.quantity<=0)return false;return true});if(vI.length===0){showToast("Ajoutez au moins un article valide.","error");return}try{await addDoc(collection(db,'deliveryRequests'),{posId,posName,items:vI,status:'pending',createdAt:serverTimestamp()});showToast("Demande de livraison envoyée !","success");onClose()}catch(e){showToast("Échec de l'envoi.","error")}}; return <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40" onClick={onClose}><div className="bg-gray-800 p-8 rounded-2xl w-full max-w-2xl border-gray-700 custom-scrollbar max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}><h2 className="text-2xl font-bold text-white mb-6">Demander une Livraison</h2><div className="space-y-4">{items.map((item,i)=>{const p=products.find(pr=>pr.id===item.productId);const sS=p&&p.hasScents!==false;return(<div key={i} className="bg-gray-700/50 p-4 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-4 items-end"><div className="sm:col-span-1"><label className="text-sm">Produit</label><select value={item.productId} onChange={e=>handleItemChange(i,'productId',e.target.value)} className="w-full bg-gray-600 p-2 rounded-lg"><option value="">-- Choisir --</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div className="sm:col-span-1">{sS&&<>
<label className="text-sm">Parfum</label><select value={item.scent} onChange={e=>handleItemChange(i,'scent',e.target.value)} className="w-full bg-gray-600 p-2 rounded-lg"><option value="">-- Choisir --</option>{scents.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</select></>}</div><div className="flex items-center gap-2"><div className="flex-grow"><label className="text-sm">Quantité</label><input type="number" value={item.quantity} onChange={e=>handleItemChange(i,'quantity',Number(e.target.value))} min="1" className="w-full bg-gray-600 p-2 rounded-lg"/></div>{items.length>1&&<button onClick={()=>handleRemove(i)} className="p-2 bg-red-600 rounded-lg text-white self-end mb-px"><Trash2 size={20}/></button>}</div></div>)})}</div><button type="button" onClick={handleAdd} className="mt-4 flex items-center gap-2 text-indigo-400"><PlusCircle size={20}/>Ajouter un article</button><div className="mt-8 flex justify-end gap-4"><button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Annuler</button><button onClick={handleSend} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><Send size={18}/>Envoyer</button></div></div></div>};
const StockAdjustmentModal = ({ item, onClose, onAdjust }) => { const [adjustment, setAdjustment] = useState(0); const [reason, setReason] = useState(''); const handleAdjust = () => { if(adjustment !== 0 && reason) onAdjust(item, adjustment, reason); }; return <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={onClose}><div className="bg-gray-800 p-8 rounded-2xl w-full max-w-lg" onClick={e=>e.stopPropagation()}><h2 className="text-2xl font-bold text-white mb-2">Ajuster le stock de :</h2><p className="text-gray-400 mb-6">{item.productName} {item.scent || ''}</p><div className="space-y-4"><div><label>Ajustement (ex: -1 pour casse)</label><input type="number" value={adjustment} onChange={e=>setAdjustment(Number(e.target.value))} className="w-full bg-gray-700 p-3 rounded-lg"/></div><div><label>Motif (obligatoire)</label><textarea value={reason} onChange={e=>setReason(e.target.value)} rows="3" className="w-full bg-gray-700 p-3 rounded-lg" placeholder="Ex: Produit cassé en rayon"></textarea></div></div><div className="mt-8 flex justify-end gap-4"><button type="button" onClick={onClose} className="bg-gray-600 font-bold py-2 px-4 rounded-lg">Annuler</button><button onClick={handleAdjust} disabled={!reason.trim() || adjustment === 0} className="bg-indigo-600 font-bold py-2 px-4 rounded-lg disabled:opacity-50">Ajuster</button></div></div></div>};

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
    const [showAdjustmentModal, setShowAdjustmentModal] = useState(null);
    const [saleToDelete, setSaleToDelete] = useState(null);
    const posId = user.uid;
    
    useEffect(() => { if (!db || !posId) return; const unsub = onSnapshot(doc(db, "pointsOfSale", posId), (doc) => { if (doc.exists()) setPosData(doc.data()); }); return unsub; }, [db, posId]);
    useEffect(() => { if (!db || !posId) return; const q = query(collection(db, `pointsOfSale/${posId}/stock`)); const unsub = onSnapshot(q, (snapshot) => setStock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))); return unsub; }, [db, posId]);
    useEffect(() => { if (!db || !posId) return; const q = query(collection(db, `pointsOfSale/${posId}/sales`), orderBy('createdAt', 'desc')); const unsub = onSnapshot(q, (snapshot) => setSalesHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))); return unsub;}, [db, posId]);
    useEffect(() => { if (!db || !posId || isAdminView) return; const q = query(collection(db, `deliveryRequests`), where("posId", "==", posId), orderBy('createdAt', 'desc')); const unsub = onSnapshot(q, (snapshot) => setDeliveryRequests(snapshot.docs.map(d => ({id: d.id, ...d.data()})))); return unsub;}, [db, posId, isAdminView]);

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

    const handleStockAdjustment = async (item, adjustment, reason) => {
        const stockId = item.scent ? `${item.productId}_${item.scent}` : item.productId;
        const stockDocRef = doc(db, `pointsOfSale/${posId}/stock`, stockId);
        const newQuantity = item.quantity + adjustment;
        if (newQuantity < 0) { showToast("L'ajustement ne peut pas rendre le stock négatif.", "error"); return; }
        try {
            const batch = writeBatch(db);
            batch.update(stockDocRef, { quantity: newQuantity });
            const logRef = collection(db, `pointsOfSale/${posId}/logs`);
            batch.set(doc(logRef), { type: 'STOCK_ADJUSTMENT', item, adjustment, reason, createdAt: serverTimestamp(), by: user.email });
            await batch.commit();
            showToast("Stock ajusté avec succès.", "success");
            setShowAdjustmentModal(null);
        } catch (error) { showToast("Erreur lors de l'ajustement.", "error"); }
    };

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
            {showAdjustmentModal && <StockAdjustmentModal item={showAdjustmentModal} onClose={() => setShowAdjustmentModal(null)} onAdjust={handleStockAdjustment} />}
            {saleToDelete && <ConfirmationModal title="Confirmer l'annulation" message={`Annuler la vente de ${saleToDelete.quantity} x ${saleToDelete.productName} ${saleToDelete.scent || ''} ?\nLe stock sera automatiquement restauré.`} onConfirm={handleDeleteSale} onCancel={() => setSaleToDelete(null)} confirmText="Annuler la Vente" requiresReason={true} />}

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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                 <div className="bg-gray-800 rounded-2xl p-6">
                     <h3 className="text-xl font-bold mb-4">Vos meilleures ventes</h3>
                     {salesStats.length > 0 ? <ul>{salesStats.map(([name, qty])=><li key={name} className="flex justify-between py-1 border-b border-gray-700"><span>{name}</span><strong>{qty}</strong></li>)}</ul> : <p className="text-gray-400">Aucune vente enregistrée.</p>}
                 </div>
                 <div className="bg-gray-800 rounded-2xl p-6">
                     <h3 className="text-xl font-bold mb-4">Suivi de vos livraisons</h3>
                     {deliveryRequests.length > 0 ? <ul>{deliveryRequests.map(req => <li key={req.id} className="flex justify-between py-1 border-b border-gray-700"><span>Demande du {formatDate(req.createdAt)}</span><span className={`px-2 py-0.5 rounded-full text-xs ${req.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'}`}>{req.status}</span></li>)}</ul> : <p className="text-gray-400">Aucune demande en cours.</p>}
                 </div>
            </div>

            <div className="bg-gray-800 rounded-2xl p-6 mt-8">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Gestion du Stock Actuel</h3>
                    <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300">
                        <>
                            {showHistory ? "Masquer l'historique" : "Voir l'historique"} {showHistory ? <ChevronUp/> : <ChevronDown/>}
                        </>
                    </button>
                </div>
                {showHistory ? (
                    <div className="animate-fade-in overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-gray-700 text-gray-400 text-sm"><th className="p-3">Date</th><th className="p-3">Produit</th><th className="p-3">Qté</th><th className="p-3">Total</th><th className="p-3">Actions</th></tr></thead><tbody>{salesHistory.map(sale => (<tr key={sale.id} className="border-b border-gray-700 hover:bg-gray-700/50"><td className="p-3">{formatDate(sale.createdAt)}</td><td className="p-3">{sale.productName} <span className="text-gray-400">{sale.scent || ''}</span></td><td className="p-3">{sale.quantity}</td><td className="p-3 font-semibold">{formatPrice(sale.totalAmount)}</td><td className="p-3"><button onClick={() => setSaleToDelete(sale)} className="text-red-500 hover:text-red-400 p-1"><Trash2 size={18}/></button></td></tr>))}</tbody></table></div>
                ) : (
                    <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-gray-700 text-gray-400 text-sm"><th className="p-3">Produit</th><th className="p-3">Parfum</th><th className="p-3">Stock</th><th className="p-3">Prix Unitaire</th><th className="p-3">Ajuster</th></tr></thead><tbody>{stock.map(item => (<tr key={item.id} className="border-b border-gray-700 hover:bg-gray-700/50"><td className="p-3 font-medium">{item.productName}</td><td className="p-3 text-gray-300">{item.scent || 'N/A'}</td><td className={`p-3 font-bold ${item.quantity <= LOW_STOCK_THRESHOLD ? 'text-yellow-400' : 'text-white'}`}>{item.quantity}</td><td className="p-3">{formatPrice(item.price)}</td><td className="p-3"><button onClick={()=>setShowAdjustmentModal(item)} className="text-indigo-400 p-1"><Wrench size={16}/></button></td></tr>))}</tbody></table></div>
                )}
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
    const [globalStats, setGlobalStats] = useState({ revenue: 0, commission: 0, toPay: 0, topPos: [], topProducts: [] });
    const [deliveryRequests, setDeliveryRequests] = useState([]);

    useEffect(() => {
        const q = query(collection(db, "pointsOfSale"), orderBy('name'));
        const unsub = onSnapshot(q, (snapshot) => {
            setPointsOfSale(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return unsub;
    }, [db]);

    useEffect(() => {
        const q = query(collection(db, "deliveryRequests"), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snapshot) => {
            setDeliveryRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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

            const salesByPos = allSales.reduce((acc, sale) => {
                acc[sale.posName] = (acc[sale.posName] || 0) + sale.totalAmount;
                return acc;
            }, {});
            const topPos = Object.entries(salesByPos).sort(([,a],[,b]) => b-a).slice(0, 3);

            const salesByProduct = allSales.reduce((acc, sale) => {
                const key = `${sale.productName} ${sale.scent || ''}`.trim();
                acc[key] = (acc[key] || 0) + sale.quantity;
                return acc;
            }, {});
            const topProducts = Object.entries(salesByProduct).sort(([,a],[,b]) => b-a).slice(0, 3);
            setGlobalStats({ revenue, commission, toPay, topPos, topProducts });
        });
    }, [pointsOfSale, db]);

    const handleMarkRequestCompleted = async (requestId) => {
        const requestDocRef = doc(db, 'deliveryRequests', requestId);
        try {
            await updateDoc(requestDocRef, { status: 'completed' });
            showToast("Demande marquée comme traitée !", "success");
        } catch (error) { showToast("Erreur lors de la mise à jour.", "error"); }
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
            {posToToggleStatus && (
                <ConfirmationModal
                    title="Confirmer le changement de statut"
                    message={`Êtes-vous sûr de vouloir rendre le compte "${posToToggleStatus.name}" ${posToToggleStatus.status === 'active' ? 'INACTIF' : 'ACTIF'} ?`}
                    onConfirm={handleTogglePosStatus}
                    onCancel={() => setPosToToggleStatus(null)}
                    confirmText="Oui, confirmer"
                    confirmColor={posToToggleStatus.status === 'active' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
                />
            )}
            
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
                <div className="lg:col-span-2 bg-gray-800 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-white mb-4">Demandes de livraison en attente</h3>
                    {deliveryRequests.length > 0 ? (
                        <ul className="space-y-3">
                            {deliveryRequests.map(req => (
                                <li key={req.id} className="bg-gray-700/50 p-3 rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="font-bold">{req.posName}</p>
                                        <p className="text-sm text-gray-400">{formatDate(req.createdAt)} - {req.items.length} article(s)</p>
                                    </div>
                                    <button onClick={() => handleMarkRequestCompleted(req.id)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded-lg flex items-center gap-2 text-sm"><CheckCircle size={16}/> Traitée</button>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-gray-400">Aucune demande de livraison en attente.</p>}
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
    
    const db = useMemo(() => getFirestore(firebaseApp), []);
    const auth = useMemo(() => getAuth(firebaseApp), []);
    
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

    const HeaderForInactiveUser = ({ userData, handleLogout }) => (
        <header className="bg-gray-800/50 p-4 flex justify-between items-center shadow-md sticky top-0 z-30 backdrop-blur-sm">
            <div className="flex items-center gap-2"><Package size={24} className="text-indigo-400"/><h1 className="text-xl font-bold">{APP_NAME}</h1></div>
            <div className="flex items-center gap-4">
                <span className="text-gray-300 text-sm"><span className="font-semibold">{userData.displayName}</span> (Inactif)</span>
                <button onClick={handleLogout} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700"><LogOut size={20} /></button>
            </div>
        </header>
    );

    const renderContent = () => {
        const catalogIsLoading = products.length === 0 || scents.length === 0;

        if (isLoading) { return <div className="bg-gray-900 min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>; }
        if (!user || !userData) { return <LoginPage onLogin={handleLogin} error={loginError} isLoggingIn={isLoggingIn} />; }
        
        if (userData.role === 'pos' && userData.status === 'inactive') {
            return (
                <>
                    <HeaderForInactiveUser userData={userData} handleLogout={handleLogout} />
                    <InactiveAccountModal />
                </>
            );
        }
        
        return (
             <div className="bg-gray-900 text-white min-h-screen font-sans">
                 <header className="bg-gray-800/50 p-4 flex justify-between items-center shadow-md sticky top-0 z-30 backdrop-blur-sm">
                     <div className="flex items-center gap-2"><Package size={24} className="text-indigo-400"/><h1 className="text-xl font-bold">{APP_NAME}</h1></div>
                     <div className="flex items-center gap-4">
                         <span className="text-gray-300 text-sm"><span className="font-semibold">{userData.displayName}</span> ({userData.role})</span>
                         <button onClick={handleLogout} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700"><LogOut size={20} /></button>
                     </div>
                 </header>
                 <main>
                     {catalogIsLoading && (!products.length || !scents.length) ?
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
