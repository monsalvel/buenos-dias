import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { Product, Customer, Sale, Payment, SaleItem, SaleStatus, PaymentMethod, BcvRate, StoreSettings } from '@/types';
import { getLocalDateString } from '@/lib/utils';

// Map DB rows to app types
const mapProduct = (r: any): Product => ({
  id: r.id, name: r.name, category: r.category, cost: Number(r.cost),
  price: Number(r.price), description: r.description, active: r.active, createdAt: r.created_at,
});

const mapCustomer = (r: any): Customer => ({
  id: r.id, firstName: r.first_name, lastName: r.last_name, phone: r.phone,
  address: r.address, totalPurchases: r.total_purchases, totalSpent: Number(r.total_spent),
  isFavorite: r.is_favorite, createdAt: r.created_at,
});

const mapPayment = (r: any): Payment => ({
  id: r.id, saleId: r.sale_id, amount: Number(r.amount), method: r.method, date: r.date, note: r.note,
});

const mapSaleItem = (r: any): SaleItem => ({
  id: r.id, saleId: r.sale_id, productId: r.product_id, productName: r.product_name,
  quantity: r.quantity, unitPrice: Number(r.unit_price), unitCost: Number(r.unit_cost), subtotal: Number(r.subtotal),
});

interface AppState {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  bcvRate: BcvRate | null;
  storeSettings: StoreSettings | null;
  loading: boolean;

  // Data fetching
  fetchAll: () => Promise<void>;
  fetchBcvRate: () => Promise<void>;

  // Product actions
  addProduct: (p: Omit<Product, 'id' | 'createdAt' | 'active'>) => Promise<void>;
  updateProduct: (id: string, p: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  // Customer actions
  addCustomer: (c: Omit<Customer, 'id' | 'createdAt' | 'totalPurchases' | 'totalSpent'>) => Promise<void>;
  updateCustomer: (id: string, c: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;

  // Sale actions
  addSale: (sale: Omit<Sale, 'id' | 'createdAt' | 'updatedAt' | 'items' | 'payments'>, items: SaleItem[], payments: Omit<Payment, 'id'>[], dueDate?: string) => Promise<void>;
  addPayment: (saleId: string, payment: Omit<Payment, 'id'>) => Promise<void>;
  cancelSale: (saleId: string) => Promise<void>;

  // Store settings
  updateStoreSettings: (s: Partial<StoreSettings>) => Promise<void>;

  // Helpers
  getFrequentCustomers: () => Customer[];
  getTodayStats: () => { income: number; profit: number; receivables: number; salesCount: number };
}

export const useStore = create<AppState>()((set, get) => ({
  products: [],
  customers: [],
  sales: [],
  bcvRate: null,
  storeSettings: null,
  loading: true,

  fetchAll: async () => {
    set({ loading: true });
    const [prodRes, custRes, salesRes] = await Promise.all([
      supabase.from('products').select('*').order('created_at'),
      supabase.from('customers').select('*').order('created_at'),
      supabase.from('sales').select('*').order('created_at', { ascending: false }),
    ]);

    const products = (prodRes.data || []).map(mapProduct);
    const customers = (custRes.data || []).map(mapCustomer);

    // Fetch items and payments for all sales
    const saleIds = (salesRes.data || []).map((s: any) => s.id);
    let allItems: any[] = [];
    let allPayments: any[] = [];

    if (saleIds.length > 0) {
      const [itemsRes, paymentsRes] = await Promise.all([
        supabase.from('sale_items').select('*').in('sale_id', saleIds),
        supabase.from('payments').select('*').in('sale_id', saleIds).order('date'),
      ]);
      allItems = itemsRes.data || [];
      allPayments = paymentsRes.data || [];
    }

    const sales: Sale[] = (salesRes.data || []).map((s: any) => ({
      id: s.id,
      customerId: s.customer_id,
      customerName: s.customer_name,
      sellerName: s.seller_name || '',
      total: Number(s.total),
      totalCost: Number(s.total_cost),
      amountPaid: Number(s.amount_paid),
      balance: Number(s.balance),
      status: s.status as SaleStatus,
      paymentMethod: s.payment_method as PaymentMethod,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      dueDate: s.due_date || undefined,
      items: allItems.filter((i: any) => i.sale_id === s.id).map(mapSaleItem),
      payments: allPayments.filter((p: any) => p.sale_id === s.id).map(mapPayment),
    }));

    // Fetch latest BCV rate
    const { data: rateData } = await supabase
      .from('bcv_rates')
      .select('*')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const bcvRate = rateData ? {
      id: rateData.id, currency: rateData.currency,
      rate: Number(rateData.rate), fetchedAt: rateData.fetched_at,
    } : null;

    // Fetch store settings
    const { data: settingsData } = await supabase
      .from('store_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    const storeSettings: StoreSettings | null = settingsData ? {
      id: settingsData.id, storeName: settingsData.store_name,
      phone: settingsData.phone, bank: settingsData.bank, cedula: settingsData.cedula,
    } : null;

    set({ products, customers, sales, bcvRate, storeSettings, loading: false });
  },

  fetchBcvRate: async () => {
    try {
      const { data, error } = await supabase.functions.invoke('bcv-rate');
      if (error) throw error;
      if (data?.success) {
        set({
          bcvRate: {
            id: '', currency: data.currency,
            rate: data.rate, fetchedAt: data.fetched_at,
          },
        });
      }
    } catch (e) {
      console.error('Error fetching BCV rate:', e);
    }
  },

  addProduct: async (p) => {
    const { data, error } = await supabase.from('products').insert({
      name: p.name, category: p.category, cost: p.cost, price: p.price, description: p.description,
    }).select().single();
    if (error) throw error;
    set((s) => ({ products: [...s.products, mapProduct(data)] }));
  },

  updateProduct: async (id, p) => {
    const update: any = {};
    if (p.name !== undefined) update.name = p.name;
    if (p.category !== undefined) update.category = p.category;
    if (p.cost !== undefined) update.cost = p.cost;
    if (p.price !== undefined) update.price = p.price;
    if (p.active !== undefined) update.active = p.active;
    if (p.description !== undefined) update.description = p.description;

    const { error } = await supabase.from('products').update(update).eq('id', id);
    if (error) throw error;
    set((s) => ({ products: s.products.map((pr) => pr.id === id ? { ...pr, ...p } : pr) }));
  },

  deleteProduct: async (id) => {
    const { error } = await supabase.from('products').update({ active: false }).eq('id', id);
    if (error) throw error;
    set((s) => ({ products: s.products.map((p) => p.id === id ? { ...p, active: false } : p) }));
  },

  addCustomer: async (c) => {
    const { data, error } = await supabase.from('customers').insert({
      first_name: c.firstName, last_name: c.lastName, phone: c.phone, address: c.address,
    }).select().single();
    if (error) throw error;
    set((s) => ({ customers: [...s.customers, mapCustomer(data)] }));
  },

  updateCustomer: async (id, c) => {
    const update: any = {};
    if (c.firstName !== undefined) update.first_name = c.firstName;
    if (c.lastName !== undefined) update.last_name = c.lastName;
    if (c.phone !== undefined) update.phone = c.phone;
    if (c.address !== undefined) update.address = c.address;

    const { error } = await supabase.from('customers').update(update).eq('id', id);
    if (error) throw error;
    set((s) => ({ customers: s.customers.map((cu) => cu.id === id ? { ...cu, ...c } : cu) }));
  },

  deleteCustomer: async (id) => {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw error;
    set((s) => ({ customers: s.customers.filter((c) => c.id !== id) }));
  },

  addSale: async (sale, items, payments, dueDate) => {
    // Insert sale (due_date stored locally only until DB column is added)
    const insertData: any = {
      customer_id: sale.customerId,
      customer_name: sale.customerName,
      seller_name: sale.sellerName,
      total: sale.total,
      total_cost: sale.totalCost,
      amount_paid: sale.amountPaid,
      balance: sale.balance,
      status: sale.status,
      payment_method: sale.paymentMethod,
    };
    const { data: saleData, error: saleErr } = await supabase.from('sales').insert(insertData).select().single();
    if (saleErr) throw saleErr;

    // Insert sale items
    const itemRows = items.map((i) => ({
      sale_id: saleData.id,
      product_id: i.productId,
      product_name: i.productName,
      quantity: i.quantity,
      unit_price: i.unitPrice,
      unit_cost: i.unitCost,
      subtotal: i.subtotal,
    }));
    const { data: itemsData } = await supabase.from('sale_items').insert(itemRows).select();

    // Insert payments if any
    let paymentsData: any[] = [];
    if (payments.length > 0) {
      const payRows = payments.map((p) => ({
        sale_id: saleData.id,
        amount: p.amount,
        method: p.method,
        date: p.date,
      }));
      const { data: pd } = await supabase.from('payments').insert(payRows).select();
      paymentsData = pd || [];
    }

    // Update customer stats
    await supabase.from('customers').update({
      total_purchases: (get().customers.find(c => c.id === sale.customerId)?.totalPurchases || 0) + 1,
      total_spent: (get().customers.find(c => c.id === sale.customerId)?.totalSpent || 0) + sale.amountPaid,
    }).eq('id', sale.customerId);

    const newSale: Sale = {
      id: saleData.id,
      customerId: saleData.customer_id,
      customerName: saleData.customer_name,
      sellerName: saleData.seller_name || '',
      total: Number(saleData.total),
      totalCost: Number(saleData.total_cost),
      amountPaid: Number(saleData.amount_paid),
      balance: Number(saleData.balance),
      status: saleData.status as SaleStatus,
      paymentMethod: saleData.payment_method as PaymentMethod,
      createdAt: saleData.created_at,
      updatedAt: saleData.updated_at,
      dueDate: (saleData as any).due_date || undefined,
      items: (itemsData || []).map(mapSaleItem),
      payments: paymentsData.map(mapPayment),
    };

    set((s) => ({
      sales: [newSale, ...s.sales],
      customers: s.customers.map((c) =>
        c.id === sale.customerId
          ? { ...c, totalPurchases: c.totalPurchases + 1, totalSpent: c.totalSpent + sale.amountPaid }
          : c
      ),
    }));
  },

  addPayment: async (saleId, payment) => {
    const sale = get().sales.find((s) => s.id === saleId);
    if (!sale) return;

    const { data: payData, error } = await supabase.from('payments').insert({
      sale_id: saleId, amount: payment.amount, method: payment.method, date: payment.date,
    }).select().single();
    if (error) throw error;

    const newPaid = sale.amountPaid + payment.amount;
    const newBalance = Math.max(0, sale.total - newPaid);
    const newStatus: SaleStatus = newBalance <= 0 ? 'pagado' : 'abonado';

    await supabase.from('sales').update({
      amount_paid: newPaid, balance: newBalance, status: newStatus,
    }).eq('id', saleId);

    set((s) => ({
      sales: s.sales.map((sl) =>
        sl.id === saleId
          ? { ...sl, payments: [...sl.payments, mapPayment(payData)], amountPaid: newPaid, balance: newBalance, status: newStatus, updatedAt: new Date().toISOString() }
          : sl
      ),
    }));
  },

  cancelSale: async (saleId) => {
    await supabase.from('sales').update({ status: 'anulado' as any }).eq('id', saleId);
    set((s) => ({
      sales: s.sales.map((sl) =>
        sl.id === saleId ? { ...sl, status: 'anulado' as SaleStatus, updatedAt: new Date().toISOString() } : sl
      ),
    }));
  },

  getFrequentCustomers: () => {
    return [...get().customers].sort((a, b) => b.totalPurchases - a.totalPurchases).slice(0, 5);
  },

  getTodayStats: () => {
    const todayStr = getLocalDateString();
    console.log(todayStr);
    // Filtramos las ventas no anuladas que localmente ocurrieron hoy
    const todaySales = get().sales.filter(
      (s) => s.status !== 'anulado' && getLocalDateString(s.createdAt) === todayStr
    );
    const allActive = get().sales.filter((s) => s.status !== 'anulado');
    return {
      income: todaySales.reduce((sum, s) => sum + s.amountPaid, 0),
      profit: todaySales.reduce((sum, s) => sum + (s.amountPaid - s.totalCost), 0),
      receivables: allActive.reduce((sum, s) => sum + s.balance, 0),
      salesCount: todaySales.length,
    };
  },
}));
