// src/utils/formatters.js
export const formatPrice = (price) => `${(price || 0).toFixed(2)} €`;

export const formatDate = (timestamp) => {
    if (!timestamp?.toDate) {
        return 'Date inconnue';
    }
    return timestamp.toDate().toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

export const formatPercent = (rate) => `${((rate || 0) * 100).toFixed(0)} %`;

export const formatPhone = (phoneStr) => {
    if (!phoneStr) return '';
    const cleaned = ('' + phoneStr).replace(/\D/g, '');
    const match = cleaned.match(/.{1,2}/g);
    return match ? match.join(' ') : '';
};
