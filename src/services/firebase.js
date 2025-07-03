// src/services/firebase.js
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import {
    getFirestore,
    collection,
    collectionGroup,
    doc,
    onSnapshot,
    writeBatch,
    query,
    where,
    addDoc,
    setDoc,
    serverTimestamp,
    orderBy,
    getDocs,
    updateDoc,
    deleteDoc,
    runTransaction,
    arrayUnion,
    arrayRemove,
    documentId // <-- AJOUT DE L'IMPORT
} from 'firebase/firestore';

// La configuration provient maintenant des variables d'environnement
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialisation de Firebase
let firebaseApp;
if (!getApps().length) {
    firebaseApp = initializeApp(firebaseConfig);
} else {
    firebaseApp = getApps()[0];
}

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

// Exportez tout pour pouvoir les utiliser dans les autres fichiers
export {
    db,
    auth,
    firebaseApp,
    // Fonctions Firebase Auth
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    deleteApp,
    getAuth,
    initializeApp,
    // Fonctions Firestore
    collection,
    collectionGroup,
    doc,
    onSnapshot,
    writeBatch,
    query,
    where,
    addDoc,
    setDoc,
    serverTimestamp,
    orderBy,
    getDocs,
    updateDoc,
    deleteDoc,
    runTransaction,
    arrayUnion,
    arrayRemove,
    documentId // <-- AJOUT DE L'EXPORT
};
