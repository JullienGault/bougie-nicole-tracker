// src/components/product/ProductFormModal.jsx
import React, { useState, useContext } from 'react';
import { Save } from 'lucide-react';
import { AppContext } from '../../contexts/AppContext';
import { db, doc, updateDoc, addDoc, collection, serverTimestamp } from '../../services/firebase';

const ProductFormModal = ({ product, onClose }) => {
    const { showToast } = useContext(AppContext);
    const isEditing = !!product?.id;

    const [name, setName] = useState(product?.name || '');
    const [price, setPrice] = useState(product?.price || 0);
    const [imageUrl, setImageUrl] = useState(product?.imageUrl || '');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name || price <= 0) {
            showToast("Veuillez remplir le nom et un prix valide.", "error");
            return;
        }
        setIsLoading(true);

        const productData = {
            name,
            price: Number(price),
            imageUrl: imageUrl.trim(),
            updatedAt: serverTimestamp(),
        };

        try {
            if (isEditing) {
                const productDocRef = doc(db, "products", product.id);
                await updateDoc(productDocRef, productData);
                showToast("Produit mis à jour avec succès !", "success");
            } else {
                productData.createdAt = serverTimestamp();
                await addDoc(collection(db, "products"), productData);
                showToast("Produit ajouté avec succès !", "success");
            }
            onClose();
        } catch (error) {
            console.error("Erreur lors de la sauvegarde du produit :", error);
            showToast("Une erreur est survenue.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 p-8 rounded-2xl w-full max-w-lg border-gray-700" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-white mb-6">{isEditing ? "Modifier le Produit" : "Ajouter un Produit"}</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Nom du produit</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg" placeholder="ex: Bougie 100g"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Prix de vente (€)</label>
                        <input type="number" value={price} onChange={e => setPrice(e.target.value)} required min="0.01" step="0.01" className="w-full bg-gray-700 p-3 rounded-lg" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">URL de l'image (optionnel)</label>
                        <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="w-full bg-gray-700 p-3 rounded-lg" placeholder="https://exemple.com/image.jpg"/>
                    </div>
                    
                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Annuler</button>
                        <button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-60">
                           {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2"></div> : <><Save size={18}/> {isEditing ? "Enregistrer" : "Créer"}</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProductFormModal;
