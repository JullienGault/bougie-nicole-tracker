// src/contexts/AppContext.jsx
import React, { useMemo, useState, useCallback, useContext } from 'react';
import Toast from '../components/common/Toast';

export const AppContext = React.createContext(null);

export const AppProvider = ({ children, value }) => {
    const [toast, setToast] = useState(null);

    const showToast = useCallback((message, type = 'success') => {
        setToast({ id: Date.now(), message, type });
    }, []);

    const contextValue = useMemo(() => ({
        ...value,
        showToast,
    }), [value, showToast]);

    return (
        <AppContext.Provider value={contextValue}>
            {children}
            {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    return useContext(AppContext);
};
