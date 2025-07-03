import React from 'react';
import { ShieldCheck, Edit } from 'lucide-react';
import { formatPhone } from '../../utils/formatters';

const ContactVerificationModal = ({ userData, onConfirm, onModify, isConfirming }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-[80]">
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-2xl border border-yellow-500 animate-fade-in-up">
                <div className="text-center mb-8">
                    <ShieldCheck className="mx-auto h-12 w-12 text-yellow-400" />
                    <h3 className="mt-4 text-2xl font-bold text-white">Vérification des informations de contact</h3>
                    <p className="text-gray-400 mt-2 max-w-lg mx-auto">Pour assurer une bonne communication, veuillez vérifier que vos informations ci-dessous sont toujours à jour.</p>
                </div>

                <div className="my-8 bg-gray-900/50 p-6 rounded-lg text-left grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                    <div>
                        <p className="text-sm text-gray-400">Nom complet</p>
                        <p className="text-lg font-semibold">{userData.firstName} {userData.lastName}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-400">Dépôt</p>
                        <p className="text-lg font-semibold">{userData.displayName}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-400">Email</p>
                        <p className="text-lg font-semibold">{userData.email}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-400">Téléphone</p>
                        <p className="text-lg font-semibold">{formatPhone(userData.phone)}</p>
                    </div>
                </div>

                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button 
                        onClick={onModify} 
                        className="w-full sm:w-auto bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2"
                    >
                        <Edit size={18} /> Modifier mes informations
                    </button>
                    <button 
                        onClick={onConfirm} 
                        disabled={isConfirming}
                        className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {isConfirming ? 'Confirmation...' : <><ShieldCheck size={18} /> Mes informations sont à jour</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ContactVerificationModal;
