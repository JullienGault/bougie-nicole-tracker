// src/components/common/FullScreenDataModal.jsx
import React from 'react';
import { X } from 'lucide-react';

const FullScreenDataModal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) {
        return null;
    }

    return (
        <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-gray-800 rounded-2xl w-[95vw] h-[90vh] flex flex-col shadow-2xl border border-gray-700 animate-fade-in-up"
                onClick={e => e.stopPropagation()}
            >
                <header className="p-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-xl font-bold text-white">{title}</h2>
                    <button 
                        onClick={onClose} 
                        className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                        title="Fermer"
                    >
                        <X size={24} />
                    </button>
                </header>
                <main className="flex-grow p-6 overflow-y-auto custom-scrollbar">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default FullScreenDataModal;
