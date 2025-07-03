// src/constants/index.js
import { Truck, User, Percent, AlertTriangle, PackageCheck, Clock, Cog, CheckCircle, XCircle } from 'lucide-react';

export const APP_NAME = "Bougie Nicole - Gestion Dépôts";
export const APP_TITLE = "Bougie Nicole Tracker";
export const LOW_STOCK_THRESHOLD = 1;

export const PAYOUT_STATUSES = {
    pending: { text: 'En attente', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    processing: { text: 'En traitement', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    received: { text: 'Reçu', color: 'text-green-400', bg: 'bg-green-500/10' },
};

// NOUVEL OBJET DE CONFIGURATION POUR LES STATUTS DE LIVRAISON
export const DELIVERY_STATUSES = {
    pending: { text: 'En attente', icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    processing: { text: 'En traitement', icon: Cog, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    shipping: { text: 'En cours de livraison', icon: Truck, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    delivered: { text: 'Livrée', icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
    cancelled: { text: 'Annulée', icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
    default: { text: 'Inconnu', icon: Clock, color: 'text-gray-400', bg: 'bg-gray-500/10' }
};

// L'ancien objet est maintenant déprécié, mais nous gardons deliveryStatusOrder pour la logique de progression
export const deliveryStatusOrder = ['pending', 'processing', 'shipping', 'delivered'];

export const NOTIFICATION_CONFIG = {
    NEW_DELIVERY_REQUEST: {
        icon: Truck,
        color: 'text-blue-400',
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
