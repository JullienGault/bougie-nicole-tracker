// src/components/pos/EditPosUserModal.jsx
import React, { useState, useContext } from 'react';
import { Save } from 'lucide-react';
import { AppContext } from '../../contexts/AppContext';
import { db, doc, updateDoc } from '../../services/firebase';

const EditPosUserModal = ({ posUser, onClose, onSave }) => {
    const { showToast } = useContext(AppContext);
    const [formData, setFormData] = useState({
        firstName: posUser.firstName || '',
        lastName: posUser.lastName || '',
        phone: posUser.phone || '',
    });
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.firstName || !formData.lastName || !formData.phone) {
            showToast("Tous les champs sont obligatoires.", "error");
            return;
        }
        setIsLoading(true);
        try {
            const userDocRef = doc(db, "users", posUser.id);
            await updateDoc(userDocRef, {
                firstName: formData.firstName,
                lastName: formData.lastName,
                phone: formData.phone,
            });

            showToast("Informations de contact mises à jour !", "success");
            onSave();
            onClose();
        } catch (error) {
            console.error("Erreur de mise à jour du contact du dépôt: ", error);
            showToast("Erreur lors de la mise à jour.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 p-8 rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-white mb-6">Modifier les infos de "{posUser.name}"</h2>
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Prénom du Contact</label>
                            <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required className="w-full bg-gray-700 p-3 rounded-lg"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Nom du Contact</label>
                            <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} required className="w-full bg-gray-700 p-3 rounded-lg"/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Téléphone</label>
                        <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className="w-full bg-gray-700 p-3 rounded-lg"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                        <input type="email" value={posUser.email} readOnly className="w-full bg-gray-900/50 p-3 rounded-lg cursor-not-allowed"/>
                    </div>
                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Annuler</button>
                        <button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-60">
                            {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2"></div> : <><Save size={18}/>Enregistrer</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditPosUserModal;
