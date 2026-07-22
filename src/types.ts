export type Role = 'ADMIN' | 'OWNER' | 'EMPLOYEE';
export type OrderStatus = 'PENDING' | 'PREPARING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
export type BusinessType = 'RESTAURANT' | 'RETAIL' | 'FASHION' | 'BAKERY' | 'SERVICE' | 'OTHER';
export type PaymentKind = 'CASH' | 'KPAY' | 'WAVE' | 'BANK';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  shopId?: string;
}

export interface Shop {
  id: string;
  name: string;
  owner: string;
  ownerId: string;
  ownerEmail: string;
  phone: string;
  address?: string;
  plan: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
  expiry: string;
  createdAt?: string;
  businessType?: BusinessType;
}

export interface EmployeePermissions {
  discount: boolean;
  refund: boolean;
  editStock: boolean;
  viewOrders: boolean;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  status: 'Active' | 'Inactive' | 'On Leave';
  shift: string;
  shopId: string;
  permissions?: EmployeePermissions;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  image: string;
  shopId: string;
  itemType?: 'PRODUCT' | 'SERVICE';
  trackStock?: boolean;
}

export interface PaymentAccount {
  id: string;
  shopId: string;
  kind: Exclude<PaymentKind, 'CASH'>;
  label: string;
  accountName: string;
  accountNumber: string;
  bankName?: string;
  active: boolean;
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  shopId: string;
  customer: string;
  customerPhone?: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  serviceCharge?: number;
  discount: number;
  total: number;
  paymentMethod: string;
  paymentKind?: PaymentKind;
  paymentAccountId?: string;
  paymentAccountLabel?: string;
  paymentAccountNumber?: string;
  paymentReference?: string;
  status: OrderStatus;
  type: 'ONLINE' | 'OFFLINE';
  employeeId?: string;
  shiftId?: string;
  createdAt: string;
  refundedAt?: string;
}

export interface Shift {
  id: string;
  shopId: string;
  employeeId: string;
  employeeName: string;
  openingCash: number;
  closingCash?: number;
  openedAt: string;
  closedAt?: string;
  status: 'OPEN' | 'CLOSED';
  expectedCash?: number;
  cashDifference?: number;
}

export interface Supplier {
  id: string;
  shopId: string;
  name: string;
  phone: string;
  address?: string;
  createdAt: string;
}

export interface Purchase {
  id: string;
  shopId: string;
  supplierId?: string;
  supplierName: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  total: number;
  createdAt: string;
}

export interface Expense {
  id: string;
  shopId: string;
  category: string;
  note: string;
  amount: number;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  shopId: string;
  actorId: string;
  actorName: string;
  action: string;
  detail: string;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  shopId: string;
  productId: string;
  productName: string;
  type: 'SALE' | 'REFUND' | 'PURCHASE' | 'ADJUSTMENT';
  quantity: number;
  balance: number;
  note?: string;
  createdAt: string;
}

export interface ShopSettings {
  businessType: BusinessType;
  taxRate: number;
  serviceCharge: number;
  invoicePrefix: string;
  loyaltyPointsPer1000: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  totalSpent?: number;
  visits?: number;
  loyaltyPoints?: number;
  updatedAt: string;
}
