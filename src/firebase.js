// ----------------------------------------------------------------------
// Firebase — initialisation et exports
// OmniBaby v3.0.0
// ----------------------------------------------------------------------
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  collection,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  enableIndexedDbPersistence,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCfpCKXJNGcjg5PQPs8aABKWjFsIS2llRo',
  authDomain: 'omnibaby-76779.firebaseapp.com',
  projectId: 'omnibaby-76779',
  storageBucket: 'omnibaby-76779.firebasestorage.app',
  messagingSenderId: '222792679552',
  appId: '1:222792679552:web:d1c1384af1d8a34f626665',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Activer la persistance offline (données disponibles sans réseau)
enableIndexedDbPersistence(db).catch((e) => {
  if (e.code === 'failed-precondition') {
    console.warn('Persistance offline : plusieurs onglets ouverts');
  } else if (e.code === 'unimplemented') {
    console.warn('Persistance offline non supportée sur ce navigateur');
  }
});

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  doc,
  collection,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
};
