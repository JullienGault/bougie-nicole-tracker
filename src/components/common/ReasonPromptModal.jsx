// src/components/common/ReasonPromptModal.jsx
import React, { useState } from 'react';

const ReasonPromptModal = ({ title, message, onConfirm, onCancel }) => {
    const [reason, setReason] = useState('');

    const handleConfirm = () => {
        if (!reason.trim()) {
            alert("Le motif est obligatoire.");
            return;
        }
        onConfirm(reason);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60]" onClick={onCancel}>
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-700 animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-semibold text-white">{title}</h3>
                <p className="text-gray-400 mt-2">{message}</p>
                <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Motif (obligatoire)</label>
                    <textarea
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        rows="4"
                        className="w-full bg-gray-700 p-3 rounded-lg"
                        placeholder="Ex: Rupture de stock sur un produit...">
                    </textarea>
                </div>
                <div className="mt-8 flex justify-end gap-4">
                    <button onClick={onCancel} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg">Annuler</button>
                    <button onClick={handleConfirm} className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50" disabled={!reason.trim()}>
                        Valider et Enregistrer
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReasonPromptModal;
