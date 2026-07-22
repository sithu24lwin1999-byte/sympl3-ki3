import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createUserWithEmailAndPassword, EmailAuthProvider, getAuth, getIdTokenResult, User as FirebaseUser, onAuthStateChanged, reauthenticateWithCredential, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updatePassword, verifyBeforeUpdateEmail } from 'firebase/auth';
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
  resetPassword(email: string): Promise<void>;
  changeAdminCredentials(input: { currentPassword: string; newEmail?: string; newPassword?: string }): Promise<void>;
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
  const data = snapshot.data() as { name: string; email: string; role: Role; shopId?: string; branchId?: string; branchName?: string; active?: boolean };
  if (data.active === false) throw new Error('This account is inactive.');
  return { id: firebaseUser.uid, name: data.name, email: data.email, role: data.role, shopId: data.shopId, branchId: data.branchId, branchName: data.branchName };
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
      setUser(await resolveUser(credential.user));
    },
    resetPassword: async (email) => {
      if (!email.trim()) throw new Error('Enter your email address first.');
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
    },
    changeAdminCredentials: async ({ currentPassword, newEmail, newPassword }) => {
      if (!firebaseUser || user?.role !== 'ADMIN' || !firebaseUser.email) throw new Error('Admin account is not available.');
      const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
      await reauthenticateWithCredential(firebaseUser, credential);
      if (newEmail && newEmail.trim().toLowerCase() !== firebaseUser.email.toLowerCase()) await verifyBeforeUpdateEmail(firebaseUser, newEmail.trim().toLowerCase(), { url: 'https://sithu24lwin1999-byte.github.io/sympl3-ki3/' });
      if (newPassword) await updatePassword(firebaseUser, newPassword);
      await firebaseUser.reload();
      setUser(await resolveUser(firebaseUser));
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

export async function createManagedUser(input: { email: string; password: string; name: string; role: Role; shopId: string; branchId?: string; branchName?: string }) {
  const secondary = initializeApp(firebaseConfig, `provision-${Date.now()}`);
  try {
    const credential = await createUserWithEmailAndPassword(getAuth(secondary), input.email, input.password);
    // Managed accounts are trusted through their admin-created shop assignment.
    // Verification email delivery is best-effort and must not orphan the account.
    await sendEmailVerification(credential.user).catch(() => undefined);
    await setDoc(doc(db, 'users', credential.user.uid), {
      name: input.name, email: input.email.toLowerCase(), role: input.role, shopId: input.shopId,
      branchId: input.branchId || 'main', branchName: input.branchName || 'Main Branch', active: true,
      createdAt: new Date().toISOString(),
    });
    return credential.user.uid;
  } finally {
    await deleteApp(secondary);
  }
}
