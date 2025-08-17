// src/components/cost/CalculationPanel.jsx
import React, { useState, useMemo } from 'react';
import { db, deleteDoc, doc } from '../../services/firebase';
import { Info, RefreshCw, Trash2, ChevronDown, BookOpen } from 'lucide-react';
import { formatPrice } from '../../utils/formatters';

// Sous-composant pour une ligne de dépense, utilisant le nouveau tooltip CSS
const ExpenseDetailRow = ({ label, value, tooltip }) => (
    <div className="flex justify-between items-center py-1">
        <span className="flex items-center gap-1.5 text-gray-300">
            {label}
            {tooltip && (
                <span className="tooltip-container">
                    <Info size={16} className="text-gray-500" />
                    <span className="tooltip-text">{tooltip}</span>
                </span>
            )}
        </span>
        <span>{formatPrice(value)}</span>
    </div>
);

const CalculationPanel = ({
    calculations,
    savedCalculations,
    saleMode,
    shippingService,
    setShippingService,
    marginMultiplier,
    setMarginMultiplier,
    manualTtcPrice,
    handleManualTtcPriceChange,
    tvaRate,
    setTvaRate,
    availableTvaRates,
    feesRate,
    setFeesRate,
    depotCommissionRate,
    setDepotCommissionRate,
    chargesRate,
    onLoadCalculation,
    showToast
}) => {
    const [isExpensesVisible, setIsExpensesVisible] = useState(false);
    const [isLibraryVisible, setIsLibraryVisible] = useState(false); // Par défaut pliée

    const transactionFeesTooltip = `${formatPrice(calculations.finalClientPrice)} (Total Facturé) × ${feesRate}% = ${formatPrice(calculations.transactionFees)}`;
    const commissionTooltip = `${formatPrice(calculations.productPriceTTC)} (Prix Produit TTC) × ${depotCommissionRate}% = ${formatPrice(calculations.commissionAmount)}`;
    
    const urssafTooltip = useMemo(() => {
        const tva = parseFloat(tvaRate) || 0;
        const turnoverHT = calculations.finalClientPrice / (1 + tva / 100);
        switch(saleMode) {
            case 'internet':
                return `${formatPrice(turnoverHT)} (CA HT) × ${chargesRate}% = ${formatPrice(calculations.businessCharges)}`;
            case 'domicile':
                 return `${formatPrice(calculations.productPriceHT)} (CA HT) × ${chargesRate}% = ${formatPrice(calculations.businessCharges)}`;
            case 'depot':
                return `${formatPrice(calculations.productPriceHT)} (CA HT avant commission) × ${chargesRate}% = ${formatPrice(calculations.businessCharges)}`;
            default:
                return '';
        }
    }, [saleMode, calculations, tvaRate, chargesRate]);


    const handleDeleteCalculation = async (calcId) => {
        if (window.confirm("Supprimer ce calcul sauvegardé ?")) {
            await deleteDoc(doc(db, 'productsCosts', calcId));
            showToast("Calcul supprimé.", "success");
        }
    };

    const getMultiplierStyle = (multiplier) => {
        const value = parseFloat(multiplier);
        const tooltipText = "Seuils de rentabilité :\n- Rouge (< x2.5): Marge faible/à risque\n- Orange (x2.5 - x3.49): Marge correcte\n- Vert (≥ x3.5): Marge saine";

        let colorClass = "bg-red-600 text-white";
        if (value >= 3.5) colorClass = "bg-green-600 text-white";
        else if (value >= 2.5) colorClass = "bg-orange-500 text-white";
        
        return { className: colorClass, tooltip: tooltipText };
    };

    const multiplierStyle = getMultiplierStyle(marginMultiplier);
    
    // NOUVEAU : Calcul du coût d'expédition facturé au client
    const shippingCustomerPrice = useMemo(() => {
        if (saleMode !== 'internet') return 0;
        return calculations.finalClientPrice - calculations.productPriceTTC;
    }, [saleMode, calculations]);

    return (
        <div className="lg:w-2/5 flex flex-col gap-8">
            <div className="bg-gray-800 p-6 rounded-2xl">
                <button onClick={() => setIsLibraryVisible(!isLibraryVisible)} className="w-full flex justify-between items-center text-left mb-6">
                    <h3 className="text-xl font-bold flex items-center gap-2"><BookOpen size={22} /> Bibliothèque de Produits</h3>
                    <ChevronDown className={`transform transition-transform ${isLibraryVisible ? 'rotate-180' : ''}`} />
                </button>
                {isLibraryVisible && (
                    <div className="mb-6 border-t border-gray-700 pt-6 animate-fade-in">
                        <div className="space-y-3 max-h-[40vh] overflow-y-auto custom-scrollbar">
                            {savedCalculations.map(calc => (
                                <div key={calc.id} className="bg-gray-900/50 p-4 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
                                    <p className="font-bold text-base text-white flex-grow text-left w-full md:w-auto">{calc.productName}</p>
                                    <div className="flex-shrink-0 grid grid-cols-3 gap-x-6 text-center">
                                        <div><span className="text-xs text-cyan-400 block">Internet</span><p className="font-semibold text-sm mt-1">{formatPrice(calc.resultsByMode?.Locker?.finalProfit || 0)}</p></div>
                                        <div><span className="text-xs text-purple-400 block">Domicile</span><p className="font-semibold text-sm mt-1">{formatPrice(calc.resultsByMode?.domicile?.finalProfit || 0)}</p></div>
                                        <div><span className="text-xs text-pink-400 block">Dépôt</span><p className="font-semibold text-sm mt-1">{formatPrice(calc.resultsByMode?.depot?.finalProfit || 0)}</p></div>
                                    </div>
                                    <div className="flex-shrink-0 flex gap-2">
                                        <button onClick={() => onLoadCalculation(calc)} className="p-2 bg-gray-700/50 hover:bg-gray-700 text-blue-400 rounded-lg flex items-center gap-2 text-xs"><RefreshCw size={14} /> Recharger</button>
                                        <button onClick={() => handleDeleteCalculation(calc.id)} className="p-2 bg-gray-700/50 hover:bg-gray-700 text-red-500 rounded-lg"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            ))}
                            {savedCalculations.length === 0 && <p className="text-center text-gray-500 py-4">Aucun calcul sauvegardé.</p>}
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-gray-800 p-6 rounded-2xl">
                <h3 className="text-xl font-bold mb-4">Résultats & Paramètres</h3>
                <div className="space-y-6">
                    <div className="space-y-4 p-4 bg-gray-900/50 rounded-lg">
                        <div className="flex justify-between items-center">
                            <label className="text-gray-300">Multiplicateur Marge</label>
                            <div className="flex items-center gap-2">
                                <div className="tooltip-container">
                                    <span className={`px-2 py-1 rounded-md text-sm font-bold ${multiplierStyle.className}`}>
                                        x{parseFloat(marginMultiplier || 0).toFixed(2)}
                                    </span>
                                    <span className="tooltip-text">{multiplierStyle.tooltip}</span>
                                </div>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={marginMultiplier}
                                    onChange={e => setMarginMultiplier(e.target.value)}
                                    onBlur={e => {
                                        const formattedValue = parseFloat(e.target.value || 0).toFixed(2);
                                        setMarginMultiplier(formattedValue);
                                    }}
                                    className="w-24 bg-gray-700 p-2 rounded-lg text-right"
                                />
                            </div>
                        </div>
                        <div className="flex justify-between items-center"><label className="text-gray-300">Prix Vente (TTC)</label><input type="number" step="0.01" value={manualTtcPrice} onChange={handleManualTtcPriceChange} className="w-24 bg-gray-700 p-2 rounded-lg text-right" /></div>
                        <div className="flex justify-between items-center"> <label className="text-gray-300">TVA (%)</label> <div className="flex gap-1 p-1 bg-gray-700 rounded-lg">{availableTvaRates.map(rate => (<button key={rate} onClick={() => setTvaRate(rate.toString())} className={`px-3 py-1.5 rounded-md text-sm font-semibold ${tvaRate === rate.toString() ? 'bg-indigo-600' : 'hover:bg-gray-600'}`}>{rate}%</button>))}</div> </div>
                        {(saleMode === 'internet' || saleMode === 'domicile') && <div className="flex justify-between items-center"><label className="text-gray-300">Frais Transaction %</label><input type="number" step="0.1" value={feesRate} onChange={e => setFeesRate(e.target.value)} className="w-24 bg-gray-700 p-2 rounded-lg text-right" /></div>}
                        {saleMode === 'depot' && <div className="flex justify-between items-center"><label className="text-gray-300">Commission Dépôt %</label><input type="number" step="1" value={depotCommissionRate} onChange={e => setDepotCommissionRate(e.target.value)} className="w-24 bg-gray-700 p-2 rounded-lg text-right" /></div>}
                    </div>

                    {saleMode === 'internet' && (
                        <div className="p-4 bg-gray-900/50 rounded-lg">
                            <label className="text-gray-300 mb-2 block">Service d'expédition</label>
                            <div className="flex gap-1 p-1 bg-gray-700 rounded-lg">
                                {['Locker', 'Point Relais', 'Domicile'].map(service => (
                                    <button key={service} onClick={() => setShippingService(service)} className={`flex-1 px-3 py-1.5 rounded-md text-sm font-semibold ${shippingService === service ? 'bg-indigo-600' : 'hover:bg-gray-600'}`}>{service}</button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2 pt-2">
                        <div className="flex justify-between p-2"><span className="text-gray-400">Coût de Production</span><span className="font-bold text-lg text-yellow-400">{formatPrice(calculations.productCost)}</span></div>
                        <hr className="border-gray-700/50" />
                        <div className="flex justify-between p-2"><span className="text-gray-300">Prix Produit (TTC)</span><span className="font-bold text-lg">{formatPrice(calculations.productPriceTTC)}</span></div>
                        
                        {/* NOUVELLE LIGNE AJOUTÉE ICI */}
                        {saleMode === 'internet' && (
                            <div className="flex justify-between p-2"><span className="text-gray-300">Expédition (facturée)</span><span className="font-bold text-lg">{formatPrice(shippingCustomerPrice)}</span></div>
                        )}

                        <div className="flex justify-between p-3 font-semibold bg-gray-900/50 rounded-md"><span className="text-gray-200">Total Facturé Client</span><span className="text-xl">{formatPrice(calculations.finalClientPrice)}</span></div>
                        <hr className="border-gray-700/50" />
                        
                        <button onClick={() => setIsExpensesVisible(!isExpensesVisible)} className="w-full flex justify-between items-center text-red-400 p-2 text-left">
                            <span className="font-semibold">- Dépenses Totales</span>
                            <div className="flex items-center gap-2">
                                <span className="font-bold">{formatPrice(calculations.totalExpenses)}</span>
                                <ChevronDown className={`transform transition-transform ${isExpensesVisible ? 'rotate-180' : ''}`} size={20} />
                            </div>
                        </button>

                        {isExpensesVisible && (
                            <div className="pl-6 border-l-2 border-gray-700/50 text-base animate-fade-in">
                                <ExpenseDetailRow label="Coût matières" value={calculations.productCost} tooltip="Coût total des composants du produit." />
                                {saleMode === 'internet' && <ExpenseDetailRow label="Coût emballage" value={calculations.packagingCost} tooltip="Coût du carton, étiquettes, etc." />}
                                {saleMode === 'internet' && <ExpenseDetailRow label="Coût expédition" value={calculations.shippingProviderCost} tooltip="Ce que vous payez réellement au transporteur." />}
                                {(saleMode === 'internet' || saleMode === 'domicile') && <ExpenseDetailRow label="Frais de transaction" value={calculations.transactionFees} tooltip={transactionFeesTooltip} />}
                                {saleMode === 'depot' && <ExpenseDetailRow label="Commission dépôt" value={calculations.commissionAmount} tooltip={commissionTooltip} />}
                                <ExpenseDetailRow label="Cotisations URSSAF" value={calculations.businessCharges} tooltip={urssafTooltip} />
                            </div>
                        )}

                        <div className="flex justify-between items-center bg-green-500/10 p-4 rounded-lg border border-green-500/30 mt-4">
                            <span className="text-green-300 font-semibold text-lg">Bénéfice Net</span>
                            <span className="font-bold text-3xl text-green-400">{formatPrice(calculations.finalProfit)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalculationPanel;
