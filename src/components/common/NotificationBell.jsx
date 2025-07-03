// src/components/common/NotificationBell.jsx
import React, { useState, useEffect, useContext } from 'react';
import { Bell } from 'lucide-react';
import { AppContext } from '../../contexts/AppContext';
import { db, query, collection, where, orderBy, onSnapshot, updateDoc, doc, writeBatch } from '../../services/firebase';
import { formatRelativeTime } from '../../utils/time';

const NotificationBell = () => {
    const { loggedInUserData } = useContext(AppContext);
    const [notifications, setNotifications] = useState([]);
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    useEffect(() => {
        if (!loggedInUserData || !db) return;

        const recipientIds = loggedInUserData.role === 'admin'
            ? [loggedInUserData.uid, 'all_admins']
            : [loggedInUserData.uid];

        const q = query(
            collection(db, 'notifications'),
            where('recipientUid', 'in', recipientIds),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => {
            console.error("Erreur de lecture des notifications (vérifiez les index Firestore): ", error);
        });

        return () => unsubscribe();
    }, [loggedInUserData]);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const handleMarkOneAsRead = async (notificationId) => {
        const notifDocRef = doc(db, 'notifications', notificationId);
        try {
            await updateDoc(notifDocRef, { isRead: true });
        } catch (error) {
            console.error("Erreur lors de la mise à jour de la notification: ", error);
        }
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
        try {
            await batch.commit();
        } catch (error) {
            console.error("Erreur lors de la mise à jour des notifications: ", error);
        }
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
                        {notifications.length > 0 ? notifications.map(notif => (
                            <div key={notif.id}
                                onClick={() => handleMarkOneAsRead(notif.id)}
                                className={`p-4 border-b border-gray-700/50 cursor-pointer hover:bg-gray-900/50 ${!notif.isRead ? 'bg-indigo-900/20' : ''}`}>
                                <p className="text-sm text-gray-200">{notif.message}</p>
                                <p className="text-xs text-gray-400 mt-1.5">{formatRelativeTime(notif.createdAt)}</p>
                            </div>
                        )) : <p className="p-4 text-sm text-center text-gray-400">Aucune nouvelle notification.</p>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
