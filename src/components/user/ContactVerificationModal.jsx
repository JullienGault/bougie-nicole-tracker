// src/components/user/ContactVerificationModal.jsx
import React from 'react';
import { ShieldCheck, Edit } from 'lucide-react';
import { formatPhone } from '../../utils/formatters';

const ContactVerificationModal = ({ userData, onConfirm, onModify, isConfirming }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-[80]">
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-lg border border-yellow-500 animate-fade-in-up">
                <div className="text-center">
                    <ShieldCheck className="mx-auto h-12 w-12 text-yellow-400" />
                    <h3 className="mt-4 text-xl font-semibold text-white">Vérification des informations de contact</h3>
                    <p className="text-gray-400 mt-2">Pour assurer une bonne communication, veuillez vérifier que vos informations ci-dessous sont toujours à jour.</p>
                </div>

                <div className="mt-6 bg-gray-900/50 p-4 rounded-lg text-left space-y-2">
                    <p><span className="font-semibold text-gray-300">Nom:</span> {userData.firstName} {userData.lastName}</p>
                    <p><span className="font-semibold text-gray-300">Email:</span> {userData.email}</p>
                    <p><span className="font-semibold text-gray-300">Téléphone:</span> {formatPhone(userData.phone)}</p>
                </div>

                <div className="mt-8 flex justify-center gap-4">
                    <button 
                        onClick={onModify} 
                        className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg flex items-center gap-2"
                    >
                        <Edit size={18} /> Modifier
                    </button>
                    <button 
                        onClick={onConfirm} 
                        disabled={isConfirming}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg flex items-center gap-2 disabled:opacity-60"
                    >
                        {isConfirming ? 'Confirmation...' : <><ShieldCheck size={18} /> Mes informations sont à jour</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ContactVerificationModal;
