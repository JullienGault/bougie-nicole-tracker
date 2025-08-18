// src/components/cost/ShippingSimulator.jsx
import React, { useState, useMemo } from 'react';
import { PlusCircle, Trash2, Box, Weight, PackagePlus, Percent, Gift } from 'lucide-react';
import { formatPrice } from '../../utils/formatters';

const ShippingSimulator = ({ savedCalculations, shippingBoxes = [], shippingConsumables = [], shippingRates = [], tvaRate, feesRate, chargesRate }) => {
    const [simulatedItems, setSimulatedItems] = useState([]);
    const [selectedBoxId, setSelectedBoxId] = useState('');
    const [selectedConsumables, setSelectedConsumables] = useState(new Set());
    const [shippingService, setShippingService] = useState('Locker');

    // Nouveaux états pour les offres commerciales
    const [isShippingFree, setIsShippingFree] = useState(false);
    const [isBundleOfferActive, setIsBundleOfferActive] = useState(false);
    const [bundleBuyQuantity, setBundleBuyQuantity] = useState(3);
    const [bundleGetQuantity, setBundleGetQuantity] = useState(1);


    const handleAddItem = (calc) => {
        setSimulatedItems(prev => {
            const existing = prev.find(item => item.id === calc.id);
            if (existing) {
                return prev.map(item => item.id === calc.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            // On ajoute le prix unitaire TTC pour simplifier les calculs d'offre
            const unitPriceTTC = calc.resultsByMode?.Locker?.productPriceTTC || 0;
            return [...prev, { ...calc, quantity: 1, unitPriceTTC }];
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

    const handleConsumableToggle = (consumableId) => {
        setSelectedConsumables(prev => {
            const newSet = new Set(prev);
            if (newSet.has(consumableId)) {
                newSet.delete(consumableId);
            } else {
                newSet.add(consumableId);
            }
            return newSet;
        });
    };

    const selectedBox = useMemo(() => {
        return shippingBoxes.find(p => p.id === selectedBoxId);
    }, [shippingBoxes, selectedBoxId]);

    const calculationResults = useMemo(() => {
        if (simulatedItems.length === 0) {
            return { totalRevenue: 0, totalCost: 0, totalProfit: 0, totalWeight: 0, shippingCustomerPrice: 0, boxCost: 0, consumablesCost: 0, shippingProviderCost: 0, transactionFees: 0, businessCharges: 0, totalProductCost: 0, totalDiscount: 0 };
        }

        const tva = parseFloat(tvaRate) || 0;
        const fees = parseFloat(feesRate) || 0;
        const charges = parseFloat(chargesRate) || 0;

        let totalProductCost = 0;
        let totalProductPackagingCost = 0;
        let totalProductPriceTTCBeforeDiscount = 0;
        let totalWeight = 0;
        let totalDiscount = 0;

        simulatedItems.forEach(item => {
            const itemData = item.resultsByMode?.Locker; 
            if (!itemData) return;
            totalProductCost += itemData.productCost * item.quantity;
            totalProductPackagingCost += itemData.packagingCost * item.quantity;
            totalProductPriceTTCBeforeDiscount += item.unitPriceTTC * item.quantity;
            totalWeight += itemData.finalPackageWeight * item.quantity;
            
            // Logique de l'offre par produit
            if (isBundleOfferActive && bundleBuyQuantity > 0) {
                const totalUnitsForOffer = bundleBuyQuantity + bundleGetQuantity;
                const numberOfBundles = Math.floor(item.quantity / totalUnitsForOffer);
                const freeItemsCount = numberOfBundles * bundleGetQuantity;
                totalDiscount += freeItemsCount * item.unitPriceTTC;
            }
        });

        const totalProductPriceTTC = totalProductPriceTTCBeforeDiscount - totalDiscount;

        const boxCost = selectedBox?.standardizedPrice || 0;
        const consumablesCost = Array.from(selectedConsumables).reduce((acc, id) => {
            const consumable = shippingConsumables.find(c => c.id === id);
            return acc + (consumable?.standardizedPrice || 0);
        }, 0);

        let shippingProviderCost = 0;
        let shippingCustomerPrice = 0;
        
        if (totalWeight > 0 && selectedBox) {
             const applicableRate = shippingRates
                .filter(rate => rate.service === shippingService)
                .sort((a, b) => a.maxWeight - b.maxWeight)
                .find(rate => totalWeight <= rate.maxWeight);
            if (applicableRate) {
                shippingProviderCost = applicableRate.cost;
                // On met le prix client à 0 si l'offre est activée
                shippingCustomerPrice = isShippingFree ? 0 : applicableRate.price;
            }
        }

        const totalRevenue = totalProductPriceTTC + shippingCustomerPrice;
        const transactionFees = totalRevenue * (fees / 100);
        const turnoverHT = totalRevenue / (1 + tva / 100);
        const businessCharges = turnoverHT * (charges / 100);

        const totalCost = totalProductCost + totalProductPackagingCost + boxCost + consumablesCost + shippingProviderCost + transactionFees + businessCharges;
        const totalProfit = totalRevenue - totalCost;

        return { totalRevenue, totalCost, totalProfit, totalWeight, shippingCustomerPrice, boxCost, consumablesCost, shippingProviderCost, transactionFees, businessCharges, totalProductCost, totalProductPackagingCost, totalDiscount };

    }, [simulatedItems, selectedBox, selectedConsumables, shippingService, shippingRates, shippingConsumables, tvaRate, feesRate, chargesRate, isShippingFree, isBundleOfferActive, bundleBuyQuantity, bundleGetQuantity]);

    return (
        <div className="bg-gray-800 p-6 rounded-2xl">
            <h3 className="text-xl font-bold mb-4">Simulateur d'Envoi de Colis</h3>
            <div className="flex flex-col md:flex-row gap-8">
                <div className="md:w-1/2 space-y-4">
                    <div>
                        <h4 className="font-semibold mb-2">1. Ajouter des produits au colis</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                             {savedCalculations.map(calc => (
                                <div key={calc.id} className="bg-gray-900/50 p-2 rounded-lg flex justify-between items-center">
                                    <span>{calc.productName}</span>
                                    <button type="button" onClick={() => handleAddItem(calc)} className="p-1 text-green-400 hover:bg-gray-700 rounded-full"><PlusCircle size={20}/></button>
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
                                    <button type="button" onClick={() => handleRemoveItem(item.id)} className="text-red-500 p-1"><Trash2 size={16}/></button>
                                </div>
                            )) : <p className="text-sm text-gray-500 text-center py-4">Le colis est vide.</p>}
                        </div>
                    </div>
                </div>

                <div className="md:w-1/2 space-y-4">
                     <div>
                        <h4 className="font-semibold mb-2">3. Choisir le Carton et les Consommables</h4>
                        <select value={selectedBoxId} onChange={e => setSelectedBoxId(e.target.value)} className="w-full bg-gray-700 p-2 rounded-lg mb-2">
                            <option value="">-- Aucun carton d'expédition --</option>
                            {shippingBoxes.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <div className="bg-gray-900/50 p-3 rounded-lg space-y-2">
                            <h5 className="text-sm font-semibold flex items-center gap-2"><PackagePlus size={16}/> Consommables d'expédition</h5>
                             <div className="max-h-24 overflow-y-auto custom-scrollbar pr-2 text-sm">
                                {shippingConsumables.map(c => (
                                    <label key={c.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-700/50">
                                        <input type="checkbox" checked={selectedConsumables.has(c.id)} onChange={() => handleConsumableToggle(c.id)} className="bg-gray-600 rounded" />
                                        <span>{c.name}</span>
                                        <span className="ml-auto text-gray-400">{formatPrice(c.standardizedPrice)}</span>
                                    </label>
                                ))}
                             </div>
                        </div>
                         <div className="flex gap-1 p-1 bg-gray-900 rounded-lg mt-4">
                            {['Locker', 'Point Relais', 'Domicile'].map(service => (
                                <button type="button" key={service} onClick={() => setShippingService(service)} className={`flex-1 px-3 py-1.5 rounded-md text-sm font-semibold ${shippingService === service ? 'bg-indigo-600' : 'hover:bg-gray-600'}`}>{service}</button>
                            ))}
                        </div>
                    </div>
                     {/* --- NOUVELLE SECTION OFFRES COMMERCIALES --- */}
                    <div>
                        <h4 className="font-semibold mb-2">4. Offres Commerciales</h4>
                        <div className="p-4 bg-gray-900/50 rounded-lg space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={isShippingFree} onChange={(e) => setIsShippingFree(e.target.checked)} className="bg-gray-600 rounded w-5 h-5" />
                                <span>Frais de port offerts au client</span>
                            </label>
                            <hr className="border-gray-700/50" />
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={isBundleOfferActive} onChange={(e) => setIsBundleOfferActive(e.target.checked)} className="bg-gray-600 rounded w-5 h-5" />
                                <span>Activer l'offre produit</span>
                            </label>
                            {isBundleOfferActive && (
                                <div className="pl-8 flex items-center gap-3 animate-fade-in">
                                    <p>Pour</p>
                                    <input type="number" value={bundleBuyQuantity} onChange={e => setBundleBuyQuantity(parseInt(e.target.value) || 0)} className="w-16 bg-gray-700 p-1 rounded text-center"/>
                                    <p>achetés,</p>
                                    <input type="number" value={bundleGetQuantity} onChange={e => setBundleGetQuantity(parseInt(e.target.value) || 0)} className="w-16 bg-gray-700 p-1 rounded text-center"/>
                                    <p>offert(s)</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                         <h4 className="font-semibold mb-2">5. Résultat de la simulation</h4>
                         <div className="p-4 bg-gray-900/50 rounded-lg space-y-2 text-sm">
                            <div className="flex justify-between items-center"><span className="text-gray-400 flex items-center gap-2"><Weight size={16}/> Poids Total du Colis</span><span className="font-bold">{calculationResults.totalWeight.toFixed(0)} g</span></div>
                            <hr className="border-gray-700"/>
                            <div className="flex justify-between items-center"><span>Total Produits TTC</span><span>{formatPrice(calculationResults.totalRevenue - calculationResults.shippingCustomerPrice + calculationResults.totalDiscount)}</span></div>
                            {calculationResults.totalDiscount > 0 && (
                                <div className="flex justify-between items-center text-orange-400">
                                    <span>- Remise article(s) offert(s)</span>
                                    <span>- {formatPrice(calculationResults.totalDiscount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center"><span>Expédition (facturée client)</span><span>{formatPrice(calculationResults.shippingCustomerPrice)}</span></div>
                            <div className="flex justify-between items-center font-bold text-base border-t border-gray-700 pt-2"><span>Total Facturé Client</span><span>{formatPrice(calculationResults.totalRevenue)}</span></div>
                            
                            <div className="pt-2">
                                <p className="text-red-400 font-semibold">- Dépenses du Colis</p>
                                <div className="pl-4 text-gray-300">
                                    <div className="flex justify-between"><span>Coût matières premières</span><span>{formatPrice(calculationResults.totalProductCost)}</span></div>
                                    <div className="flex justify-between"><span>Coût emballages produits</span><span>{formatPrice(calculationResults.totalProductPackagingCost)}</span></div>
                                    <div className="flex justify-between"><span>Coût du carton d'expédition</span><span>{formatPrice(calculationResults.boxCost)}</span></div>
                                    <div className="flex justify-between"><span>Coût consommables</span><span>{formatPrice(calculationResults.consumablesCost)}</span></div>
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
