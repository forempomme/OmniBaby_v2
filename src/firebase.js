import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  deleteUser,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  collection,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
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

// Cache hors-ligne persistant (remplace enableIndexedDbPersistence, déprécié
// depuis Firebase 9.19 et qui échouait silencieusement avec plusieurs onglets).
function createDb() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (e) {
    console.warn('[Firebase] cache persistant indisponible, cache mémoire utilisé', e);
    return initializeFirestore(app, {});
  }
}
export const db = createDb();

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  deleteUser,
  doc,
  collection,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
};
