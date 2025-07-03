// src/components/delivery/DeliveryDetailsModal.jsx
import React from 'react';
import { AlertTriangle, Check, Package } from 'lucide-react';
import { DELIVERY_STATUSES, deliveryStatusOrder } from '../../constants';

// Ce composant n'est plus une modale, mais un bloc de contenu.
// Il ne reçoit donc plus de fonction "onClose".
const DeliveryDetailsModal = ({ request }) => {

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
        // L'élément racine est maintenant un simple <div>
        <div>
            <section className="mb-6 p-4 bg-gray-900/50 rounded-lg">
                <DeliveryStatusTracker status={request.status} />
            </section>

            <section>
                <h3 className="text-lg font-semibold mb-4">Articles Demandés</h3>
                <div className="bg-gray-700/50 p-4 rounded-lg max-h-60 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-gray-600 text-sm">
                                <th className="p-2">Produit</th>
                                <th className="p-2 text-center w-32">Quantité</th>
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
            {/* Le bouton "Fermer" a été retiré, car la fermeture se fait en repliant la carte. */}
        </div>
    );
};

export default DeliveryDetailsModal;
