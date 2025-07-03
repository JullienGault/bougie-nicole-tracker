// src/components/delivery/ProcessDeliveryModal.jsx
import React, { useState, useContext } from 'react';
import { AlertTriangle, Check, XCircle, Save, Truck, Trash2, CheckCircle as CheckCircleIcon } from 'lucide-react';
import { AppContext } from '../../contexts/AppContext';
import { db, doc, updateDoc, addDoc, collection, serverTimestamp, runTransaction } from '../../services/firebase';
import { DELIVERY_STATUSES, deliveryStatusOrder } from '../../constants';
import { formatDate } from '../../utils/formatters';
import ReasonPromptModal from '../common/ReasonPromptModal';

const ProcessDeliveryModal = ({ request, onClose, onCancelRequest }) => {
    const { products, showToast } = useContext(AppContext);
    const [isLoading, setIsLoading] = useState(false);
    const [editableItems, setEditableItems] = useState(request.items);
    const [showReasonModal, setShowReasonModal] = useState(false);

    const DeliveryStatusTracker = ({ status }) => {
        if (status === 'cancelled') {
            return (
                <div className="flex items-center gap-4 bg-red-500/10 p-3 rounded-lg"><AlertTriangle className="h-8 w-8 text-red-500"/><div><h4 className="font-bold text-red-400">Commande Annulée</h4><p className="text-xs text-gray-400">Cette commande ne sera pas traitée.</p></div></div>
            );
        }
        const currentIndex = deliveryStatusOrder.indexOf(status);
        return (
            <div className="flex items-center space-x-4">
                {deliveryStatusOrder.map((step, index) => {
                    const isCompleted = index < currentIndex; const isActive = index === currentIndex;
                    return (
                        <React.Fragment key={step}>
                            <div className="flex flex-col items-center text-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${isCompleted ? 'bg-green-600' : isActive ? 'bg-blue-600 animate-pulse' : 'bg-gray-600'}`}>
                                    {isCompleted ? <Check size={16} /> : <span className="text-xs font-bold">{index + 1}</span>}
                                </div>
                                <p className={`mt-2 text-xs w-20 ${isActive ? 'text-white font-bold' : 'text-gray-400'}`}>{DELIVERY_STATUSES[step]?.text || step}</p>
                            </div>
                            {index < deliveryStatusOrder.length - 1 && (<div className={`flex-1 h-1 rounded-full ${isCompleted ? 'bg-green-600' : 'bg-gray-600'}`}></div>)}
                        </React.Fragment>
                    );
                })}
            </div>
        );
    };

    const handleQuantityChange = (index, quantity) => { const newItems = [...editableItems]; newItems[index].quantity = Math.max(0, Number(quantity)); setEditableItems(newItems); };
    const handleRemoveItem = (index) => { setEditableItems(editableItems.filter((_, i) => i !== index)); };

    const handleSaveChanges = async (reason) => {
        setShowReasonModal(false); setIsLoading(true);
        try {
            const requestDocRef = doc(db, 'deliveryRequests', request.id);
            await updateDoc(requestDocRef, { items: editableItems, modificationReason: reason, originalItems: request.originalItems || request.items });
            await addDoc(collection(db, 'notifications'), { recipientUid: request.posId, message: `Votre demande de livraison du ${formatDate(request.createdAt)} a été modifiée.`, createdAt: serverTimestamp(), isRead: false, type: 'DELIVERY_UPDATE' });
            showToast("Modifications enregistrées !", "success");
        } catch (error) { showToast("Erreur lors de la sauvegarde.", "error"); }
        finally { setIsLoading(false); }
    };

    const handleAdvanceStatus = async () => {
        setIsLoading(true);
        const currentIndex = deliveryStatusOrder.indexOf(request.status);
        if (currentIndex >= deliveryStatusOrder.length - 1) { setIsLoading(false); return; }
        const nextStatus = deliveryStatusOrder[currentIndex + 1];
        try {
            if (nextStatus === 'delivered') {
                await runTransaction(db, async (transaction) => {
                    const requestDocRef = doc(db, "deliveryRequests", request.id);
                    for (const item of editableItems) {
                        const product = products.find(p => p.id === item.productId);
                        if (!product) throw new Error(`Produit ID ${item.productId} non trouvé.`);

                        const stockId = item.productId;
                        const stockDocRef = doc(db, `pointsOfSale/${request.posId}/stock`, stockId);
                        const stockDoc = await transaction.get(stockDocRef);

                        if (stockDoc.exists()) {
                            transaction.update(stockDocRef, { quantity: (stockDoc.data().quantity || 0) + item.quantity });
                        } else {
                            transaction.set(stockDocRef, { productId: item.productId, productName: product.name, price: product.price, scent: null, quantity: item.quantity });
                        }
                    }
                    transaction.update(requestDocRef, { status: 'delivered', items: editableItems });
                });
                showToast("Livraison confirmée et stock mis à jour !", "success");
            } else {
                await updateDoc(doc(db, 'deliveryRequests', request.id), { status: nextStatus });
                const nextStatusText = DELIVERY_STATUSES[nextStatus]?.text || nextStatus;
                showToast(`Statut mis à jour : ${nextStatusText}`, "success");
            }
            const notificationMessage = `Le statut de votre commande est maintenant : "${DELIVERY_STATUSES[nextStatus]?.text || nextStatus}".`;
            await addDoc(collection(db, 'notifications'), { recipientUid: request.posId, message: notificationMessage, createdAt: serverTimestamp(), isRead: false, type: 'DELIVERY_UPDATE' });
            onClose();
        } catch (error) {
            console.error("Erreur: ", error);
            showToast(error.message || "Erreur lors de la mise à jour.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const isLastStep = request.status === 'shipping'; const canAdvance = request.status !== 'delivered' && request.status !== 'cancelled';

    return (
        <>
            {showReasonModal && <ReasonPromptModal title="Justifier les modifications" message="Veuillez expliquer pourquoi la commande est modifiée." onConfirm={handleSaveChanges} onCancel={() => setShowReasonModal(false)}/>}
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={onClose}>
                <div className="bg-gray-800 p-8 rounded-2xl w-full max-w-3xl" onClick={e=>e.stopPropagation()}>
                    <div className="flex justify-between items-start mb-6">
                        <div><h2 className="text-2xl font-bold text-white mb-2">Gérer la livraison pour :</h2><p className="text-indigo-400 text-xl font-semibold">{request.posName}</p></div>
                        {canAdvance && <button onClick={() => onCancelRequest(request)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><XCircle size={18}/>Annuler la Commande</button>}
                    </div>
                    <div className="mb-8"><DeliveryStatusTracker status={request.status} /></div>
                    <div className="bg-gray-700/50 p-4 rounded-lg max-h-64 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead><tr className="border-b border-gray-600"><th className="p-2">Produit</th><th className="p-2 w-32">Quantité</th><th className="p-2 w-16">Actions</th></tr></thead>
                            <tbody>
                                {editableItems.map((item, index) => (
                                    <tr key={index} className="border-b border-gray-700/50">
                                        <td className="p-2">{item.productName || 'Inconnu'}</td>
                                        <td className="p-2"><input type="number" value={item.quantity} onChange={(e) => handleQuantityChange(index, e.target.value)} className="w-20 bg-gray-600 p-1 rounded-md text-center" disabled={!canAdvance} /></td>
                                        <td className="p-2">{canAdvance && <button onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-400 p-1"><Trash2 size={18}/></button>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-8 flex justify-between items-center">
                        {canAdvance ? <button onClick={() => setShowReasonModal(true)} disabled={isLoading} className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50"><Save size={18}/> Enregistrer Modifications</button> : <div />}
                        <div className="flex gap-4">
                            <button type="button" onClick={onClose} className="bg-gray-600 font-bold py-2 px-4 rounded-lg">Fermer</button>
                            {canAdvance && <button onClick={handleAdvanceStatus} disabled={isLoading} className={`${isLastStep ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50`}>{isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2"></div> : isLastStep ? <><CheckCircleIcon size={18}/>Confirmer la Livraison</> : <><Truck size={18}/>Étape Suivante</>}</button>}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
export default ProcessDeliveryModal;
