// src/components/common/ConfirmationModal.jsx
import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

const ConfirmationModal = ({ title, message, onConfirm, onCancel, confirmText = "Confirmer", cancelText = "Annuler", confirmColor = "bg-red-600 hover:bg-red-700", requiresReason = false }) => {
    const [reason, setReason] = useState('');

    const handleConfirm = () => {
        if (requiresReason && !reason.trim()) {
            alert("Veuillez fournir une raison.");
            return;
        }
        onConfirm(requiresReason ? reason : undefined);
    };

    return (
        // Conteneur principal avec z-index élevé et positionnement
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            {/* Fond noir séparé */}
            <div className="absolute inset-0 bg-black/75 animate-fade-in" onClick={onCancel}></div>

            {/* Panneau du modal avec positionnement relatif */}
            <div 
                className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 animate-fade-in-up relative" 
                onClick={e => e.stopPropagation()}
            >
                <div className="text-center">
                    <AlertTriangle className="mx-auto h-12 w-12 text-yellow-400" />
                    <h3 className="mt-4 text-xl font-semibold text-white">{title}</h3>
                    <div className="text-gray-400 mt-2 whitespace-pre-line">{message}</div>
                </div>
                {requiresReason && (
                    <div className="mt-6">
                        <label className="block text-sm font-medium text-gray-300 mb-2">Raison (obligatoire)</label>
                        <textarea value={reason} onChange={e => setReason(e.target.value)} rows="3" className="w-full bg-gray-700 p-3 rounded-lg" placeholder="Ex: Rupture de stock, demande client..."></textarea>
                    </div>
                )}
                <div className="mt-8 flex justify-center gap-4">
                    <button onClick={onCancel} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg">{cancelText}</button>
                    {onConfirm && <button onClick={handleConfirm} className={`${confirmColor} text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50`} disabled={requiresReason && !reason.trim()}>{confirmText}</button>}
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
