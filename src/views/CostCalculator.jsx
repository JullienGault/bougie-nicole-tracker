// src/views/CostCalculator.jsx
import React, { useState, useEffect, useMemo, useContext, useCallback } from 'react';
import { db, collection, onSnapshot, addDoc, doc, updateDoc, query, orderBy, serverTimestamp, deleteDoc } from '../services/firebase';
import { AppContext } from '../contexts/AppContext';
import { Save, Wrench, Box, Ship, ChevronDown, Globe, Home, Store as StoreIcon, Ruler, BookOpen, RefreshCw, Trash2, PackagePlus } from 'lucide-react';
import { formatPrice } from '../utils/formatters';

import { useCostCalculator } from '../hooks/useCostCalculator';
import ItemList from '../components/cost/ItemList';
import RawMaterialManager from '../components/cost/RawMaterialManager';
import ShippingRateManager from '../components/cost/ShippingRateManager';
import CalculationPanel from '../components/cost/CalculationPanel';
import ShippingSimulator from '../components/cost/ShippingSimulator';

const CostCalculator = () => {
    const { showToast } = useContext(AppContext);

    const [rawMaterials, setRawMaterials] = useState([]);
    const [shippingRates, setShippingRates] = useState([]);
    const [savedCalculations, setSavedCalculations] = useState([]);

    const [saleMode, setSaleMode] = useState('internet');
    const [recipeItems, setRecipeItems] = useState([]);
    const [packagingItems, setPackagingItems] = useState([]);
    const [productName, setProductName] = useState('');
    const [editingCalcId, setEditingCalcId] = useState(null);
    const [isShippingVisible, setIsShippingVisible] = useState(false);
    
    // États pour contrôler la visibilité des sections principales
    const [isCalculatorVisible, setIsCalculatorVisible] = useState(true);
    // MODIFIÉ : La bibliothèque est maintenant repliée par défaut
    const [isLibraryVisible, setIsLibraryVisible] = useState(false);
    const [isSimulatorVisible, setIsSimulatorVisible] = useState(false);
    const [isMaterialsVisible, setIsMaterialsVisible] = useState(false);
    
    const [productLength, setProductLength] = useState('');
    const [productWidth, setProductWidth] = useState('');
    const [productHeight, setProductHeight] = useState('');
    
    const [selectedShippingBoxId, setSelectedShippingBoxId] = useState('');
    const [selectedConsumables, setSelectedConsumables] = useState(new Set());

    const [tvaRate, setTvaRate] = useState('0');
    const [marginMultiplier, setMarginMultiplier] = useState('3.50');
    const chargesRate = 13.4;
    const [feesRate, setFeesRate] = useState('1.75');
    const [depotCommissionRate, setDepotCommissionRate] = useState('30');
    const [manualTtcPrice, setManualTtcPrice] = useState('0.00');
    const availableTvaRates = [0, 5.5, 10, 20];
    const [shippingService, setShippingService] = useState('Locker');

    useEffect(() => {
        const qMats = query(collection(db, 'rawMaterials'), orderBy('name'));
        const unsubMats = onSnapshot(qMats, (snap) => setRawMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        
        const qRates = query(collection(db, 'shippingRates'), orderBy('maxWeight'));
        const unsubRates = onSnapshot(qRates, (snap) => setShippingRates(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        
        const qCalcs = query(collection(db, 'productsCosts'), orderBy('productName'));
        const unsubCalcs = onSnapshot(qCalcs, (snap) => setSavedCalculations(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        
        return () => { unsubMats(); unsubRates(); unsubCalcs(); };
    }, []);
    
    const { availableMaterials, shippingBoxes, shippingConsumables } = useMemo(() => {
        const usedMaterialIds = new Set([
            ...recipeItems.map(item => item.materialId),
            ...packagingItems.map(item => item.materialId)
        ]);
        const available = rawMaterials.filter(material => !usedMaterialIds.has(material.id));
        const boxes = rawMaterials.filter(m => m.packagingSubCategory === 'shippingBox');
        const consumables = rawMaterials.filter(m => m.packagingSubCategory === 'shippingConsumable');
        return { availableMaterials: available, shippingBoxes: boxes, shippingConsumables: consumables };
    }, [rawMaterials, recipeItems, packagingItems]);

    const { calculations, calculateAllModes } = useCostCalculator({
        saleMode, recipeItems, packagingItems, shippingRates, shippingService,
        marginMultiplier, tvaRate, feesRate, depotCommissionRate, chargesRate,
        selectedShippingBoxId, shippingBoxes,
        selectedConsumableIds: Array.from(selectedConsumables),
        allShippingConsumables: shippingConsumables
    });

    const handleAddMaterialToCalculation = useCallback((material) => {
        if (material.category === 'component') {
            if (recipeItems.find(item => item.materialId === material.id)) {
                showToast("Ce composant est déjà dans la recette.", "info"); return;
            }
            setRecipeItems(prev => [...prev, { materialId: material.id, ...material, quantity: 1 }]);
        } else if (material.category === 'packaging' && material.packagingSubCategory === 'productPackaging') {
            if (packagingItems.find(item => item.materialId === material.id)) {
                showToast("Cet emballage est déjà dans la liste.", "info"); return;
            }
            setPackagingItems(prev => [...prev, { materialId: material.id, ...material, quantity: 1 }]);
        } else {
            showToast("Cet article (ex: carton d'expédition) ne peut pas être ajouté directement à un produit.", "error");
        }
    }, [recipeItems, packagingItems, showToast]);
    
    const handleRecipeQuantityChange = useCallback((materialId, newQuantity) => setRecipeItems(items => items.map(item => item.materialId === materialId ? { ...item, quantity: parseFloat(newQuantity) || 0 } : item)), []);
    const handlePackagingQuantityChange = useCallback((materialId, newQuantity) => setPackagingItems(items => items.map(item => item.materialId === materialId ? { ...item, quantity: parseFloat(newQuantity) || 0 } : item)), []);
    const handleRemoveRecipeItem = useCallback((materialId) => setRecipeItems(items => items.filter(item => item.materialId !== materialId)), []);
    const handleRemovePackagingItem = useCallback((materialId) => setPackagingItems(items => items.filter(item => item.materialId !== materialId)), []);
    
    const handleConsumableToggle = useCallback((consumableId) => {
        setSelectedConsumables(prev => {
            const newSet = new Set(prev);
            if (newSet.has(consumableId)) newSet.delete(consumableId);
            else newSet.add(consumableId);
            return newSet;
        });
    }, []);

    const handleManualTtcPriceChange = (e) => {
        const newTtcPriceString = e.target.value;
        setManualTtcPrice(newTtcPriceString);
        const newTtcPrice = parseFloat(newTtcPriceString);
        const productCost = calculations.productCost;

        if (!isNaN(newTtcPrice) && newTtcPrice >= 0 && productCost > 0) {
            const tva = parseFloat(tvaRate) || 0;
            const newHtPrice = newTtcPrice / (1 + tva / 100);
            const newMultiplier = newHtPrice / productCost;
            setMarginMultiplier(newMultiplier.toFixed(2));
        }
    };

    const resetProductForm = () => {
        setProductName(''); setRecipeItems([]); setPackagingItems([]);
        setEditingCalcId(null); setMarginMultiplier('3.50');
        setManualTtcPrice('0.00'); setProductLength('');
        setProductWidth(''); setProductHeight('');
        setSelectedShippingBoxId(''); setSelectedConsumables(new Set());
    };

    const handleSaveCost = async () => {
        if (!productName || recipeItems.length === 0) {
            showToast("Veuillez nommer le produit et ajouter au moins un composant.", "error"); return;
        }
        
        const dataToSave = {
            productName, 
            items: recipeItems.map(({ id, createdAt, ...item }) => item),
            packagingItems: packagingItems.map(({ id, createdAt, ...item }) => item),
            marginMultiplier: parseFloat(marginMultiplier) || 0,
            tvaRate: parseFloat(tvaRate) || 0,
            feesRate: parseFloat(feesRate) || 0,
            depotCommissionRate: parseFloat(depotCommissionRate) || 0,
            resultsByMode: calculateAllModes(),
            productLength: parseFloat(productLength) || null,
            productWidth: parseFloat(productWidth) || null,
            productHeight: parseFloat(productHeight) || null,
            shippingBoxId: selectedShippingBoxId,
            shippingConsumableIds: Array.from(selectedConsumables),
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
            resetProductForm();
        } catch (error) { console.error(error); showToast("Erreur lors de la sauvegarde.", "error"); }
    };

    const handleLoadCalculation = (calc) => {
        setProductName(calc.productName); setRecipeItems(calc.items || []);
        setPackagingItems(calc.packagingItems || []);
        setMarginMultiplier(parseFloat(calc.marginMultiplier || 3.5).toFixed(2));
        setTvaRate((calc.tvaRate !== undefined ? calc.tvaRate : 0).toString());
        setFeesRate((calc.feesRate || 1.75).toString());
        setDepotCommissionRate((calc.depotCommissionRate || 30).toString());
        setManualTtcPrice((calc.resultsByMode?.depot?.productPriceTTC || 0).toFixed(2));
        setEditingCalcId(calc.id); setProductLength(calc.productLength || '');
        setProductWidth(calc.productWidth || ''); setProductHeight(calc.productHeight || '');
        setSelectedShippingBoxId(calc.shippingBoxId || '');
        setSelectedConsumables(new Set(calc.shippingConsumableIds || []));
        setIsCalculatorVisible(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
    const handleDeleteCalculation = async (calcId) => {
        if (window.confirm("Supprimer ce calcul sauvegardé ?")) {
            await deleteDoc(doc(db, 'productsCosts', calcId));
            showToast("Calcul supprimé.", "success");
            if(editingCalcId === calcId) resetProductForm();
        }
    };
    
    const getMultiplierStyle = (multiplier) => {
        const value = parseFloat(multiplier);
        const tooltipText = "Seuils de rentabilité :\n- Rouge (< x2.5): Marge faible/à risque\n- Orange (x2.5 - x3.49): Marge correcte\n- Vert (≥ x3.5): Marge saine";
        let colorClass = "bg-red-600 text-white";
        if (value >= 3.5) colorClass = "bg-green-600 text-white";
        else if (value >= 2.5) colorClass = "bg-orange-500 text-white";
        return { className: colorClass, tooltip: tooltipText };
    };

    const Section = ({ title, icon: Icon, isVisible, setIsVisible, children }) => (
        <section className="bg-gray-800 rounded-2xl">
            <button onClick={() => setIsVisible(!isVisible)} className="w-full flex justify-between items-center p-6 text-left">
                <h3 className="text-xl font-bold flex items-center gap-3"><Icon size={24} /> {title}</h3>
                <ChevronDown className={`transform transition-transform duration-300 ${isVisible ? 'rotate-180' : ''}`} />
            </button>
            {isVisible && (
                <div className="px-6 pb-6 border-t border-gray-700/50 animate-fade-in">
                    {children}
                </div>
            )}
        </section>
    );

    return (
        <div className="p-4 sm:p-8 animate-fade-in space-y-8">
            <header className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-white">Calculateur de Coût de Production</h2>
                <button onClick={handleSaveCost} disabled={!productName || recipeItems.length === 0} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    <Save size={18}/> {editingCalcId ? 'Mettre à jour' : 'Enregistrer'}
                </button>
            </header>

            {/* MODIFIÉ : Ordre des sections inversé */}
            <Section title="Bibliothèque de Produits" icon={BookOpen} isVisible={isLibraryVisible} setIsVisible={setIsLibraryVisible}>
                <div className="pt-6 space-y-3 max-h-[50vh] overflow-y-auto custom-scrollbar">
                    {savedCalculations.map(calc => {
                        const itemMultiplierStyle = getMultiplierStyle(calc.marginMultiplier);
                        return (
                            <div key={calc.id} className="bg-gray-900/50 p-4 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="flex items-center gap-2 flex-grow text-left w-full md:w-auto">
                                    <span className={`px-2 py-1 rounded-md text-sm font-bold ${itemMultiplierStyle.className}`}>x{parseFloat(calc.marginMultiplier || 0).toFixed(2)}</span>
                                    <p className="font-bold text-base text-white">{calc.productName}</p>
                                </div>
                                <div className="flex-shrink-0 grid grid-cols-3 gap-x-6 text-center">
                                    <div><span className="text-xs text-cyan-400 block">Internet</span><p className="font-semibold text-sm mt-1">{formatPrice(calc.resultsByMode?.Locker?.finalProfit || 0)}</p></div>
                                    <div><span className="text-xs text-purple-400 block">Domicile</span><p className="font-semibold text-sm mt-1">{formatPrice(calc.resultsByMode?.domicile?.finalProfit || 0)}</p></div>
                                    <div><span className="text-xs text-pink-400 block">Dépôt</span><p className="font-semibold text-sm mt-1">{formatPrice(calc.resultsByMode?.depot?.finalProfit || 0)}</p></div>
                                </div>
                                <div className="flex-shrink-0 flex gap-2">
                                    <button onClick={() => handleLoadCalculation(calc)} className="p-2 bg-gray-700/50 hover:bg-gray-700 text-blue-400 rounded-lg flex items-center gap-2 text-xs"><RefreshCw size={14} /> Recharger</button>
                                    <button onClick={() => handleDeleteCalculation(calc.id)} className="p-2 bg-gray-700/50 hover:bg-gray-700 text-red-500 rounded-lg"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        );
                    })}
                    {savedCalculations.length === 0 && <p className="text-center text-gray-500 py-4">Aucun calcul sauvegardé.</p>}
                </div>
            </Section>

            <Section title="Calculateur de Produit" icon={Wrench} isVisible={isCalculatorVisible} setIsVisible={setIsCalculatorVisible}>
                <div className="pt-6">
                    <div className="mb-6 p-1.5 bg-gray-900/50 rounded-xl flex gap-2">
                        {[{id: 'internet', label: 'Vente Internet', icon: Globe}, {id: 'domicile', label: 'Vente Domicile', icon: Home}, {id: 'depot', label: 'Dépôt-Vente', icon: StoreIcon}].map(tab => (
                            <button key={tab.id} onClick={() => setSaleMode(tab.id)} className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-semibold transition-colors text-sm ${saleMode === tab.id ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>
                                <tab.icon size={16}/> {tab.label}
                            </button>
                        ))}
                    </div>
                    <main className="flex flex-col lg:flex-row gap-8">
                        <div className="lg:w-3/5 flex flex-col gap-8">
                            <div className="bg-gray-900 p-6 rounded-2xl">
                                <h4 className="text-lg font-bold mb-4 flex items-center gap-2">Définition du Produit</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                                    <input type="text" value={productName} onChange={e => setProductName(e.target.value)} placeholder="Nom du produit..." className="w-full bg-gray-700 p-3 rounded-lg sm:col-span-2"/>
                                    <div className="bg-gray-800 p-3 rounded-lg text-center flex items-center justify-center"><span className="text-sm text-gray-400">Poids: </span><span className="font-bold ml-2 text-lg">{(calculations.finalPackageWeight || 0).toFixed(0)} g</span></div>
                                </div>
                                <div className="p-4 bg-gray-700/50 rounded-lg mb-6">
                                    <label className="text-sm text-gray-400 flex items-center gap-2 mb-2"><Ruler size={16}/> Dimensions du produit fini (cm) - <i className='text-xs'>Optionnel</i></label>
                                    <div className="grid grid-cols-3 gap-3">
                                        <input type="number" step="0.1" value={productLength} onChange={e => setProductLength(e.target.value)} placeholder="Longueur" className="w-full bg-gray-600 p-2 rounded-lg" />
                                        <input type="number" step="0.1" value={productWidth} onChange={e => setProductWidth(e.target.value)} placeholder="Largeur" className="w-full bg-gray-600 p-2 rounded-lg" />
                                        <input type="number" step="0.1" value={productHeight} onChange={e => setProductHeight(e.target.value)} placeholder="Hauteur" className="w-full bg-gray-600 p-2 rounded-lg" />
                                    </div>
                                </div>
                                {saleMode === 'internet' && (
                                    <div className="p-4 bg-gray-700/50 rounded-lg mb-6 space-y-4">
                                        <div>
                                            <label htmlFor="shippingBoxSelect" className="text-sm text-gray-400 flex items-center gap-2 mb-2"><Box size={16}/> Carton d'expédition</label>
                                            <select id="shippingBoxSelect" value={selectedShippingBoxId} onChange={e => setSelectedShippingBoxId(e.target.value)} className="w-full bg-gray-600 p-2 rounded-lg">
                                                <option value="">-- Sélectionner un carton --</option>
                                                {shippingBoxes.map(box => <option key={box.id} value={box.id}>{box.name} ({box.length}x{box.width}x{box.height} cm)</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-400 flex items-center gap-2 mb-2"><PackagePlus size={16}/> Consommables d'expédition</label>
                                            <div className="max-h-24 overflow-y-auto custom-scrollbar pr-2 text-sm space-y-1">
                                                {shippingConsumables.map(c => (
                                                    <label key={c.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-600/50 cursor-pointer">
                                                        <input type="checkbox" checked={selectedConsumables.has(c.id)} onChange={() => handleConsumableToggle(c.id)} className="bg-gray-500 rounded" />
                                                        <span>{c.name}</span>
                                                        <span className="ml-auto text-gray-400">{formatPrice(c.standardizedPrice)}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <ItemList title="Composition du Produit" icon={Wrench} items={recipeItems} onQuantityChange={handleRecipeQuantityChange} onRemoveItem={handleRemoveRecipeItem} />
                                <div className="mt-6"><ItemList title="Emballage du Produit (boîte, étiquette...)" icon={Box} items={packagingItems} onQuantityChange={handlePackagingQuantityChange} onRemoveItem={handleRemovePackagingItem} /></div>
                            </div>
                            {saleMode === 'internet' && (
                                <div className="bg-gray-900 p-6 rounded-2xl space-y-4">
                                    <button onClick={() => setIsShippingVisible(!isShippingVisible)} className="w-full flex justify-between items-center text-left p-2">
                                        <h4 className="text-lg font-semibold flex items-center gap-2"><Ship size={20}/> Grille Tarifaire d'Expédition</h4>
                                        <ChevronDown className={`transform transition-transform ${isShippingVisible ? 'rotate-180' : ''}`} />
                                    </button>
                                    {isShippingVisible && <div className="mt-3 pt-3 border-t border-gray-700 animate-fade-in"><ShippingRateManager rates={shippingRates} /></div>}
                                </div>
                            )}
                        </div>
                        <CalculationPanel calculations={calculations} saleMode={saleMode} shippingService={shippingService} setShippingService={setShippingService} marginMultiplier={marginMultiplier} setMarginMultiplier={setMarginMultiplier} manualTtcPrice={manualTtcPrice} handleManualTtcPriceChange={handleManualTtcPriceChange} tvaRate={tvaRate} setTvaRate={setTvaRate} availableTvaRates={availableTvaRates} feesRate={feesRate} setFeesRate={setFeesRate} depotCommissionRate={depotCommissionRate} setDepotCommissionRate={setDepotCommissionRate} chargesRate={chargesRate} />
                    </main>
                </div>
            </Section>

            <Section title="Simulateur d'Envoi Groupé" icon={Ship} isVisible={isSimulatorVisible} setIsVisible={setIsSimulatorVisible}>
                <div className="pt-6">
                    <ShippingSimulator savedCalculations={savedCalculations} shippingBoxes={shippingBoxes} shippingConsumables={shippingConsumables} shippingRates={shippingRates} tvaRate={tvaRate} feesRate={feesRate} chargesRate={chargesRate} />
                </div>
            </Section>
            
            <Section title="Bibliothèque des Matières Premières" icon={Box} isVisible={isMaterialsVisible} setIsVisible={setIsMaterialsVisible}>
                <div className="pt-6">
                    <RawMaterialManager materials={availableMaterials} onSelect={handleAddMaterialToCalculation} />
                </div>
            </Section>
        </div>
    );
};

export default CostCalculator;
