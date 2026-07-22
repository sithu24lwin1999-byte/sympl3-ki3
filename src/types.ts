export type Role = 'ADMIN' | 'OWNER' | 'EMPLOYEE';
export type OrderStatus = 'PENDING' | 'PREPARING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';

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
  discount: number;
  total: number;
  paymentMethod: 'Cash' | 'KBZ Pay' | 'Wave Pay';
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
}
