import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const firebaseApp = getApps()[0] || initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = (() => {
  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    }, firebaseConfig.firestoreDatabaseId);
  } catch {
    // Vite hot reload can reuse an already initialized Firebase app.
    return getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
  }
})();
