// src/components/pos/CreatePosModal.jsx
import React, { useState, useContext } from 'react';
import { UserPlus } from 'lucide-react';
import { AppContext } from '../../contexts/AppContext';
import { db, writeBatch, doc, serverTimestamp, createUserWithEmailAndPassword, signOut, deleteApp, getAuth, initializeApp } from '../../services/firebase';

const CreatePosModal = ({ onClose }) => {
    const { showToast } = useContext(AppContext);
    const [depotName, setDepotName] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleCreate = async (ev) => {
        ev.preventDefault();
        if(!depotName || !firstName || !lastName || !email || !phone || password.length < 6){
            showToast("Tous les champs sont obligatoires. Le mot de passe doit faire 6+ caractères.", "error");
            return;
        }
        setIsLoading(true);

        const appName = `secondary-app-${Date.now()}`;
        let secondaryApp;
        try {
            // CORRECTION : On utilise les variables d'environnement pour plus de fiabilité
            const firebaseConfig = {
                apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
                authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
                projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
            };
            
            secondaryApp = initializeApp(firebaseConfig, appName);
            const secondaryAuth = getAuth(secondaryApp);
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            const newUser = userCredential.user;

            const batch = writeBatch(db);

            const userDocRef = doc(db, "users", newUser.uid);
            batch.set(userDocRef, {
                displayName: depotName,
                email: email,
                firstName: firstName,
                lastName: lastName,
                phone: phone,
                role: "pos",
                status: "active",
                createdAt: serverTimestamp()
            });

            const posDocRef = doc(db, "pointsOfSale", newUser.uid);
            batch.set(posDocRef, {
                name: depotName,
                commissionRate: 0.3,
                createdAt: serverTimestamp(),
                status: "active",
                isArchived: false,
                archivedBy: [] // Initialiser le champ pour l'archivage indépendant
            });

            await batch.commit();
            showToast(`Compte pour ${depotName} créé avec succès !`, "success");
            onClose();
        } catch(err) {
            if (err.code === 'auth/email-already-in-use') {
                showToast("Cette adresse email est déjà utilisée.", "error");
            } else {
                console.error("Erreur de création : ", err);
                showToast("Erreur lors de la création du compte.", "error");
            }
        } finally {
            setIsLoading(false);
            if (secondaryApp) {
                // S'assurer que la déconnexion et la suppression se font correctement
                try {
                    await signOut(getAuth(secondaryApp));
                    await deleteApp(secondaryApp);
                } catch (cleanupError) {
                    console.error("Erreur lors du nettoyage de l'app secondaire:", cleanupError);
                }
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40" onClick={onClose}>
            <div className="bg-gray-800 p-8 rounded-2xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-white mb-6">Ajouter un Dépôt-Vente</h2>
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Nom du Dépôt-Vente</label>
                        <input type="text" value={depotName} onChange={e=>setDepotName(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Prénom du Contact</label>
                            <input type="text" value={firstName} onChange={e=>setFirstName(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Nom du Contact</label>
                            <input type="text" value={lastName} onChange={e=>setLastName(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Téléphone</label>
                            <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Mot de passe initial</label>
                        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg"/>
                    </div>
                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Annuler</button>
                        <button type="submit" disabled={isLoading} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-60">
                            {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2"></div> : <><UserPlus size={18}/>Créer</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreatePosModal;
