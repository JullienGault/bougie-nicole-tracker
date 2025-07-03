// src/components/payout/PayoutReconciliationModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, Edit, Save, AlertTriangle } from 'lucide-react';

const PayoutReconciliationModal = ({ pos, unsettledSales, stock, onClose, onConfirm }) => {
    
    // État pour gérer la liste des ventes de la période, avec un statut de validation
    const [reconciliationItems, setReconciliationItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Initialisation de l'état à l'ouverture de la modale
    useEffect(() => {
        const items = unsettledSales.map(sale => {
            const stockItem = stock.find(s => s.productId === sale.productId);
            return {
                ...sale, // Contient id, productName, quantity, totalAmount...
                status: 'pending', // 'pending', 'confirmed', 'editing'
                currentStock: stockItem?.quantity || 0,
                adjustmentReason: ''
            };
        });
        setReconciliationItems(items);
    }, [unsettledSales, stock]);

    // Calcul du montant total en temps réel
    const totalNetAmount = useMemo(() => {
        const totalRevenue = reconciliationItems.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
        const commission = totalRevenue * (pos.commissionRate || 0);
        return totalRevenue - commission;
    }, [reconciliationItems, pos.commissionRate]);

    const handleQuantityChange = (saleId, newQuantity) => {
        setReconciliationItems(items => items.map(item => 
            item.id === saleId ? { ...item, quantity: parseInt(newQuantity, 10) || 0 } : item
        ));
    };

    const handleStatusChange = (saleId, status) => {
        setReconciliationItems(items => items.map(item => 
            item.id === saleId ? { ...item, status } : item
        ));
    };
    
    const handleReasonChange = (saleId, reason) => {
        setReconciliationItems(items => items.map(item => 
            item.id === saleId ? { ...item, adjustmentReason: reason } : item
        ));
    };

    // Vérifie si tout est confirmé pour activer le bouton de clôture
    const isReadyToClose = useMemo(() => {
        if (reconciliationItems.length === 0) return false;
        return reconciliationItems.every(item => item.status === 'confirmed');
    }, [reconciliationItems]);

    const handleConfirmPayout = () => {
        // C'est ici que la logique complexe de la transaction Firestore sera ajoutée
        // 1. Préparer les données (ajustements, montant final...)
        // 2. Appeler la fonction onConfirm en passant ces données
        // 3. Gérer l'état de chargement
        console.log("Données à envoyer pour la clôture :", {
            items: reconciliationItems,
            netAmount: totalNetAmount,
        });
        onConfirm(reconciliationItems); // Passer les items réconciliés au parent
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-gray-800 rounded-2xl w-full max-w-4xl h-[90vh] border-gray-700 flex flex-col" onClick={e => e.stopPropagation()}>
                {/* En-tête */}
                <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Réconciliation et Clôture</h2>
                        <p className="text-gray-400">Pour le dépôt : {pos.name}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-gray-400 text-sm">Net à reverser</p>
                        <p className="text-3xl font-bold text-green-400">{totalNetAmount.toFixed(2)} €</p>
                    </div>
                </div>

                {/* Tableau */}
                <div className="flex-grow p-6 overflow-y-auto custom-scrollbar">
                    <div className="space-y-2">
                        {reconciliationItems.map(item => {
                            const remainingStock = item.currentStock - item.quantity;
                            return (
                                <div key={item.id} className={`p-4 rounded-lg transition-all ${item.status === 'editing' ? 'bg-red-900/20 ring-1 ring-red-500' : 'bg-gray-900/50'}`}>
                                    <div className="grid grid-cols-12 gap-4 items-center">
                                        <div className="col-span-4 font-bold">{item.productName}</div>
                                        <div className="col-span-2">
                                            <input 
                                                type="number" 
                                                value={item.quantity}
                                                onChange={e => handleQuantityChange(item.id, e.target.value)}
                                                disabled={item.status !== 'editing'}
                                                className="w-20 bg-gray-700 p-1 rounded-md text-center disabled:bg-gray-800 disabled:text-gray-400"
                                            />
                                        </div>
                                        <div className="col-span-2 text-gray-400">{remainingStock}</div>
                                        <div className="col-span-4 flex justify-end gap-2">
                                            {item.status === 'pending' && (
                                                <>
                                                    <button onClick={() => handleStatusChange(item.id, 'confirmed')} className="p-2 bg-green-600 rounded-lg text-white hover:bg-green-500"><Check size={18} /></button>
                                                    <button onClick={() => handleStatusChange(item.id, 'editing')} className="p-2 bg-red-600 rounded-lg text-white hover:bg-red-500"><Edit size={18} /></button>
                                                </>
                                            )}
                                            {item.status === 'editing' && (
                                                <button onClick={() => item.adjustmentReason.trim() ? handleStatusChange(item.id, 'confirmed') : alert('Le motif est obligatoire.')} className="p-2 bg-blue-600 rounded-lg text-white hover:bg-blue-500"><Save size={18} /></button>
                                            )}
                                            {item.status === 'confirmed' && (
                                                <span className="text-green-400 font-bold text-sm">Validé</span>
                                            )}
                                        </div>
                                    </div>
                                    {item.status === 'editing' && (
                                        <div className="mt-3 animate-fade-in">
                                            <label className="text-xs text-yellow-400">Motif de l'ajustement (obligatoire)</label>
                                            <input 
                                                type="text"
                                                value={item.adjustmentReason}
                                                onChange={e => handleReasonChange(item.id, e.target.value)}
                                                placeholder="Ex: Produit offert, erreur de saisie..."
                                                className="w-full bg-gray-700 p-2 rounded-lg mt-1 text-sm"
                                            />
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Pied de page */}
                <div className="p-6 border-t border-gray-700 flex justify-end gap-4">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg">Annuler</button>
                    <button onClick={handleConfirmPayout} disabled={!isReadyToClose || isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
                        {isLoading ? 'Clôture...' : 'Clôturer la Période'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PayoutReconciliationModal;
