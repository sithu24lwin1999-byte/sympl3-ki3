export type Role = 'ADMIN' | 'OWNER' | 'EMPLOYEE';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  shopId?: string;
}

export interface Shop {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  plan: '30000 MMK' | '50000 MMK';
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
  expiryDate: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  image: string;
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
  items: OrderItem[];
  total: number;
  status: 'PENDING' | 'PREPARING' | 'COMPLETED' | 'CANCELLED';
  type: 'ONLINE' | 'OFFLINE';
  createdAt: string;
}
