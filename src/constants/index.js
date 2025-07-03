// src/constants/index.js
import { Truck, User, Percent, AlertTriangle, PackageCheck } from 'lucide-react';

export const APP_NAME = "Bougie Nicole - Gestion Dépôts";
export const APP_TITLE = "Bougie Nicole Tracker";
export const LOW_STOCK_THRESHOLD = 1;

export const PAYOUT_STATUSES = {
    pending: { text: 'En attente', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    processing: { text: 'En traitement', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    received: { text: 'Reçu', color: 'text-green-400', bg: 'bg-green-500/10' },
};

export const DELIVERY_STATUS_STEPS = {
    pending: 'En attente',
    processing: 'En traitement',
    shipping: 'En cours de livraison',
    delivered: 'Livrée',
    cancelled: 'Annulée'
};

export const deliveryStatusOrder = ['pending', 'processing', 'shipping', 'delivered'];

export const NOTIFICATION_CONFIG = {
    NEW_DELIVERY_REQUEST: {
        icon: Truck,
        color: 'text-blue-400',
        // MODIFICATION ICI
        action: 'OPEN_DELIVERY_VIEW'
    },
    DELIVERY_UPDATE: {
        icon: PackageCheck,
        color: 'text-green-400',
        action: 'VIEW_DELIVERIES'
    },
    PROFILE_UPDATE: {
        icon: User,
        color: 'text-cyan-400',
        action: 'VIEW_POS_DETAILS'
    },
    COMMISSION_UPDATE: {
        icon: Percent,
        color: 'text-purple-400',
        action: 'VIEW_PROFILE'
    },
    LOW_STOCK_ALERT: {
        icon: AlertTriangle,
        color: 'text-yellow-400',
        action: 'VIEW_STOCK'
    },
    DEFAULT: {
        icon: Truck,
        color: 'text-gray-400'
    }
};
