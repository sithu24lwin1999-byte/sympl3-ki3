import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { enableIndexedDbPersistence, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const firebaseApp = getApps()[0] || initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

enableIndexedDbPersistence(db).catch(() => {
  // Persistence can be unavailable in private mode or when another tab owns the cache.
});
