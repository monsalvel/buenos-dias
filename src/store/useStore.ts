import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { Product, Customer, Sale, Payment, SaleItem, SaleStatus, PaymentMethod, BcvRate, StoreSettings, ProductBatch, PriceList, PriceListPrice, PriceListKind, BatchPayment } from '@/types';
import { getLocalDateString } from '@/lib/utils';

// Map DB rows to app types
const mapProduct = (r: any): Product => ({
  id: r.id, name: r.name, category: r.category, cost: Number(r.cost),
  price: Number(r.price), description: r.description, stock: r.stock ?? 0, active: r.active, createdAt: r.created_at,
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

const mapBatch = (r: any): ProductBatch => ({
  id: r.id, productId: r.product_id, unitCost: Number(r.unit_cost),
  quantityReceived: r.quantity_received, quantityRemaining: r.quantity_remaining,
  receivedAt: r.received_at, note: r.note ?? undefined,
});

const mapPriceList = (r: any): PriceList => ({
  id: r.id, code: r.code, name: r.name, kind: r.kind as PriceListKind,
  currency: r.currency, isSystem: !!r.is_system, createdAt: r.created_at,
});

const mapPriceListPrice = (r: any): PriceListPrice => ({
  id: r.id, priceListId: r.price_list_id, productId: r.product_id,
  unitPrice: Number(r.unit_price), validFrom: r.valid_from, validTo: r.valid_to,
  note: r.note ?? undefined, createdByEmail: r.created_by_email ?? undefined,
  createdAt: r.created_at,
});

const mapBatchPayment = (r: any): BatchPayment => ({
  id: r.id, batchId: r.batch_id, amount: Number(r.amount),
  method: r.method, paidAt: r.paid_at, note: r.note ?? undefined,
  createdByEmail: r.created_by_email ?? undefined, createdAt: r.created_at,
});

interface AppState {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  batches: ProductBatch[];
  batchPayments: BatchPayment[];
  priceLists: PriceList[];
  /** Lookup: listId -> productId -> active unit price */
  activePrices: Record<string, Record<string, number>>;
  bcvRate: BcvRate | null;
  storeSettings: StoreSettings | null;
  loading: boolean;

  // Data fetching
  fetchAll: () => Promise<void>;
  fetchBcvRate: () => Promise<void>;
  fetchBatches: () => Promise<void>;
  fetchPriceLists: () => Promise<void>;
  fetchActivePrices: () => Promise<void>;
  fetchPriceHistory: (listId: string, productId: string) => Promise<PriceListPrice[]>;
  fetchBatchPayments: () => Promise<void>;

  // Batch payment actions
  addBatchPayment: (batchId: string, payment: Omit<BatchPayment, 'id' | 'batchId' | 'createdAt' | 'createdByEmail'>) => Promise<void>;
  deleteBatchPayment: (id: string) => Promise<void>;

  // Product actions
  addProduct: (p: Omit<Product, 'id' | 'createdAt' | 'active'>) => Promise<void>;
  updateProduct: (id: string, p: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  // Batch actions
  addBatch: (productId: string, quantity: number, unitCost: number, note?: string) => Promise<void>;
  adjustBatchRemaining: (batchId: string, newRemaining: number) => Promise<void>;

  // Customer actions
  addCustomer: (c: Omit<Customer, 'id' | 'createdAt' | 'totalPurchases' | 'totalSpent'>) => Promise<void>;
  updateCustomer: (id: string, c: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;

  // Sale actions
  addSale: (sale: Omit<Sale, 'id' | 'createdAt' | 'updatedAt' | 'items' | 'payments'>, items: SaleItem[], payments: Omit<Payment, 'id'>[], dueDate?: string) => Promise<void>;
  addPayment: (saleId: string, payment: Omit<Payment, 'id'>) => Promise<void>;
  cancelSale: (saleId: string) => Promise<void>;

  // Price list actions
  setProductPrice: (listId: string, productId: string, newPrice: number, note?: string) => Promise<void>;
  getActivePrice: (listId: string, productId: string) => number | null;

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
  batches: [],
  batchPayments: [],
  priceLists: [],
  activePrices: {},
  bcvRate: null,
  storeSettings: null,
  loading: true,

  fetchAll: async () => {
    set({ loading: true });
    const [prodRes, custRes, salesRes, batchesRes] = await Promise.all([
      supabase.from('products').select('*').order('created_at'),
      supabase.from('customers').select('*').order('created_at'),
      supabase.from('sales').select('*').order('created_at', { ascending: false }),
      supabase.from('product_batches').select('*').order('received_at', { ascending: false }),
    ]);

    const products = (prodRes.data || []).map(mapProduct);
    const customers = (custRes.data || []).map(mapCustomer);
    const batches = (batchesRes.data || []).map(mapBatch);

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
      priceListId: s.price_list_id,
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

    set({ products, customers, sales, batches, bcvRate, storeSettings, loading: false });

    // Lazy-load price lists, active prices and supplier payments in background
    get().fetchPriceLists();
    get().fetchActivePrices();
    get().fetchBatchPayments();
  },

  fetchBatchPayments: async () => {
    const { data, error } = await (supabase as any).from('batch_payments').select('*').order('paid_at', { ascending: false });
    if (error) { console.error('Error fetching batch_payments:', error); return; }
    set({ batchPayments: (data || []).map(mapBatchPayment) });
  },

  addBatchPayment: async (batchId, payment) => {
    const { data, error } = await (supabase as any).from('batch_payments').insert({
      batch_id: batchId,
      amount: payment.amount,
      method: payment.method,
      paid_at: payment.paidAt,
      note: payment.note ?? null,
    }).select().single();
    if (error) throw error;
    set((s) => ({ batchPayments: [mapBatchPayment(data), ...s.batchPayments] }));
  },

  deleteBatchPayment: async (id) => {
    const { error } = await (supabase as any).from('batch_payments').delete().eq('id', id);
    if (error) throw error;
    set((s) => ({ batchPayments: s.batchPayments.filter((p) => p.id !== id) }));
  },

  fetchPriceLists: async () => {
    const { data } = await supabase.from('price_lists').select('*').order('created_at');
    set({ priceLists: (data || []).map(mapPriceList) });
  },

  fetchActivePrices: async () => {
    const { data } = await supabase.from('price_list_prices').select('*').is('valid_to', null);
    const activePrices: Record<string, Record<string, number>> = {};
    for (const row of (data || []) as any[]) {
      const lid = row.price_list_id;
      const pid = row.product_id;
      if (!activePrices[lid]) activePrices[lid] = {};
      activePrices[lid][pid] = Number(row.unit_price);
    }
    set({ activePrices });
  },

  fetchPriceHistory: async (listId, productId) => {
    const { data, error } = await supabase
      .from('price_list_prices')
      .select('*')
      .eq('price_list_id', listId)
      .eq('product_id', productId)
      .order('valid_from', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapPriceListPrice);
  },

  fetchBatches: async () => {
    const { data } = await supabase.from('product_batches').select('*').order('received_at', { ascending: false });
    set({ batches: (data || []).map(mapBatch) });
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

    // Create initial prices in system lists
    const lists = get().priceLists;
    const saleList = lists.find((l) => l.code === 'LISTA_PRECIO_VENTA_USD');
    const costList = lists.find((l) => l.code === 'LISTA_PRECIO_COSTO_USD');
    const syncTasks: Promise<void>[] = [];
    if (saleList) syncTasks.push(get().setProductPrice(saleList.id, data.id, p.price, 'Precio inicial'));
    if (costList) syncTasks.push(get().setProductPrice(costList.id, data.id, p.cost, 'Costo inicial'));
    if (syncTasks.length) {
      try { await Promise.all(syncTasks); } catch (e) { console.error('Error creando precios iniciales:', e); }
    }
  },

  updateProduct: async (id, p) => {
    const update: any = {};
    if (p.name !== undefined) update.name = p.name;
    if (p.category !== undefined) update.category = p.category;
    if (p.cost !== undefined) update.cost = p.cost;
    if (p.price !== undefined) update.price = p.price;
    if (p.active !== undefined) update.active = p.active;
    if (p.description !== undefined) update.description = p.description;
    if (p.stock !== undefined) update.stock = p.stock;

    const prev = get().products.find((pr) => pr.id === id);
    const { error } = await supabase.from('products').update(update).eq('id', id);
    if (error) throw error;
    set((s) => ({ products: s.products.map((pr) => pr.id === id ? { ...pr, ...p } : pr) }));

    // Sync price lists when price/cost changed via product form
    const lists = get().priceLists;
    const saleList = lists.find((l) => l.code === 'LISTA_PRECIO_VENTA_USD');
    const costList = lists.find((l) => l.code === 'LISTA_PRECIO_COSTO_USD');
    const tasks: Promise<void>[] = [];
    if (saleList && p.price !== undefined && prev && prev.price !== p.price) {
      tasks.push(get().setProductPrice(saleList.id, id, p.price, 'Actualización desde ficha de producto'));
    }
    if (costList && p.cost !== undefined && prev && prev.cost !== p.cost) {
      tasks.push(get().setProductPrice(costList.id, id, p.cost, 'Actualización desde ficha de producto'));
    }
    if (tasks.length) {
      try { await Promise.all(tasks); } catch (e) { console.error('Error sincronizando listas de precios:', e); }
    }
  },

  deleteProduct: async (id) => {
    const { error } = await supabase.from('products').update({ active: false }).eq('id', id);
    if (error) throw error;
    set((s) => ({ products: s.products.map((p) => p.id === id ? { ...p, active: false } : p) }));
  },

  addBatch: async (productId, quantity, unitCost, note) => {
    const { data, error } = await supabase.from('product_batches').insert({
      product_id: productId,
      unit_cost: unitCost,
      quantity_received: quantity,
      quantity_remaining: quantity,
      note: note || null,
    }).select().single();
    if (error) throw error;

    // The trigger updated products.stock — refresh that one product
    const { data: prodData } = await supabase.from('products').select('*').eq('id', productId).single();
    set((s) => ({
      batches: [mapBatch(data), ...s.batches],
      products: prodData ? s.products.map((p) => p.id === productId ? mapProduct(prodData) : p) : s.products,
    }));
  },

  adjustBatchRemaining: async (batchId, newRemaining) => {
    const batch = get().batches.find((b) => b.id === batchId);
    if (!batch) return;
    const safe = Math.max(0, Math.min(newRemaining, batch.quantityReceived));
    const { error } = await supabase
      .from('product_batches')
      .update({ quantity_remaining: safe })
      .eq('id', batchId);
    if (error) throw error;

    const { data: prodData } = await supabase.from('products').select('*').eq('id', batch.productId).single();
    set((s) => ({
      batches: s.batches.map((b) => b.id === batchId ? { ...b, quantityRemaining: safe } : b),
      products: prodData ? s.products.map((p) => p.id === batch.productId ? mapProduct(prodData) : p) : s.products,
    }));
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
    // Validar stock antes de consumir: bloquear si algún producto tiene stock 0
    // o si la cantidad pedida supera el stock disponible.
    const productsState = get().products;
    for (const it of items) {
      const prod = productsState.find((p) => p.id === it.productId);
      const stock = prod?.stock ?? 0;
      if (stock <= 0) {
        throw new Error(`Sin stock: "${prod?.name || 'producto'}" tiene 0 unidades disponibles`);
      }
      if (it.quantity > stock) {
        throw new Error(`Stock insuficiente para "${prod?.name}": pediste ${it.quantity}, hay ${stock}`);
      }
    }

    // Consume FIFO for each item to get the real unit cost from batches
    const adjustedItems = await Promise.all(items.map(async (i) => {
      const { data: realCost } = await supabase.rpc('consume_stock_fifo', {
        _product_id: i.productId,
        _qty: i.quantity,
      });
      const unitCost = realCost != null ? Number(realCost) : i.unitCost;
      return { ...i, unitCost };
    }));

    const totalCost = adjustedItems.reduce((sum, i) => sum + i.unitCost * i.quantity, 0);

    const insertData: any = {
      customer_id: sale.customerId,
      customer_name: sale.customerName,
      seller_name: sale.sellerName,
      total: sale.total,
      total_cost: totalCost,
      amount_paid: sale.amountPaid,
      balance: sale.balance,
      status: sale.status,
      payment_method: sale.paymentMethod,
      price_list_id: sale.priceListId,
      due_date: dueDate || null,
    };
    const { data: saleData, error: saleErr } = await supabase.from('sales').insert(insertData).select().single();
    if (saleErr) throw saleErr;

    // Insert sale items with the FIFO-adjusted costs
    const itemRows = adjustedItems.map((i) => ({
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
      priceListId: (saleData as any).price_list_id,
      createdAt: saleData.created_at,
      updatedAt: saleData.updated_at,
      dueDate: (saleData as any).due_date || undefined,
      items: (itemsData || []).map(mapSaleItem),
      payments: paymentsData.map(mapPayment),
    };

    // Refresh batches & products to reflect FIFO consumption
    await get().fetchBatches();
    const productIds = [...new Set(adjustedItems.map((i) => i.productId))];
    if (productIds.length) {
      const { data: prods } = await supabase.from('products').select('*').in('id', productIds);
      if (prods) {
        set((s) => ({
          products: s.products.map((p) => {
            const updated = prods.find((u: any) => u.id === p.id);
            return updated ? mapProduct(updated) : p;
          }),
        }));
      }
    }

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

  setProductPrice: async (listId, productId, newPrice, note) => {
    const { error } = await supabase.rpc('set_product_price', {
      _list_id: listId,
      _product_id: productId,
      _new_price: newPrice,
      _note: note ?? null,
    });
    if (error) throw error;
    set((s) => {
      const next = { ...s.activePrices };
      if (!next[listId]) next[listId] = {};
      next[listId] = { ...next[listId], [productId]: newPrice };
      return { activePrices: next };
    });
  },

  getActivePrice: (listId, productId) => {
    const v = get().activePrices[listId]?.[productId];
    return typeof v === 'number' ? v : null;
  },

  updateStoreSettings: async (s) => {
    const current = get().storeSettings;
    const update: any = {};
    if (s.storeName !== undefined) update.store_name = s.storeName;
    if (s.phone !== undefined) update.phone = s.phone;
    if (s.bank !== undefined) update.bank = s.bank;
    if (s.cedula !== undefined) update.cedula = s.cedula;

    if (current) {
      await supabase.from('store_settings').update(update).eq('id', current.id);
      set({ storeSettings: { ...current, ...s } });
    }
  },

  getFrequentCustomers: () => {
    return [...get().customers].sort((a, b) => b.totalPurchases - a.totalPurchases).slice(0, 5);
  },

  getTodayStats: () => {
    const todayStr = getLocalDateString();
    const todaySales = get().sales.filter(
      (s) => s.status !== 'anulado' && getLocalDateString(s.createdAt) === todayStr
    );
    const allActive = get().sales.filter((s) => s.status !== 'anulado');
    return {
      income: todaySales.reduce((sum, s) => sum + s.amountPaid, 0),
      profit: todaySales.reduce((sum, s) => sum + (s.total - s.totalCost), 0),
      receivables: allActive.reduce((sum, s) => sum + s.balance, 0),
      salesCount: todaySales.length,
    };
  },
}));
