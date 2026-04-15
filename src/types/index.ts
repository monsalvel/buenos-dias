export interface Product {
  id: string;
  name: string;
  category: 'pan' | 'dona' | 'otro';
  cost: number;
  price: number;
  description?: string;
  active: boolean;
  createdAt: string;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  address?: string;
  totalPurchases: number;
  totalSpent: number;
  isFavorite?: boolean;
  createdAt: string;
}

export interface SaleItem {
  id?: string;
  saleId?: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  subtotal: number;
}

export type PaymentMethod = 'efectivo' | 'transferencia' | 'pago_movil' | 'credito';
export type SaleStatus = 'pagado' | 'abonado' | 'deuda' | 'anulado';

export interface Payment {
  id: string;
  saleId?: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  note?: string;
}

export interface Sale {
  id: string;
  customerId: string;
  customerName: string;
  sellerName: string;
  items: SaleItem[];
  total: number;
  totalCost: number;
  payments: Payment[];
  amountPaid: number;
  balance: number;
  status: SaleStatus;
  paymentMethod: PaymentMethod;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
}

export interface BcvRate {
  id: string;
  currency: string;
  rate: number;
  fetchedAt: string;
}

export interface StoreSettings {
  id: string;
  storeName: string;
  phone: string;
  bank: string;
  cedula: string;
}

export type TabId = 'dashboard' | 'sales' | 'customers' | 'products' | 'settings';
