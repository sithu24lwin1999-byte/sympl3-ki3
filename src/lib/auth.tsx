import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createUserWithEmailAndPassword, getAuth, getIdTokenResult, GoogleAuthProvider, User as FirebaseUser, onAuthStateChanged, sendEmailVerification, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { deleteApp, initializeApp } from 'firebase/app';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth, db } from './firebase';
import type { AppUser, Role } from '@/types';

interface AuthContextValue {
  user: AppUser | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  loginWithGoogle(): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function resolveUser(firebaseUser: FirebaseUser): Promise<AppUser> {
  const token = await getIdTokenResult(firebaseUser, true);
  if (token.claims.admin === true) {
    return { id: firebaseUser.uid, name: firebaseUser.displayName || 'System Admin', email: firebaseUser.email, role: 'ADMIN' };
  }
  const snapshot = await getDoc(doc(db, 'users', firebaseUser.uid));
  if (!snapshot.exists()) throw new Error('This account has not been assigned to a shop yet.');
  const data = snapshot.data() as { name: string; email: string; role: Role; shopId?: string; active?: boolean };
  if (data.active === false) throw new Error('This account is inactive.');
  return { id: firebaseUser.uid, name: data.name, email: data.email, role: data.role, shopId: data.shopId };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, async current => {
    setFirebaseUser(current);
    if (!current) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await resolveUser(current));
    } catch {
      await signOut(auth);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }), []);

  const value = useMemo<AuthContextValue>(() => ({
    user, firebaseUser, loading,
    login: async (email, password) => {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      if (!credential.user.emailVerified) {
        await sendEmailVerification(credential.user);
        await signOut(auth);
        throw new Error('Verify your email using the link we just sent, then sign in again.');
      }
      setUser(await resolveUser(credential.user));
    },
    loginWithGoogle: async () => {
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      setUser(await resolveUser(credential.user));
    },
    logout: () => signOut(auth),
  }), [user, firebaseUser, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

export async function createManagedUser(input: { email: string; password: string; name: string; role: Role; shopId: string }) {
  const secondary = initializeApp(firebaseConfig, `provision-${Date.now()}`);
  try {
    const credential = await createUserWithEmailAndPassword(getAuth(secondary), input.email, input.password);
    await sendEmailVerification(credential.user);
    await setDoc(doc(db, 'users', credential.user.uid), {
      name: input.name, email: input.email.toLowerCase(), role: input.role, shopId: input.shopId, active: true,
      createdAt: new Date().toISOString(),
    });
    return credential.user.uid;
  } finally {
    await deleteApp(secondary);
  }
}
