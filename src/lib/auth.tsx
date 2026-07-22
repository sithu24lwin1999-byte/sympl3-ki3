import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createUserWithEmailAndPassword, deleteUser, EmailAuthProvider, getAuth, getIdTokenResult, User as FirebaseUser, onAuthStateChanged, reauthenticateWithCredential, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updatePassword, verifyBeforeUpdateEmail } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { deleteApp, initializeApp } from 'firebase/app';
import firebaseConfig from '../../firebase-applet-config.json';
import type { AppUser, EmployeePermissions, Role, Shop } from '@/types';
import { normalizePermissions } from './permissions';

export interface AccessIssue { code: 'UNAUTHORIZED' | 'SUSPENDED' | 'EXPIRED'; message: string }
const INACTIVE_SUBSCRIPTION_MESSAGE = 'Your Ki3 POS subscription is currently inactive. Please contact the system administrator.';

interface AuthContextValue {
  user: AppUser | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  accessIssue: AccessIssue | null;
  clearAccessIssue(): void;
  login(email: string, password: string): Promise<void>;
  resetPassword(email: string): Promise<void>;
  changeAdminCredentials(input: { currentPassword: string; newEmail?: string; newPassword?: string }): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

class TenantAccessError extends Error {
  constructor(public issue: AccessIssue) { super(issue.message); }
}

const defaultPermissions: EmployeePermissions = normalizePermissions();

function shopIsExpired(shop: Shop) {
  return Boolean(shop.expiry && shop.expiry < new Date().toISOString().slice(0, 10));
}

async function recordSecurityEvent(user: AppUser, action: 'LOGIN' | 'LOGOUT') {
  const payload = { actorId: user.id, actorName: user.name, actorRole: user.role, action, detail: `${user.role} account ${action.toLowerCase()}`, createdAt: serverTimestamp() };
  const target = user.role === 'ADMIN' ? 'systemAuditLogs' : `shops/${user.shopId}/auditLogs`;
  await addDoc(collection(db, target), user.shopId ? { ...payload, shopId: user.shopId } : payload);
}

async function recordManagedAction(path: string, action: string, detail: string, shopId?: string) {
  const actor = auth.currentUser;
  if (!actor) return;
  await addDoc(collection(db, path), {
    actorId: actor.uid, actorName: actor.displayName || actor.email || 'Administrator', actorRole: shopId ? 'OWNER' : 'ADMIN',
    action, detail, ...(shopId ? { shopId } : {}), createdAt: serverTimestamp(),
  });
}

async function resolveUser(firebaseUser: FirebaseUser): Promise<AppUser> {
  const token = await getIdTokenResult(firebaseUser, true);
  if (token.claims.admin === true) {
    return { id: firebaseUser.uid, name: firebaseUser.displayName || 'System Admin', email: firebaseUser.email, role: 'ADMIN' };
  }
  const snapshot = await getDoc(doc(db, 'users', firebaseUser.uid));
  if (!snapshot.exists()) throw new Error('This account has not been assigned to a shop yet.');
  const data = snapshot.data() as { name: string; email: string; role: Role; shopId?: string; branchId?: string; branchName?: string; active?: boolean };
  if (data.active === false) throw new TenantAccessError({ code: 'UNAUTHORIZED', message: 'This account has been disabled by an administrator.' });
  if ((data.role !== 'OWNER' && data.role !== 'EMPLOYEE') || !data.shopId) throw new TenantAccessError({ code: 'UNAUTHORIZED', message: 'This account does not have a valid shop assignment.' });
  const shopSnapshot = await getDoc(doc(db, 'shops', data.shopId));
  if (!shopSnapshot.exists()) throw new TenantAccessError({ code: 'UNAUTHORIZED', message: 'The assigned shop no longer exists.' });
  const shop = { id: shopSnapshot.id, ...shopSnapshot.data() } as Shop;
  if (shop.status === 'SUSPENDED' || shop.status === 'CANCELLED' || shop.systemStatus === 'STOPPED' || shop.systemStatus === 'ARCHIVED') throw new TenantAccessError({ code: 'SUSPENDED', message: INACTIVE_SUBSCRIPTION_MESSAGE });
  if (shop.status === 'EXPIRED' || shopIsExpired(shop)) throw new TenantAccessError({ code: 'EXPIRED', message: INACTIVE_SUBSCRIPTION_MESSAGE });
  if (!['TRIAL', 'ACTIVE', 'EXPIRING_SOON'].includes(shop.status)) throw new TenantAccessError({ code: 'UNAUTHORIZED', message: INACTIVE_SUBSCRIPTION_MESSAGE });
  if (data.role === 'OWNER' && shop.ownerId !== firebaseUser.uid) throw new TenantAccessError({ code: 'UNAUTHORIZED', message: 'The owner assignment for this account is invalid.' });
  let permissions: EmployeePermissions | undefined;
  if (data.role === 'EMPLOYEE') {
    const employeeSnapshot = await getDoc(doc(db, `shops/${data.shopId}/employees/${firebaseUser.uid}`));
    if (!employeeSnapshot.exists() || employeeSnapshot.data().status === 'Inactive') throw new TenantAccessError({ code: 'UNAUTHORIZED', message: 'This employee account is inactive.' });
    permissions = normalizePermissions(employeeSnapshot.data().permissions || {});
  }
  return { id: firebaseUser.uid, name: data.name, email: data.email, role: data.role, shopId: data.shopId, branchId: data.branchId, branchName: data.branchName, permissions };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessIssue, setAccessIssue] = useState<AccessIssue | null>(null);

  useEffect(() => {
    let requestId = 0;
    const unsubscribe = onAuthStateChanged(auth, async current => {
      const currentRequest = ++requestId;
      setFirebaseUser(current);
      if (!current) {
        setUser(null);
        setLoading(false);
        return;
      }
      setAccessIssue(null);
      setLoading(true);
      try {
        const resolved = await resolveUser(current);
        if (currentRequest === requestId) setUser(resolved);
      } catch (issue) {
        if (issue instanceof TenantAccessError) setAccessIssue(issue.issue);
        else setAccessIssue({ code: 'UNAUTHORIZED', message: issue instanceof Error ? issue.message : 'Unable to authorize this account.' });
        if (currentRequest === requestId) setUser(null);
      } finally {
        if (currentRequest === requestId) setLoading(false);
      }
    });
    return () => { requestId += 1; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!firebaseUser || !user || user.role === 'ADMIN' || !user.shopId) return;
    const endSession = (issue: AccessIssue) => {
      setUser(null);
      setAccessIssue(issue);
    };
    const stopUser = onSnapshot(doc(db, 'users', firebaseUser.uid), snapshot => {
      if (!snapshot.exists() || snapshot.data().active === false) endSession({ code: 'UNAUTHORIZED', message: 'This account has been disabled.' });
    }, () => endSession({ code: 'UNAUTHORIZED', message: 'Your account access could not be verified.' }));
    const stopEmployee = user.role === 'EMPLOYEE' ? onSnapshot(doc(db, `shops/${user.shopId}/employees/${firebaseUser.uid}`), snapshot => {
      if (!snapshot.exists() || snapshot.data().status === 'Inactive') endSession({ code: 'UNAUTHORIZED', message: 'This employee account is inactive.' });
      else setUser(current => current ? { ...current, permissions: normalizePermissions(snapshot.data().permissions || {}) } : current);
    }, () => endSession({ code: 'UNAUTHORIZED', message: 'Employee permissions could not be verified.' })) : () => undefined;
    const stopShop = onSnapshot(doc(db, 'shops', user.shopId), snapshot => {
      if (!snapshot.exists()) endSession({ code: 'UNAUTHORIZED', message: 'The assigned shop no longer exists.' });
      else if (['SUSPENDED', 'CANCELLED'].includes(snapshot.data().status) || ['STOPPED', 'ARCHIVED'].includes(snapshot.data().systemStatus)) endSession({ code: 'SUSPENDED', message: INACTIVE_SUBSCRIPTION_MESSAGE });
      else if (snapshot.data().status === 'EXPIRED' || shopIsExpired({ id: snapshot.id, ...snapshot.data() } as Shop)) endSession({ code: 'EXPIRED', message: INACTIVE_SUBSCRIPTION_MESSAGE });
    }, () => endSession({ code: 'UNAUTHORIZED', message: 'Shop access could not be verified.' }));
    return () => { stopUser(); stopEmployee(); stopShop(); };
  }, [firebaseUser, user?.id, user?.role, user?.shopId]);

  const value = useMemo<AuthContextValue>(() => ({
    user, firebaseUser, loading, accessIssue,
    clearAccessIssue: () => setAccessIssue(null),
    login: async (email, password) => {
      setAccessIssue(null);
      const credential = await signInWithEmailAndPassword(auth, email, password);
      try {
        const resolved = await resolveUser(credential.user);
        setUser(resolved);
        await recordSecurityEvent(resolved, 'LOGIN').catch(() => undefined);
      } catch (issue) {
        if (issue instanceof TenantAccessError) setAccessIssue(issue.issue);
        else await signOut(auth);
        throw issue;
      }
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
    logout: async () => {
      if (user) await recordSecurityEvent(user, 'LOGOUT').catch(() => undefined);
      setAccessIssue(null);
      await signOut(auth);
    },
  }), [user, firebaseUser, loading, accessIssue]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

export async function createManagedUser(input: { email: string; password: string; name: string; role: Role; shopId: string; branchId?: string; branchName?: string; phone?: string; shift?: string; jobTitle?: string; permissions?: EmployeePermissions }) {
  // Spark-plan compatible provisioning: creating the managed account in an
  // isolated secondary Auth app preserves the administrator's primary session.
  const secondary = initializeApp(firebaseConfig, `provision-${Date.now()}`);
  let credential: Awaited<ReturnType<typeof createUserWithEmailAndPassword>> | null = null;
  try {
    credential = await createUserWithEmailAndPassword(getAuth(secondary), input.email.trim().toLowerCase(), input.password);
    const branchId = input.branchId || 'main';
    const branchName = input.branchName || 'Main Branch';
    if (input.role === 'EMPLOYEE') await setDoc(doc(db, `shops/${input.shopId}/employees/${credential.user.uid}`), {
      name: input.name, email: input.email.trim().toLowerCase(), role: input.jobTitle || 'Cashier', phone: input.phone || '', shift: input.shift || 'Morning',
      shopId: input.shopId, branchId, branchName, status: 'Active', permissions: input.permissions || defaultPermissions, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'users', credential.user.uid), {
      name: input.name, email: input.email.trim().toLowerCase(), role: input.role, shopId: input.shopId, branchId, branchName, active: true, createdAt: new Date().toISOString(),
    });
    await recordManagedAction(input.role === 'OWNER' ? 'systemAuditLogs' : `shops/${input.shopId}/auditLogs`, input.role === 'OWNER' ? 'OWNER_ACCOUNT_CREATED' : 'EMPLOYEE_CREATED', `${input.name} (${input.email.trim().toLowerCase()})`, input.role === 'EMPLOYEE' ? input.shopId : undefined).catch(() => undefined);
    return credential.user.uid;
  } catch (issue) {
    if (credential) await deleteUser(credential.user).catch(() => undefined);
    throw issue;
  } finally { await deleteApp(secondary); }
}

export async function updateManagedUser(input: { uid: string; name: string; email: string; active?: boolean; jobTitle?: string; branchId?: string; branchName?: string; phone?: string; shift?: string; permissions?: EmployeePermissions }) {
  const userSnapshot = await getDoc(doc(db, 'users', input.uid));
  if (!userSnapshot.exists() || userSnapshot.data().role !== 'EMPLOYEE') throw new Error('Managed employee not found.');
  if (String(userSnapshot.data().email).toLowerCase() !== input.email.toLowerCase()) throw new Error('For security, an existing employee login email cannot be changed. Create a replacement employee account and disable this one.');
  const shopId = userSnapshot.data().shopId as string;
  await setDoc(doc(db, `shops/${shopId}/employees/${input.uid}`), {
    name: input.name, email: input.email.toLowerCase(), role: input.jobTitle || 'Cashier', phone: input.phone || '', shift: input.shift || 'Morning', status: input.active === false ? 'Inactive' : 'Active',
    branchId: input.branchId || 'main', branchName: input.branchName || 'Main Branch', permissions: input.permissions || defaultPermissions, updatedAt: new Date().toISOString(),
  }, { merge: true });
  await updateDoc(doc(db, 'users', input.uid), { name: input.name, email: input.email.toLowerCase(), branchId: input.branchId || 'main', branchName: input.branchName || 'Main Branch', active: input.active !== false, updatedAt: new Date().toISOString() });
  await recordManagedAction(`shops/${shopId}/auditLogs`, input.active === false ? 'EMPLOYEE_DISABLED' : 'EMPLOYEE_UPDATED', `${input.name} (${input.uid})`, shopId).catch(() => undefined);
}
