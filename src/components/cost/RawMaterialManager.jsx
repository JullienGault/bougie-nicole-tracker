// src/components/cost/RawMaterialManager.jsx
import React, { useState, useMemo, useContext } from 'react';
import { db, addDoc, updateDoc, deleteDoc, doc, collection, serverTimestamp } from '../../services/firebase';
import { AppContext } from '../../contexts/AppContext';
import { PlusCircle, Save, Edit, Trash2, Link as LinkIcon, Ruler } from 'lucide-react';
import { formatPrice } from '../../utils/formatters';

// Sous-composant pour gérer une seule catégorie (Composant ou Emballage)
const MaterialCategoryColumn = ({ title, category, materials, onSelect, onEdit, onDelete }) => {
    const { showToast } = useContext(AppContext);
    
    const [name, setName] = useState('');
    const [supplierUrl, setSupplierUrl] = useState('');
    const [purchasePrice, setPurchasePrice] = useState('');
    const [purchaseQty, setPurchaseQty] = useState('');
    const [purchaseUnit, setPurchaseUnit] = useState(category === 'component' ? 'kg' : 'piece');
    const [density, setDensity] = useState('1');
    const [weightPerPiece, setWeightPerPiece] = useState('');
    const [length, setLength] = useState('');
    const [width, setWidth] = useState('');
    const [height, setHeight] = useState('');
    const [editingMaterial, setEditingMaterial] = useState(null);

    const resetForm = () => {
        setName(''); setSupplierUrl(''); setPurchasePrice(''); setPurchaseQty('');
        setPurchaseUnit(category === 'component' ? 'kg' : 'piece');
        setDensity('1'); setWeightPerPiece(''); setLength(''); setWidth(''); setHeight('');
        setEditingMaterial(null);
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
            supplierUrl: supplierUrl.trim(),
            length: category === 'packaging' ? parseFloat(length) || null : null,
            width: category === 'packaging' ? parseFloat(width) || null : null,
            height: category === 'packaging' ? parseFloat(height) || null : null,
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
        } catch (error) { console.error(error); showToast("Une erreur est survenue.", "error"); }
    };

    const startEditing = (material) => {
        setEditingMaterial(material); setName(material.name); setPurchasePrice(material.purchasePrice);
        setPurchaseQty(material.purchaseQty); setPurchaseUnit(material.purchaseUnit);
        setDensity(material.density || '1');
        setWeightPerPiece(material.weightPerPiece || '');
        setSupplierUrl(material.supplierUrl || '');
        setLength(material.length || '');
        setWidth(material.width || '');
        setHeight(material.height || '');
        onEdit(material.id); // Notifie le parent qu'une édition est en cours
    };

    return (
        <div className="bg-gray-900/50 p-4 rounded-xl flex flex-col">
            <h4 className="font-bold text-lg mb-4 text-center">{title}</h4>
            <form onSubmit={handleSubmit} className="space-y-3 mb-4">
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nom" className="w-full bg-gray-700 p-2 rounded-lg" />
                {category === 'packaging' && (
                    <div className="grid grid-cols-3 gap-2">
                        <input type="number" step="0.1" value={length} onChange={e => setLength(e.target.value)} placeholder="L (cm)" className="w-full bg-gray-700 p-2 rounded-lg" />
                        <input type="number" step="0.1" value={width} onChange={e => setWidth(e.target.value)} placeholder="l (cm)" className="w-full bg-gray-700 p-2 rounded-lg" />
                        <input type="number" step="0.1" value={height} onChange={e => setHeight(e.target.value)} placeholder="H (cm)" className="w-full bg-gray-700 p-2 rounded-lg" />
                    </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                    <input type="number" step="0.01" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} placeholder="Prix €" className="w-full bg-gray-700 p-2 rounded-lg" />
                    <input type="number" step="0.01" value={purchaseQty} onChange={e => setPurchaseQty(e.target.value)} placeholder="Qté" className="w-full bg-gray-700 p-2 rounded-lg" />
                    <select value={purchaseUnit} onChange={e => setPurchaseUnit(e.target.value)} className="w-full bg-gray-700 p-2 rounded-lg h-[42px]">
                        <option value="kg">kg</option><option value="g">g</option><option value="L">L</option><option value="ml">ml</option><option value="piece">pièce(s)</option>
                    </select>
                </div>
                 {purchaseUnit === 'piece' && <input type="number" step="0.1" value={weightPerPiece} onChange={e => setWeightPerPiece(e.target.value)} placeholder="Poids / pièce (g)" className="w-full bg-gray-700 p-2 rounded-lg" />}
                <button type="submit" className="w-full bg-indigo-600 py-2 px-4 rounded-lg flex items-center justify-center gap-2">
                    {editingMaterial ? <Save size={18} /> : <PlusCircle size={18} />} {editingMaterial ? 'Enregistrer' : 'Ajouter'}
                </button>
                 {editingMaterial && <button type="button" onClick={resetForm} className="w-full text-center text-xs text-gray-400 hover:text-white mt-1">Annuler</button>}
            </form>

            <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 max-h-[40vh]">
                <div className="space-y-2">
                    {materials.map(mat => (
                        <div key={mat.id} className="bg-gray-700/50 p-2 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="font-semibold truncate pr-2">{mat.name}</span>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <button onClick={() => onSelect(mat)} className="text-green-400 p-1 hover:bg-gray-600 rounded" title="Ajouter au calcul"><PlusCircle size={18} /></button>
                                    <button onClick={() => startEditing(mat)} className="text-yellow-400 p-1 hover:bg-gray-600 rounded" title="Modifier"><Edit size={18} /></button>
                                    <button onClick={() => onDelete(mat.id)} className="text-red-500 p-1 hover:bg-gray-600 rounded" title="Supprimer"><Trash2 size={18} /></button>
                                </div>
                            </div>
                             <span className="font-mono text-xs text-indigo-300">
                                {(mat.standardizedUnit === 'g' || mat.standardizedUnit === 'ml')
                                    ? `${formatPrice(mat.standardizedPrice * 100)}/100${mat.standardizedUnit}`
                                    : `${formatPrice(mat.standardizedPrice)}/${mat.standardizedUnit}`
                                }
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- Composant Principal ---
const RawMaterialManager = ({ materials, onSelect, isVisible, setIsVisible }) => {
    const { showToast } = useContext(AppContext);
    
    const [editingId, setEditingId] = useState(null); // Pour suivre quelle colonne a un formulaire actif

    const handleDelete = async (materialId) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer cette matière première ?")) {
            await deleteDoc(doc(db, 'rawMaterials', materialId));
            showToast("Matière première supprimée.", "success");
        }
    };

    const { componentMaterials, packagingMaterials } = useMemo(() => {
        return {
            componentMaterials: materials.filter(m => !m.category || m.category === 'component'),
            packagingMaterials: materials.filter(m => m.category === 'packaging')
        };
    }, [materials]);

    return (
        <div className="bg-gray-800 p-6 rounded-2xl flex flex-col">
            <button onClick={() => setIsVisible(!isVisible)} className="w-full flex justify-between items-center text-left">
                <h3 className="text-xl font-bold">Bibliothèque des Matières</h3>
                {/* Icône ChevronDown retirée pour un look plus épuré car le titre est maintenant plus simple */}
            </button>

            {isVisible && (
                <div className="mt-6 border-t border-gray-700 pt-6 animate-fade-in grid grid-cols-1 md:grid-cols-2 gap-6">
                    <MaterialCategoryColumn 
                        title="Composants Produit"
                        category="component"
                        materials={componentMaterials}
                        onSelect={onSelect}
                        onEdit={setEditingId}
                        onDelete={handleDelete}
                    />
                    <MaterialCategoryColumn 
                        title="Matériels d'Emballage"
                        category="packaging"
                        materials={packagingMaterials}
                        onSelect={onSelect}
                        onEdit={setEditingId}
                        onDelete={handleDelete}
                    />
                </div>
            )}
        </div>
    );
};

export default RawMaterialManager;
