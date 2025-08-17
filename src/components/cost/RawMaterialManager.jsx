// src/components/cost/RawMaterialManager.jsx
import React, { useState, useMemo, useContext } from 'react';
import { db, addDoc, updateDoc, deleteDoc, doc, collection, serverTimestamp } from '../../services/firebase';
import { AppContext } from '../../contexts/AppContext';
import { Building, PlusCircle, Save, Edit, Trash2, ChevronDown, Link as LinkIcon } from 'lucide-react';
import { formatPrice } from '../../utils/formatters';

const RawMaterialManager = ({ materials, onSelect, isVisible, setIsVisible }) => {
    const { showToast } = useContext(AppContext);
    // Ajout de l'état pour l'URL du fournisseur
    const [supplierUrl, setSupplierUrl] = useState('');
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
        // Vider le champ URL
        setSupplierUrl('');
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
            // Ajout de l'URL du fournisseur aux données
            supplierUrl: supplierUrl.trim(),
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
        setIsVisible(true);
        setEditingMaterial(material); setName(material.name); setPurchasePrice(material.purchasePrice);
        setPurchaseQty(material.purchaseQty); setPurchaseUnit(material.purchaseUnit);
        setDensity(material.density || '1');
        setWeightPerPiece(material.weightPerPiece || '');
        setCategory(material.category || 'component');
        // Pré-remplir le champ URL
        setSupplierUrl(material.supplierUrl || '');
    };

    const productComponents = useMemo(() => materials.filter(m => !m.category || m.category === 'component'), [materials]);
    const packagingComponents = useMemo(() => materials.filter(m => m.category === 'packaging'), [materials]);

    return (
        <div className="bg-gray-800 p-6 rounded-2xl flex flex-col">
            <button onClick={() => setIsVisible(!isVisible)} className="w-full flex justify-between items-center text-left">
                <h3 className="text-xl font-bold flex items-center gap-2"><Building size={22}/> Bibliothèque des Matières</h3>
                <ChevronDown className={`transform transition-transform ${isVisible ? 'rotate-180' : ''}`} />
            </button>
            
            {isVisible && (
                <div className="mt-6 border-t border-gray-700 pt-6 animate-fade-in">
                    <form onSubmit={handleSubmit} className="space-y-4 mb-6">
                        <div>
                            <label className="text-sm text-gray-400">Catégorie</label>
                            <div className="flex gap-2 p-1 bg-gray-900 rounded-lg mt-1">
                                <button type="button" onClick={() => setCategory('component')} className={`flex-1 py-1.5 rounded-md text-sm font-semibold ${category === 'component' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>Composant Produit</button>
                                <button type="button" onClick={() => setCategory('packaging')} className={`flex-1 py-1.5 rounded-md text-sm font-semibold ${category === 'packaging' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>Matériel d'Emballage</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-400">Nom</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={category === 'component' ? "Ex: Cire de Soja" : "Ex: Carton d'expédition 15x15"} className="w-full bg-gray-700 p-2 rounded-lg mt-1" />
                            </div>
                            <div>
                                <label className="text-sm text-gray-400">Lien Fournisseur (URL)</label>
                                <input type="url" value={supplierUrl} onChange={e => setSupplierUrl(e.target.value)} placeholder="https://..." className="w-full bg-gray-700 p-2 rounded-lg mt-1" />
                            </div>
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

                    <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 max-h-[50vh]">
                        {[
                            { title: "Composants de Produit", items: productComponents },
                            { title: "Matériels d'Emballage", items: packagingComponents }
                        ].map(section => (
                            <div key={section.title} className="mt-4">
                                <h4 className="text-lg font-semibold mb-2">{section.title}</h4>
                                <div className="space-y-2">
                                    <div className="grid grid-cols-[1fr_120px_auto] gap-3 px-2 text-xs uppercase text-gray-400"><span>Nom</span><span>Coût standardisé</span><span className="text-center">Actions</span></div>
                                    {section.items.map(mat => (
                                        <div key={mat.id} className="grid grid-cols-[1fr_120px_auto] gap-3 items-center bg-gray-900/50 p-2 rounded-lg">
                                            <span className="font-semibold truncate">{mat.name}</span>
                                            <span className="font-mono text-sm text-indigo-300">
                                                {(mat.standardizedUnit === 'g' || mat.standardizedUnit === 'ml')
                                                    ? `${formatPrice(mat.standardizedPrice * 100)}/100${mat.standardizedUnit}`
                                                    : `${formatPrice(mat.standardizedPrice)}/${mat.standardizedUnit}`
                                                }
                                                {mat.weightPerPiece && ` (${mat.weightPerPiece}g)`}
                                            </span>
                                            <div className="flex justify-center gap-1">
                                                {mat.supplierUrl && (
                                                    <a href={mat.supplierUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 p-1 hover:bg-gray-700 rounded" title="Voir le fournisseur">
                                                        <LinkIcon size={18}/>
                                                    </a>
                                                )}
                                                <button onClick={() => onSelect(mat)} className="text-green-400 p-1 hover:bg-gray-700 rounded" title="Ajouter au calcul"><PlusCircle size={18}/></button>
                                                <button onClick={() => startEditing(mat)} className="text-yellow-400 p-1 hover:bg-gray-700 rounded" title="Modifier"><Edit size={18}/></button>
                                                <button onClick={() => handleDelete(mat.id)} className="text-red-500 p-1 hover:bg-gray-700 rounded" title="Supprimer"><Trash2 size={18}/></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RawMaterialManager;
