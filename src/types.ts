export type Role = 'ADMIN' | 'OWNER' | 'EMPLOYEE';
export type OrderStatus = 'DRAFT' | 'HELD' | 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
export type BusinessType = 'RESTAURANT' | 'RETAIL' | 'FASHION' | 'BAKERY' | 'PHOTOBOOTH' | 'SERVICE' | 'OTHER';
export type PaymentKind = 'CASH' | 'BANK' | 'CARD' | 'KPAY' | 'WAVE' | 'AYAPAY' | 'CBPAY' | 'CREDIT' | 'SPLIT';
export type OrderChannel = 'ONLINE' | 'IN_STORE';
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED';
export type TenantSystemStatus = 'ACTIVE' | 'STOPPED' | 'ARCHIVED';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  shopId?: string;
  branchId?: string;
  branchName?: string;
  permissions?: EmployeePermissions;
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
  status: SubscriptionStatus;
  systemStatus?: TenantSystemStatus;
  expiry: string;
  subscriptionStart?: string;
  monthlyFee?: number;
  trialEndsAt?: string;
  archivedAt?: string;
  updatedAt?: string;
  createdAt?: string;
  businessType?: BusinessType;
}

export interface SubscriptionTransaction {
  id: string;
  shopId: string;
  shopName: string;
  plan: string;
  type: 'INITIAL' | 'RENEWAL' | 'EXTENSION' | 'ADJUSTMENT';
  status: 'PAID' | 'OUTSTANDING' | 'VOID';
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  paymentMethod?: string;
  reference?: string;
  paidAt?: string;
  createdAt: string;
  actorId?: string;
  actorName?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  monthlyFee: number;
  active: boolean;
  trialDays: number;
}

export interface PlatformSettings {
  systemName: string;
  supportEmail: string;
  logo?: string;
  favicon?: string;
  currency: string;
  language: string;
  timezone: string;
  defaultTaxRate: number;
  trialPeriodDays: number;
  gracePeriodDays: number;
  maintenanceMode: boolean;
  dataRetentionDays: number;
  plans: SubscriptionPlan[];
  featureFlags: Record<string, boolean>;
  notifications: { emailEnabled: boolean; smsEnabled: boolean; renewalDays: number };
  security: { sessionTimeoutMinutes: number; requireStrongPasswords: boolean; auditRetentionDays: number };
  backup: { enabled: boolean; frequency: string; retentionDays: number };
}

export interface EmployeePermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  export: boolean;
  approve: boolean;
  discount: boolean;
  refund: boolean;
  viewCost: boolean;
  viewProfit: boolean;
  accessReports: boolean;
  manageSettings: boolean;
  editStock: boolean;
  viewOrders: boolean;
  recordExpenses: boolean;
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
  branchId?: string;
  branchName?: string;
  permissions?: EmployeePermissions;
}

export interface Branch {
  id: string;
  shopId: string;
  name: string;
  phone?: string;
  address?: string;
  active: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  brand?: string;
  unit?: string;
  supplierId?: string;
  supplierName?: string;
  price: number;
  cost: number;
  discount?: number;
  tax?: number;
  onlinePrice?: number;
  inStorePrice?: number;
  stock: number;
  minStock: number;
  maxStock?: number;
  variants?: Array<{ id: string; name: string; sku?: string; barcode?: string; price?: number }>;
  description?: string;
  active?: boolean;
  availableOnline?: boolean;
  availableInStore?: boolean;
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
  qrCode?: string;
  active: boolean;
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  cost?: number;
}

export interface PaymentAllocation {
  kind: Exclude<PaymentKind, 'SPLIT'>;
  label: string;
  amount: number;
  accountId?: string;
  accountNumber?: string;
  reference?: string;
}

export interface Order {
  id: string;
  orderNumber?: string;
  shopId: string;
  shopName?: string;
  branchId?: string;
  branchName?: string;
  customer: string;
  customerPhone?: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  serviceCharge?: number;
  deliveryCharge?: number;
  discount: number;
  total: number;
  paidAmount?: number;
  initialPaidAmount?: number;
  dueAmount?: number;
  paymentMethod: string;
  paymentKind?: PaymentKind;
  paymentAccountId?: string;
  paymentAccountLabel?: string;
  paymentAccountNumber?: string;
  paymentReference?: string;
  payments?: PaymentAllocation[];
  notes?: string;
  status: OrderStatus;
  type: 'ONLINE' | 'IN_STORE' | 'OFFLINE';
  employeeId?: string;
  employeeName?: string;
  shiftId?: string;
  createdAt: string;
  statusUpdatedAt?: string;
  confirmedAt?: string;
  preparingAt?: string;
  readyAt?: string;
  completedAt?: string;
  refundedAt?: string;
  refundReason?: string;
  cancelledAt?: string;
  cancelReason?: string;
}

export interface HeldOrder {
  id: string;
  orderNumber?: string;
  shopId: string;
  branchId: string;
  branchName: string;
  employeeId: string;
  employeeName: string;
  type: OrderChannel;
  items: OrderItem[];
  customer: string;
  customerPhone?: string;
  discountPercent: number;
  deliveryCharge: number;
  notes?: string;
  heldAt: string;
}

export interface Shift {
  id: string;
  shopId: string;
  branchId?: string;
  branchName?: string;
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
  branchId?: string;
  branchName?: string;
  type?: 'OPERATING' | 'OWNER_WITHDRAWAL';
  actorId?: string;
  actorName?: string;
  category: string;
  note: string;
  amount: number;
  createdAt: string;
}

export interface DueCollection {
  id: string;
  shopId: string;
  orderId: string;
  orderNumber: string;
  customer: string;
  amount: number;
  paymentKind: Exclude<PaymentKind, 'CREDIT' | 'SPLIT'>;
  paymentMethod: string;
  reference?: string;
  actorId: string;
  actorName: string;
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
  orderId?: string;
  productId: string;
  productName: string;
  type: 'SALE' | 'REFUND' | 'PURCHASE' | 'ADJUSTMENT' | 'STOCK_IN' | 'STOCK_OUT' | 'COUNT';
  quantity: number;
  before?: number;
  balance: number;
  reason?: string;
  actorId?: string;
  actorName?: string;
  sourceId?: string;
  note?: string;
  createdAt: string;
}

export interface ShopSettings {
  businessType: BusinessType;
  taxRate: number;
  serviceCharge: number;
  invoicePrefix: string;
  loyaltyPointsPer1000: number;
  allowNegativeStock: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  totalSpent?: number;
  visits?: number;
  loyaltyPoints?: number;
  outstandingCredit?: number;
  updatedAt: string;
}
