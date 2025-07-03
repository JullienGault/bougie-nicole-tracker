// src/components/pos/SaleModal.jsx
import React, { useState, useMemo, useContext } from 'react';
import { Plus, Minus, Trash2, CheckCircle, Search, ImageOff, X } from 'lucide-react';
import { AppContext } from '../../contexts/AppContext';
import { db, writeBatch, doc, collection, serverTimestamp } from '../../services/firebase';
import { LOW_STOCK_THRESHOLD } from '../../constants';
import { formatPrice } from '../../utils/formatters';

const SaleModal = ({ posId, stock, onClose }) => {
    const { showToast, products } = useContext(AppContext); // On récupère aussi les produits pour les images
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // On ne montre que les produits en stock et qui ne sont pas déjà dans la vente
    const availableStock = useMemo(() => {
        const itemIdsInSale = items.map(i => i.stockId);
        return stock.filter(s => s.quantity > 0 && !itemIdsInSale.includes(s.id) && s.productName.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [stock, items, searchTerm]);

    const handleAddItem = (stockItem) => {
        const productInfo = products.find(p => p.id === stockItem.productId);
        setItems(prevItems => [...prevItems, {
            stockId: stockItem.id,
            productId: stockItem.productId,
            name: stockItem.productName,
            price: stockItem.price,
            maxQuantity: stockItem.quantity,
            quantity: 1,
            imageUrl: productInfo?.imageUrl || null
        }]);
        setSearchTerm(''); // Reset search
    };

    const handleQuantityChange = (stockId, change) => {
        setItems(items.map(item => {
            if (item.stockId === stockId) {
                const newQuantity = item.quantity + change;
                if (newQuantity >= 1 && newQuantity <= item.maxQuantity) {
                    return { ...item, quantity: newQuantity };
                }
            }
            return item;
        }));
    };
    
    const handleRemoveItem = (stockId) => setItems(items.filter(item => item.stockId !== stockId));
    
    const saleTotal = useMemo(() => items.reduce((total, item) => total + (item.price * item.quantity), 0), [items]);

    const handleConfirmSale = async () => {
        if (items.length === 0) {
            showToast("Veuillez ajouter au moins un produit à la vente.", "error");
            return;
        }
        setIsLoading(true);
        // La logique de validation reste la même
        const batch = writeBatch(db);
        for (const item of items) {
            const stockItem = stock.find(s => s.id === item.stockId);
            if (!stockItem || stockItem.quantity < item.quantity) {
                showToast(`Stock insuffisant pour ${item.name}.`, "error");
                setIsLoading(false);
                return;
            }
            const stockDocRef = doc(db, `pointsOfSale/${posId}/stock`, item.stockId);
            const newQuantity = stockItem.quantity - item.quantity;
            batch.update(stockDocRef, { quantity: newQuantity });
            
            if (stockItem.quantity > LOW_STOCK_THRESHOLD && newQuantity <= LOW_STOCK_THRESHOLD) {
                const notificationRef = doc(collection(db, 'notifications'));
                batch.set(notificationRef, {
                    recipientUid: posId,
                    message: `Stock bas pour ${item.name} (${newQuantity} restant). Pensez à faire une demande de livraison.`,
                    createdAt: serverTimestamp(), isRead: false, type: 'LOW_STOCK_ALERT', relatedId: item.productId 
                });
            }

            const saleDocRef = doc(collection(db, `pointsOfSale/${posId}/sales`));
            batch.set(saleDocRef, {
                posId, productId: item.productId, productName: item.name, scent: null,
                quantity: item.quantity, unitPrice: item.price, totalAmount: item.price * item.quantity,
                createdAt: serverTimestamp(), payoutId: null
            });
        }
        try {
            await batch.commit();
            showToast("Vente enregistrée avec succès !", "success");
            onClose();
        } catch (error) {
            showToast("Une erreur est survenue lors de l'enregistrement.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-2xl w-full max-w-3xl border-gray-700 flex flex-col h-[90vh]" onClick={e => e.stopPropagation()}>
                
                <header className="p-6 border-b border-gray-700">
                    <h2 className="text-2xl font-bold text-white">Enregistrer une Vente</h2>
                </header>

                {/* --- Contenu Principal --- */}
                <main className="flex-1 p-6 space-y-6 overflow-y-auto custom-scrollbar">
                    {/* Zone de recherche de produits */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Rechercher un produit en stock..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-700 p-3 pl-12 rounded-lg"
                        />
                        {searchTerm && (
                            <div className="absolute w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg max-h-60 overflow-y-auto z-10">
                                {availableStock.length > 0 ? availableStock.map(s => (
                                    <div key={s.id} onClick={() => handleAddItem(s)} className="p-3 hover:bg-indigo-600 cursor-pointer flex justify-between items-center">
                                        <span>{s.productName}</span>
                                        <span className="text-xs text-gray-400">Stock: {s.quantity}</span>
                                    </div>
                                )) : <p className="p-3 text-gray-500">Aucun produit trouvé ou déjà ajouté.</p>}
                            </div>
                        )}
                    </div>
                    
                    {/* Liste des articles dans la vente */}
                    <div className="space-y-4">
                        {items.map(item => (
                            <div key={item.stockId} className="bg-gray-900/50 p-4 rounded-xl flex items-center gap-4 animate-fade-in-up">
                                {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-16 h-16 rounded-md object-cover"/> : <div className="w-16 h-16 rounded-md bg-gray-700 flex items-center justify-center"><ImageOff className="text-gray-500" /></div>}
                                <div className="flex-grow">
                                    <p className="font-bold text-white">{item.name}</p>
                                    <p className="text-sm text-gray-400">{formatPrice(item.price)} / unité</p>
                                </div>
                                <div className="flex items-center gap-3 bg-gray-700 p-1 rounded-lg">
                                    <button onClick={() => handleQuantityChange(item.stockId, -1)} className="p-1.5 hover:bg-gray-600 rounded-md"><Minus size={16}/></button>
                                    <span className="font-bold w-8 text-center text-lg">{item.quantity}</span>
                                    <button onClick={() => handleQuantityChange(item.stockId, 1)} className="p-1.5 hover:bg-gray-600 rounded-md"><Plus size={16}/></button>
                                </div>
                                <div className="w-24 text-right">
                                    <p className="font-bold text-lg text-white">{formatPrice(item.price * item.quantity)}</p>
                                </div>
                                <button onClick={() => handleRemoveItem(item.stockId)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-full"><Trash2 size={18} /></button>
                            </div>
                        ))}
                        {items.length === 0 && (
                            <div className="text-center py-12 text-gray-500">
                                <p>Recherchez un produit pour l'ajouter à la vente.</p>
                            </div>
                        )}
                    </div>
                </main>

                {/* --- Pied de page avec Total et Actions --- */}
                <footer className="p-6 border-t border-gray-700 bg-gray-800">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-gray-400">Montant total de la vente</p>
                            <p className="text-4xl font-bold text-green-400">{formatPrice(saleTotal)}</p>
                        </div>
                        <div className="flex gap-4">
                            <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg">Annuler</button>
                            <button onClick={handleConfirmSale} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg flex items-center gap-2 disabled:opacity-60" disabled={isLoading || items.length === 0}>
                                {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2"></div> : <><CheckCircle size={20} /> Valider la vente</>}
                            </button>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
};
export default SaleModal;
