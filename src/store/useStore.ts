import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, Customer, Sale, Payment, SaleItem, SaleStatus, PaymentMethod } from '@/types';

const generateId = () => crypto.randomUUID();

// Sample data
const sampleProducts: Product[] = [
  { id: '1', name: 'Pan Francés', category: 'pan', cost: 0.15, price: 0.30, active: true, createdAt: new Date().toISOString() },
  { id: '2', name: 'Pan de Jamón', category: 'pan', cost: 1.50, price: 3.00, active: true, createdAt: new Date().toISOString() },
  { id: '3', name: 'Dona Glaseada', category: 'dona', cost: 0.40, price: 1.00, active: true, createdAt: new Date().toISOString() },
  { id: '4', name: 'Dona de Chocolate', category: 'dona', cost: 0.50, price: 1.20, active: true, createdAt: new Date().toISOString() },
  { id: '5', name: 'Pan Campesino', category: 'pan', cost: 0.80, price: 1.50, active: true, createdAt: new Date().toISOString() },
  { id: '6', name: 'Dona Rellena', category: 'dona', cost: 0.60, price: 1.50, active: true, createdAt: new Date().toISOString() },
];

const sampleCustomers: Customer[] = [
  { id: '1', firstName: 'María', lastName: 'González', phone: '+584121234567', address: 'Calle Principal #10', totalPurchases: 15, totalSpent: 45.00, createdAt: new Date().toISOString() },
  { id: '2', firstName: 'Carlos', lastName: 'Rodríguez', phone: '+584149876543', address: 'Av. Libertador #25', totalPurchases: 8, totalSpent: 28.50, createdAt: new Date().toISOString() },
  { id: '3', firstName: 'Ana', lastName: 'Martínez', phone: '+584161112233', totalPurchases: 22, totalSpent: 67.00, createdAt: new Date().toISOString() },
];

const today = new Date().toISOString();
const sampleSales: Sale[] = [
  {
    id: '1', customerId: '1', customerName: 'María González',
    items: [{ productId: '1', productName: 'Pan Francés', quantity: 10, unitPrice: 0.30, unitCost: 0.15, subtotal: 3.00 }],
    total: 3.00, totalCost: 1.50, payments: [{ id: 'p1', amount: 3.00, method: 'efectivo', date: today }],
    amountPaid: 3.00, balance: 0, status: 'pagado', paymentMethod: 'efectivo', createdAt: today, updatedAt: today,
  },
  {
    id: '2', customerId: '3', customerName: 'Ana Martínez',
    items: [
      { productId: '3', productName: 'Dona Glaseada', quantity: 6, unitPrice: 1.00, unitCost: 0.40, subtotal: 6.00 },
      { productId: '4', productName: 'Dona de Chocolate', quantity: 4, unitPrice: 1.20, unitCost: 0.50, subtotal: 4.80 },
    ],
    total: 10.80, totalCost: 4.40, payments: [{ id: 'p2', amount: 5.00, method: 'pago_movil', date: today }],
    amountPaid: 5.00, balance: 5.80, status: 'abonado', paymentMethod: 'credito', createdAt: today, updatedAt: today,
  },
  {
    id: '3', customerId: '2', customerName: 'Carlos Rodríguez',
    items: [{ productId: '2', productName: 'Pan de Jamón', quantity: 2, unitPrice: 3.00, unitCost: 1.50, subtotal: 6.00 }],
    total: 6.00, totalCost: 3.00, payments: [],
    amountPaid: 0, balance: 6.00, status: 'deuda', paymentMethod: 'credito', createdAt: today, updatedAt: today,
  },
];

interface AppState {
  products: Product[];
  customers: Customer[];
  sales: Sale[];

  // Product actions
  addProduct: (p: Omit<Product, 'id' | 'createdAt' | 'active'>) => void;
  updateProduct: (id: string, p: Partial<Product>) => void;
  deleteProduct: (id: string) => void;

  // Customer actions
  addCustomer: (c: Omit<Customer, 'id' | 'createdAt' | 'totalPurchases' | 'totalSpent'>) => void;
  updateCustomer: (id: string, c: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  // Sale actions
  addSale: (sale: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>) => void;
  addPayment: (saleId: string, payment: Omit<Payment, 'id'>) => void;
  cancelSale: (saleId: string) => void;

  // Helpers
  getFrequentCustomers: () => Customer[];
  getTodayStats: () => { income: number; profit: number; receivables: number; salesCount: number };
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      products: sampleProducts,
      customers: sampleCustomers,
      sales: sampleSales,

      addProduct: (p) => set((s) => ({
        products: [...s.products, { ...p, id: generateId(), active: true, createdAt: new Date().toISOString() }],
      })),
      updateProduct: (id, p) => set((s) => ({
        products: s.products.map((pr) => pr.id === id ? { ...pr, ...p } : pr),
      })),
      deleteProduct: (id) => set((s) => ({
        products: s.products.filter((p) => p.id !== id),
      })),

      addCustomer: (c) => set((s) => ({
        customers: [...s.customers, { ...c, id: generateId(), totalPurchases: 0, totalSpent: 0, createdAt: new Date().toISOString() }],
      })),
      updateCustomer: (id, c) => set((s) => ({
        customers: s.customers.map((cu) => cu.id === id ? { ...cu, ...c } : cu),
      })),
      deleteCustomer: (id) => set((s) => ({
        customers: s.customers.filter((c) => c.id !== id),
      })),

      addSale: (sale) => {
        const id = generateId();
        const now = new Date().toISOString();
        set((s) => ({
          sales: [...s.sales, { ...sale, id, createdAt: now, updatedAt: now }],
          customers: s.customers.map((c) =>
            c.id === sale.customerId
              ? { ...c, totalPurchases: c.totalPurchases + 1, totalSpent: c.totalSpent + sale.amountPaid }
              : c
          ),
        }));
      },

      addPayment: (saleId, payment) => set((s) => {
        const sale = s.sales.find((sl) => sl.id === saleId);
        if (!sale) return s;
        const newPayment = { ...payment, id: generateId() };
        const newPaid = sale.amountPaid + payment.amount;
        const newBalance = sale.total - newPaid;
        const newStatus: SaleStatus = newBalance <= 0 ? 'pagado' : 'abonado';
        return {
          sales: s.sales.map((sl) =>
            sl.id === saleId
              ? { ...sl, payments: [...sl.payments, newPayment], amountPaid: newPaid, balance: Math.max(0, newBalance), status: newStatus, updatedAt: new Date().toISOString() }
              : sl
          ),
        };
      }),

      cancelSale: (saleId) => set((s) => ({
        sales: s.sales.map((sl) =>
          sl.id === saleId ? { ...sl, status: 'anulado' as SaleStatus, updatedAt: new Date().toISOString() } : sl
        ),
      })),

      getFrequentCustomers: () => {
        return [...get().customers].sort((a, b) => b.totalPurchases - a.totalPurchases).slice(0, 5);
      },

      getTodayStats: () => {
        const todayStr = new Date().toISOString().split('T')[0];
        const todaySales = get().sales.filter(
          (s) => s.createdAt.split('T')[0] === todayStr && s.status !== 'anulado'
        );
        const allActive = get().sales.filter((s) => s.status !== 'anulado');
        return {
          income: todaySales.reduce((sum, s) => sum + s.amountPaid, 0),
          profit: todaySales.reduce((sum, s) => sum + (s.amountPaid - s.totalCost), 0),
          receivables: allActive.reduce((sum, s) => sum + s.balance, 0),
          salesCount: todaySales.length,
        };
      },
    }),
    { name: 'panaderia-store' }
  )
);
