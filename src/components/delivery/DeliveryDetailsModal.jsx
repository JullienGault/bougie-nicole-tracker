// src/components/delivery/DeliveryDetailsModal.jsx
import React from 'react';
import { X, AlertTriangle, Check, Package } from 'lucide-react';
import { DELIVERY_STATUSES, deliveryStatusOrder } from '../../constants';

const DeliveryDetailsModal = ({ request, onClose }) => {

    const DeliveryStatusTracker = ({ status }) => {
        if (status === 'cancelled') {
            return (
                <div className="flex items-center gap-4 bg-red-500/10 p-4 rounded-lg">
                    <AlertTriangle className="h-10 w-10 text-red-500 flex-shrink-0" />
                    <div>
                        <h4 className="font-bold text-red-400">Commande Annulée</h4>
                        {request.cancellationReason && <p className="text-xs text-gray-300 mt-1">Motif : {request.cancellationReason}</p>}
                    </div>
                </div>
            );
        }
        const currentIndex = deliveryStatusOrder.indexOf(status);
        return (
            <div className="flex items-center space-x-2 sm:space-x-4">
                {deliveryStatusOrder.map((step, index) => {
                    const isCompleted = index < currentIndex;
                    const isActive = index === currentIndex;
                    const statusConfig = DELIVERY_STATUSES[step] || DELIVERY_STATUSES.default;
                    return (
                        <React.Fragment key={step}>
                            <div className="flex flex-col items-center text-center">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${isCompleted ? 'bg-green-600' : isActive ? 'bg-blue-600 animate-pulse' : 'bg-gray-600'}`}>
                                    {isCompleted ? <Check size={20} /> : <Package size={20} />}
                                </div>
                                <p className={`mt-2 text-xs w-24 ${isActive ? 'text-white font-bold' : 'text-gray-400'}`}>{statusConfig.text}</p>
                            </div>
                            {index < deliveryStatusOrder.length - 1 && (
                                <div className={`flex-1 h-1 rounded-full ${isCompleted ? 'bg-green-600' : 'bg-gray-600'}`}></div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[70]" onClick={onClose}>
            <div className="bg-gray-800 p-8 rounded-2xl w-full max-w-3xl border-gray-700" onClick={e => e.stopPropagation()}>
                <header className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Détail de la Livraison</h2>
                        <p className="text-gray-400">Suivi de votre demande du {new Date(request.createdAt?.toDate()).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white"><X size={24} /></button>
                </header>

                <section className="mb-8 p-4 bg-gray-900/50 rounded-lg">
                    <DeliveryStatusTracker status={request.status} />
                </section>

                <section>
                    <h3 className="text-lg font-semibold mb-4">Articles Demandés</h3>
                    <div className="bg-gray-700/50 p-4 rounded-lg max-h-60 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-gray-600 text-sm">
                                    <th className="p-2">Produit</th>
                                    <th className="p-2 text-center w-32">Quantité Demandée</th>
                                </tr>
                            </thead>
                            <tbody>
                                {request.items.map((item, index) => (
                                    <tr key={index} className="border-b border-gray-700/50">
                                        <td className="p-3 font-medium">{item.productName}</td>
                                        <td className="p-3 text-center font-bold">{item.quantity}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <footer className="mt-8 flex justify-end">
                    <button onClick={onClose} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg">Fermer</button>
                </footer>
            </div>
        </div>
    );
};

export default DeliveryDetailsModal;
