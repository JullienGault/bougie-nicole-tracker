// src/components/common/Toast.jsx
import React, { useEffect } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const getToastStyle = () => {
        switch (type) {
            case 'success': return 'bg-green-600';
            case 'error': return 'bg-red-600';
            case 'info':
            default: return 'bg-blue-600';
        }
    };

    const getToastIcon = () => {
        const IconComponent = {
            success: CheckCircle,
            error: XCircle,
            info: Info
        }[type] || Info;
        return <IconComponent size={24} />;
    };

    return (
        <div className={`fixed bottom-5 right-5 p-4 rounded-lg shadow-2xl text-white flex items-center gap-3 z-[999] animate-fade-in-up ${getToastStyle()}`}>
            {getToastIcon()}
            <span>{message}</span>
            <button onClick={onClose} className="ml-2 opacity-80 hover:opacity-100"><X size={20} /></button>
        </div>
    );
};

export default Toast;
