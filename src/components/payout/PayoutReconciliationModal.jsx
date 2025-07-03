// src/components/payout/PayoutReconciliationModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, Edit, Save, AlertTriangle } from 'lucide-react';

// isReadOnly est la nouvelle prop pour contrôler les permissions
const PayoutReconciliationModal = ({ pos, unsettledSales, stock, onClose, onConfirm, isReadOnly = false }) => {
    
    const [reconciliationItems, setReconciliationItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const salesByProduct = unsettledSales.reduce((acc, sale) => {
            const productId = sale.productId;
            if (!acc[productId]) {
                acc[productId] = {
                    productId: sale.productId, productName: sale.productName,
                    unitPrice: sale.unitPrice, quantity: 0, originalSales: []
                };
            }
            acc[productId].quantity += sale.quantity;
            acc[productId].originalSales.push(sale);
            return acc;
        }, {});
        
        const items = Object.values(salesByProduct).map(groupedSale => {
            const stockItem = stock.find(s => s.id === groupedSale.productId);
            return {
                ...groupedSale, id: groupedSale.productId,
                status: isReadOnly ? 'confirmed' : 'pending', // Si lecture seule, tout est considéré comme validé
                currentStock: stockItem?.quantity || 0, adjustmentReason: ''
            };
        });
        setReconciliationItems(items);
    }, [unsettledSales, stock, isReadOnly]);

    const totalNetAmount = useMemo(() => {
        const totalRevenue = reconciliationItems.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
        const commission = totalRevenue * (pos.commissionRate || 0);
        return totalRevenue - commission;
    }, [reconciliationItems, pos.commissionRate]);

    const handleQuantityChange = (productId, newQuantity) => {
        setReconciliationItems(items => items.map(item => 
            item.productId === productId ? { ...item, quantity: parseInt(newQuantity, 10) || 0 } : item
        ));
    };

    const handleStatusChange = (productId, status) => {
        setReconciliationItems(items => items.map(item => 
            item.productId === productId ? { ...item, status } : item
        ));
    };
    
    const handleReasonChange = (productId, reason) => {
        setReconciliationItems(items => items.map(item => 
            item.productId === productId ? { ...item, adjustmentReason: reason } : item
        ));
    };

    const isReadyToClose = useMemo(() => {
        if (reconciliationItems.length === 0) return false;
        return reconciliationItems.every(item => item.status === 'confirmed');
    }, [reconciliationItems]);

    const handleConfirmPayout = () => {
        setIsLoading(true);
        const finalData = {
            netAmount: totalNetAmount,
            grossRevenue: reconciliationItems.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0),
            commissionRate: pos.commissionRate,
            items: reconciliationItems.map(item => ({
                productId: item.productId, productName: item.productName,
                finalQuantity: item.quantity,
                originalQuantity: item.originalSales.reduce((acc, s) => acc + s.quantity, 0),
                unitPrice: item.unitPrice, adjustmentReason: item.adjustmentReason,
                originalSaleIds: item.originalSales.map(s => s.id)
            }))
        };
        onConfirm(finalData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-gray-800 rounded-2xl w-full max-w-5xl h-[90vh] border-gray-700 flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-white">{isReadOnly ? "Détail du Paiement" : "Réconciliation et Clôture"}</h2>
                        <p className="text-gray-400">Pour le dépôt : {pos.name}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-gray-400 text-sm">Net à reverser</p>
                        <p className="text-3xl font-bold text-green-400">{totalNetAmount.toFixed(2)} €</p>
                    </div>
                </div>

                <div className="flex-grow p-6 overflow-y-auto custom-scrollbar">
                    {/* EN-TÊTES DE COLONNES AJOUTÉS ICI */}
                    <div className="w-full text-left text-xs text-gray-400 uppercase grid grid-cols-12 gap-4 px-4 pb-2 border-b border-gray-700 font-semibold">
                        <div className="col-span-4">Produit</div>
                        <div className="col-span-2 text-center">Vendu</div>
                        <div className="col-span-2 text-center">Stock Restant</div>
                        <div className="col-span-4 text-right">Actions</div>
                    </div>
                    <div className="space-y-2 mt-2">
                        {reconciliationItems.map(item => {
                            const originalQuantity = item.originalSales.reduce((acc, s) => acc + s.quantity, 0);
                            const remainingStock = item.currentStock + originalQuantity - item.quantity;
                            return (
                                <div key={item.id} className={`p-4 rounded-lg transition-all ${item.status === 'editing' ? 'bg-red-900/20 ring-1 ring-red-500' : 'bg-gray-900/50'}`}>
                                    <div className="grid grid-cols-12 gap-4 items-center">
                                        <div className="col-span-4 font-bold text-white">{item.productName}</div>
                                        <div className="col-span-2 text-center">
                                            <input 
                                                type="number" 
                                                value={item.quantity}
                                                onChange={e => handleQuantityChange(item.id, e.target.value)}
                                                disabled={isReadOnly || item.status !== 'editing'}
                                                className="w-20 bg-gray-700 p-1 rounded-md text-center disabled:bg-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                                            />
                                        </div>
                                        <div className="col-span-2 text-center text-gray-400 font-mono">{remainingStock}</div>
                                        <div className="col-span-4 flex justify-end gap-2">
                                            {!isReadOnly && item.status === 'pending' && (
                                                <>
                                                    <button onClick={() => handleStatusChange(item.id, 'confirmed')} className="p-2 bg-green-600 rounded-lg text-white hover:bg-green-500" title="Confirmer la ligne"><Check size={18} /></button>
                                                    <button onClick={() => handleStatusChange(item.id, 'editing')} className="p-2 bg-yellow-600 rounded-lg text-white hover:bg-yellow-500" title="Ajuster la quantité"><Edit size={18} /></button>
                                                </>
                                            )}
                                            {!isReadOnly && item.status === 'editing' && (
                                                <button onClick={() => item.adjustmentReason.trim() ? handleStatusChange(item.id, 'confirmed') : alert('Le motif est obligatoire pour sauvegarder l\'ajustement.')} className="p-2 bg-blue-600 rounded-lg text-white hover:bg-blue-500" title="Sauvegarder l'ajustement"><Save size={18} /></button>
                                            )}
                                            {item.status === 'confirmed' && (
                                                <span className="text-green-400 font-bold text-sm flex items-center gap-1"><Check size={16}/> Validé</span>
                                            )}
                                        </div>
                                    </div>
                                    {!isReadOnly && item.status === 'editing' && (
                                        <div className="mt-3 animate-fade-in col-span-12">
                                            <label className="text-xs text-yellow-400 flex items-center gap-2"><AlertTriangle size={14}/>Motif de l'ajustement (obligatoire)</label>
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

                <div className="p-6 border-t border-gray-700 flex justify-end gap-4">
                    {isReadOnly ? (
                        <button onClick={onClose} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg">Fermer</button>
                    ) : (
                        <>
                            <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg">Annuler</button>
                            <button onClick={handleConfirmPayout} disabled={!isReadyToClose || isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
                                {isLoading ? 'Clôture en cours...' : 'Valider et Clôturer la Période'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PayoutReconciliationModal;
