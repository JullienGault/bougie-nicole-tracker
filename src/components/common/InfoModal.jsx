// src/components/common/InfoModal.jsx
import React from 'react';
import { Info } from 'lucide-react';

const InfoModal = ({ title, message, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
        <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="text-center">
                <Info className="mx-auto h-12 w-12 text-blue-400" />
                <h3 className="mt-4 text-xl font-semibold text-white">{title}</h3>
                <p className="text-gray-400 mt-2">{message}</p>
            </div>
            <div className="mt-8 flex justify-center">
                <button onClick={onClose} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg">Fermer</button>
            </div>
        </div>
    </div>
);

export default InfoModal;
