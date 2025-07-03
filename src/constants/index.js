// src/constants/index.js
export const APP_NAME = "Bougie Nicole - Gestion Dépôts";
export const APP_TITLE = "Bougie Nicole Tracker";
export const LOW_STOCK_THRESHOLD = 3;

export const DELIVERY_STATUS_STEPS = {
    pending: 'En attente',
    processing: 'En traitement',
    shipping: 'En cours de livraison',
    delivered: 'Livrée',
    cancelled: 'Annulée'
};

export const deliveryStatusOrder = ['pending', 'processing', 'shipping', 'delivered'];

export const PAYOUT_STATUSES = {
    pending: { text: 'En attente', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    processing: { text: 'En traitement', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    received: { text: 'Reçu', color: 'text-green-400', bg: 'bg-green-500/10' },
};

export const payoutStatusOrder = ['pending', 'processing', 'received'];
