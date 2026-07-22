import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, runTransaction, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const emulator = process.env.FIRESTORE_EMULATOR_HOST;
const describeRules = emulator ? describe : describe.skip;
let environment: RulesTestEnvironment;

describeRules('Ki3 POS Firestore authorization', () => {
  beforeAll(async () => {
    const [host, port] = emulator!.split(':');
    environment = await initializeTestEnvironment({
      projectId: 'demo-ki3',
      firestore: { host, port: Number(port), rules: readFileSync(resolve('firestore.rules'), 'utf8') },
    });
  });

  beforeEach(async () => {
    await environment.clearFirestore();
    await environment.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      const future = Timestamp.fromMillis(Date.now() + 86_400_000);
      await Promise.all([
        setDoc(doc(db, 'shops/shop-a'), { ownerId: 'owner-a', status: 'ACTIVE', expiresAt: future }),
        setDoc(doc(db, 'shops/shop-b'), { ownerId: 'owner-b', status: 'ACTIVE', expiresAt: future }),
        setDoc(doc(db, 'shops/suspended'), { ownerId: 'owner-s', status: 'SUSPENDED', expiresAt: future }),
        setDoc(doc(db, 'shops/shop-a/products/product-a'), { shopId: 'shop-a', name: 'A', price: 100, stock: 5, status: 'In Stock' }),
        setDoc(doc(db, 'shops/shop-b/products/product-b'), { shopId: 'shop-b', name: 'B', price: 100, stock: 5, status: 'In Stock' }),
        setDoc(doc(db, 'shops/suspended/products/product-s'), { shopId: 'suspended', name: 'S', price: 100, stock: 5, status: 'In Stock' }),
        setDoc(doc(db, 'shops/shop-a/employees/employee-a'), {
          shopId: 'shop-a', branchId: 'main', status: 'Active',
          permissions: { view: false, create: false, discount: false, refund: false, editStock: false, viewOrders: false, recordExpenses: false },
        }),
        setDoc(doc(db, 'shops/shop-a/orders/own-order'), { shopId: 'shop-a', employeeId: 'employee-a', branchId: 'main', status: 'COMPLETED' }),
        setDoc(doc(db, 'shops/shop-a/orders/other-order'), { shopId: 'shop-a', employeeId: 'other', branchId: 'main', status: 'COMPLETED' }),
      ]);
    });
  });

  afterAll(async () => environment?.cleanup());

  it('isolates owners to their own tenant', async () => {
    const db = environment.authenticatedContext('owner-a').firestore();
    await assertSucceeds(getDoc(doc(db, 'shops/shop-a/products/product-a')));
    await assertFails(getDoc(doc(db, 'shops/shop-b/products/product-b')));
  });

  it('blocks all tenant data when a shop is suspended', async () => {
    const db = environment.authenticatedContext('owner-s').firestore();
    await assertSucceeds(getDoc(doc(db, 'shops/suspended')));
    await assertFails(getDoc(doc(db, 'shops/suspended/products/product-s')));
  });

  it('lets employees read their own orders but enforces viewOrders for other orders', async () => {
    const db = environment.authenticatedContext('employee-a').firestore();
    await assertSucceeds(getDoc(doc(db, 'shops/shop-a/orders/own-order')));
    await assertFails(getDoc(doc(db, 'shops/shop-a/orders/other-order')));
  });

  it('enforces the create permission for employee sales', async () => {
    const db = environment.authenticatedContext('employee-a').firestore();
    const order = { shopId: 'shop-a', employeeId: 'employee-a', branchId: 'main', status: 'COMPLETED', total: 100, discount: 0, items: [] };
    await assertFails(setDoc(doc(db, 'shops/shop-a/orders/new-order-blocked'), order));
    await environment.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), 'shops/shop-a/employees/employee-a'), {
      'permissions.create': true,
    }));
    await assertSucceeds(setDoc(doc(db, 'shops/shop-a/orders/new-order-allowed'), order));
  });

  it('isolates held orders to the owner and the employee who created them', async () => {
    const employeeDb = environment.authenticatedContext('employee-a').firestore();
    const ownerDb = environment.authenticatedContext('owner-a').firestore();
    const outsiderDb = environment.authenticatedContext('employee-b').firestore();
    const held = { shopId: 'shop-a', employeeId: 'employee-a', items: [], heldAt: new Date().toISOString() };
    await assertFails(setDoc(doc(employeeDb, 'shops/shop-a/heldOrders/held-a'), held));
    await environment.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), 'shops/shop-a/employees/employee-a'), {
      'permissions.create': true,
    }));
    await assertSucceeds(setDoc(doc(employeeDb, 'shops/shop-a/heldOrders/held-a'), held));
    await assertSucceeds(getDoc(doc(ownerDb, 'shops/shop-a/heldOrders/held-a')));
    await assertFails(getDoc(doc(outsiderDb, 'shops/shop-a/heldOrders/held-a')));
  });

  it('enforces expense and stock permissions at the database boundary', async () => {
    const employeeDb = environment.authenticatedContext('employee-a').firestore();
    await assertFails(setDoc(doc(employeeDb, 'shops/shop-a/expenses/expense-a'), {
      shopId: 'shop-a', branchId: 'main', actorId: 'employee-a', amount: 100, category: 'General', detail: '',
    }));
    await assertFails(updateDoc(doc(employeeDb, 'shops/shop-a/products/product-a'), { stock: 3, status: 'In Stock' }));

    await environment.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), 'shops/shop-a/employees/employee-a'), {
      'permissions.recordExpenses': true,
    }));
    await assertSucceeds(setDoc(doc(employeeDb, 'shops/shop-a/expenses/expense-b'), {
      shopId: 'shop-a', branchId: 'main', actorId: 'employee-a', amount: 100, category: 'General', detail: '',
    }));
  });

  it('rejects untraced owner stock edits and accepts an atomic movement record', async () => {
    const ownerDb = environment.authenticatedContext('owner-a').firestore();
    const productRef = doc(ownerDb, 'shops/shop-a/products/product-a');
    await assertFails(updateDoc(productRef, { stock: 8, status: 'In Stock' }));
    await assertSucceeds(runTransaction(ownerDb, async transaction => {
      const movementRef = doc(ownerDb, 'shops/shop-a/stockMovements/movement-a');
      transaction.update(productRef, { stock: 8, status: 'In Stock', lastMovementId: movementRef.id });
      transaction.set(movementRef, { shopId: 'shop-a', productId: 'product-a', productName: 'A', type: 'STOCK_IN', quantity: 3, before: 5, balance: 8, reason: 'Delivery received', createdAt: new Date().toISOString() });
    }));
  });

  it('allows negative checkout stock only after the shop setting is enabled', async () => {
    const ownerDb = environment.authenticatedContext('owner-a').firestore();
    const productRef = doc(ownerDb, 'shops/shop-a/products/product-a');
    const attempt = (movementId: string) => runTransaction(ownerDb, async transaction => {
      const movementRef = doc(ownerDb, `shops/shop-a/stockMovements/${movementId}`);
      transaction.update(productRef, { stock: -1, status: 'Out of Stock', lastMovementId: movementRef.id });
      transaction.set(movementRef, { shopId: 'shop-a', productId: 'product-a', productName: 'A', type: 'STOCK_OUT', quantity: -6, before: 5, balance: -1, reason: 'Negative-stock checkout', createdAt: new Date().toISOString() });
    });
    await assertFails(attempt('negative-blocked'));
    await assertSucceeds(setDoc(doc(ownerDb, 'shops/shop-a/settings/general'), { allowNegativeStock: true }));
    await assertSucceeds(attempt('negative-allowed'));
  });

  it('prevents owners from changing root authorization records', async () => {
    const db = environment.authenticatedContext('owner-a').firestore();
    await assertFails(setDoc(doc(db, 'users/attacker'), { role: 'OWNER', shopId: 'shop-b', active: true }));
  });

  it('grants platform-wide reads only to an admin custom claim', async () => {
    const db = environment.authenticatedContext('admin-user', { admin: true }).firestore();
    await assertSucceeds(getDoc(doc(db, 'shops/shop-b/products/product-b')));
  });
});
