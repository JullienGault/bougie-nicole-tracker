// src/components/cost/ItemList.jsx
import React from 'react';
import { X } from 'lucide-react';

const ItemList = ({ title, icon: Icon, items, onQuantityChange, onRemoveItem }) => (
    <div className="p-4 rounded-2xl">
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2"><Icon size={20} /> {title}</h3>
        {items.length > 0 && (
            <div className="grid grid-cols-[1fr_80px_40px_auto] gap-3 items-center px-2 text-sm text-gray-400 uppercase font-semibold mb-2">
                <span>Élément</span><span className="text-center">Qté</span><span>Unité</span>
            </div>
        )}
        <div className="space-y-2 max-h-[30vh] overflow-y-auto custom-scrollbar pr-2">
            {items.map(item => (
                <div key={item.materialId} className="grid grid-cols-[1fr_80px_40px_auto] gap-3 items-center bg-gray-900/50 p-2 rounded-lg">
                    <div className="font-semibold truncate pr-2">{item.name}</div>
                    <input 
                        type="number" 
                        step="0.1" 
                        value={item.quantity} 
                        onChange={e => onQuantityChange(item.materialId, e.target.value)} 
                        className="w-full bg-gray-700 p-1 rounded text-center"
                    />
                    <span className="text-sm text-gray-400">{item.standardizedUnit}</span>
                    {/* CORRIGÉ : Ajout de type="button" */}
                    <button type="button" onClick={() => onRemoveItem(item.materialId)} className="text-red-500 p-1"><X size={18}/></button>
                </div>
            ))}
            {items.length === 0 && <p className="text-center text-gray-500 py-4">Ajoutez un élément depuis la bibliothèque.</p>}
        </div>
    </div>
);

export default ItemList;
