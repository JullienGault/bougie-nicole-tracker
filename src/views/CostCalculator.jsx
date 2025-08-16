// src/views/CostCalculator.jsx
import React, { useState, useEffect, useMemo, useContext } from 'react';
import { db, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, where } from '../services/firebase';
import { AppContext } from '../contexts/AppContext';
import { PlusCircle, Trash2, Save, X, Edit, Calculator, Ship, Banknote, Percent, ChevronDown, RefreshCw, Globe, Home, Store as StoreIcon, Library, Box } from 'lucide-react';
import { formatPrice } from '../utils/formatters';


// --- Sous-composant pour la Grille Tarifaire ---
const ShippingRateManager = ({ rates }) => {
    const { showToast } = useContext(AppContext);
    const [maxWeight, setMaxWeight] = useState('');
    const [providerCost, setProviderCost] = useState('');
    const [customerPrice, setCustomerPrice] = useState('');
    const [editingId, setEditingId] = useState(null);

    const handleSaveRate = async () => {
        const weight = parseInt(maxWeight, 10);
        const cost = parseFloat(providerCost);
        const price = parseFloat(customerPrice);
        if (isNaN(weight) || weight <= 0 || isNaN(cost) || cost < 0 || isNaN(price) || price < 0) {
            showToast("Veuillez entrer des valeurs valides pour tous les champs.", "error"); return;
        }
        const data = { maxWeight: weight, cost, price };
        try {
            if (editingId) {
                await updateDoc(doc(db, 'shippingRates', editingId), data);
                showToast("Tarif mis à jour.", "success");
            } else {
                await addDoc(collection(db, 'shippingRates'), data);
                showToast("Nouveau tarif ajouté.", "success");
            }
            setMaxWeight(''); setProviderCost(''); setCustomerPrice(''); setEditingId(null);
        } catch (error) { showToast("Erreur lors de la sauvegarde du tarif.", "error"); }
    };

    const handleDeleteRate = async (rateId) => {
        if (window.confirm("Supprimer ce tarif ?")) {
            await deleteDoc(doc(db, 'shippingRates', rateId));
            showToast("Tarif supprimé.", "success");
        }
    };
    
    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-4">
                <div><label className="text-xs text-gray-400">Poids max (g)</label><input type="number" value={maxWeight} onChange={e => setMaxWeight(e.target.value)} placeholder="500" className="w-full bg-gray-700 p-2 rounded-lg mt-1 text-sm" /></div>
                <div><label className="text-xs text-gray-400">Coût Transporteur (€)</label><input type="number" step="0.01" value={providerCost} onChange={e => setProviderCost(e.target.value)} placeholder="4.90" className="w-full bg-gray-700 p-2 rounded-lg mt-1 text-sm" /></div>
                <div><label className="text-xs text-gray-400">Prix Client (€)</label><input type="number" step="0.01" value={customerPrice} onChange={e => setCustomerPrice(e.target.value)} placeholder="5.90" className="w-full bg-gray-700 p-2 rounded-lg mt-1 text-sm" /></div>
                <button onClick={handleSaveRate} className="bg-indigo-600 py-2 px-4 rounded-lg h-[42px] text-sm">{editingId ? 'Modifier' : 'Ajouter'}</button>
            </div>
            <div className="max-h-48 overflow-y-auto custom-scrollbar text-sm">
                {rates.map(rate => (
                    <div key={rate.id} className="flex justify-between items-center p-2 bg-gray-900/50 rounded mb-2">
                        <span>Jusqu'à <span className="font-semibold">{rate.maxWeight}g</span></span>
                        <div className="text-right">
                            <span className="font-semibold">{formatPrice(rate.price)} <span className="text-xs text-gray-400">(Client)</span></span><br/>
                            <span className="text-xs text-yellow-400">{formatPrice(rate.cost)} <span className="text-gray-400">(Coût)</span></span>
                        </div>
                        <div className="flex gap-2">
                           <button onClick={() => { setEditingId(rate.id); setMaxWeight(rate.maxWeight); setProviderCost(rate.cost); setCustomerPrice(rate.price); }} className="text-yellow-400 p-1"><Edit size={16}/></button>
                           <button onClick={() => handleDeleteRate(rate.id)} className="text-red-500 p-1"><Trash2 size={16}/></button>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
};

const RawMaterialManager = ({ materials, onSelect }) => {
    const { showToast } = useContext(AppContext);
    const [name, setName] = useState('');
    const [category, setCategory] = useState('standard');
    const [purchasePrice, setPurchasePrice] = useState('');
    const [purchaseQty, setPurchaseQty] = useState('');
    const [purchaseUnit, setPurchaseUnit] = useState('kg');
    const [editingMaterial, setEditingMaterial] = useState(null);
    const [density, setDensity] = useState('1'); 
    const [weightPerPiece, setWeightPerPiece] = useState(''); 
    const [capacity, setCapacity] = useState('');

    const resetForm = () => {
        setName(''); setCategory('standard'); setPurchasePrice(''); setPurchaseQty(''); setPurchaseUnit('kg'); 
        setDensity('1'); setWeightPerPiece(''); setCapacity(''); setEditingMaterial(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const price = parseFloat(purchasePrice);
        const qty = parseFloat(purchaseQty);
        if (!name || isNaN(price) || price <= 0 || isNaN(qty) || qty <= 0) {
            showToast("Veuillez renseigner tous les champs avec des valeurs valides.", "error"); return;
        }
        let standardizedPrice = 0, standardizedUnit = '';
        switch (purchaseUnit) {
            case 'kg': standardizedPrice = price / (qty * 1000); standardizedUnit = 'g'; break;
            case 'g': standardizedPrice = price / qty; standardizedUnit = 'g'; break;
            case 'L': standardizedPrice = price / (qty * 1000); standardizedUnit = 'ml'; break;
            case 'ml': standardizedPrice = price / qty; standardizedUnit = 'ml'; break;
            case 'piece': default: standardizedPrice = price / qty; standardizedUnit = 'piece'; break;
        }
        const data = { 
            name, category, purchasePrice: price, purchaseQty: qty, purchaseUnit, standardizedPrice, standardizedUnit,
            density: (purchaseUnit === 'L' || purchaseUnit === 'ml') ? parseFloat(density) : null,
            weightPerPiece: purchaseUnit === 'piece' ? parseFloat(weightPerPiece) : null,
            capacity: category === 'expedition' ? parseInt(capacity, 10) : null,
        };
        try {
            if (editingMaterial) {
                await updateDoc(doc(db, 'rawMaterials', editingMaterial.id), data);
                showToast("Matière première mise à jour.", "success");
            } else {
                await addDoc(collection(db, 'rawMaterials'), { ...data, createdAt: serverTimestamp() });
                showToast("Matière première ajoutée.", "success");
            }
            resetForm();
        } catch (error) { showToast("Une erreur est survenue.", "error"); }
    };
    
    const handleDelete = async (materialId) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer cette matière première ?")) {
            await deleteDoc(doc(db, 'rawMaterials', materialId));
            showToast("Matière première supprimée.", "success");
        }
    };

    const startEditing = (material) => {
        setEditingMaterial(material); setName(material.name); setCategory(material.category || 'standard'); 
        setPurchasePrice(material.purchasePrice); setPurchaseQty(material.purchaseQty); setPurchaseUnit(material.purchaseUnit);
        setDensity(material.density || '1');
        setWeightPerPiece(material.weightPerPiece || '');
        setCapacity(material.capacity || '');
    };

    return (
        <div className="bg-gray-800 p-6 rounded-2xl">
            <h3 className="text-lg font-bold mb-4">Matières Premières & Fournitures</h3>
            <form onSubmit={handleSubmit} className="space-y-3 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                        <label className="text-xs text-gray-400">Nom</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Cire de Soja, Carton Petit Format..." className="w-full bg-gray-700 p-2 rounded-lg mt-1 text-sm" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400">Catégorie</label>
                        <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-gray-700 p-2 rounded-lg mt-1 h-[42px] text-sm">
                            <option value="standard">Standard</option>
                            <option value="cire">Cire</option>
                            <option value="parfum">Parfum</option>
                            <option value="expedition">Fourniture d'Expédition</option>
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-10 gap-4 items-end">
                    <div className="sm:col-span-3"><label className="text-xs text-gray-400">Prix total (€)</label><input type="number" step="0.01" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} placeholder="169.90" className="w-full bg-gray-700 p-2 rounded-lg mt-1 text-sm" /></div>
                    <div className="sm:col-span-2"><label className="text-xs text-gray-400">Qté achetée</label><input type="number" step="0.01" value={purchaseQty} onChange={e => setPurchaseQty(e.target.value)} placeholder="20" className="w-full bg-gray-700 p-2 rounded-lg mt-1 text-sm" /></div>
                    <div className="sm:col-span-2"><label className="text-xs text-gray-400">Unité</label><select value={purchaseUnit} onChange={e => setPurchaseUnit(e.target.value)} className="w-full bg-gray-700 p-2 rounded-lg mt-1 h-[42px] text-sm"><option value="kg">kg</option><option value="g">g</option><option value="L">L</option><option value="ml">ml</option><option value="piece">pièce(s)</option></select></div>
                    {(purchaseUnit === 'L' || purchaseUnit === 'ml') && <div className="sm:col-span-3"><label className="text-xs text-gray-400">Densité (g/ml)</label><input type="number" step="0.01" value={density} onChange={e => setDensity(e.target.value)} className="w-full bg-gray-700 p-2 rounded-lg mt-1 text-sm" /></div>}
                    {purchaseUnit === 'piece' && <div className="sm:col-span-3"><label className="text-xs text-gray-400">Poids / pièce (g)</label><input type="number" step="0.1" value={weightPerPiece} onChange={e => setWeightPerPiece(e.target.value)} placeholder="ex: 250" className="w-full bg-gray-700 p-2 rounded-lg mt-1 text-sm" /></div>}
                    {category === 'expedition' && <div className="sm:col-span-3"><label className="text-xs text-gray-400">Capacité (nb produits)</label><input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="ex: 2" className="w-full bg-gray-700 p-2 rounded-lg mt-1 text-sm" /></div>}
                    <button type="submit" className="bg-indigo-600 py-2 px-4 rounded-lg flex items-center justify-center gap-2 h-[42px] sm:col-span-3 sm:col-start-8 text-sm">
                        {editingMaterial ? <Save size={16}/> : <PlusCircle size={16}/>} {editingMaterial ? 'Enregistrer' : 'Ajouter'}
                    </button>
                </div>
                {editingMaterial && <div className="flex justify-end"><button type="button" onClick={resetForm} className="bg-gray-600 py-2 px-4 rounded-lg text-sm">Annuler</button></div>}
            </form>
            <div className="max-h-64 overflow-y-auto custom-scrollbar text-sm">
                <table className="w-full text-left">
                     <thead><tr className="border-b border-gray-700 text-xs uppercase text-gray-400"><th className="p-2">Nom</th><th className="p-2">Prix d'achat</th><th className="p-2">Coût standardisé</th><th className="p-2 text-center">Actions</th></tr></thead>
                    <tbody>
                        {materials.map(mat => (
                            <tr key={mat.id} className="border-b border-gray-700/50">
                                <td className="p-2 font-semibold">{mat.name} <span className="text-xs text-gray-500">({mat.category})</span></td>
                                <td className="p-2">{formatPrice(mat.purchasePrice)} / {mat.purchaseQty} {mat.purchaseUnit}</td>
                                <td className="p-2 font-mono text-xs text-indigo-300">
                                    {(mat.standardizedUnit === 'g' || mat.standardizedUnit === 'ml')
                                        ? `${formatPrice(mat.standardizedPrice * 100)} / 100${mat.standardizedUnit}`
                                        : `${formatPrice(mat.standardizedPrice)} / ${mat.standardizedUnit}`
                                    }
                                    {mat.weightPerPiece && ` (${mat.weightPerPiece}g)`}
                                </td>
                                <td className="p-2 flex justify-center gap-2">
                                    <button onClick={() => onSelect(mat)} className="text-green-400 p-1 hover:bg-gray-700 rounded" title="Ajouter au calcul"><PlusCircle size={16}/></button>
                                    <button onClick={() => startEditing(mat)} className="text-yellow-400 p-1 hover:bg-gray-700 rounded" title="Modifier"><Edit size={16}/></button>
                                    <button onClick={() => handleDelete(mat.id)} className="text-red-500 p-1 hover:bg-gray-700 rounded" title="Supprimer"><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- Composant Principal ---
const CostCalculator = () => {
    const { showToast } = useContext(AppContext);
    const [saleMode, setSaleMode] = useState('internet');
    const [rawMaterials, setRawMaterials] = useState([]);
    const [shippingRates, setShippingRates] = useState([]);
    const [savedCalculations, setSavedCalculations] = useState([]);
    const [recipeItems, setRecipeItems] = useState([]);
    const [productName, setProductName] = useState('');
    const [shippingSupply, setShippingSupply] = useState(null);
    const [editingCalcId, setEditingCalcId] = useState(null);
    const [isLibraryVisible, setIsLibraryVisible] = useState(false);
    const [isShippingVisible, setIsShippingVisible] = useState(false);
    const [isFinancialsVisible, setIsFinancialsVisible] = useState(false);
    const [isExpensesVisible, setIsExpensesVisible] = useState(false);
    
    // --- États pour le mode Dépôt-Vente ---
    const [publicPrice, setPublicPrice] = useState('');
    const [commissionRate, setCommissionRate] = useState(30);

    const [marginMultiplier, setMarginMultiplier] = useState(2.5);
    const [tvaRate, setTvaRate] = useState(20);
    const chargesRate = 13.30;
    const [feesRate, setFeesRate] = useState(1.75);
    const [manualPriceTTC, setManualPriceTTC] = useState('');
    const [isPriceModified, setIsPriceModified] = useState(false);

    const availableTvaRates = [20, 10, 5.5, 0];
    const availableCommissionRates = [10, 15, 20, 25, 30];

    const shippingSupplies = useMemo(() => rawMaterials.filter(m => m.category === 'expedition'), [rawMaterials]);
    const productMaterials = useMemo(() => rawMaterials.filter(m => m.category !== 'expedition'), [rawMaterials]);

    useEffect(() => {
        // ... listeners firebase
    }, []);

    const productCost = useMemo(() => recipeItems.reduce((acc, item) => acc + (item.standardizedPrice * item.quantity), 0), [recipeItems]);

    useEffect(() => {
        if (!isPriceModified && saleMode !== 'depot') {
            const productPriceHT = productCost * marginMultiplier;
            const calculatedTTC = productPriceHT * (1 + tvaRate / 100);
            const roundedTTC = (Math.round(calculatedTTC * 2) / 2).toFixed(2);
            setManualPriceTTC(roundedTTC);
        }
    }, [productCost, marginMultiplier, tvaRate, isPriceModified, saleMode]);

    const handleManualPriceChange = (e) => {
        const newPrice = e.target.value;
        setManualPriceTTC(newPrice);
        setIsPriceModified(true);
        if (parseFloat(newPrice) > 0) {
            const priceHT = parseFloat(newPrice) / (1 + tvaRate / 100);
            if (productCost > 0) {
                const newMultiplier = priceHT / productCost;
                setMarginMultiplier(newMultiplier);
            }
        }
    };
    
    const handleAddMaterialToRecipe = (material) => {
        if (recipeItems.find(item => item.materialId === material.id)) {
            showToast("Cette matière est déjà dans la recette.", "info"); return;
        }
        let quantity = 1;
        if (material.category === 'parfum') {
            const cire = recipeItems.find(item => item.category === 'cire');
            if (cire) {
                quantity = cire.quantity * 0.10;
            } else {
                showToast("Veuillez d'abord ajouter une cire à la recette.", "info"); return;
            }
        }
        setRecipeItems(prev => [...prev, { ...material, materialId: material.id, quantity }]);
    };

    const handleRecipeQuantityChange = (materialId, newQuantityStr) => {
        const newQuantity = parseFloat(newQuantityStr) || 0;
        let newRecipe = recipeItems.map(item => 
            item.materialId === materialId ? { ...item, quantity: newQuantity } : item
        );
        const changedItem = newRecipe.find(item => item.materialId === materialId);
        if (changedItem && changedItem.category === 'cire') {
            newRecipe = newRecipe.map(item => {
                if (item.category === 'parfum') {
                    return { ...item, quantity: newQuantity * 0.10 };
                }
                return item;
            });
        }
        setRecipeItems(newRecipe);
    };

    const handleRemoveFromRecipe = (materialId) => setRecipeItems(items => items.filter(item => item.materialId !== materialId));
    
    const calculations = useMemo(() => {
        let productPriceTTC = parseFloat(manualPriceTTC) || 0;
        let productPriceHT = productPriceTTC / (1 + tvaRate / 100);
        let finalProfit;

        if (saleMode === 'depot') {
            const price = parseFloat(publicPrice) || 0;
            const commission = price * (commissionRate / 100);
            finalProfit = price - commission - productCost;
        } else {
            const finalPackageWeight = recipeItems.reduce((acc, item) => {
                let weight = 0;
                if(item.standardizedUnit === 'g') weight = item.quantity;
                else if(item.standardizedUnit === 'ml') weight = item.quantity * (item.density || 1);
                else if(item.standardizedUnit === 'piece') weight = item.quantity * (item.weightPerPiece || 0);
                return acc + weight;
            }, 0);

            let shippingProviderCost = 0, shippingCustomerPrice = 0, shippingSupplyCost = 0;
            if (saleMode === 'internet') {
                if (finalPackageWeight > 0 && shippingRates.length > 0) {
                    const sortedRates = [...shippingRates].sort((a, b) => a.maxWeight - b.maxWeight);
                    const applicableRate = sortedRates.find(rate => finalPackageWeight <= rate.maxWeight);
                    if (applicableRate) {
                        shippingProviderCost = applicableRate.cost;
                        shippingCustomerPrice = applicableRate.price;
                    }
                }
                if (shippingSupply && shippingSupply.capacity > 0) {
                    shippingSupplyCost = shippingSupply.standardizedPrice / shippingSupply.capacity;
                }
            }
            
            const finalClientPrice = productPriceTTC + shippingCustomerPrice;
            const transactionTotal = finalClientPrice;
            const transactionFees = transactionTotal * (feesRate / 100);
            const businessCharges = productPriceHT * (chargesRate / 100);
            const profitOnProduct = productPriceHT - productCost - businessCharges - shippingSupplyCost;
            const profitOnShipping = shippingCustomerPrice - shippingProviderCost;
            finalProfit = profitOnProduct + profitOnShipping - transactionFees;

            return { ...{ productCost, finalPackageWeight, productPriceHT, productPriceTTC, shippingProviderCost, shippingCustomerPrice, finalClientPrice, transactionFees, businessCharges, finalProfit, totalExpenses: productCost + shippingProviderCost + transactionFees + shippingSupplyCost }, shippingSupplyCost };
        }
        
        return { productCost, finalProfit, publicPrice, commissionRate };
    }, [recipeItems, manualPriceTTC, tvaRate, shippingRates, chargesRate, feesRate, saleMode, productCost, publicPrice, commissionRate, shippingSupply]);

    // ... handleSaveCost, handleLoadCalculation, handleDeleteCalculation
    
    const renderTabs = () => (
        <div className="mb-8 p-1.5 bg-gray-900/50 rounded-xl flex gap-2">
            {[{id: 'internet', label: 'Vente par Internet', icon: Globe}, {id: 'domicile', label: 'Vente Domicile', icon: Home}, {id: 'depot', label: 'Dépôt-Vente', icon: StoreIcon}].map(tab => (
                 <button key={tab.id} onClick={() => setSaleMode(tab.id)} className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-semibold transition-colors text-sm ${saleMode === tab.id ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>
                    <tab.icon size={16}/> {tab.label}
                </button>
            ))}
        </div>
    );

    return (
        <div className="p-4 sm:p-8 animate-fade-in text-sm">
            <h2 className="text-2xl font-bold text-white mb-6">Calculateur de Coût de Production</h2>
            {renderTabs()}
            
            <div className="bg-gray-800 p-6 rounded-2xl mb-8">
                {/* Bibliothèque de produits */}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-8">
                    {/* Composition du produit */}
                    {saleMode === 'internet' && 
                        <div>
                            <label className="text-xs text-gray-400">Emballage d'Expédition</label>
                            <select onChange={e => setShippingSupply(shippingSupplies.find(s => s.id === e.target.value) || null)} className="w-full bg-gray-700 p-2 rounded-lg mt-1 text-sm">
                                <option value="">Aucun</option>
                                {shippingSupplies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    }
                    <RawMaterialManager materials={productMaterials} onSelect={handleAddMaterialToRecipe} />
                </div>
                <div className="space-y-8">
                    {/* Colonne de Droite */}
                </div>
            </div>
        </div>
    );
};

export default CostCalculator;
