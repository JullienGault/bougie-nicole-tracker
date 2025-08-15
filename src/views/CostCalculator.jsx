// src/views/CostCalculator.jsx
import React, { useState, useEffect, useMemo, useContext } from 'react';
import { db, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from '../services/firebase';
import { AppContext } from '../contexts/AppContext';
import { PlusCircle, Trash2, Save, X, Edit, Calculator } from 'lucide-react';
import { formatPrice } from '../utils/formatters';

// Sous-composant pour gérer les matières premières
const RawMaterialManager = ({ materials, onSelect }) => {
    const { showToast } = useContext(AppContext);
    const [name, setName] = useState('');
    const [purchasePrice, setPurchasePrice] = useState('');
    const [purchaseQty, setPurchaseQty] = useState('');
    const [purchaseUnit, setPurchaseUnit] = useState('kg');
    const [editingMaterial, setEditingMaterial] = useState(null);

    const resetForm = () => {
        setName('');
        setPurchasePrice('');
        setPurchaseQty('');
        setPurchaseUnit('kg');
        setEditingMaterial(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const price = parseFloat(purchasePrice);
        const qty = parseFloat(purchaseQty);

        if (!name || isNaN(price) || price <= 0 || isNaN(qty) || qty <= 0) {
            showToast("Veuillez renseigner tous les champs avec des valeurs valides.", "error");
            return;
        }

        let standardizedPrice = 0;
        let standardizedUnit = '';

        // Standardisation du prix pour le calcul (toujours par g, ml, ou pièce)
        switch (purchaseUnit) {
            case 'kg':
                standardizedPrice = price / (qty * 1000);
                standardizedUnit = 'g';
                break;
            case 'g':
                standardizedPrice = price / qty;
                standardizedUnit = 'g';
                break;
            case 'L':
                standardizedPrice = price / (qty * 1000);
                standardizedUnit = 'ml';
                break;
            case 'ml':
                standardizedPrice = price / qty;
                standardizedUnit = 'ml';
                break;
            case 'piece':
            default:
                standardizedPrice = price / qty;
                standardizedUnit = 'piece';
                break;
        }

        const data = {
            name,
            purchasePrice: price,
            purchaseQty: qty,
            purchaseUnit,
            standardizedPrice,
            standardizedUnit
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
        } catch (error) {
            showToast("Une erreur est survenue.", "error");
        }
    };

    const handleDelete = async (materialId) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer cette matière première ?")) {
            try {
                await deleteDoc(doc(db, 'rawMaterials', materialId));
                showToast("Matière première supprimée.", "success");
            } catch (error) {
                showToast("Erreur lors de la suppression.", "error");
            }
        }
    };

    const startEditing = (material) => {
        setEditingMaterial(material);
        setName(material.name);
        setPurchasePrice(material.purchasePrice);
        setPurchaseQty(material.purchaseQty);
        setPurchaseUnit(material.purchaseUnit);
    };

    return (
        <div className="bg-gray-800 p-6 rounded-2xl">
            <h3 className="text-xl font-bold mb-4">Matières Premières</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 items-end">
                <div className="md:col-span-2">
                    <label className="text-sm text-gray-400">Nom de la matière</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Cire de Soja" className="w-full bg-gray-700 p-2 rounded-lg mt-1" />
                </div>
                <div className="flex-grow">
                    <label className="text-sm text-gray-400">Prix total d'achat (€)</label>
                    <input type="number" step="0.01" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} placeholder="169.90" className="w-full bg-gray-700 p-2 rounded-lg mt-1" />
                </div>
                <div className="flex gap-2">
                    <div className="flex-grow">
                        <label className="text-sm text-gray-400">Qté achetée</label>
                        <input type="number" step="0.01" value={purchaseQty} onChange={e => setPurchaseQty(e.target.value)} placeholder="20" className="w-full bg-gray-700 p-2 rounded-lg mt-1" />
                    </div>
                     <div>
                        <label className="text-sm text-gray-400">Unité</label>
                        <select value={purchaseUnit} onChange={e => setPurchaseUnit(e.target.value)} className="w-full bg-gray-700 p-2 rounded-lg mt-1 h-[42px]">
                            <option value="kg">kg</option><option value="g">g</option><option value="L">L</option><option value="ml">ml</option><option value="piece">pièce(s)</option>
                        </select>
                    </div>
                </div>
                <div className="md:col-span-4 flex justify-end gap-2">
                    {editingMaterial && <button type="button" onClick={resetForm} className="bg-gray-600 py-2 px-4 rounded-lg">Annuler</button>}
                    <button type="submit" className="bg-indigo-600 py-2 px-4 rounded-lg flex items-center gap-2">{editingMaterial ? <Save size={18}/> : <PlusCircle size={18}/>} {editingMaterial ? 'Enregistrer' : 'Ajouter'}</button>
                </div>
            </form>

            <div className="max-h-64 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-gray-700 text-xs uppercase text-gray-400">
                            <th className="p-2">Nom</th>
                            <th className="p-2">Prix d'achat</th>
                            <th className="p-2">Coût standardisé</th>
                            <th className="p-2 text-center">Actions</th>
                        </tr>
                    </thead>
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


// Composant principal
const CostCalculator = () => {
    const { showToast } = useContext(AppContext);
    const [rawMaterials, setRawMaterials] = useState([]);
    const [recipeItems, setRecipeItems] = useState([]);
    const [productName, setProductName] = useState('');
    const [tvaRate, setTvaRate] = useState(20);
    const [marginMultiplier, setMarginMultiplier] = useState(2.5);

    useEffect(() => {
        const q = query(collection(db, 'rawMaterials'), orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setRawMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, []);

    const handleAddMaterialToRecipe = (material) => {
        if (recipeItems.find(item => item.materialId === material.id)) {
            showToast("Cette matière est déjà dans la recette.", "info");
            return;
        }
        setRecipeItems(prev => [...prev, { materialId: material.id, ...material, quantity: 1 }]);
    };

    const handleRecipeQuantityChange = (materialId, newQuantity) => {
        setRecipeItems(items => items.map(item =>
            item.materialId === materialId ? { ...item, quantity: parseFloat(newQuantity) || 0 } : item
        ));
    };

    const handleRemoveFromRecipe = (materialId) => {
        setRecipeItems(items => items.filter(item => item.materialId !== materialId));
    };

    const { totalCost, suggestedPriceHT, suggestedPriceTTC, netMargin } = useMemo(() => {
        const totalCost = recipeItems.reduce((acc, item) => {
            return acc + (item.standardizedPrice * item.quantity);
        }, 0);

        const suggestedPriceHT = totalCost * marginMultiplier;
        const suggestedPriceTTC = suggestedPriceHT * (1 + tvaRate / 100);
        const netMargin = suggestedPriceHT - totalCost;

        return { totalCost, suggestedPriceHT, suggestedPriceTTC, netMargin };
    }, [recipeItems, marginMultiplier, tvaRate]);

    const handleSaveCost = async () => {
        if (!productName || recipeItems.length === 0) {
            showToast("Veuillez nommer le produit et ajouter au moins une matière première.", "error");
            return;
        }
        try {
            await addDoc(collection(db, 'productsCosts'), {
                productName,
                totalCost,
                suggestedPriceHT,
                suggestedPriceTTC,
                netMargin,
                marginMultiplier,
                tvaRate,
                items: recipeItems.map(({ id, createdAt, ...item }) => item),
                createdAt: serverTimestamp()
            });
            showToast("Coût du produit enregistré avec succès !", "success");
            setProductName('');
            setRecipeItems([]);
        } catch (error) {
            showToast("Erreur lors de la sauvegarde.", "error");
        }
    };

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            <h2 className="text-3xl font-bold text-white mb-8">Calculateur de Coût de Production</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Colonne de gauche: composition et gestion des matières */}
                <div className="space-y-8">
                    <div className="bg-gray-800 p-6 rounded-2xl">
                        <h3 className="text-xl font-bold mb-4">Composition du Produit Fini</h3>
                        <input type="text" value={productName} onChange={e => setProductName(e.target.value)} placeholder="Nom du produit (ex: Bougie 200g Rose)" className="w-full bg-gray-700 p-2 rounded-lg mb-4"/>
                        <div className="space-y-2">
                            {recipeItems.map(item => (
                                <div key={item.materialId} className="grid grid-cols-12 gap-2 items-center bg-gray-900/50 p-2 rounded">
                                    <div className="col-span-6 font-semibold">{item.name}</div>
                                    <div className="col-span-5 flex items-center gap-2">
                                        <input type="number" step="0.1" value={item.quantity} onChange={e => handleRecipeQuantityChange(item.materialId, e.target.value)} className="w-full bg-gray-700 p-1 rounded text-center"/>
                                        <span className="text-xs text-gray-400">{item.standardizedUnit}</span>
                                    </div>
                                    <div className="col-span-1 text-right">
                                        <button onClick={() => handleRemoveFromRecipe(item.materialId)} className="text-red-500 p-1"><X size={16}/></button>
                                    </div>
                                </div>
                            ))}
                             {recipeItems.length === 0 && <p className="text-center text-gray-500 py-4">Utilisez le bouton <PlusCircle size={16} className="inline-block text-green-400"/> pour ajouter une matière.</p>}
                        </div>
                    </div>
                    <RawMaterialManager materials={rawMaterials} onSelect={handleAddMaterialToRecipe} />
                </div>

                {/* Colonne de droite: paramètres et résultats */}
                <div className="bg-gray-800 p-6 rounded-2xl h-fit sticky top-24">
                    <h3 className="text-xl font-bold mb-6">Paramètres & Résultats</h3>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="text-sm text-gray-400">Marge / Multiplicateur</label>
                            <input type="number" step="0.1" value={marginMultiplier} onChange={e => setMarginMultiplier(parseFloat(e.target.value))} className="w-full bg-gray-700 p-2 rounded-lg mt-1" />
                        </div>
                         <div>
                            <label className="text-sm text-gray-400">TVA (%)</label>
                            <input type="number" step="1" value={tvaRate} onChange={e => setTvaRate(parseFloat(e.target.value))} className="w-full bg-gray-700 p-2 rounded-lg mt-1" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-gray-900/50 p-3 rounded-lg">
                            <span className="text-gray-300">Coût de Production Total</span>
                            <span className="font-bold text-2xl text-yellow-400">{formatPrice(totalCost)}</span>
                        </div>
                        <div className="flex justify-between items-center bg-gray-900/50 p-3 rounded-lg">
                            <span className="text-gray-300">Marge Nette (HT)</span>
                            <span className="font-bold text-lg text-indigo-400">{formatPrice(netMargin)}</span>
                        </div>
                        <div className="flex justify-between items-center bg-gray-900/50 p-3 rounded-lg">
                            <span className="text-gray-300">Prix de Vente Conseillé (HT)</span>
                            <span className="font-bold text-lg text-white">{formatPrice(suggestedPriceHT)}</span>
                        </div>
                         <div className="flex justify-between items-center bg-green-500/10 p-4 rounded-lg">
                            <span className="text-green-300 font-semibold">Prix de Vente Conseillé (TTC)</span>
                            <span className="font-bold text-3xl text-green-400">{formatPrice(suggestedPriceTTC)}</span>
                        </div>
                    </div>
                     <div className="mt-8 flex justify-end">
                        <button onClick={handleSaveCost} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg flex items-center gap-2">
                            <Save size={18}/> Enregistrer ce calcul
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CostCalculator;
