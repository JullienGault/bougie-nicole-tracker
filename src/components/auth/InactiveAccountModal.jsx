// src/components/auth/InactiveAccountModal.jsx
import React from 'react';
import { AlertTriangle } from 'lucide-react';

const InactiveAccountModal = ({ onLogout }) => (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50 animate-fade-in">
        <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 text-center animate-fade-in-up">
            <AlertTriangle className="mx-auto h-12 w-12 text-yellow-400" />
            <h3 className="mt-4 text-xl font-semibold text-white">Compte Inactif</h3>
            <p className="text-gray-400 mt-2">Votre compte a été désactivé. Veuillez contacter un administrateur pour plus d'informations.</p>
            <div className="mt-8">
                <button onClick={onLogout} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg">Déconnexion</button>
            </div>
        </div>
    </div>
);

export default InactiveAccountModal;
