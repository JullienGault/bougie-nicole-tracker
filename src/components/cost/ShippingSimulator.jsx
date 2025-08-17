// src/components/cost/ShippingSimulator.jsx
import React, { useState, useMemo } from 'react';
import { PlusCircle, Trash2, Box, Weight, Info } from 'lucide-react';
import { formatPrice } from '../../utils/formatters';

const ShippingSimulator = ({ savedCalculations, packagingMaterials, shippingRates, tvaRate, feesRate, chargesRate }) => {
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

    const selectedBox = useMemo(() => {
        return packagingMaterials.find(p => p.id === selectedBoxId);
    }, [packagingMaterials, selectedBoxId]);

    const calculationResults = useMemo(() => {
        if (simulatedItems.length === 0) {
            return { totalRevenue: 0, totalCost: 0, totalProfit: 0, totalWeight: 0 };
        }

        const tva = parseFloat(tvaRate) || 0;
        const fees = parseFloat(feesRate) || 0;
        const charges = parseFloat(chargesRate) || 0;

        // 1. Calculs de base sur les produits
        let totalProductCost = 0;
        let totalProductPriceTTC = 0;
        let totalWeight = 0;

        simulatedItems.forEach(item => {
            const itemData = item.resultsByMode?.internet; // On se base sur le mode internet pour les coûts produits
            if (!itemData) return;
            totalProductCost += itemData.productCost * item.quantity;
            totalProductPriceTTC += itemData.productPriceTTC * item.quantity;
            totalWeight += itemData.finalPackageWeight * item.quantity;
        });

        // 2. Coût de l'emballage (1 seul carton)
        const boxCost = selectedBox?.standardizedPrice || 0;

        // 3. Coût de l'expédition (selon le poids total)
        let shippingProviderCost = 0;
        let shippingCustomerPrice = 0;
        if (totalWeight > 0) {
             const applicableRate = shippingRates
                .filter(rate => rate.service === shippingService)
                .sort((a, b) => a.maxWeight - b.maxWeight)
                .find(rate => totalWeight <= rate.maxWeight);
            if (applicableRate) {
                shippingProviderCost = applicableRate.cost;
                shippingCustomerPrice = applicableRate.price;
            }
        }

        // 4. Calculs financiers globaux
        const totalRevenue = totalProductPriceTTC + shippingCustomerPrice;
        const transactionFees = totalRevenue * (fees / 100);
        const turnoverHT = totalRevenue / (1 + tva / 100);
        const businessCharges = turnoverHT * (charges / 100);

        const totalCost = totalProductCost + boxCost + shippingProviderCost + transactionFees + businessCharges;
        const totalProfit = totalRevenue - totalCost;

        return { totalRevenue, totalCost, totalProfit, totalWeight, shippingCustomerPrice, boxCost, shippingProviderCost, transactionFees, businessCharges };

    }, [simulatedItems, selectedBox, shippingService, shippingRates, tvaRate, feesRate, chargesRate]);

    return (
        <div className="bg-gray-800 p-6 rounded-2xl">
            <h3 className="text-xl font-bold mb-4">Simulateur d'Envoi de Colis</h3>
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
                                <option key={p.id} value={p.id}>{p.name}</option>
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
                         <div className="p-4 bg-gray-900/50 rounded-lg space-y-2 text-sm">
                            <div className="flex justify-between items-center"><span className="text-gray-400 flex items-center gap-2"><Weight size={16}/> Poids Total du Colis</span><span className="font-bold">{calculationResults.totalWeight.toFixed(0)} g</span></div>
                            <hr className="border-gray-700"/>
                            <div className="flex justify-between items-center"><span>Total Produits TTC</span><span>{formatPrice(calculationResults.totalRevenue - calculationResults.shippingCustomerPrice)}</span></div>
                            <div className="flex justify-between items-center"><span>Expédition (facturée client)</span><span>{formatPrice(calculationResults.shippingCustomerPrice)}</span></div>
                            <div className="flex justify-between items-center font-bold text-base border-t border-gray-700 pt-2"><span>Total Facturé Client</span><span>{formatPrice(calculationResults.totalRevenue)}</span></div>
                            
                            <div className="pt-2">
                                <p className="text-red-400 font-semibold">- Dépenses du Colis</p>
                                <div className="pl-4 text-gray-300">
                                    <div className="flex justify-between"><span>Coût total des produits</span><span>{formatPrice(calculationResults.totalCost - calculationResults.boxCost - calculationResults.shippingProviderCost - calculationResults.transactionFees - calculationResults.businessCharges)}</span></div>
                                    <div className="flex justify-between"><span>Coût du carton</span><span>{formatPrice(calculationResults.boxCost)}</span></div>
                                    <div className="flex justify-between"><span>Coût transporteur</span><span>{formatPrice(calculationResults.shippingProviderCost)}</span></div>
                                    <div className="flex justify-between"><span>Frais de transaction</span><span>{formatPrice(calculationResults.transactionFees)}</span></div>
                                    <div className="flex justify-between"><span>Cotisations URSSAF</span><span>{formatPrice(calculationResults.businessCharges)}</span></div>
                                    <div className="flex justify-between font-bold border-t border-gray-700/50 mt-1 pt-1"><span>Total Dépenses</span><span>{formatPrice(calculationResults.totalCost)}</span></div>
                                </div>
                            </div>
                            
                            <div className="flex justify-between items-center bg-green-500/10 p-3 rounded-lg mt-2 !-mx-4 !-mb-4">
                                <span className="text-green-300 font-semibold text-lg">Bénéfice Net du Colis</span>
                                <span className="font-bold text-2xl text-green-400">{formatPrice(calculationResults.totalProfit)}</span>
                            </div>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShippingSimulator;
