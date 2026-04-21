import { useState } from 'react';
import { toast } from 'sonner';
import { useStore } from '@/store/useStore';
import { SaleItem, PaymentMethod, SaleStatus, Sale } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Plus, Minus, DollarSign, Eye, CalendarClock, Check, ChevronsUpDown } from 'lucide-react';
import { cn, getLocalDateString } from '@/lib/utils';

const paymentLabels: Record<PaymentMethod, string> = {
  efectivo: '💵 Efectivo',
  transferencia: '🏦 Transferencia',
  pago_movil: '📱 Pago Móvil',
  credito: '📋 Crédito',
};

const statusColors: Record<SaleStatus, string> = {
  pagado: 'bg-success/10 text-success',
  abonado: 'bg-warning/10 text-warning',
  deuda: 'bg-destructive/10 text-destructive',
  anulado: 'bg-muted text-muted-foreground',
};

const NewSaleForm = ({ onClose }: { onClose: () => void }) => {
  const { products, customers, addSale, priceLists, getActivePrice } = useStore();

  // Allow both sale and cost price lists for order creation
  const saleLists = priceLists.filter((l) => l.kind === 'sale');
  const costLists = priceLists.filter((l) => l.kind === 'cost');
  const defaultListId =
    saleLists.find((l) => l.code === 'LISTA_PRECIO_VENTA_USD')?.id ||
    saleLists[0]?.id ||
    costLists[0]?.id ||
    '';

  const [priceListId, setPriceListId] = useState(defaultListId);
  const [customerId, setCustomerId] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [items, setItems] = useState<SaleItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [paidAmount, setPaidAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [openCustomerList, setOpenCustomerList] = useState(false);

  const sortedCustomers = [...customers].sort((a, b) =>
    `${a.firstName} ${a.lastName || ''}`.trim().localeCompare(`${b.firstName} ${b.lastName || ''}`.trim())
  );

  const total = items.reduce((s, i) => s + i.subtotal, 0);
  const totalCost = items.reduce((s, i) => s + i.unitCost * i.quantity, 0);

  const selectedList = priceLists.find((l) => l.id === priceListId);
  const isCostList = selectedList?.kind === 'cost';

  const handleListChange = (newListId: string) => {
    if (items.length > 0) {
      const ok = window.confirm('Tienes productos en el carrito. Cambiar la lista los eliminará. ¿Continuar?');
      if (!ok) return;
      setItems([]);
    }
    setPriceListId(newListId);
  };

  const addItem = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const listPrice = priceListId ? getActivePrice(priceListId, productId) : null;
    if (listPrice == null) {
      toast.error('Este producto no tiene precio en la lista seleccionada');
      return;
    }
    const existing = items.find((i) => i.productId === productId);
    if (existing) {
      setItems(items.map((i) =>
        i.productId === productId
          ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unitPrice }
          : i
      ));
    } else {
      setItems([
        ...items,
        { productId, productName: product.name, quantity: 1, unitPrice: listPrice, unitCost: product.cost, subtotal: listPrice },
      ]);
    }
  };

  const updateQty = (productId: string, delta: number) => {
    setItems(items.map((i) => {
      if (i.productId !== productId) return i;
      const newQty = Math.max(0, i.quantity + delta);
      return { ...i, quantity: newQty, subtotal: newQty * i.unitPrice };
    }).filter((i) => i.quantity > 0));
  };

  const handleSubmit = async () => {
    if (!customerId || items.length === 0 || !sellerName.trim() || !priceListId) return;
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;

    setSubmitting(true);
    try {
      const paid = paymentMethod === 'credito' ? parseFloat(paidAmount || '0') : total;
      const balance = total - paid;
      const status: SaleStatus = balance <= 0 ? 'pagado' : paid > 0 ? 'abonado' : 'deuda';

      const payments = paid > 0 ? [{
        amount: paid,
        method: (paymentMethod === 'credito' ? 'efectivo' : paymentMethod) as PaymentMethod,
        date: new Date().toISOString(),
      }] : [];

      await addSale({
        customerId,
        customerName: `${customer.firstName} ${customer.lastName}`,
        sellerName: sellerName.trim(),
        total,
        totalCost,
        amountPaid: paid,
        balance: Math.max(0, balance),
        status,
        paymentMethod,
        priceListId,
      }, items, payments, dueDate || undefined);
      toast.success('Venta registrada exitosamente');
      onClose();
    } catch (e: any) {
      console.error('Error creating sale:', e);
      toast.error('Error al registrar venta', { description: e?.message || 'Intenta de nuevo' });
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !!customerId && items.length > 0 && !!sellerName.trim() && !!priceListId && !submitting;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Scrollable form content */}
      <div className="flex-1 overflow-y-auto px-1 -mx-1 space-y-4 pb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="seller-name">Vendedor</Label>
            <Input
              id="seller-name"
              value={sellerName}
              onChange={(e) => setSellerName(e.target.value)}
              placeholder="Nombre del vendedor"
              required
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Popover open={openCustomerList} onOpenChange={setOpenCustomerList}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openCustomerList}
                  className="w-full justify-between h-11 font-normal"
                >
                  <span className="truncate">
                    {customerId
                      ? (() => {
                          const c = customers.find((c) => c.id === customerId);
                          return c ? `${c.firstName} ${c.lastName || ''}`.trim() : 'Seleccionar cliente';
                        })()
                      : 'Seleccionar cliente'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar cliente..." />
                  <CommandList>
                    <CommandEmpty>No se encontró ningún cliente.</CommandEmpty>
                    <CommandGroup>
                      {sortedCustomers.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${c.firstName} ${c.lastName || ''}`}
                          onSelect={() => {
                            setCustomerId(c.id);
                            setOpenCustomerList(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              customerId === c.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          {c.firstName} {c.lastName}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Lista de precio *</Label>
          <Select value={priceListId} onValueChange={handleListChange}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Selecciona una lista" /></SelectTrigger>
            <SelectContent>
              {saleLists.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Venta</SelectLabel>
                  {saleLists.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectGroup>
              )}
              {costLists.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Costo</SelectLabel>
                  {costLists.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
          {isCostList && (
            <p className="text-[11px] text-warning leading-snug">
              ⚠️ Estás usando una lista de costo. Los precios aplicados serán de costo, no de venta.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Agregar productos</Label>
            <span className="text-[11px] text-muted-foreground">{items.length} en carrito</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {products.filter((p) => p.active).map((p) => {
              const listPrice = priceListId ? getActivePrice(priceListId, p.id) : null;
              const disabled = !priceListId || listPrice == null;
              return (
                <Button
                  key={p.id}
                  variant="outline"
                  className="h-auto min-h-11 py-2 px-3 justify-between gap-2 text-left"
                  onClick={() => addItem(p.id)}
                  disabled={disabled}
                  title={disabled ? 'Sin precio en la lista seleccionada' : undefined}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="text-base shrink-0">{p.category === 'pan' ? '🍞' : '🍩'}</span>
                    <span className="text-xs font-medium truncate">{p.name}</span>
                  </span>
                  <span
                    className={cn(
                      'text-xs font-semibold shrink-0 tabular-nums',
                      listPrice == null ? 'text-muted-foreground' : 'text-primary'
                    )}
                  >
                    {listPrice != null ? `$${listPrice.toFixed(2)}` : 'Sin precio'}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>

        {items.length > 0 && (
          <Card>
            <CardContent className="p-3 space-y-2">
              {items.map((item) => (
                <div key={item.productId} className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate flex-1 min-w-0">{item.productName}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(item.productId, -1)}>
                      <Minus className="w-3.5 h-3.5" />
                    </Button>
                    <span className="text-sm font-bold w-7 text-center tabular-nums">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(item.productId, 1)}>
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                    <span className="text-sm font-semibold w-16 text-right tabular-nums">${item.subtotal.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="space-y-1.5">
          <Label>Método de pago</Label>
          <Select value={paymentMethod} onValueChange={(v: PaymentMethod) => setPaymentMethod(v)}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(paymentLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {paymentMethod === 'credito' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Monto de abono inicial ($)</Label>
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder="0.00"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" />Fecha límite</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={getLocalDateString()}
                className="h-11"
              />
              <p className="text-[10px] text-muted-foreground">Se te recordará cuando llegue esta fecha</p>
            </div>
          </div>
        )}
      </div>

      {/* Sticky footer with total + submit */}
      <div className="border-t pt-3 mt-2 space-y-3 bg-background">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-2xl font-bold tabular-nums">${total.toFixed(2)}</span>
        </div>
        <Button className="w-full h-12 text-base" onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? 'Registrando...' : 'Registrar venta'}
        </Button>
      </div>
    </div>
  );
};

const PaymentDialog = ({ sale, onClose }: { sale: Sale; onClose: () => void }) => {
  const { addPayment } = useStore();
  const [amount, setAmount] = useState(sale.balance.toString());
  const [method, setMethod] = useState<PaymentMethod>('efectivo');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addPayment(sale.id, { amount: parseFloat(amount), method, date: new Date().toISOString() });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">Saldo pendiente: <span className="font-bold text-destructive">${sale.balance.toFixed(2)}</span></p>
      <div><Label>Monto del abono</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
      <div><Label>Método</Label>
        <Select value={method} onValueChange={(v: PaymentMethod) => setMethod(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="efectivo">💵 Efectivo</SelectItem>
            <SelectItem value="transferencia">🏦 Transferencia</SelectItem>
            <SelectItem value="pago_movil">📱 Pago Móvil</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>{submitting ? 'Registrando...' : 'Registrar abono'}</Button>
    </form>
  );
};

const SalesPage = () => {
  const { sales, cancelSale } = useStore();
  const [showNew, setShowNew] = useState(false);
  const [payingSale, setPayingSale] = useState<Sale | null>(null);
  const [viewSale, setViewSale] = useState<Sale | null>(null);

  const todayStr = getLocalDateString();
  const dueTodaySales = sales.filter(
    (s) => s.status !== 'anulado' && s.status !== 'pagado' && s.dueDate === todayStr
  );
  const overdueSales = sales.filter(
    (s) => s.status !== 'anulado' && s.status !== 'pagado' && s.dueDate && s.dueDate < todayStr
  );

  const sorted = [...sales].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-4 animate-fade-in">
      {dueTodaySales.length > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 animate-fade-in">
          <p className="text-sm font-bold text-warning flex items-center gap-1.5">
            <CalendarClock className="w-4 h-4" /> ⏰ {dueTodaySales.length} crédito{dueTodaySales.length > 1 ? 's' : ''} vence{dueTodaySales.length > 1 ? 'n' : ''} hoy
          </p>
          <div className="mt-1.5 space-y-1">
            {dueTodaySales.map((s) => (
              <p key={s.id} className="text-xs text-warning/80">
                • {s.customerName} — <span className="font-bold">${s.balance.toFixed(2)}</span> pendiente
              </p>
            ))}
          </div>
        </div>
      )}

      {overdueSales.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 animate-fade-in">
          <p className="text-sm font-bold text-destructive flex items-center gap-1.5">
            🚨 {overdueSales.length} crédito{overdueSales.length > 1 ? 's' : ''} vencido{overdueSales.length > 1 ? 's' : ''}
          </p>
          <div className="mt-1.5 space-y-1">
            {overdueSales.map((s) => (
              <p key={s.id} className="text-xs text-destructive/80">
                • {s.customerName} — <span className="font-bold">${s.balance.toFixed(2)}</span> (venció {new Date(s.dueDate! + 'T00:00:00').toLocaleDateString('es-VE')})
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Ventas</h1>
          <p className="text-muted-foreground text-sm">{sales.length} registradas</p>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}><Plus className="w-4 h-4 mr-1" />Nueva venta</Button>
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nueva venta</DialogTitle></DialogHeader>
          <NewSaleForm onClose={() => setShowNew(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!payingSale} onOpenChange={() => setPayingSale(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar abono</DialogTitle></DialogHeader>
          {payingSale && <PaymentDialog sale={payingSale} onClose={() => setPayingSale(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewSale} onOpenChange={() => setViewSale(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalle de venta</DialogTitle></DialogHeader>
          {viewSale && (
            <div className="space-y-3">
              <p className="text-sm"><span className="text-muted-foreground">Cliente:</span> {viewSale.customerName}</p>
              <p className="text-sm"><span className="text-muted-foreground">Vendedor:</span> {viewSale.sellerName || '—'}</p>
              <p className="text-sm"><span className="text-muted-foreground">Fecha:</span> {new Date(viewSale.createdAt).toLocaleString()}</p>
              <div className="border rounded-lg p-3 space-y-1">
                {viewSale.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{item.quantity}x {item.productName}</span>
                    <span>${item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t pt-1 flex justify-between font-bold text-sm">
                  <span>Total</span><span>${viewSale.total.toFixed(2)}</span>
                </div>
              </div>
              {viewSale.payments.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-1">Pagos:</p>
                  {viewSale.payments.map((p, i) => (
                    <div key={i} className="flex justify-between text-sm text-muted-foreground">
                      <span>{paymentLabels[p.method]} - {new Date(p.date).toLocaleDateString()}</span>
                      <span className="text-foreground">${p.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between font-bold">
                <span>Saldo pendiente</span>
                <span className={viewSale.balance > 0 ? 'text-destructive' : 'text-success'}>${viewSale.balance.toFixed(2)}</span>
              </div>
              {viewSale.dueDate && (
                <div className={`flex items-center gap-2 text-sm p-2 rounded-lg mt-1 ${
                  new Date(viewSale.dueDate) < new Date() && viewSale.balance > 0
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-warning/10 text-warning'
                }`}>
                  <CalendarClock className="w-4 h-4" />
                  <span>Fecha límite: <span className="font-bold">{new Date(viewSale.dueDate + 'T00:00:00').toLocaleDateString('es-VE')}</span></span>
                  {new Date(viewSale.dueDate) < new Date() && viewSale.balance > 0 && (
                    <span className="text-[10px] font-bold uppercase ml-auto">Vencido</span>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        {sorted.map((sale) => (
          <Card key={sale.id} className={sale.dueDate && sale.dueDate <= todayStr && sale.status !== 'anulado' && sale.status !== 'pagado' ? 'border-destructive/40' : ''}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p className="font-medium text-sm">{sale.customerName}</p>
                  <p className="text-xs text-muted-foreground">{new Date(sale.createdAt).toLocaleDateString()} · {sale.items.length} items{sale.sellerName ? ` · 🧑‍💼 ${sale.sellerName}` : ''}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">${sale.total.toFixed(2)}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${statusColors[sale.status]}`}>{sale.status}</span>
                </div>
              </div>
              {sale.dueDate && sale.balance > 0 && sale.status !== 'anulado' && (
                <div className={`flex items-center gap-1.5 text-[10px] mt-1 px-2 py-1 rounded-md ${
                  sale.dueDate === todayStr ? 'bg-warning/10 text-warning font-bold' :
                  sale.dueDate < todayStr ? 'bg-destructive/10 text-destructive font-bold' :
                  'text-muted-foreground'
                }`}>
                  <CalendarClock className="w-3 h-3" />
                  {sale.dueDate === todayStr ? '⏰ Vence HOY' :
                   sale.dueDate < todayStr ? `🚨 Vencido (${new Date(sale.dueDate + 'T00:00:00').toLocaleDateString('es-VE')})` :
                   `Vence: ${new Date(sale.dueDate + 'T00:00:00').toLocaleDateString('es-VE')}`}
                </div>
              )}
              <div className="flex gap-1 mt-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setViewSale(sale)}><Eye className="w-3 h-3 mr-1" />Ver</Button>
                {(sale.status === 'deuda' || sale.status === 'abonado') && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-success" onClick={() => setPayingSale(sale)}><DollarSign className="w-3 h-3 mr-1" />Abonar</Button>
                )}
                {sale.status !== 'anulado' && sale.status !== 'pagado' && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => cancelSale(sale.id)}>Anular</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SalesPage;
