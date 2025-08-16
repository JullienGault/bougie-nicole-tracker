// src/views/CostCalculator.jsx
import React, { useState, useEffect, useMemo, useContext } from 'react';
import { db, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from '../services/firebase';
import { AppContext } from '../contexts/AppContext';
import { PlusCircle, Trash2, Save, X, Edit, Ship, Percent, ChevronDown, RefreshCw, Globe, Home, Store as StoreIcon, Box, Info } from 'lucide-react';
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
                <div><label className="text-sm text-gray-400">Poids max (g)</label><input type="number" value={maxWeight} onChange={e => setMaxWeight(e.target.value)} placeholder="500" className="w-full bg-gray-700 p-2 rounded-lg mt-1" /></div>
                <div><label className="text-sm text-gray-400">Coût Transporteur (€)</label><input type="number" step="0.01" value={providerCost} onChange={e => setProviderCost(e.target.value)} placeholder="4.90" className="w-full bg-gray-700 p-2 rounded-lg mt-1" /></div>
                <div><label className="text-sm text-gray-400">Prix Client (€)</label><input type="number" step="0.01" value={customerPrice} onChange={e => setCustomerPrice(e.target.value)} placeholder="5.90" className="w-full bg-gray-700 p-2 rounded-lg mt-1" /></div>
                <button onClick={handleSaveRate} className="bg-indigo-600 py-2 px-4 rounded-lg h-[42px]">{editingId ? 'Modifier' : 'Ajouter'}</button>
            </div>
            <div className="max-h-48 overflow-y-auto custom-scrollbar">
                {rates.map(rate => (
                    <div key={rate.id} className="flex justify-between items-center p-2 bg-gray-900/50 rounded mb-2">
                        <span>Jusqu'à <span className="font-bold">{rate.maxWeight}g</span></span>
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
    const [purchasePrice, setPurchasePrice] = useState('');
    const [purchaseQty, setPurchaseQty] = useState('');
    const [purchaseUnit, setPurchaseUnit] = useState('kg');
    const [editingMaterial, setEditingMaterial] = useState(null);
    const [density, setDensity] = useState('1'); 
    const [weightPerPiece, setWeightPerPiece] = useState(''); 
    const [category, setCategory] = useState('component');

    const resetForm = () => {
        setName(''); setPurchasePrice(''); setPurchaseQty(''); setPurchaseUnit('kg'); 
        setDensity('1'); setWeightPerPiece(''); setEditingMaterial(null); setCategory('component');
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
        setEditingMaterial(material); setName(material.name); setPurchasePrice(material.purchasePrice);
        setPurchaseQty(material.purchaseQty); setPurchaseUnit(material.purchaseUnit);
        setDensity(material.density || '1');
        setWeightPerPiece(material.weightPerPiece || '');
        setCategory(material.category || 'component');
    };

    const productComponents = useMemo(() => materials.filter(m => !m.category || m.category === 'component'), [materials]);
    const packagingComponents = useMemo(() => materials.filter(m => m.category === 'packaging'), [materials]);

    return (
        <div className="bg-gray-800 p-6 rounded-2xl">
            <h3 className="text-xl font-bold mb-4">Matières Premières & Emballages</h3>
            <form onSubmit={handleSubmit} className="space-y-4 mb-6">
                <div>
                    <label className="text-sm text-gray-400">Catégorie</label>
                    <div className="flex gap-2 p-1 bg-gray-900 rounded-lg mt-1">
                        <button type="button" onClick={() => setCategory('component')} className={`flex-1 py-1.5 rounded-md text-sm font-semibold ${category === 'component' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>Composant Produit</button>
                        <button type="button" onClick={() => setCategory('packaging')} className={`flex-1 py-1.5 rounded-md text-sm font-semibold ${category === 'packaging' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>Matériel d'Emballage</button>
                    </div>
                </div>
                <div>
                    <label className="text-sm text-gray-400">Nom</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={category === 'component' ? "Ex: Cire de Soja" : "Ex: Carton d'expédition 15x15"} className="w-full bg-gray-700 p-2 rounded-lg mt-1" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-10 gap-4 items-end">
                    <div className="sm:col-span-3"><label className="text-sm text-gray-400">Prix total (€)</label><input type="number" step="0.01" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} placeholder="169.90" className="w-full bg-gray-700 p-2 rounded-lg mt-1" /></div>
                    <div className="sm:col-span-2"><label className="text-sm text-gray-400">Qté achetée</label><input type="number" step="0.01" value={purchaseQty} onChange={e => setPurchaseQty(e.target.value)} placeholder="20" className="w-full bg-gray-700 p-2 rounded-lg mt-1" /></div>
                    <div className="sm:col-span-2"><label className="text-sm text-gray-400">Unité</label><select value={purchaseUnit} onChange={e => setPurchaseUnit(e.target.value)} className="w-full bg-gray-700 p-2 rounded-lg mt-1 h-[42px]"><option value="kg">kg</option><option value="g">g</option><option value="L">L</option><option value="ml">ml</option><option value="piece">pièce(s)</option></select></div>
                    {(purchaseUnit === 'L' || purchaseUnit === 'ml') && <div className="sm:col-span-3"><label className="text-sm text-gray-400">Densité (g/ml)</label><input type="number" step="0.01" value={density} onChange={e => setDensity(e.target.value)} className="w-full bg-gray-700 p-2 rounded-lg mt-1" /></div>}
                    {purchaseUnit === 'piece' && <div className="sm:col-span-3"><label className="text-sm text-gray-400">Poids / pièce (g)</label><input type="number" step="0.1" value={weightPerPiece} onChange={e => setWeightPerPiece(e.target.value)} placeholder="ex: 250" className="w-full bg-gray-700 p-2 rounded-lg mt-1" /></div>}
                    <button type="submit" className="bg-indigo-600 py-2 px-4 rounded-lg flex items-center justify-center gap-2 h-[42px] sm:col-span-3 sm:col-start-8">
                        {editingMaterial ? <Save size={18}/> : <PlusCircle size={18}/>} {editingMaterial ? 'Enregistrer' : 'Ajouter'}
                    </button>
                </div>
                {editingMaterial && <div className="flex justify-end"><button type="button" onClick={resetForm} className="bg-gray-600 py-2 px-4 rounded-lg">Annuler</button></div>}
            </form>

            {[
                { title: "Composants de Produit", items: productComponents },
                { title: "Matériels d'Emballage", items: packagingComponents }
            ].map(section => (
                <div key={section.title} className="mt-6">
                    <h4 className="text-lg font-semibold mb-2">{section.title}</h4>
                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead><tr className="border-b border-gray-700 text-xs uppercase text-gray-400"><th className="p-2">Nom</th><th className="p-2">Coût standardisé</th><th className="p-2 text-center">Actions</th></tr></thead>
                            <tbody>
                                {section.items.map(mat => (
                                    <tr key={mat.id} className="border-b border-gray-700/50">
                                        <td className="p-2 font-semibold">{mat.name}</td>
                                        <td className="p-2 font-mono text-xs text-indigo-300">
                                            {(mat.standardizedUnit === 'g' || mat.standardizedUnit === 'ml')
                                                ? `${formatPrice(mat.standardizedPrice * 100)} / 100${mat.standardizedUnit}`
                                                : `${formatPrice(mat.standardizedPrice)} / ${mat.standardizedUnit}`
                                            }
                                            {mat.weightPerPiece && ` (${mat.weightPerPiece}g)`}
                                        </td>
                                        <td className="p-2 flex justify-center gap-2">
                                            <button onClick={() => onSelect(mat)} className="text-green-400 p-1 hover:bg-gray-700 rounded" title="Ajouter au calcul"><PlusCircle size={18}/></button>
                                            <button onClick={() => startEditing(mat)} className="text-yellow-400 p-1 hover:bg-gray-700 rounded" title="Modifier"><Edit size={18}/></button>
                                            <button onClick={() => handleDelete(mat.id)} className="text-red-500 p-1 hover:bg-gray-700 rounded" title="Supprimer"><Trash2 size={18}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
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
    const [packagingItems, setPackagingItems] = useState([]);
    const [productName, setProductName] = useState('');
    const [editingCalcId, setEditingCalcId] = useState(null);
    const [isShippingVisible, setIsShippingVisible] = useState(false);
    const [isFinancialsVisible, setIsFinancialsVisible] = useState(false);
    const [isExpensesVisible, setIsExpensesVisible] = useState(false);
    
    const [marginMultiplier, setMarginMultiplier] = useState(2.5);
    const [tvaRate, setTvaRate] = useState(20);
    const chargesRate = 13.30;
    const [feesRate, setFeesRate] = useState(1.75);
    const [depotCommissionRate, setDepotCommissionRate] = useState(30);
    const [manualTtcPrice, setManualTtcPrice] = useState('0.00');

    const availableTvaRates = [20, 10, 5.5, 0];

    useEffect(() => {
        const qMats = query(collection(db, 'rawMaterials'), orderBy('name'));
        const unsubMats = onSnapshot(qMats, (snap) => setRawMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const qRates = query(collection(db, 'shippingRates'), orderBy('maxWeight'));
        const unsubRates = onSnapshot(qRates, (snap) => setShippingRates(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const qCalcs = query(collection(db, 'productsCosts'), orderBy('productName'));
        const unsubCalcs = onSnapshot(qCalcs, (snap) => setSavedCalculations(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => { unsubMats(); unsubRates(); unsubCalcs(); };
    }, []);

    const handleAddMaterialToCalculation = (material) => {
        const targetList = material.category === 'packaging' ? packagingItems : recipeItems;
        const setTargetList = material.category === 'packaging' ? setPackagingItems : setRecipeItems;
        
        if (targetList.find(item => item.materialId === material.id)) {
            showToast("Cet élément est déjà dans la liste.", "info"); return;
        }
        setTargetList(prev => [...prev, { materialId: material.id, ...material, quantity: 1 }]);
    };

    const handleQuantityChange = (list, setList, materialId, newQuantity) => {
        setList(items => items.map(item => item.materialId === materialId ? { ...item, quantity: parseFloat(newQuantity) || 0 } : item));
    };

    const handleRemoveItem = (setList, materialId) => {
        setList(items => items.filter(item => item.materialId !== materialId));
    };

    const calculateForMode = (mode, commonData) => {
        const { recipe, packaging, margin, tva, charges, fees, depotCommission, shipping } = commonData;

        const productCost = recipe.reduce((acc, item) => acc + (item.standardizedPrice * item.quantity), 0);
        const packagingCost = packaging.reduce((acc, item) => acc + (item.standardizedPrice * item.quantity), 0);
        const productPriceHT = productCost * margin;
        const productPriceTTC = productPriceHT * (1 + tva / 100);

        let finalClientPrice = productPriceTTC;
        let shippingProviderCost = 0;
        let totalExpenses = 0;
        let finalProfit = 0;
        let transactionFees = 0;
        let businessCharges = 0;
        let commissionAmount = 0;

        if (mode === 'internet') {
            const productWeight = recipe.reduce((acc, item) => acc + (item.weightPerPiece || (item.density || 1)) * item.quantity, 0);
            const packagingWeight = packaging.reduce((acc, item) => acc + (item.weightPerPiece || 0) * item.quantity, 0);
            const finalPackageWeight = productWeight + packagingWeight;
            const applicableRate = shipping.find(rate => finalPackageWeight <= rate.maxWeight);
            shippingProviderCost = applicableRate ? applicableRate.cost : 0;
            const shippingCustomerPrice = applicableRate ? applicableRate.price : 0;
            finalClientPrice = productPriceTTC + shippingCustomerPrice;
            transactionFees = finalClientPrice * (fees / 100);
            businessCharges = productPriceHT * (charges / 100);
            totalExpenses = productCost + packagingCost + shippingProviderCost + transactionFees + businessCharges;
            finalProfit = finalClientPrice - totalExpenses;
        } else if (mode === 'domicile') {
            transactionFees = finalClientPrice * (fees / 100);
            businessCharges = productPriceHT * (charges / 100);
            totalExpenses = productCost + transactionFees + businessCharges;
            finalProfit = finalClientPrice - totalExpenses;
        } else if (mode === 'depot') {
            commissionAmount = productPriceTTC * (depotCommission / 100);
            const netRevenueHT = productPriceHT * (1 - (depotCommission / (1 + tva/100) ) / 100);
            businessCharges = netRevenueHT * (charges / 100);
            totalExpenses = productCost + commissionAmount + businessCharges;
            finalProfit = productPriceTTC - totalExpenses;
        }
        
        return { productCost, packagingCost, productPriceHT, productPriceTTC, finalClientPrice, totalExpenses, finalProfit, transactionFees, businessCharges, shippingProviderCost, commissionAmount };
    };

    const calculations = useMemo(() => {
        const commonData = {
            recipe: recipeItems, packaging: packagingItems, margin: marginMultiplier,
            tva: tvaRate, charges: chargesRate, fees: feesRate,
            depotCommission: depotCommissionRate, shipping: shippingRates
        };
        return calculateForMode(saleMode, commonData);
    }, [recipeItems, packagingItems, marginMultiplier, tvaRate, feesRate, depotCommissionRate, shippingRates, saleMode]);

    useEffect(() => {
        setManualTtcPrice(calculations.productPriceTTC.toFixed(2));
    }, [calculations.productPriceTTC]);
    
    const handleManualTtcPriceChange = (e) => {
        const newTtcPriceString = e.target.value;
        setManualTtcPrice(newTtcPriceString);
        
        const newTtcPrice = parseFloat(newTtcPriceString);

        if (!isNaN(newTtcPrice) && newTtcPrice >= 0 && calculations.productCost > 0) {
            const newHtPrice = newTtcPrice / (1 + tvaRate / 100);
            const newMultiplier = newHtPrice / calculations.productCost;
            setMarginMultiplier(newMultiplier);
        }
    };

    const handleSaveCost = async () => {
        if (!productName || recipeItems.length === 0) {
            showToast("Veuillez nommer le produit et ajouter au moins un composant.", "error"); return;
        }
        
        const commonData = {
            recipe: recipeItems, packaging: packagingItems, margin: marginMultiplier,
            tva: tvaRate, charges: chargesRate, fees: feesRate,
            depotCommission: depotCommissionRate, shipping: shippingRates
        };

        const resultsByMode = {
            internet: calculateForMode('internet', commonData),
            domicile: calculateForMode('domicile', commonData),
            depot: calculateForMode('depot', commonData)
        };

        const dataToSave = {
            productName, 
            items: recipeItems.map(({ id, createdAt, ...item }) => item),
            packagingItems: packagingItems.map(({ id, createdAt, ...item }) => item),
            marginMultiplier, tvaRate, feesRate, depotCommissionRate,
            resultsByMode, 
            updatedAt: serverTimestamp()
        };

        try {
            if (editingCalcId) {
                await updateDoc(doc(db, 'productsCosts', editingCalcId), dataToSave);
                showToast(`"${productName}" mis à jour avec succès !`, "success");
            } else {
                await addDoc(collection(db, 'productsCosts'), { ...dataToSave, createdAt: serverTimestamp() });
                showToast(`"${productName}" enregistré avec succès !`, "success");
            }
            setProductName(''); setRecipeItems([]); setPackagingItems([]); setEditingCalcId(null);
        } catch (error) { console.error(error); showToast("Erreur lors de la sauvegarde.", "error"); }
    };

    const handleLoadCalculation = (calc) => {
        setProductName(calc.productName);
        setRecipeItems(calc.items || []);
        setPackagingItems(calc.packagingItems || []);
        setMarginMultiplier(calc.marginMultiplier || 2.5);
        setTvaRate(calc.tvaRate !== undefined ? calc.tvaRate : 20);
        setFeesRate(calc.feesRate || 1.75);
        setDepotCommissionRate(calc.depotCommissionRate || 30);
        setEditingCalcId(calc.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteCalculation = async (calcId) => {
        if (window.confirm("Supprimer ce calcul sauvegardé ?")) {
            await deleteDoc(doc(db, 'productsCosts', calcId));
            showToast("Calcul supprimé.", "success");
        }
    };
    
    const renderTabs = () => (
        <div className="mb-8 p-1.5 bg-gray-900/50 rounded-xl flex gap-2">
            {[{id: 'internet', label: 'Vente par Internet', icon: Globe}, {id: 'domicile', label: 'Vente Domicile', icon: Home}, {id: 'depot', label: 'Dépôt-Vente', icon: StoreIcon}].map(tab => (
                 <button key={tab.id} onClick={() => setSaleMode(tab.id)} className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-semibold transition-colors ${saleMode === tab.id ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>
                    <tab.icon size={18}/> {tab.label}
                </button>
            ))}
        </div>
    );

    const ItemList = ({ title, icon: Icon, items, setList, onQuantityChange }) => (
         <div className="bg-gray-800 p-6 rounded-2xl">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Icon size={22} /> {title}</h3>
             {items.length > 0 && (
                <div className="grid grid-cols-[1fr_100px_40px_auto] gap-3 items-center px-2 text-xs text-gray-400 uppercase font-semibold mb-2">
                    <span>Élément</span>
                    <span className="text-center">Quantité</span>
                    <span>Unité</span>
                    <span></span>
                </div>
            )}
            <div className="space-y-2">
                {items.map(item => (
                    <div key={item.materialId} className="grid grid-cols-[1fr_100px_40px_auto] gap-3 items-center bg-gray-900/50 p-2 rounded">
                        <div className="font-semibold truncate pr-2">{item.name}</div>
                        <input type="number" step="0.1" value={item.quantity} onChange={e => onQuantityChange(items, setList, item.materialId, e.target.value)} className="w-full bg-gray-700 p-1 rounded text-center"/>
                        <span className="text-xs text-gray-400">{item.standardizedUnit}</span>
                        <button onClick={() => handleRemoveItem(setList, item.materialId)} className="text-red-500 p-1"><X size={16}/></button>
                    </div>
                ))}
                {items.length === 0 && <p className="text-center text-gray-500 py-4">Ajoutez un élément depuis la bibliothèque de matières.</p>}
            </div>
        </div>
    );

    const ExpenseDetailRow = ({ label, value, tooltip }) => (
        <div className="flex justify-between items-center p-1">
            <span className="flex items-center gap-1.5">
                {label}
                <Info size={14} className="text-gray-500" title={tooltip} />
            </span>
            <span>{formatPrice(value)}</span>
        </div>
    );

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            <h2 className="text-3xl font-bold text-white mb-6">Calculateur de Coût de Production</h2>
            {renderTabs()}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-8">
                    <div className="bg-gray-800 p-6 rounded-2xl">
                        <h3 className="text-xl font-bold mb-4">Informations Générales</h3>
                        <input type="text" value={productName} onChange={e => setProductName(e.target.value)} placeholder="Nom du produit" className="w-full bg-gray-700 p-2 rounded-lg"/>
                    </div>
                    
                    <ItemList title="Composition du Produit Fini" icon={X} items={recipeItems} setList={setRecipeItems} onQuantityChange={handleQuantityChange} />
                    {saleMode === 'internet' && <ItemList title="Emballage pour l'expédition" icon={Box} items={packagingItems} setList={setPackagingItems} onQuantityChange={handleQuantityChange} />}
                    <RawMaterialManager materials={rawMaterials} onSelect={handleAddMaterialToCalculation} />
                </div>
                <div className="space-y-8">
                    <div className="bg-gray-800 p-6 rounded-2xl">
                        <button onClick={() => setIsFinancialsVisible(!isFinancialsVisible)} className="w-full flex justify-between items-center text-left">
                            <h3 className="text-xl font-bold flex items-center gap-2"><Percent size={22}/> Paramètres Financiers</h3>
                            <ChevronDown className={`transform transition-transform ${isFinancialsVisible ? 'rotate-180' : ''}`} />
                        </button>
                        {isFinancialsVisible && 
                             <div className="mt-4 border-t border-gray-700 pt-4 animate-fade-in space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm text-gray-400">Multiplicateur de Marge</label>
                                        <input type="number" step="0.01" value={marginMultiplier} onChange={e => setMarginMultiplier(parseFloat(e.target.value))} className="w-full bg-gray-700 p-2 rounded-lg mt-1" />
                                    </div>
                                     <div>
                                        <label className="text-sm text-gray-400">Prix de Vente (TTC)</label>
                                        <input type="number" step="0.01" value={manualTtcPrice} onChange={handleManualTtcPriceChange} className="w-full bg-gray-700 p-2 rounded-lg mt-1" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400 block mb-2">TVA (%)</label>
                                    <div className="flex gap-2 p-1 bg-gray-900 rounded-lg">
                                        {availableTvaRates.map(rate => (
                                            <button key={rate} onClick={() => setTvaRate(rate)} className={`flex-1 py-1.5 rounded-md text-sm font-semibold ${tvaRate === rate ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>{rate}%</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="text-sm text-gray-400">Frais (Sumup, Stripe...) %</label><input type="number" step="0.1" value={feesRate} onChange={e => setFeesRate(parseFloat(e.target.value))} className="w-full bg-gray-700 p-2 rounded-lg mt-1" /></div>
                                    <div><label className="text-sm text-gray-400">Commission Dépôt-Vente %</label><input type="number" step="1" value={depotCommissionRate} onChange={e => setDepotCommissionRate(parseFloat(e.target.value))} className="w-full bg-gray-700 p-2 rounded-lg mt-1" /></div>
                                </div>
                            </div>
                        }
                    </div>
                    {saleMode === 'internet' && (
                        <div className="bg-gray-800 p-6 rounded-2xl">
                            <button onClick={() => setIsShippingVisible(!isShippingVisible)} className="w-full flex justify-between items-center text-left">
                                <h3 className="text-xl font-bold flex items-center gap-2"><Ship size={22}/> Grille Tarifaire d'Expédition</h3>
                                <ChevronDown className={`transform transition-transform ${isShippingVisible ? 'rotate-180' : ''}`} />
                            </button>
                            {isShippingVisible && <div className="mt-4 border-t border-gray-700 pt-4 animate-fade-in"><ShippingRateManager rates={shippingRates} /></div>}
                        </div>
                    )}
                    <div className="bg-gray-800 p-6 rounded-2xl h-fit sticky top-24">
                        <h3 className="text-xl font-bold mb-4">Résultats du Calcul ({saleMode})</h3>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center p-2"><span className="text-gray-400">Coût de Production</span><span className="font-bold text-lg text-yellow-400">{formatPrice(calculations.productCost)}</span></div>
                            <hr className="border-gray-700"/>
                            <div className="flex justify-between items-center p-2"><span className="text-gray-300">Prix Produit (TTC)</span><span className="font-bold text-lg text-white">{formatPrice(calculations.productPriceTTC)}</span></div>
                            <div className="flex justify-between items-center p-2 font-semibold bg-gray-900/50 rounded-md"><span className="text-gray-200">Total Facturé au Client</span><span className="text-xl text-white">{formatPrice(calculations.finalClientPrice)}</span></div>
                            <hr className="border-gray-700"/>
                            
                            <button onClick={() => setIsExpensesVisible(!isExpensesVisible)} className="w-full flex justify-between items-center text-left p-2 text-red-400">
                                <span className="font-semibold">- Dépenses Totales</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold">{formatPrice(calculations.totalExpenses)}</span>
                                    <ChevronDown className={`transform transition-transform ${isExpensesVisible ? 'rotate-180' : ''}`} size={18} />
                                </div>
                            </button>
                            
                            {isExpensesVisible && (
                                <div className="pl-6 border-l-2 border-gray-700 text-sm text-red-400/80 animate-fade-in">
                                    <ExpenseDetailRow label="Coût matières" value={calculations.productCost} tooltip="Coût total des composants du produit." />
                                    {saleMode === 'internet' && <ExpenseDetailRow label="Coût emballage" value={calculations.packagingCost} tooltip="Coût du carton, étiquettes, etc." />}
                                    {saleMode === 'internet' && <ExpenseDetailRow label="Coût expédition" value={calculations.shippingProviderCost} tooltip="Ce que vous payez réellement au transporteur." />}
                                    {(saleMode === 'internet' || saleMode === 'domicile') && <ExpenseDetailRow label="Frais de transaction" value={calculations.transactionFees} tooltip={`Commission du processeur de paiement (${feesRate}%) sur le total facturé.`} />}
                                    {saleMode === 'depot' && <ExpenseDetailRow label="Commission dépôt" value={calculations.commissionAmount} tooltip={`Commission du dépôt-vente (${depotCommissionRate}%) sur le prix de vente TTC.`} />}
                                    <ExpenseDetailRow label="Cotisations URSSAF" value={calculations.businessCharges} tooltip={`Cotisations sociales (${chargesRate}%) calculées sur le chiffre d'affaires HT (après déduction de la commission pour les dépôts).`} />
                                </div>
                            )}

                            <div className="flex justify-between items-center bg-green-500/10 p-4 rounded-lg border border-green-500/30 mt-4">
                                <span className="text-green-300 font-semibold">Bénéfice Net Final</span>
                                <span className="font-bold text-3xl text-green-400">{formatPrice(calculations.finalProfit)}</span>
                            </div>
                        </div>
                        <div className="mt-8 flex justify-end">
                             <button onClick={handleSaveCost} disabled={!productName || recipeItems.length === 0} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg flex items-center gap-2 disabled:opacity-50"><Save size={18}/> {editingCalcId ? 'Mettre à jour' : 'Enregistrer le calcul'}</button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="mt-12 bg-gray-800 p-6 rounded-2xl">
                 <h3 className="text-xl font-bold mb-4">Bibliothèque de Produits Calculés</h3>
                 <div className="space-y-3">
                    {savedCalculations.map(calc => (
                        <div key={calc.id} className="bg-gray-900/50 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4">
                            <p className="font-bold text-lg w-full sm:w-1/4">{calc.productName}</p>
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center w-full">
                                <div><span className="text-xs text-cyan-400">Bénéf. Internet</span><p className="font-semibold">{formatPrice(calc.resultsByMode?.internet?.finalProfit || 0)}</p></div>
                                <div><span className="text-xs text-purple-400">Bénéf. Domicile</span><p className="font-semibold">{formatPrice(calc.resultsByMode?.domicile?.finalProfit || 0)}</p></div>
                                <div><span className="text-xs text-pink-400">Bénéf. Dépôt</span><p className="font-semibold">{formatPrice(calc.resultsByMode?.depot?.finalProfit || 0)}</p></div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleLoadCalculation(calc)} className="p-2 text-blue-400 hover:bg-gray-700 rounded-lg flex items-center gap-2 text-sm"><RefreshCw size={16}/> Recharger</button>
                                <button onClick={() => handleDeleteCalculation(calc.id)} className="p-2 text-red-500 hover:bg-gray-700 rounded-lg"><Trash2 size={18}/></button>
                            </div>
                        </div>
                    ))}
                    {savedCalculations.length === 0 && <p className="text-center text-gray-500 py-4">Aucun calcul sauvegardé pour le moment.</p>}
                 </div>
            </div>
        </div>
    );
};

export default CostCalculator;
