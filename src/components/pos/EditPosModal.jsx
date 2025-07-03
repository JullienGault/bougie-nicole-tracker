// src/components/pos/EditPosModal.jsx
import React, { useState, useContext } from 'react';
import { Save, Info } from 'lucide-react';
import { AppContext } from '../../contexts/AppContext';
import { db, writeBatch, doc, addDoc, collection, serverTimestamp } from '../../services/firebase';
import { formatPercent } from '../../utils/formatters';

const EditPosModal = ({ pos, onClose, onSave, hasOpenBalance }) => {
    const { showToast } = useContext(AppContext);
    const [name, setName] = useState(pos.name);
    const [commissionRate, setCommissionRate] = useState((pos.commissionRate || 0) * 100);
    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async (event) => {
        event.preventDefault();

        if (hasOpenBalance && pos.commissionRate * 100 !== parseFloat(commissionRate)) {
            showToast("Clôturez la période de paiement en cours avant de modifier la commission.", "error");
            return;
        }

        setIsLoading(true);
        const newRate = parseFloat(commissionRate) / 100;
        if (isNaN(newRate) || newRate < 0 || newRate > 1) {
            showToast("Le taux de commission doit être entre 0 et 100.", "error");
            setIsLoading(false);
            return;
        }
        try {
            const batch = writeBatch(db);
            const posDocRef = doc(db, "pointsOfSale", pos.id);
            const userDocRef = doc(db, "users", pos.id);

            batch.update(posDocRef, { name: name, commissionRate: newRate });
            batch.update(userDocRef, { displayName: name });

            await batch.commit();

            if (pos.commissionRate !== newRate) {
                await addDoc(collection(db, 'notifications'), {
                    recipientUid: pos.id,
                    message: `Le taux de votre commission a été mis à jour à ${formatPercent(newRate)}.`,
                    createdAt: serverTimestamp(),
                    isRead: false,
                    type: 'COMMISSION_UPDATE'
                });
            }

            showToast("Dépôt mis à jour avec succès !", "success");
            onSave();
            onClose();
        } catch (error) {
            console.error("Erreur de mise à jour du dépôt : ", error);
            showToast("Erreur lors de la mise à jour.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-gray-800 p-8 rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-white mb-6">Paramètres du Dépôt-Vente</h2>
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Nom du Dépôt</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Taux de Commission (%)</label>
                        <input
                            type="number"
                            value={commissionRate}
                            onChange={e => setCommissionRate(e.target.value)}
                            required
                            min="0"
                            max="100"
                            className={`w-full bg-gray-700 p-3 rounded-lg ${hasOpenBalance ? 'cursor-not-allowed bg-gray-900/50' : ''}`}
                            disabled={hasOpenBalance}
                        />
                        {hasOpenBalance && (
                            <p className="text-xs text-yellow-400 mt-2">
                                <Info size={14} className="inline mr-1" />
                                Vous devez clôturer la période de paiement en cours pour modifier ce taux.
                            </p>
                        )}
                    </div>
                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Annuler</button>
                        <button type="submit" disabled={isLoading} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50">
                            {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2"></div> : <><Save size={18}/>Enregistrer</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditPosModal;
