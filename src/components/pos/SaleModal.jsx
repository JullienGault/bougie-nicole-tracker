// src/components/pos/SaleModal.jsx
import React, { useState, useMemo, useContext } from 'react';
import { PlusCircle, Trash2, CheckCircle } from 'lucide-react';
import { AppContext } from '../../contexts/AppContext';
import { db, writeBatch, doc, collection, serverTimestamp } from '../../services/firebase';

const SaleModal = ({ posId, stock, onClose }) => {
    const { showToast } = useContext(AppContext);
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

export default SaleModal;
