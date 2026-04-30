import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useStore } from '@/store/useStore';
import { BatchPayment } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Truck, DollarSign, ChevronDown, Plus, Search, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type FilterStatus = 'all' | 'pending' | 'paid';

const methodLabels: Record<string, string> = {
  efectivo: '💵 Efectivo',
  transferencia: '🏦 Transferencia',
  pago_movil: '📱 Pago Móvil',
  otro: '📝 Otro',
};

const SupplierPaymentsPage = () => {
  const { products, batches, batchPayments, addBatchPayment, deleteBatchPayment } = useStore();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [payingBatchId, setPayingBatchId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('efectivo');
  const [payNote, setPayNote] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  // Index payments by batch
  const paidByBatch = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of batchPayments) {
      map.set(p.batchId, (map.get(p.batchId) || 0) + p.amount);
    }
    return map;
  }, [batchPayments]);

  const enriched = useMemo(() => {
    return batches.map((b) => {
      const product = products.find((p) => p.id === b.productId);
      const totalDue = b.unitCost * b.quantityReceived;
      const paid = paidByBatch.get(b.id) || 0;
      const balance = Math.max(0, totalDue - paid);
      return {
        batch: b,
        productName: product?.name || 'Producto eliminado',
        totalDue,
        paid,
        balance,
        isPaid: balance <= 0.001 && totalDue > 0,
      };
    });
  }, [batches, products, paidByBatch]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched
      .filter((e) => {
        if (filter === 'pending' && e.isPaid) return false;
        if (filter === 'paid' && !e.isPaid) return false;
        if (q && !e.productName.toLowerCase().includes(q) && !(e.batch.note || '').toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.batch.receivedAt).getTime() - new Date(a.batch.receivedAt).getTime());
  }, [enriched, filter, search]);

  const totals = useMemo(() => {
    const totalDue = enriched.reduce((s, e) => s + e.totalDue, 0);
    const totalPaid = enriched.reduce((s, e) => s + e.paid, 0);
    const totalBalance = enriched.reduce((s, e) => s + e.balance, 0);
    const pendingCount = enriched.filter((e) => !e.isPaid && e.totalDue > 0).length;
    return { totalDue, totalPaid, totalBalance, pendingCount };
  }, [enriched]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openPayDialog = (batchId: string, suggested: number) => {
    setPayingBatchId(batchId);
    setPayAmount(suggested > 0 ? suggested.toFixed(2) : '');
    setPayMethod('efectivo');
    setPayNote('');
    setPayDate(new Date().toISOString().slice(0, 10));
  };

  const handleSubmitPayment = async () => {
    if (!payingBatchId) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }
    setSubmitting(true);
    try {
      await addBatchPayment(payingBatchId, {
        amount,
        method: payMethod,
        paidAt: new Date(payDate + 'T12:00:00').toISOString(),
        note: payNote.trim() || undefined,
      });
      toast.success('Pago registrado');
      setPayingBatchId(null);
    } catch (e: any) {
      toast.error('Error al registrar pago', { description: e?.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!confirm('¿Eliminar este pago?')) return;
    try {
      await deleteBatchPayment(id);
      toast.success('Pago eliminado');
    } catch (e: any) {
      toast.error('Error al eliminar', { description: e?.message });
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Truck className="w-6 h-6 text-primary" /> Pagos a Proveedor
        </h1>
        <p className="text-muted-foreground text-sm">Cuánto debes y cuánto has pagado por cada lote</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Total deuda</p>
            <p className="text-lg font-bold font-display tabular-nums">${totals.totalDue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-3">
            <p className="text-[10px] text-success uppercase">Pagado</p>
            <p className="text-lg font-bold font-display tabular-nums text-success">${totals.totalPaid.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className={cn(totals.totalBalance > 0 ? 'border-destructive/30 bg-destructive/5' : 'border-success/30 bg-success/5')}>
          <CardContent className="p-3">
            <p className={cn('text-[10px] uppercase', totals.totalBalance > 0 ? 'text-destructive' : 'text-success')}>
              Saldo {totals.pendingCount > 0 ? `(${totals.pendingCount})` : ''}
            </p>
            <p className={cn('text-lg font-bold font-display tabular-nums', totals.totalBalance > 0 ? 'text-destructive' : 'text-success')}>
              ${totals.totalBalance.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar producto o nota..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={(v: FilterStatus) => setFilter(v)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="paid">Pagados</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Batch list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">No hay lotes en esta vista</p>
        )}
        {filtered.map(({ batch: b, productName, totalDue, paid, balance, isPaid }) => {
          const date = new Date(b.receivedAt).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
          const isOpen = expanded.has(b.id);
          const payments = batchPayments
            .filter((p) => p.batchId === b.id)
            .sort((a, b2) => new Date(b2.paidAt).getTime() - new Date(a.paidAt).getTime());
          const progress = totalDue > 0 ? Math.min(100, (paid / totalDue) * 100) : 0;

          return (
            <Card key={b.id} className={cn(isPaid && 'border-success/30 bg-success/5')}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-sm truncate">{productName}</p>
                      {isPaid ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {date} · {b.quantityReceived} uds × ${b.unitCost.toFixed(2)}
                    </p>
                    {b.note && <p className="text-[10px] text-muted-foreground italic truncate">{b.note}</p>}
                  </div>
                  {!isPaid && (
                    <Button size="sm" className="h-8 shrink-0" onClick={() => openPayDialog(b.id, balance)}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Pago
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-1 text-center text-[11px]">
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-bold tabular-nums">${totalDue.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-success">Pagado</p>
                    <p className="font-bold tabular-nums text-success">${paid.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className={cn(balance > 0 ? 'text-destructive' : 'text-muted-foreground')}>Saldo</p>
                    <p className={cn('font-bold tabular-nums', balance > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                      ${balance.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full transition-all', isPaid ? 'bg-success' : 'bg-primary')}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {payments.length > 0 && (
                  <Collapsible open={isOpen} onOpenChange={() => toggleExpanded(b.id)}>
                    <CollapsibleTrigger className="w-full flex items-center justify-between text-[11px] text-muted-foreground hover:text-foreground py-1 rounded transition-colors">
                      <span>{payments.length} {payments.length === 1 ? 'pago' : 'pagos'} registrado{payments.length === 1 ? '' : 's'}</span>
                      <ChevronDown className={cn('w-3 h-3 transition-transform', isOpen && 'rotate-180')} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1.5 pt-2">
                      {payments.map((p) => (
                        <div key={p.id} className="rounded-lg bg-muted/40 p-2 text-[11px] flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold tabular-nums">${p.amount.toFixed(2)} <span className="font-normal text-muted-foreground">· {methodLabels[p.method] || p.method}</span></p>
                            <p className="text-muted-foreground">
                              {new Date(p.paidAt).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}
                              {p.note && ` · ${p.note}`}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-destructive hover:text-destructive"
                            onClick={() => handleDeletePayment(p.id)}
                          >
                            Eliminar
                          </Button>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pay dialog */}
      <Dialog open={!!payingBatchId} onOpenChange={(o) => !o && setPayingBatchId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" /> Registrar pago
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Monto ($)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs">Método</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(methodLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Nota (opcional)</Label>
              <Input placeholder="Referencia, recibo..." value={payNote} onChange={(e) => setPayNote(e.target.value)} />
            </div>
            <Button className="w-full" onClick={handleSubmitPayment} disabled={submitting || !payAmount}>
              {submitting ? 'Registrando...' : 'Registrar pago'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupplierPaymentsPage;
