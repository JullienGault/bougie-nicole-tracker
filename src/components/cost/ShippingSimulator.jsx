// src/components/cost/ShippingSimulator.jsx
import React, { useState, useMemo } from 'react';
import { PlusCircle, Trash2, Box, Weight, AlertTriangle, CheckCircle } from 'lucide-react';
import { formatPrice } from '../../utils/formatters';

const ShippingSimulator = ({ savedCalculations, packagingMaterials, shippingRates }) => {
    const [simulatedItems, setSimulatedItems] = useState([]);
    const [selectedBoxId, setSelectedBoxId] = useState('');
    const [shippingService, setShippingService] = useState('Locker');

    const handleAddItem = (calc) => {
        setSimulatedItems(prev => {
            const existing = prev.find(item => item.id === calc.id);
            if (existing) {
                return prev.map(item => item.id === calc.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prev, { ...calc, quantity: 1 }];
        });
    };

    const handleQuantityChange = (calcId, newQuantity) => {
        const qty = parseInt(newQuantity, 10);
        if (qty <= 0) {
            setSimulatedItems(prev => prev.filter(item => item.id !== calcId));
        } else {
            setSimulatedItems(prev => prev.map(item => item.id === calcId ? { ...item, quantity: qty } : item));
        }
    };
    
    const handleRemoveItem = (calcId) => {
        setSimulatedItems(prev => prev.filter(item => item.id !== calcId));
    };

    const { totalWeight, totalVolume, totalNetProfit, shippingCost } = useMemo(() => {
        let weight = 0;
        let volume = 0;
        let profit = 0;

        simulatedItems.forEach(item => {
            const itemWeight = item.resultsByMode?.Locker?.finalPackageWeight || 0; // Le poids du produit est le même partout
            const itemProfit = item.resultsByMode?.[shippingService.toLowerCase()]?.finalProfit || 0;
            const itemVolume = (item.productLength || 0) * (item.productWidth || 0) * (item.productHeight || 0);

            weight += itemWeight * item.quantity;
            volume += itemVolume * item.quantity;
            profit += itemProfit * item.quantity;
        });

        let finalShippingCost = 0;
        if (weight > 0) {
             const applicableRate = shippingRates
                .filter(rate => rate.service === shippingService)
                .sort((a, b) => a.maxWeight - b.maxWeight)
                .find(rate => weight <= rate.maxWeight);
            if (applicableRate) {
                finalShippingCost = applicableRate.price;
            }
        }
        
        // On soustrait le coût d'envoi du profit total car le profit par item ne l'inclut pas.
        profit -= finalShippingCost;

        return { totalWeight: weight, totalVolume: volume, totalNetProfit: profit, shippingCost: finalShippingCost };
    }, [simulatedItems, shippingRates, shippingService]);

    const selectedBox = useMemo(() => {
        return packagingMaterials.find(p => p.id === selectedBoxId);
    }, [packagingMaterials, selectedBoxId]);

    const boxVolume = useMemo(() => {
        if (!selectedBox) return 0;
        return (selectedBox.length || 0) * (selectedBox.width || 0) * (selectedBox.height || 0);
    }, [selectedBox]);

    // On considère que les produits ne doivent pas dépasser 90% du volume du carton pour le calage
    const isBoxBigEnough = boxVolume > 0 && totalVolume > 0 ? totalVolume <= (boxVolume * 0.9) : false;

    return (
        <div className="bg-gray-800 p-6 rounded-2xl">
            <h3 className="text-xl font-bold mb-4">Simulateur d'Envoi</h3>
            <div className="flex flex-col md:flex-row gap-8">
                {/* Colonne de gauche: Bibliothèque et colis */}
                <div className="md:w-1/2 space-y-4">
                    <div>
                        <h4 className="font-semibold mb-2">1. Ajouter des produits au colis</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                             {savedCalculations.map(calc => (
                                <div key={calc.id} className="bg-gray-900/50 p-2 rounded-lg flex justify-between items-center">
                                    <span>{calc.productName}</span>
                                    <button onClick={() => handleAddItem(calc)} className="p-1 text-green-400 hover:bg-gray-700 rounded-full"><PlusCircle size={20}/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h4 className="font-semibold mb-2">2. Contenu du colis</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                            {simulatedItems.length > 0 ? simulatedItems.map(item => (
                                <div key={item.id} className="bg-gray-900/50 p-2 rounded-lg flex items-center gap-2">
                                    <span className="flex-grow">{item.productName}</span>
                                    <input type="number" value={item.quantity} onChange={(e) => handleQuantityChange(item.id, e.target.value)} className="w-16 bg-gray-700 p-1 rounded text-center"/>
                                    <button onClick={() => handleRemoveItem(item.id)} className="text-red-500 p-1"><Trash2 size={16}/></button>
                                </div>
                            )) : <p className="text-sm text-gray-500 text-center py-4">Le colis est vide.</p>}
                        </div>
                    </div>
                </div>

                {/* Colonne de droite: Configuration et résultats */}
                <div className="md:w-1/2 space-y-4">
                     <div>
                        <h4 className="font-semibold mb-2">3. Choisir l'emballage et le service</h4>
                        <select value={selectedBoxId} onChange={e => setSelectedBoxId(e.target.value)} className="w-full bg-gray-700 p-2 rounded-lg mb-2">
                            <option value="">-- Sélectionner un carton --</option>
                            {packagingMaterials.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.length}x{p.width}x{p.height}cm)</option>
                            ))}
                        </select>
                         <div className="flex gap-1 p-1 bg-gray-900 rounded-lg">
                            {['Locker', 'Point Relais', 'Domicile'].map(service => (
                                <button key={service} onClick={() => setShippingService(service)} className={`flex-1 px-3 py-1.5 rounded-md text-sm font-semibold ${shippingService === service ? 'bg-indigo-600' : 'hover:bg-gray-600'}`}>{service}</button>
                            ))}
                        </div>
                    </div>
                    <div>
                         <h4 className="font-semibold mb-2">4. Résultat de la simulation</h4>
                         <div className="p-4 bg-gray-900/50 rounded-lg space-y-3">
                            <div className="flex justify-between items-center"><span className="text-gray-400 flex items-center gap-2"><Weight size={16}/> Poids Total</span><span className="font-bold text-lg">{totalWeight.toFixed(0)} g</span></div>
                            <div className="flex justify-between items-center"><span className="text-gray-400 flex items-center gap-2"><Box size={16}/> Volume Produits</span><span className="font-bold text-lg">{totalVolume.toFixed(0)} cm³</span></div>
                            {selectedBox && <div className="flex justify-between items-center"><span className="text-gray-400">Volume Carton</span><span>{boxVolume.toFixed(0)} cm³</span></div>}
                            
                            {selectedBoxId && totalVolume > 0 && (
                                isBoxBigEnough ? (
                                    <div className="bg-green-500/10 text-green-400 p-2 rounded-md text-sm flex items-center gap-2"><CheckCircle size={16}/> Le carton est adapté.</div>
                                ) : (
                                    <div className="bg-red-500/10 text-red-400 p-2 rounded-md text-sm flex items-center gap-2"><AlertTriangle size={16}/> Le carton est trop petit !</div>
                                )
                            )}

                            <hr className="border-gray-700"/>

                            <div className="flex justify-between items-center text-lg"><span className="text-gray-300">Coût d'envoi</span><span className="font-semibold">{formatPrice(shippingCost)}</span></div>
                            <div className="flex justify-between items-center bg-green-500/10 p-3 rounded-lg"><span className="text-green-300 font-semibold text-lg">Bénéfice Net Estimé</span><span className="font-bold text-2xl text-green-400">{formatPrice(totalNetProfit)}</span></div>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShippingSimulator;
