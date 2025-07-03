// src/components/common/NotificationBell.jsx
import React, { useState, useEffect, useContext } from 'react';
import { Bell } from 'lucide-react';
import { AppContext } from '../../contexts/AppContext';
import { db, query, collection, where, orderBy, onSnapshot, updateDoc, doc, writeBatch } from '../../services/firebase';
import { formatRelativeTime } from '../../utils/time';
import { NOTIFICATION_CONFIG } from '../../constants';

const NotificationBell = () => {
    // AJOUT DE globalModal
    const { loggedInUserData, globalModal } = useContext(AppContext);
    const [notifications, setNotifications] = useState([]);
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    useEffect(() => {
        if (!loggedInUserData?.uid) return;

        const recipientQuery = loggedInUserData.role === 'admin'
            ? where('recipientUid', '==', 'all_admins')
            : where('recipientUid', '==', loggedInUserData.uid);

        const q = query(
            collection(db, 'notifications'),
            recipientQuery,
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => unsubscribe();
    }, [loggedInUserData]);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const handleNotificationClick = async (notification) => {
        if (!notification.isRead) {
            const notifDocRef = doc(db, 'notifications', notification.id);
            await updateDoc(notifDocRef, { isRead: true });
        }

        const config = NOTIFICATION_CONFIG[notification.type] || NOTIFICATION_CONFIG.DEFAULT;
        // GESTION DE L'ACTION
        if (config.action === 'OPEN_DELIVERY_VIEW' && globalModal) {
            globalModal(); // Appelle la fonction pour changer de vue
        }

        setIsPanelOpen(false);
    };

    const handleMarkAllAsRead = async () => {
        if (unreadCount === 0) return;
        const batch = writeBatch(db);
        notifications.forEach(notif => {
            if (!notif.isRead) {
                const notifDocRef = doc(db, 'notifications', notif.id);
                batch.update(notifDocRef, { isRead: true });
            }
        });
        await batch.commit();
    };

    return (
        <div className="relative">
            <button onClick={() => setIsPanelOpen(!isPanelOpen)} className="relative p-2 text-gray-400 hover:text-white">
                <Bell size={22} />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                )}
            </button>

            {isPanelOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-gray-800 rounded-lg shadow-2xl border border-gray-700 animate-fade-in-up z-50">
                    <div className="p-3 flex justify-between items-center border-b border-gray-700">
                        <h4 className="font-bold text-white">Notifications</h4>
                        {unreadCount > 0 &&
                            <button onClick={handleMarkAllAsRead} className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold">
                                Marquer tout comme lu
                            </button>
                        }
                    </div>
                    <div className="max-h-96 overflow-y-auto custom-scrollbar">
                        {notifications.length > 0 ? notifications.map(notif => {
                            const config = NOTIFICATION_CONFIG[notif.type] || NOTIFICATION_CONFIG.DEFAULT;
                            const Icon = config.icon;
                            return (
                                <div key={notif.id}
                                    onClick={() => handleNotificationClick(notif)}
                                    className={`p-4 border-b border-gray-700/50 cursor-pointer flex gap-3 hover:bg-gray-900/50 ${!notif.isRead ? 'bg-indigo-900/20' : ''}`}>
                                    <div className="flex-shrink-0 mt-1">
                                        <Icon className={config.color} size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-200">{notif.message}</p>
                                        <p className="text-xs text-gray-400 mt-1.5">{formatRelativeTime(notif.createdAt)}</p>
                                    </div>
                                </div>
                            );
                        }) : <p className="p-4 text-sm text-center text-gray-400">Aucune nouvelle notification.</p>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
