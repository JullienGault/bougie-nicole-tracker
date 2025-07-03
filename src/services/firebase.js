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
    arrayRemove
} from 'firebase/firestore';

// La configuration provient de votre App.jsx original
const firebaseConfig = {
    apiKey: "AIzaSyDUmxNBMQ2gWvCHWMrk0iowFpYVE1wMpMo",
    authDomain: "bougienicole.firebaseapp.com",
    projectId: "bougienicole",
    storageBucket: "bougienicole.appspot.com",
    messagingSenderId: "319062939476",
    appId: "1:319062939476:web:ba2235b7ab762c37a39ac1"
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
    arrayRemove
};
