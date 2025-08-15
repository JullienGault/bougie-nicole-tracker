// src/views/CostCalculator.jsx
import React, { useState, useEffect, useMemo, useContext } from 'react';
import { db, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, where } from '../services/firebase';
import { AppContext } from '../contexts/AppContext';
import { PlusCircle, Trash2, Save, X, Edit, Calculator, Ship, Banknote, Percent } from 'lucide-react';
import { formatPrice } from '../utils/formatters';


// --- Sous-composant pour la Grille Tarifaire ---
const ShippingRateManager = ({ rates, onRatesChange }) => {
    const { showToast } = useContext(AppContext);
    const [maxWeight, setMaxWeight] = useState('');
    const [price, setPrice] = useState('');
    const [editingId, setEditingId] = useState(null);

    const handleSaveRate = async () => {
        const weight = parseInt(maxWeight, 10);
        const ratePrice = parseFloat(price);
        if (isNaN(weight) || weight <= 0 || isNaN(ratePrice) || ratePrice < 0) {
            showToast("Veuillez entrer un poids et un prix valides.", "error"); return;
        }
        try {
            if (editingId) {
                await updateDoc(doc(db, 'shippingRates', editingId), { maxWeight: weight, price: ratePrice });
                showToast("Tarif mis à jour.", "success");
            } else {
                await addDoc(collection(db, 'shippingRates'), { maxWeight: weight, price: ratePrice });
                showToast("Nouveau tarif ajouté.", "success");
            }
            setMaxWeight(''); setPrice(''); setEditingId(null);
        } catch (error) { showToast("Erreur lors de la sauvegarde du tarif.", "error"); }
    };

    const handleDeleteRate = async (rateId) => {
        if (window.confirm("Supprimer ce tarif ?")) {
            await deleteDoc(doc(db, 'shippingRates', rateId));
            showToast("Tarif supprimé.", "success");
        }
    };
    
    return (
        <div className="bg-gray-800 p-6 rounded-2xl">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Ship size={22}/> Grille Tarifaire d'Expédition</h3>
             <div className="grid grid-cols-3 gap-4 items-end mb-4">
                <div>
                    <label className="text-sm text-gray-400">Poids max (g)</label>
                    <input type="number" value={maxWeight} onChange={e => setMaxWeight(e.target.value)} placeholder="500" className="w-full bg-gray-700 p-2 rounded-lg mt-1" />
                </div>
                <div>
                    <label className="text-sm text-gray-400">Prix (€)</label>
                    <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="5.90" className="w-full bg-gray-700 p-2 rounded-lg mt-1" />
                </div>
                <button onClick={handleSaveRate} className="bg-indigo-600 py-2 px-4 rounded-lg h-[42px]">{editingId ? 'Modifier' : 'Ajouter Tarif'}</button>
            </div>
            <div className="max-h-48 overflow-y-auto custom-scrollbar">
                {rates.map(rate => (
                    <div key={rate.id} className="flex justify-between items-center p-2 bg-gray-900/50 rounded mb-2">
                        <span>Jusqu'à <span className="font-bold">{rate.maxWeight}g</span></span>
                        <span className="font-semibold">{formatPrice(rate.price)}</span>
                        <div className="flex gap-2">
                           <button onClick={() => { setEditingId(rate.id); setMaxWeight(rate.maxWeight); setPrice(rate.price); }} className="text-yellow-400 p-1"><Edit size={16}/></button>
                           <button onClick={() => handleDeleteRate(rate.id)} className="text-red-500 p-1"><Trash2 size={16}/></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Sous-composant pour les Matières Premières ---
const RawMaterialManager = ({ materials, onSelect }) => {
    const { showToast } = useContext(AppContext);
    const [name, setName] = useState('');
    const [purchasePrice, setPurchasePrice] = useState('');
    const [purchaseQty, setPurchaseQty] = useState('');
    const [purchaseUnit, setPurchaseUnit] = useState('kg');
    const [editingMaterial, setEditingMaterial] = useState(null);

    const resetForm = () => {
        setName(''); setPurchasePrice(''); setPurchaseQty(''); setPurchaseUnit('kg'); setEditingMaterial(null);
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
        const data = { name, purchasePrice: price, purchaseQty: qty, purchaseUnit, standardizedPrice, standardizedUnit };
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
    };

    return (
        <div className="bg-gray-800 p-6 rounded-2xl">
            <h3 className="text-xl font-bold mb-4">Matières Premières</h3>
            <form onSubmit={handleSubmit} className="space-y-3 mb-6">
                <div>
                    <label className="text-sm text-gray-400">Nom de la matière</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Cire de Soja" className="w-full bg-gray-700 p-2 rounded-lg mt-1" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="text-sm text-gray-400">Prix total (€)</label>
                        <input type="number" step="0.01" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} placeholder="169.90" className="w-full bg-gray-700 p-2 rounded-lg mt-1" />
                    </div>
                    <div>
                        <label className="text-sm text-gray-400">Qté achetée</label>
                        <input type="number" step="0.01" value={purchaseQty} onChange={e => setPurchaseQty(e.target.value)} placeholder="20" className="w-full bg-gray-700 p-2 rounded-lg mt-1" />
                    </div>
                    <div>
                        <label className="text-sm text-gray-400">Unité</label>
                        <select value={purchaseUnit} onChange={e => setPurchaseUnit(e.target.value)} className="w-full bg-gray-700 p-2 rounded-lg mt-1 h-[42px]">
                            <option value="kg">kg</option><option value="g">g</option><option value="L">L</option><option value="ml">ml</option><option value="piece">pièce(s)</option>
                        </select>
                    </div>
                    <button type="submit" className="bg-indigo-600 py-2 px-4 rounded-lg flex items-center justify-center gap-2 h-[42px]">
                        {editingMaterial ? <Save size={18}/> : <PlusCircle size={18}/>} {editingMaterial ? 'Enregistrer' : 'Ajouter'}
                    </button>
                </div>
                {editingMaterial && (
                    <div className="flex justify-end">
                        <button type="button" onClick={resetForm} className="bg-gray-600 py-2 px-4 rounded-lg">Annuler</button>
                    </div>
                )}
            </form>
            <div className="max-h-64 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left">
                     <thead><tr className="border-b border-gray-700 text-xs uppercase text-gray-400"><th className="p-2">Nom</th><th className="p-2">Prix d'achat</th><th className="p-2">Coût standardisé</th><th className="p-2 text-center">Actions</th></tr></thead>
                    <tbody>
                        {materials.map(mat => (
                            <tr key={mat.id} className="border-b border-gray-700/50">
                                <td className="p-2 font-semibold">{mat.name}</td>
                                <td className="p-2">{formatPrice(mat.purchasePrice)} pour {mat.purchaseQty} {mat.purchaseUnit}</td>
                                <td className="p-2 font-mono text-xs text-indigo-300">{formatPrice(mat.standardizedPrice)} / {mat.standardizedUnit}</td>
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
    );
};

// --- Composant Principal ---
const CostCalculator = () => {
    const { showToast } = useContext(AppContext);
    const [rawMaterials, setRawMaterials] = useState([]);
    const [shippingRates, setShippingRates] = useState([]);
    const [recipeItems, setRecipeItems] = useState([]);
    const [productName, setProductName] = useState('');
    const [finalPackageWeight, setFinalPackageWeight] = useState('');
    
    // Paramètres financiers
    const [marginMultiplier, setMarginMultiplier] = useState(2.5);
    const [tvaRate, setTvaRate] = useState(20);
    const [chargesRate, setChargesRate] = useState(22.2); // URSSAF, etc.
    const [feesRate, setFeesRate] = useState(2); // Stripe, Paypal, etc.

    useEffect(() => {
        const qMats = query(collection(db, 'rawMaterials'), orderBy('name'));
        const unsubMats = onSnapshot(qMats, (snap) => setRawMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const qRates = query(collection(db, 'shippingRates'), orderBy('maxWeight'));
        const unsubRates = onSnapshot(qRates, (snap) => setShippingRates(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => { unsubMats(); unsubRates(); };
    }, []);

    const handleAddMaterialToRecipe = (material) => {
        if (recipeItems.find(item => item.materialId === material.id)) {
            showToast("Cette matière est déjà dans la recette.", "info"); return;
        }
        setRecipeItems(prev => [...prev, { materialId: material.id, ...material, quantity: 1 }]);
    };
    const handleRecipeQuantityChange = (materialId, newQuantity) => setRecipeItems(items => items.map(item => item.materialId === materialId ? { ...item, quantity: parseFloat(newQuantity) || 0 } : item));
    const handleRemoveFromRecipe = (materialId) => setRecipeItems(items => items.filter(item => item.materialId !== materialId));

    const calculations = useMemo(() => {
        // 1. Calcul du coût de base du produit
        const productCost = recipeItems.reduce((acc, item) => acc + (item.standardizedPrice * item.quantity), 0);

        // 2. Calcul du prix de vente du produit
        const productPriceHT = productCost * marginMultiplier;
        const productPriceTTC = productPriceHT * (1 + tvaRate / 100);

        // 3. Calcul des frais de port
        let shippingCost = 0;
        const weight = parseFloat(finalPackageWeight);
        if (weight > 0 && shippingRates.length > 0) {
            const applicableRate = shippingRates.find(rate => weight <= rate.maxWeight);
            shippingCost = applicableRate ? applicableRate.price : 0;
        }

        // 4. Calcul du total pour le client
        const finalClientPrice = productPriceTTC + shippingCost;

        // 5. Calcul du bénéfice réel pour l'entreprise
        const transactionTotal = finalClientPrice;
        const transactionFees = transactionTotal * (feesRate / 100);
        const businessCharges = productPriceHT * (chargesRate / 100); // Charges sur le CA HT du produit

        const totalExpenses = productCost + transactionFees + businessCharges;
        const finalProfit = productPriceHT - totalExpenses;

        return { productCost, productPriceHT, productPriceTTC, shippingCost, finalClientPrice, transactionFees, businessCharges, finalProfit };
    }, [recipeItems, marginMultiplier, tvaRate, finalPackageWeight, shippingRates, chargesRate, feesRate]);

    const handleSaveCost = async () => {
        if (!productName || recipeItems.length === 0) {
            showToast("Veuillez nommer le produit et ajouter au moins une matière première.", "error"); return;
        }
        try {
            await addDoc(collection(db, 'productsCosts'), {
                productName, ...calculations,
                items: recipeItems.map(({ id, createdAt, ...item }) => item),
                createdAt: serverTimestamp()
            });
            showToast("Coût du produit enregistré avec succès !", "success");
            setProductName(''); setRecipeItems([]); setFinalPackageWeight('');
        } catch (error) { console.error(error); showToast("Erreur lors de la sauvegarde.", "error"); }
    };

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            <h2 className="text-3xl font-bold text-white mb-8">Calculateur de Coût de Production</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-8">
                    <div className="bg-gray-800 p-6 rounded-2xl">
                        <h3 className="text-xl font-bold mb-4">Composition du Produit Fini</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                            <input type="text" value={productName} onChange={e => setProductName(e.target.value)} placeholder="Nom du produit" className="w-full bg-gray-700 p-2 rounded-lg sm:col-span-2"/>
                            <input type="number" value={finalPackageWeight} onChange={e => setFinalPackageWeight(e.target.value)} placeholder="Poids colis (g)" className="w-full bg-gray-700 p-2 rounded-lg" />
                        </div>
                        <div className="space-y-2">
                            {recipeItems.map(item => (
                                <div key={item.materialId} className="grid grid-cols-12 gap-2 items-center bg-gray-900/50 p-2 rounded">
                                    <div className="col-span-6 font-semibold">{item.name}</div>
                                    <div className="col-span-5 flex items-center gap-2">
                                        <input type="number" step="0.1" value={item.quantity} onChange={e => handleRecipeQuantityChange(item.materialId, e.target.value)} className="w-full bg-gray-700 p-1 rounded text-center"/>
                                        <span className="text-xs text-gray-400">{item.standardizedUnit}</span>
                                    </div>
                                    <div className="col-span-1 text-right"><button onClick={() => handleRemoveFromRecipe(item.materialId)} className="text-red-500 p-1"><X size={16}/></button></div>
                                </div>
                            ))}
                             {recipeItems.length === 0 && <p className="text-center text-gray-500 py-4">Utilisez le bouton <PlusCircle size={16} className="inline-block text-green-400"/> pour ajouter une matière.</p>}
                        </div>
                    </div>
                    <ShippingRateManager rates={shippingRates} />
                    <RawMaterialManager materials={rawMaterials} onSelect={handleAddMaterialToRecipe} />
                </div>

                <div className="bg-gray-800 p-6 rounded-2xl h-fit sticky top-24">
                    <h3 className="text-xl font-bold mb-6">Paramètres & Résultats</h3>
                    <div className="space-y-4">
                        <div className="bg-gray-900/50 p-4 rounded-lg">
                            <h4 className="font-semibold text-lg mb-3 text-indigo-300">Paramètres Financiers</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-sm text-gray-400">Marge / Multiplicateur</label><input type="number" step="0.1" value={marginMultiplier} onChange={e => setMarginMultiplier(parseFloat(e.target.value))} className="w-full bg-gray-700 p-2 rounded-lg mt-1" /></div>
                                <div><label className="text-sm text-gray-400">TVA (%)</label><input type="number" step="1" value={tvaRate} onChange={e => setTvaRate(parseFloat(e.target.value))} className="w-full bg-gray-700 p-2 rounded-lg mt-1" /></div>
                                <div><label className="text-sm text-gray-400">Cotisations (URSSAF...) %</label><input type="number" step="0.1" value={chargesRate} onChange={e => setChargesRate(parseFloat(e.target.value))} className="w-full bg-gray-700 p-2 rounded-lg mt-1" /></div>
                                <div><label className="text-sm text-gray-400">Frais bancaires %</label><input type="number" step="0.1" value={feesRate} onChange={e => setFeesRate(parseFloat(e.target.value))} className="w-full bg-gray-700 p-2 rounded-lg mt-1" /></div>
                            </div>
                        </div>

                        <div className="space-y-2 pt-4">
                            <div className="flex justify-between items-center p-2"><span className="text-gray-400">Coût de Production</span><span className="font-bold text-lg text-gray-300">{formatPrice(calculations.productCost)}</span></div>
                            <hr className="border-gray-700"/>
                            <div className="flex justify-between items-center p-2"><span className="text-gray-300">Prix de Vente Produit (TTC)</span><span className="font-bold text-lg text-white">{formatPrice(calculations.productPriceTTC)}</span></div>
                            <div className="flex justify-between items-center p-2"><span className="text-gray-300">Frais d'expédition</span><span className="font-bold text-lg text-cyan-400">{formatPrice(calculations.shippingCost)}</span></div>
                            <div className="flex justify-between items-center p-2 font-semibold bg-gray-900/50 rounded-md"><span className="text-gray-200">Total Facturé au Client</span><span className="text-xl text-white">{formatPrice(calculations.finalClientPrice)}</span></div>
                            <hr className="border-gray-700"/>
                            <div className="flex justify-between items-center p-2 text-red-400 text-sm"><span >- Dépenses (Matières + Frais)</span><span>{formatPrice(calculations.productCost + calculations.transactionFees)}</span></div>
                            <div className="flex justify-between items-center p-2 text-red-400 text-sm"><span >- Cotisations (-{chargesRate}%)</span><span>{formatPrice(calculations.businessCharges)}</span></div>
                            
                            <div className="flex justify-between items-center bg-green-500/10 p-4 rounded-lg border border-green-500/30 mt-4">
                                <span className="text-green-300 font-semibold">Bénéfice Net (par produit)</span>
                                <span className="font-bold text-3xl text-green-400">{formatPrice(calculations.finalProfit)}</span>
                            </div>
                        </div>
                    </div>
                     <div className="mt-8 flex justify-end">
                        <button onClick={handleSaveCost} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg flex items-center gap-2"><Save size={18}/> Enregistrer ce calcul</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CostCalculator;
