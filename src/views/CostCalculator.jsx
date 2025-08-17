// src/views/CostCalculator.jsx
import React, { useState, useEffect, useMemo, useContext, useCallback } from 'react';
import { db, collection, onSnapshot, addDoc, doc, updateDoc, query, orderBy, serverTimestamp } from '../services/firebase';
import { AppContext } from '../contexts/AppContext';
import { Save, Wrench, Box, Ship, ChevronDown, Globe, Home, Store as StoreIcon } from 'lucide-react';

// Nouveaux imports des composants et du hook
import { useCostCalculator } from '../hooks/useCostCalculator';
import ItemList from '../../components/cost/ItemList';
import RawMaterialManager from '../../components/cost/RawMaterialManager';
import ShippingRateManager from '../../components/cost/ShippingRateManager';
import CalculationPanel from '../../components/cost/CalculationPanel';

const CostCalculator = () => {
    const { showToast } = useContext(AppContext);

    // --- GESTION DES DONNÉES DE BASE ---
    const [rawMaterials, setRawMaterials] = useState([]);
    const [shippingRates, setShippingRates] = useState([]);
    const [savedCalculations, setSavedCalculations] = useState([]);

    // --- ÉTATS DU CALCULATEUR ACTUEL ---
    const [saleMode, setSaleMode] = useState('internet');
    const [recipeItems, setRecipeItems] = useState([]);
    const [packagingItems, setPackagingItems] = useState([]);
    const [productName, setProductName] = useState('');
    const [editingCalcId, setEditingCalcId] = useState(null);
    const [isShippingVisible, setIsShippingVisible] = useState(false);
    const [shippingService, setShippingService] = useState('Locker');

    // --- PARAMÈTRES DE CALCUL ---
    const [tvaRate, setTvaRate] = useState('0');
    const [marginMultiplier, setMarginMultiplier] = useState('2.5');
    const chargesRate = 13.30; // Constante
    const [feesRate, setFeesRate] = useState('1.75');
    const [depotCommissionRate, setDepotCommissionRate] = useState('30');
    const [manualTtcPrice, setManualTtcPrice] = useState('0.00');
    const availableTvaRates = [0, 5.5, 10, 20];

    // --- FETCH DES DONNÉES FIREBASE ---
    useEffect(() => {
        const qMats = query(collection(db, 'rawMaterials'), orderBy('name'));
        const unsubMats = onSnapshot(qMats, (snap) => setRawMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        
        const qRates = query(collection(db, 'shippingRates'), orderBy('maxWeight'));
        const unsubRates = onSnapshot(qRates, (snap) => setShippingRates(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        
        const qCalcs = query(collection(db, 'productsCosts'), orderBy('productName'));
        const unsubCalcs = onSnapshot(qCalcs, (snap) => setSavedCalculations(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        
        return () => { unsubMats(); unsubRates(); unsubCalcs(); };
    }, []);

    // --- UTILISATION DU HOOK DE CALCUL ---
    const { calculations, calculateAllModes } = useCostCalculator({
        saleMode, recipeItems, packagingItems, shippingRates, shippingService,
        marginMultiplier, tvaRate, feesRate, depotCommissionRate, chargesRate
    });

    // --- LOGIQUE DE MANIPULATION DES LISTES ---
    const handleAddMaterialToCalculation = (material) => {
        const targetList = material.category === 'packaging' ? packagingItems : recipeItems;
        const setTargetList = material.category === 'packaging' ? setPackagingItems : setRecipeItems;
        
        if (targetList.find(item => item.materialId === material.id)) {
            showToast("Cet élément est déjà dans la liste.", "info"); return;
        }
        setTargetList(prev => [...prev, { materialId: material.id, ...material, quantity: 1 }]);
    };
    
    const handleRecipeQuantityChange = useCallback((materialId, newQuantity) => setRecipeItems(items => items.map(item => item.materialId === materialId ? { ...item, quantity: parseFloat(newQuantity) || 0 } : item)), []);
    const handlePackagingQuantityChange = useCallback((materialId, newQuantity) => setPackagingItems(items => items.map(item => item.materialId === materialId ? { ...item, quantity: parseFloat(newQuantity) || 0 } : item)), []);
    const handleRemoveRecipeItem = useCallback((materialId) => setRecipeItems(items => items.filter(item => item.materialId !== materialId)), []);
    const handleRemovePackagingItem = useCallback((materialId) => setPackagingItems(items => items.filter(item => item.materialId !== materialId)), []);

    // --- LOGIQUE DE GESTION DU PRIX ET DE LA MARGE ---
    const handleManualTtcPriceChange = (e) => {
        const newTtcPriceString = e.target.value;
        setManualTtcPrice(newTtcPriceString);
        
        const newTtcPrice = parseFloat(newTtcPriceString);
        const productCost = calculations.productCost;

        if (!isNaN(newTtcPrice) && newTtcPrice >= 0 && productCost > 0) {
            const tva = parseFloat(tvaRate) || 0;
            const newHtPrice = newTtcPrice / (1 + tva / 100);
            const newMultiplier = newHtPrice / productCost;
            setMarginMultiplier(newMultiplier.toFixed(4));
        }
    };

    // --- LOGIQUE DE SAUVEGARDE ET CHARGEMENT ---
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
            setProductName('');
            setRecipeItems([]);
            setPackagingItems([]);
            setEditingCalcId(null);
            setMarginMultiplier('2.5');
            setManualTtcPrice('0.00');
        } catch (error) { console.error(error); showToast("Erreur lors de la sauvegarde.", "error"); }
    };

    const handleLoadCalculation = (calc) => {
        setProductName(calc.productName);
        setRecipeItems(calc.items || []);
        setPackagingItems(calc.packagingItems || []);
        setMarginMultiplier((calc.marginMultiplier || 2.5).toString());
        setTvaRate((calc.tvaRate !== undefined ? calc.tvaRate : 0).toString());
        setFeesRate((calc.feesRate || 1.75).toString());
        setDepotCommissionRate((calc.depotCommissionRate || 30).toString());
        setManualTtcPrice((calc.resultsByMode?.depot?.productPriceTTC || 0).toFixed(2));
        setEditingCalcId(calc.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
    const availableMaterials = useMemo(() => {
        const usedMaterialIds = new Set([
            ...recipeItems.map(item => item.materialId),
            ...packagingItems.map(item => item.materialId)
        ]);
        return rawMaterials.filter(material => !usedMaterialIds.has(material.id));
    }, [rawMaterials, recipeItems, packagingItems]);


    return (
        <div className="p-4 sm:p-8 animate-fade-in">
             <header className="flex justify-between items-center mb-8">
                 <h2 className="text-3xl font-bold text-white">Calculateur de Coût de Production</h2>
                 <button onClick={handleSaveCost} disabled={!productName || recipeItems.length === 0} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    <Save size={18}/> {editingCalcId ? 'Mettre à jour' : 'Enregistrer'}
                </button>
            </header>
            
            <div className="mb-6 p-1.5 bg-gray-900/50 rounded-xl flex gap-2">
                {[{id: 'internet', label: 'Vente Internet', icon: Globe}, {id: 'domicile', label: 'Vente Domicile', icon: Home}, {id: 'depot', label: 'Dépôt-Vente', icon: StoreIcon}].map(tab => (
                     <button key={tab.id} onClick={() => setSaleMode(tab.id)} className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-semibold transition-colors text-sm ${saleMode === tab.id ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>
                        <tab.icon size={16}/> {tab.label}
                    </button>
                ))}
            </div>

            <main className="flex flex-col lg:flex-row gap-8">
                
                <div className="lg:w-3/5 flex flex-col gap-8">
                    <div className="bg-gray-800 p-6 rounded-2xl">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Wrench size={22}/> Produit Actuel</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                            <input type="text" value={productName} onChange={e => setProductName(e.target.value)} placeholder="Nom du produit..." className="w-full bg-gray-700 p-3 rounded-lg sm:col-span-2"/>
                             <div className="bg-gray-900 p-3 rounded-lg text-center flex items-center justify-center"><span className="text-sm text-gray-400">Poids: </span><span className="font-bold ml-2 text-lg">{(calculations.finalPackageWeight || 0).toFixed(0)} g</span></div>
                        </div>
                        <ItemList title="Composition du Produit" icon={Wrench} items={recipeItems} onQuantityChange={handleRecipeQuantityChange} onRemoveItem={handleRemoveRecipeItem} />
                    </div>
                    
                    {(saleMode === 'internet' || saleMode === 'domicile') && (
                        <div className="bg-gray-800 p-6 rounded-2xl space-y-4">
                           <ItemList title="Éléments d'emballage & Expédition" icon={Box} items={packagingItems} onQuantityChange={handlePackagingQuantityChange} onRemoveItem={handleRemovePackagingItem} />
                           {saleMode === 'internet' && <div>
                               <button onClick={() => setIsShippingVisible(!isShippingVisible)} className="w-full flex justify-between items-center text-left p-2">
                                   <h4 className="text-lg font-semibold flex items-center gap-2"><Ship size={20}/> Grille Tarifaire d'Expédition</h4>
                                   <ChevronDown className={`transform transition-transform ${isShippingVisible ? 'rotate-180' : ''}`} />
                               </button>
                               {isShippingVisible && <div className="mt-3 pt-3 border-t border-gray-700 animate-fade-in"><ShippingRateManager rates={shippingRates} /></div>}
                           </div>}
                        </div>
                    )}

                    <RawMaterialManager materials={availableMaterials} onSelect={handleAddMaterialToCalculation} />
                </div>

                <CalculationPanel 
                    calculations={calculations}
                    savedCalculations={savedCalculations}
                    saleMode={saleMode}
                    shippingService={shippingService}
                    setShippingService={setShippingService}
                    marginMultiplier={marginMultiplier}
                    setMarginMultiplier={setMarginMultiplier}
                    manualTtcPrice={manualTtcPrice}
                    handleManualTtcPriceChange={handleManualTtcPriceChange}
                    tvaRate={tvaRate}
                    setTvaRate={setTvaRate}
                    availableTvaRates={availableTvaRates}
                    feesRate={feesRate}
                    setFeesRate={setFeesRate}
                    depotCommissionRate={depotCommissionRate}
                    setDepotCommissionRate={setDepotCommissionRate}
                    chargesRate={chargesRate}
                    onLoadCalculation={handleLoadCalculation}
                    showToast={showToast}
                />
            </main>
        </div>
    );
};

export default CostCalculator;
