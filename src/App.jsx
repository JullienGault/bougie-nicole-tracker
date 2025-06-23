import React, { useState, useEffect, useMemo, useCallback } from 'react';

// Importations Firebase
import { initializeApp } from 'firebase/app';
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
    DollarSign, Archive, Eye, ChevronDown, ChevronUp, Check, XCircle, Trash2, Send, UserPlus
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
            </div>
        </div>
    );
};

// =================================================================
// COMPOSANTS DE L'APPLICATION
// =================================================================

const KpiCard = ({ title, value, icon: Icon, color }) => (
    <div className="bg-gray-800 p-5 rounded-xl flex items-center gap-4">
        <div className={`p-3 rounded-lg ${color}`}><Icon size={28} className="text-white"/></div>
        <div>
            <p className="text-gray-400 text-sm font-medium">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
        </div>
    </div>
);

const SaleModal = ({ db, posId, stock, onClose, showToast }) => {
    const [selectedProductId, setSelectedProductId] = useState('');
    const [selectedScent, setSelectedScent] = useState('');
    const [quantity, setQuantity] = useState(1);
    
    const availableScents = useMemo(() => {
        const product = PRODUCTS.find(p => p.id === selectedProductId);
        return product?.hasScents !== false ? SCENTS : [];
    }, [selectedProductId]);
    
    const maxQuantity = useMemo(() => {
        if (!selectedProductId) return 0;
        const stockItem = stock.find(item => 
            item.productId === selectedProductId && 
            (item.scent === selectedScent || availableScents.length === 0)
        );
        return stockItem ? stockItem.quantity : 0;
    }, [stock, selectedProductId, selectedScent, availableScents]);

    const handleSaveSale = async () => {
        const product = PRODUCTS.find(p => p.id === selectedProductId);
        if (!product || (product.hasScents !== false && !selectedScent) || quantity <= 0) {
            showToast("Veuillez remplir tous les champs.", "error"); return;
        }
        if (quantity > maxQuantity) {
            showToast("Quantité de vente supérieure au stock disponible.", "error"); return;
        }
        try {
            const batch = writeBatch(db);
            const salesCollectionRef = collection(db, `pointsOfSale/${posId}/sales`);
            batch.set(doc(salesCollectionRef), {
                productId: product.id, productName: product.name,
                scent: product.hasScents !== false ? selectedScent : null,
                quantity: Number(quantity), unitPrice: product.price,
                totalAmount: product.price * Number(quantity), createdAt: serverTimestamp(),
            });
            const stockDocRef = doc(db, `pointsOfSale/${posId}/stock`, product.hasScents !== false ? `${product.id}_${selectedScent}` : product.id);
            batch.update(stockDocRef, { quantity: maxQuantity - Number(quantity) });
            await batch.commit();
            showToast("Vente enregistrée avec succès !", "success");
            onClose();
        } catch (error) {
            showToast("Échec de l'enregistrement de la vente.", "error");
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-700 animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-white mb-6">Enregistrer une Vente</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Produit</label>
                        <select value={selectedProductId} onChange={e => { setSelectedProductId(e.target.value); setSelectedScent(''); }} className="w-full bg-gray-700 p-3 rounded-lg text-white">
                            <option value="">-- Choisir un produit --</option>
                            {PRODUCTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    {availableScents.length > 0 && (
                         <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Parfum</label>
                            <select value={selectedScent} onChange={e => setSelectedScent(e.target.value)} className="w-full bg-gray-700 p-3 rounded-lg text-white" disabled={!selectedProductId}>
                                <option value="">-- Choisir un parfum --</option>
                                {availableScents.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Quantité</label>
                        <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min="1" max={maxQuantity} className="w-full bg-gray-700 p-3 rounded-lg text-white" />
                        {maxQuantity > 0 && <p className="text-xs text-gray-400 mt-1">En stock : {maxQuantity}</p>}
                    </div>
                </div>
                <div className="mt-8 flex justify-end gap-4">
                     <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Annuler</button>
                     <button onClick={handleSaveSale} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg">Enregistrer</button>
                </div>
            </div>
        </div>
    );
};

const DeliveryRequestModal = ({ db, posId, posName, onClose, showToast }) => {
    const [items, setItems] = useState([{ productId: '', scent: '', quantity: 10 }]);
    const handleItemChange = (index, field, value) => { const newItems=[...items]; newItems[index][field]=value; if(field==='productId')newItems[index].scent=''; setItems(newItems) };
    const handleAddItem = () => setItems([...items, { productId: '', scent: '', quantity: 10 }]);
    const handleRemoveItem = (index) => setItems(items.filter((_, i) => i !== index));
    const handleSendRequest = async () => {
        const validItems = items.filter(item => { const p=PRODUCTS.find(p=>p.id===item.productId); if(!p||(p.hasScents!==false&&!item.scent)||item.quantity<=0)return false; return true });
        if(validItems.length===0){showToast("Veuillez ajouter au moins un article valide.","error");return}
        try {
            await addDoc(collection(db, 'deliveryRequests'), { posId, posName, items: validItems, status: 'pending', createdAt: serverTimestamp() });
            showToast("Demande de livraison envoyée !", "success");
            onClose();
        } catch (error) {
            showToast("Échec de l'envoi de la demande.", "error");
        }
    };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-700 animate-fade-in-up custom-scrollbar max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-white mb-6">Demander une Livraison</h2>
                <div className="space-y-4">
                    {items.map((item, index) => {
                         const product = PRODUCTS.find(p => p.id === item.productId);
                         const showScent = product && product.hasScents !== false;
                        return (
                            <div key={index} className="bg-gray-700/50 p-4 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                                <div className="sm:col-span-1">
                                    <label className="text-sm text-gray-300 mb-1 block">Produit</label>
                                    <select value={item.productId} onChange={e => handleItemChange(index, 'productId', e.target.value)} className="w-full bg-gray-600 p-2 rounded-lg"><option value="">-- Choisir --</option>{PRODUCTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                                </div>
                                <div className="sm:col-span-1">
                                   {showScent && (
                                     <>
                                      <label className="text-sm text-gray-300 mb-1 block">Parfum</label>
                                      <select value={item.scent} onChange={e => handleItemChange(index, 'scent', e.target.value)} className="w-full bg-gray-600 p-2 rounded-lg"><option value="">-- Choisir --</option>{SCENTS.map(s => <option key={s} value={s}>{s}</option>)}</select>
                                     </>
                                   )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex-grow">
                                        <label className="text-sm text-gray-300 mb-1 block">Quantité</label>
                                        <input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))} min="1" className="w-full bg-gray-600 p-2 rounded-lg"/>
                                    </div>
                                    {items.length > 1 && (<button onClick={() => handleRemoveItem(index)} className="p-2 bg-red-600 hover:bg-red-700 rounded-lg text-white self-end mb-px"><Trash2 size={20} /></button>)}
                                </div>
                            </div>
                        )
                    })}
                </div>
                <button type="button" onClick={handleAddItem} className="mt-4 flex items-center gap-2 text-indigo-400 hover:text-indigo-300"><PlusCircle size={20} /> Ajouter un autre article</button>
                <div className="mt-8 flex justify-end gap-4">
                     <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Annuler</button>
                     <button onClick={handleSendRequest} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><Send size={18} /> Envoyer la demande</button>
                </div>
            </div>
        </div>
    )
};


// =================================================================
// TABLEAUX DE BORD
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
        const q = query(collection(db, `pointsOfSale/${posId}/stock`), orderBy('productName'));
        const unsubscribe = onSnapshot(q, (snapshot) => setStock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))), console.error);
        return unsubscribe;
    }, [db, posId]);

    useEffect(() => {
        if (!showHistory) return;
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

const CreatePosModal = ({ db, showToast, onClose }) => {
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        if (!displayName || !email || !password) { showToast("Veuillez remplir tous les champs.", "error"); return; }
        setIsLoading(true);

        const secondaryApp = initializeApp(firebaseConfig, `secondary-app-${Date.now()}`);
        const secondaryAuth = getAuth(secondaryApp);

        try {
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            const newUser = userCredential.user;
            await setDoc(doc(db, "users", newUser.uid), {
                displayName, email, role: "pos", createdAt: serverTimestamp()
            });
            showToast(`Compte pour ${displayName} créé avec succès !`, "success");
            onClose();
        } catch (error) {
            if (error.code === 'auth/email-already-in-use') { showToast("Cette adresse email est déjà utilisée.", "error"); }
            else { showToast("Erreur lors de la création du compte.", "error"); }
        } finally {
            setIsLoading(false);
            signOut(secondaryAuth);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-700 animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-white mb-6">Ajouter un Dépôt-Vente</h2>
                <form onSubmit={handleCreateUser} className="space-y-4">
                    <div><label className="block text-sm font-medium text-gray-300 mb-2">Nom du Dépôt-Vente</label><input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg" /></div>
                    <div><label className="block text-sm font-medium text-gray-300 mb-2">Email de connexion</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg" /></div>
                    <div><label className="block text-sm font-medium text-gray-300 mb-2">Mot de passe initial</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg" /></div>
                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Annuler</button>
                        <button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-60">
                            {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2"></div> : <><UserPlus size={18} /> Créer le compte</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AdminDashboard = ({ db, user, showToast }) => {
    const [pointsOfSale, setPointsOfSale] = useState([]);
    const [deliveryRequests, setDeliveryRequests] = useState([]);
    const [selectedPos, setSelectedPos] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        const q = query(collection(db, 'users'), where('role', '==', 'pos'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const posData = snapshot.docs.map(doc => ({
                uid: doc.id, // ** CORRECTION CLÉ POUR ÉVITER LE CRASH **
                ...doc.data()
            }));
            setPointsOfSale(posData);
        }, console.error);
        return unsubscribe;
    }, [db]);
    
    useEffect(() => {
        const q = query(collection(db, 'deliveryRequests'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => setDeliveryRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))), console.error);
        return unsubscribe;
    }, [db]);

    const handleFulfillRequest = async (request) => {
        try {
            const batch = writeBatch(db);
            const posStockSnapshot = await getDocs(collection(db, `pointsOfSale/${request.posId}/stock`));
            const stockMap = new Map(posStockSnapshot.docs.map(d => [d.id, d.data().quantity]));
            for (const item of request.items) {
                 const stockId = item.scent ? `${item.productId}_${item.scent}` : item.productId;
                 const stockDocRef = doc(db, `pointsOfSale/${request.posId}/stock`, stockId);
                 const currentQty = stockMap.get(stockId) || 0;
                 batch.set(stockDocRef, {productId:item.productId, productName:PRODUCTS.find(p=>p.id===item.productId).name, price:PRODUCTS.find(p=>p.id===item.productId).price, scent:item.scent||null, quantity:currentQty+Number(item.quantity)}, {merge:true});
            }
            batch.update(doc(db, 'deliveryRequests', request.id), { status: 'fulfilled' });
            await batch.commit();
            showToast(`Livraison pour ${request.posName} traitée.`, "success");
        } catch (error) { showToast("Erreur lors du traitement.", "error"); }
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
            <div className="mb-8"><h2 className="text-3xl font-bold text-white">Tableau de Bord Administrateur</h2><p className="text-gray-400">Bienvenue, {user.displayName}</p></div>
            
            <div className="bg-gray-800 rounded-2xl p-6 mb-8">
                 <h3 className="text-xl font-bold text-white mb-4">Demandes de Livraison en Attente ({deliveryRequests.length})</h3>
                 <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
                     {deliveryRequests.length > 0 ? deliveryRequests.map(req => (
                         <div key={req.id} className="bg-gray-700/50 p-4 rounded-lg"><div className="flex justify-between items-start"><div><p className="font-bold">{req.posName}</p><p className="text-sm text-gray-400">Le {formatDate(req.createdAt)}</p><ul className="list-disc list-inside mt-2 text-sm">{req.items.map((item, idx) => (<li key={idx}>{item.quantity} x {PRODUCTS.find(p=>p.id===item.productId).name} {item.scent||''}</li>))}</ul></div><button onClick={()=>handleFulfillRequest(req)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg flex items-center gap-2 text-sm"><Check size={18}/> Traiter</button></div></div>
                     )) : <p className="text-gray-400">Aucune demande en attente.</p>}
                 </div>
            </div>

            <div className="bg-gray-800 rounded-2xl p-6">
                 <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-white">Gérer les Dépôts-Ventes</h3><button onClick={()=>setShowCreateModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><UserPlus size={18}/> Ajouter un Dépôt-Vente</button></div>
                 <div className="space-y-3">
                     {pointsOfSale.map(pos => (
                         <div key={pos.uid} className="bg-gray-700/50 p-4 rounded-lg flex justify-between items-center">
                             <div><p className="font-bold">{pos.displayName}</p><p className="text-sm text-gray-400">{pos.email}</p></div>
                             <button onClick={() => setSelectedPos(pos)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-3 rounded-lg flex items-center gap-2 text-sm"><Eye size={18}/> Voir le détail</button>
                         </div>
                     ))}
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
                }, () => {
                    setLoginError("Erreur de lecture des données utilisateur.");
                    signOut(auth); setIsLoading(false);
                });
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
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            if (error.code === 'auth/invalid-credential') {
                setLoginError("Email ou mot de passe incorrect.");
            } else {
                setLoginError("Une erreur est survenue.");
            }
        } finally {
            setIsLoggingIn(false);
        }
    }, [auth]);
    
    const handleLogout = useCallback(() => { signOut(auth); }, [auth]);

    const renderContent = () => {
        if (isLoading) {
            return <div className="bg-gray-900 min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>;
        }

        if (!user || !userData) {
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
