// src/components/common/KpiCard.jsx
import React from 'react';

const KpiCard = ({ title, value, icon: Icon, color, tooltip }) => (
    <div className="bg-gray-800 p-5 rounded-xl flex items-center gap-4" title={tooltip}>
        <div className={`p-3 rounded-lg ${color}`}>
            <Icon size={28} className="text-white" />
        </div>
        <div>
            <p className="text-gray-400 text-sm font-medium">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
        </div>
    </div>
);

export default KpiCard;
