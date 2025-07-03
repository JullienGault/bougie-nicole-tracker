// src/components/delivery/DeliveryRequestModal.jsx
import React, { useState, useMemo, useContext } from 'react';
import { Search, ImageOff, Send } from 'lucide-react';
import { AppContext } from '../../contexts/AppContext';
import { db, addDoc, collection, serverTimestamp } from '../../services/firebase';
import { formatPrice } from '../../utils/formatters';

const DeliveryRequestModal = ({ posId, posName, onClose }) => {
    const { showToast, products, scents } = useContext(AppContext);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [requestedQuantities, setRequestedQuantities] = useState({});

    const handleQuantityChange = (productId, scentName, quantityStr) => {
        const quantity = parseInt(quantityStr, 10);
        const key = scentName ? `${productId}_${scentName}` : productId;

        setRequestedQuantities(prev => {
            const newQuantities = { ...prev };
            if (isNaN(quantity) || quantity <= 0) {
                delete newQuantities[key];
            } else {
                newQuantities[key] = quantity;
            }
            return newQuantities;
        });
    };

    const handleSend = async () => {
        const itemsToSend = Object.entries(requestedQuantities)
            .map(([key, quantity]) => {
                if (quantity > 0) {
                    const product = products.find(p => p.id === key.split('_')[0]);
                    const parts = key.split('_');
                    const productId = parts[0];
                    const scent = parts.length > 1 ? parts.slice(1).join('_') : null;
                    return { productId, scent, quantity, productName: product.name };
                }
                return null;
            })
            .filter(Boolean);

        if (itemsToSend.length === 0) {
            showToast("Veuillez demander une quantité pour au moins un produit.", "error");
            return;
        }

        setIsLoading(true);
        try {
            await addDoc(collection(db, 'deliveryRequests'), {
                posId,
                posName,
                items: itemsToSend,
                status: 'pending',
                createdAt: serverTimestamp(),
                archivedBy: []
            });

            await addDoc(collection(db, 'notifications'), {
                recipientUid: 'all_admins',
                message: `Nouvelle demande de livraison reçue de ${posName}.`,
                createdAt: serverTimestamp(),
                isRead: false,
                type: 'NEW_DELIVERY_REQUEST'
            });

            showToast("Demande de livraison envoyée avec succès !", "success");
            onClose();
        } catch (error) {
            console.error("Erreur lors de l'envoi de la demande de livraison: ", error);
            showToast("Une erreur est survenue lors de l'envoi.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const filteredProducts = useMemo(() => {
        if (!searchTerm) return products;
        return products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [products, searchTerm]);

    const totalItems = Object.values(requestedQuantities).reduce((sum, qty) => sum + qty, 0);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-2xl w-full max-w-4xl border-gray-700 flex flex-col h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-700">
                    <h2 className="text-2xl font-bold text-white">Demander une Livraison</h2>
                    <p className="text-gray-400">Parcourez le catalogue et indiquez les quantités souhaitées.</p>
                    <div className="relative mt-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Rechercher un produit..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-700 p-2 pl-10 rounded-lg"
                        />
                    </div>
                </div>

                <div className="flex-grow p-6 overflow-y-auto custom-scrollbar">
                    {filteredProducts.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredProducts.map(p => {
                                const key_noscent = p.id;
                                return (
                                <div key={p.id} className="bg-gray-900/50 rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between animate-fade-in-up">
                                    {p.imageUrl ? (
                                        <img src={p.imageUrl} alt={p.name} className="w-full h-48 object-cover"/>
                                    ) : (
                                        <div className="w-full h-48 bg-gray-700 flex items-center justify-center">
                                            <ImageOff size={48} className="text-gray-500"/>
                                        </div>
                                    )}
                                    <div className="p-4 flex-grow">
                                        <h3 className="font-bold text-lg text-white">{p.name}</h3>
                                        <p className="text-indigo-400 font-semibold text-xl mt-1">{formatPrice(p.price)}</p>
                                    </div>
                                    <div className="p-4 pt-2">
                                        {!p.hasScents ? (
                                            <div>
                                                <label className="text-sm font-medium text-gray-300 block mb-1">Quantité</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    placeholder="0"
                                                    value={requestedQuantities[key_noscent] || ''}
                                                    onChange={e => handleQuantityChange(p.id, null, e.target.value)}
                                                    className="w-full bg-gray-700 p-2 rounded-lg text-center font-bold text-lg"
                                                />
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <p className="text-sm font-medium text-gray-300 -mb-1">Quantités par parfum :</p>
                                                {scents.map(scent => {
                                                    const key_scent = `${p.id}_${scent.name}`;
                                                    return (
                                                        <div key={scent.id} className="flex items-center justify-between gap-2">
                                                            <label htmlFor={key_scent} className="text-gray-300 text-sm">{scent.name}</label>
                                                            <input
                                                                id={key_scent}
                                                                type="number"
                                                                min="0"
                                                                placeholder="0"
                                                                value={requestedQuantities[key_scent] || ''}
                                                                onChange={e => handleQuantityChange(p.id, scent.name, e.target.value)}
                                                                className="w-20 bg-gray-700 p-1 rounded-md text-center"
                                                            />
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-16 text-gray-400">
                            <p>Aucun produit ne correspond à votre recherche "{searchTerm}".</p>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-700 bg-gray-800 flex justify-between items-center">
                    <div>
                        <span className="font-bold text-lg">{totalItems}</span>
                        <span className="text-gray-400"> article(s) dans la demande.</span>
                    </div>
                    <div className="flex gap-4">
                        <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg">Annuler</button>
                        <button onClick={handleSend} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg flex items-center gap-2" disabled={isLoading || totalItems === 0}>
                            {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2"></div> : <><Send size={18}/>Envoyer la demande</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeliveryRequestModal;
