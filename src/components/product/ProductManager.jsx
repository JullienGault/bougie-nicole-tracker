// src/components/product/ProductManager.jsx
import React, { useState, useMemo, useContext } from 'react';
import { ArrowRightCircle, PlusCircle, Search, ImageOff, Edit, Trash2 } from 'lucide-react';
import { AppContext } from '../../contexts/AppContext';
import { db, doc, deleteDoc } from '../../services/firebase';
import { formatPrice } from '../../utils/formatters';
import ProductFormModal from './ProductFormModal';
import ConfirmationModal from '../common/ConfirmationModal';

const ProductManager = ({ onBack }) => {
    const { products, showToast } = useContext(AppContext);
    const [productToEdit, setProductToEdit] = useState(null);
    const [productToDelete, setProductToDelete] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const handleDelete = async () => {
        if (!productToDelete) return;
        try {
            // On pourrait ajouter une vérification pour s'assurer que le produit n'est en stock nulle part.
            await deleteDoc(doc(db, 'products', productToDelete.id));
            showToast("Produit supprimé avec succès.", "success");
        } catch (error) {
            console.error("Erreur lors de la suppression :", error);
            showToast("Erreur lors de la suppression du produit.", "error");
        } finally {
            setProductToDelete(null);
        }
    };

    const filteredProducts = useMemo(() => {
        return products.filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [products, searchTerm]);

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {productToEdit && <ProductFormModal product={productToEdit.id ? productToEdit : null} onClose={() => setProductToEdit(null)} />}
            {productToDelete && <ConfirmationModal
                title="Confirmer la suppression"
                message={`Êtes-vous sûr de vouloir supprimer le produit "${productToDelete.name}" ? Cette action est irréversible.`}
                onConfirm={handleDelete}
                onCancel={() => setProductToDelete(null)}
                confirmText="Oui, supprimer"
            />}

            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="bg-gray-600 hover:bg-gray-500 p-2 rounded-full text-white">
                        <ArrowRightCircle className="transform rotate-180" size={24} />
                    </button>
                    <div>
                        <h2 className="text-3xl font-bold text-white">Gestion du Catalogue</h2>
                        <p className="text-gray-400">Ajoutez, modifiez ou supprimez des produits.</p>
                    </div>
                </div>
                <button onClick={() => setProductToEdit({})} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2">
                    <PlusCircle size={20} /> Ajouter un produit
                </button>
            </div>

            <div className="mb-8 max-w-md">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Rechercher dans le catalogue..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-700 p-3 pl-10 rounded-lg"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {filteredProducts.map(p => (
                    <div key={p.id} className="bg-gray-800 rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between animate-fade-in-up">
                        {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-full h-48 object-cover"/>
                        ) : (
                            <div className="w-full h-48 bg-gray-700 flex items-center justify-center">
                                <ImageOff size={48} className="text-gray-500"/>
                            </div>
                        )}
                        <div className="p-4 flex-grow">
                            <h3 className="font-bold text-lg text-white">{p.name}</h3>
                            <p className="text-indigo-400 font-semibold text-xl mt-2">{formatPrice(p.price)}</p>
                        </div>
                        <div className="p-4 pt-0 flex justify-end items-center gap-2">
                            <button onClick={() => setProductToEdit(p)} title="Modifier" className="p-2 text-yellow-400 hover:text-yellow-300 bg-gray-700/50 rounded-lg"><Edit size={18}/></button>
                            <button onClick={() => setProductToDelete(p)} title="Supprimer" className="p-2 text-red-500 hover:text-red-400 bg-gray-700/50 rounded-lg"><Trash2 size={18}/></button>
                        </div>
                    </div>
                ))}
            </div>
            {filteredProducts.length === 0 && <p className="text-center text-gray-400 py-16">Aucun produit ne correspond à votre recherche.</p>}
        </div>
    );
};

export default ProductManager;
