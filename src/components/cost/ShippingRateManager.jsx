// src/components/cost/ShippingRateManager.jsx
import React, { useState, useMemo, useContext } from 'react';
import { db, addDoc, updateDoc, deleteDoc, doc, collection, writeBatch, query, where, getDocs } from '../../services/firebase';
import { AppContext } from '../../contexts/AppContext';
import { Edit, Trash2, PackagePlus } from 'lucide-react';
import { formatPrice } from '../../utils/formatters';

const ShippingRateManager = ({ rates }) => {
    const { showToast } = useContext(AppContext);
    const [activeService, setActiveService] = useState('Locker');
    const [maxWeight, setMaxWeight] = useState('');
    const [providerCost, setProviderCost] = useState('');
    const [customerPrice, setCustomerPrice] = useState('');
    const [editingId, setEditingId] = useState(null);

    const services = ['Locker', 'Point Relais', 'Domicile'];

    const resetForm = () => {
        setMaxWeight('');
        setProviderCost('');
        setCustomerPrice('');
        setEditingId(null);
    };

    const handleSaveRate = async () => {
        const weight = parseInt(maxWeight, 10);
        const cost = parseFloat(providerCost);
        const price = parseFloat(customerPrice);

        if (isNaN(weight) || weight <= 0 || isNaN(cost) || cost < 0 || isNaN(price) || price < 0) {
            showToast("Veuillez entrer des valeurs valides pour tous les champs.", "error");
            return;
        }

        const data = { 
            service: activeService,
            maxWeight: weight, 
            cost, 
            price 
        };

        try {
            if (editingId) {
                await updateDoc(doc(db, 'shippingRates', editingId), data);
                showToast("Tarif mis à jour.", "success");
            } else {
                await addDoc(collection(db, 'shippingRates'), data);
                showToast("Nouveau tarif ajouté.", "success");
            }
            resetForm();
        } catch (error) { 
            showToast("Erreur lors de la sauvegarde du tarif.", "error"); 
        }
    };

    const handleDeleteRate = async (rateId) => {
        if (window.confirm("Supprimer ce tarif ?")) {
            await deleteDoc(doc(db, 'shippingRates', rateId));
            showToast("Tarif supprimé.", "success");
        }
    };

    const handleInitializeRates = async () => {
        if (!window.confirm("Cette action va ajouter les 45 tarifs de base de Mondial Relay. Si des tarifs existent déjà, ils ne seront pas dupliqués. Continuer ?")) {
            return;
        }

        const mondialRelayRates = {
            'Locker': [
                {w: 250, c: 3.59}, {w: 500, c: 3.59}, {w: 750, c: 3.59}, {w: 1000, c: 3.59}, {w: 2000, c: 5.39}, 
                {w: 3000, c: 5.99}, {w: 4000, c: 6.89}, {w: 5000, c: 9.29}, {w: 7000, c: 12.19}, {w: 10000, c: 13.69}, 
                {w: 15000, c: 19.79}, {w: 20000, c: 20.89}, {w: 25000, c: 31.00}
            ],
            'Point Relais': [
                {w: 250, c: 4.20}, {w: 500, c: 4.30}, {w: 750, c: 5.40}, {w: 1000, c: 5.40}, {w: 2000, c: 6.60},
                {w: 3000, c: 7.40}, {w: 4000, c: 8.90}, {w: 5000, c: 12.40}, {w: 7000, c: 14.40}, {w: 10000, c: 14.40},
                {w: 15000, c: 22.40}, {w: 20000, c: 22.40}, {w: 25000, c: 32.40}
            ],
            'Domicile': [
                {w: 250, c: 4.99}, {w: 500, c: 6.79}, {w: 750, c: 8.55}, {w: 1000, c: 8.79}, {w: 2000, c: 9.99},
                {w: 3000, c: 14.99}, {w: 4000, c: 14.99}, {w: 5000, c: 14.99}, {w: 7000, c: 18.99}, {w: 10000, c: 23.99},
                {w: 15000, c: 28.99}, {w: 20000, c: 39.70}, {w: 25000, c: 39.70}
            ]
        };

        try {
            const batch = writeBatch(db);
            let count = 0;
            for (const service of services) {
                const existingRatesSnapshot = await getDocs(query(collection(db, 'shippingRates'), where('service', '==', service)));
                if (existingRatesSnapshot.empty) {
                    mondialRelayRates[service].forEach(rate => {
                        const rateDocRef = doc(collection(db, 'shippingRates'));
                        batch.set(rateDocRef, {
                            service: service,
                            maxWeight: rate.w,
                            cost: rate.c,
                            price: rate.c // Prix client initialisé au coût
                        });
                        count++;
                    });
                }
            }
            if (count > 0) {
                await batch.commit();
                showToast(`${count} tarifs ont été ajoutés avec succès !`, "success");
            } else {
                showToast("Les tarifs semblent déjà initialisés pour tous les services.", "info");
            }
        } catch (error) {
            console.error("Erreur lors de l'initialisation des tarifs :", error);
            showToast("Une erreur est survenue lors de l'initialisation.", "error");
        }
    };

    const startEditing = (rate) => {
        setEditingId(rate.id);
        setMaxWeight(rate.maxWeight);
        setProviderCost(rate.cost);
        setCustomerPrice(rate.price);
        setActiveService(rate.service);
    };

    const filteredRates = useMemo(() => rates.filter(r => r.service === activeService).sort((a, b) => a.maxWeight - b.maxWeight), [rates, activeService]);
    
    return (
        <>
            <div className="flex justify-between items-center mb-4">
                <div className="flex gap-1 p-1 bg-gray-900 rounded-lg">
                    {services.map(service => (
                        <button key={service} onClick={() => setActiveService(service)} className={`px-3 py-1.5 rounded-md text-sm font-semibold ${activeService === service ? 'bg-indigo-600' : 'hover:bg-gray-600'}`}>
                            {service}
                        </button>
                    ))}
                </div>
                <button onClick={handleInitializeRates} className="p-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg flex items-center gap-2 text-xs">
                    <PackagePlus size={16}/> Pré-remplir les tarifs
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-4">
                <div><label className="text-sm text-gray-400">Poids max (g)</label><input type="number" value={maxWeight} onChange={e => setMaxWeight(e.target.value)} placeholder="500" className="w-full bg-gray-700 p-2 rounded-lg mt-1" /></div>
                <div><label className="text-sm text-gray-400">Coût Transporteur (€)</label><input type="number" step="0.01" value={providerCost} onChange={e => setProviderCost(e.target.value)} placeholder="4.90" className="w-full bg-gray-700 p-2 rounded-lg mt-1" /></div>
                <div><label className="text-sm text-gray-400">Prix Client (€)</label><input type="number" step="0.01" value={customerPrice} onChange={e => setCustomerPrice(e.target.value)} placeholder="5.90" className="w-full bg-gray-700 p-2 rounded-lg mt-1" /></div>
                <button onClick={handleSaveRate} className="bg-indigo-600 py-2 px-4 rounded-lg h-[42px]">{editingId ? 'Modifier' : 'Ajouter'}</button>
            </div>
            {editingId && <button onClick={resetForm} className="text-xs text-gray-400 hover:text-white mb-2">Annuler la modification</button>}
            <div className="max-h-48 overflow-y-auto custom-scrollbar">
                {filteredRates.map(rate => (
                    <div key={rate.id} className="flex justify-between items-center p-2 bg-gray-900/50 rounded mb-2">
                        <span>Jusqu'à <span className="font-bold">{rate.maxWeight}g</span></span>
                        <div className="text-right">
                            <span className="font-semibold">{formatPrice(rate.price)} <span className="text-xs text-gray-400">(Client)</span></span><br/>
                            <span className="text-xs text-yellow-400">{formatPrice(rate.cost)} <span className="text-gray-400">(Coût)</span></span>
                        </div>
                        <div className="flex gap-2">
                           <button onClick={() => startEditing(rate)} className="text-yellow-400 p-1"><Edit size={16}/></button>
                           <button onClick={() => handleDeleteRate(rate.id)} className="text-red-500 p-1"><Trash2 size={16}/></button>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
};

export default ShippingRateManager;
