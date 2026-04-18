import { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Package, Plus, Minus, AlertTriangle, Search, ChevronDown, History } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const StockPage = () => {
  const { products, batches, sales, addBatch, adjustBatchRemaining } = useStore();
  const [search, setSearch] = useState('');

  // Add batch dialog
  const [batchProduct, setBatchProduct] = useState<string | null>(null);
  const [batchQty, setBatchQty] = useState('');
  const [batchCost, setBatchCost] = useState('');
  const [batchNote, setBatchNote] = useState('');

  // Adjust (shrinkage) dialog
  const [adjustProduct, setAdjustProduct] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');

  // Track which products are expanded
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const activeProducts = products.filter((p) => p.active);
  const filtered = activeProducts.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );
  const lowStock = activeProducts.filter((p) => (p.stock ?? 0) <= 5);

  // Compute units sold per batch using FIFO assumption (sale_items unit_cost matches batch unit_cost)
  // We approximate by summing items where unit_cost equals the batch cost for that product.
  const batchSalesIndex = useMemo(() => {
    // For each batch: units sold = received - remaining; revenue/profit = sum of items with same product+cost
    const map = new Map<string, { unitsSold: number; revenue: number; profit: number }>();
    for (const b of batches) {
      const sold = b.quantityReceived - b.quantityRemaining;
      let revenue = 0;
      let profit = 0;
      for (const s of sales) {
        if (s.status === 'anulado') continue;
        for (const it of s.items) {
          if (it.productId === b.productId && Math.abs(it.unitCost - b.unitCost) < 0.001) {
            revenue += it.unitPrice * it.quantity;
            profit += (it.unitPrice - it.unitCost) * it.quantity;
          }
        }
      }
      map.set(b.id, { unitsSold: sold, revenue, profit });
    }
    return map;
  }, [batches, sales]);

  const handleAddBatch = async () => {
    const qty = parseInt(batchQty);
    const cost = parseFloat(batchCost);
    if (!batchProduct || isNaN(qty) || qty <= 0 || isNaN(cost) || cost < 0) return;
    try {
      await addBatch(batchProduct, qty, cost, batchNote.trim() || undefined);
      const product = products.find((p) => p.id === batchProduct);
      toast.success(`Lote agregado: ${qty} uds a $${cost.toFixed(2)} c/u — ${product?.name}`);
      setBatchProduct(null);
      setBatchQty('');
      setBatchCost('');
      setBatchNote('');
    } catch {
      toast.error('Error al agregar lote');
    }
  };

  const handleShrinkage = async () => {
    const amount = parseInt(adjustAmount);
    if (!adjustProduct || isNaN(amount) || amount <= 0) return;
    // Consume FIFO from batches manually (oldest first)
    const productBatches = batches
      .filter((b) => b.productId === adjustProduct && b.quantityRemaining > 0)
      .sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());

    let remaining = amount;
    try {
      for (const b of productBatches) {
        if (remaining <= 0) break;
        const take = Math.min(b.quantityRemaining, remaining);
        await adjustBatchRemaining(b.id, b.quantityRemaining - take);
        remaining -= take;
      }
      toast.success(`Stock ajustado: -${amount - remaining} uds`);
      setAdjustProduct(null);
      setAdjustAmount('');
    } catch {
      toast.error('Error al ajustar stock');
    }
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">📦 Inventario</h1>
        <p className="text-muted-foreground text-sm">Lotes con costos separados (FIFO)</p>
      </div>

      {lowStock.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-warning">Stock bajo ({lowStock.length})</p>
              <p className="text-[10px] text-muted-foreground">
                {lowStock.map((p) => p.name).join(', ')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((product) => {
          const stock = product.stock ?? 0;
          const isLow = stock <= 5;
          const productBatches = batches
            .filter((b) => b.productId === product.id)
            .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
          const isOpen = expanded.has(product.id);

          return (
            <Card key={product.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                      isLow ? 'bg-warning/15 text-warning' : 'bg-primary/15 text-primary'
                    )}>
                      <Package className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">{product.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right mr-1">
                      <p className={cn('text-lg font-bold font-display leading-none', isLow && 'text-warning')}>{stock}</p>
                      <p className="text-[10px] text-muted-foreground">uds</p>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => {
                        setBatchProduct(product.id);
                        setBatchCost(product.cost.toString());
                        setBatchQty('');
                        setBatchNote('');
                      }}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      <span className="text-xs">Lote</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => { setAdjustProduct(product.id); setAdjustAmount(''); }}
                      title="Ajuste / merma"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Batch history collapsible */}
                {productBatches.length > 0 && (
                  <Collapsible open={isOpen} onOpenChange={() => toggleExpanded(product.id)}>
                    <CollapsibleTrigger className="w-full flex items-center justify-between text-[11px] text-muted-foreground hover:text-foreground py-1 px-1 rounded transition-colors">
                      <span className="flex items-center gap-1">
                        <History className="w-3 h-3" />
                        {productBatches.length} {productBatches.length === 1 ? 'lote' : 'lotes'}
                      </span>
                      <ChevronDown className={cn('w-3 h-3 transition-transform', isOpen && 'rotate-180')} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1.5 pt-2">
                      {productBatches.map((b) => {
                        const stats = batchSalesIndex.get(b.id) || { unitsSold: 0, revenue: 0, profit: 0 };
                        const date = new Date(b.receivedAt).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
                        return (
                          <div key={b.id} className="rounded-lg bg-muted/40 p-2 text-[11px] space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold">{date}</span>
                              <span className="text-muted-foreground">
                                Costo: <span className="font-bold text-foreground">${b.unitCost.toFixed(2)}</span>
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-1 text-center">
                              <div>
                                <p className="text-muted-foreground">Recibidos</p>
                                <p className="font-bold">{b.quantityReceived}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Vendidos</p>
                                <p className="font-bold">{stats.unitsSold}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Restan</p>
                                <p className={cn('font-bold', b.quantityRemaining === 0 && 'text-muted-foreground')}>
                                  {b.quantityRemaining}
                                </p>
                              </div>
                            </div>
                            {stats.unitsSold > 0 && (
                              <div className="flex justify-between pt-1 border-t border-border/50">
                                <span className="text-muted-foreground">Ganancia generada:</span>
                                <span className={cn('font-bold', stats.profit >= 0 ? 'text-success' : 'text-destructive')}>
                                  ${stats.profit.toFixed(2)}
                                </span>
                              </div>
                            )}
                            {b.note && <p className="text-muted-foreground italic">{b.note}</p>}
                          </div>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">No hay productos</p>
        )}
      </div>

      {/* Add Batch Dialog */}
      <Dialog open={!!batchProduct} onOpenChange={() => setBatchProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">➕ Nuevo lote de stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {products.find((p) => p.id === batchProduct)?.name}
            </p>
            <div>
              <Label className="text-xs">Cantidad recibida</Label>
              <Input
                type="number"
                min="1"
                placeholder="Ej: 50"
                value={batchQty}
                onChange={(e) => setBatchQty(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs">Costo unitario de este lote ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Ej: 0.50"
                value={batchCost}
                onChange={(e) => setBatchCost(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Las ventas de este lote calcularán ganancia con este costo (FIFO).
              </p>
            </div>
            <div>
              <Label className="text-xs">Nota (opcional)</Label>
              <Input
                placeholder="Ej: proveedor X, factura 1234"
                value={batchNote}
                onChange={(e) => setBatchNote(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleAddBatch}
              disabled={!batchQty || !batchCost || parseInt(batchQty) <= 0}
            >
              Agregar lote
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Shrinkage Dialog */}
      <Dialog open={!!adjustProduct} onOpenChange={() => setAdjustProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">➖ Ajuste de stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {products.find((p) => p.id === adjustProduct)?.name} — Stock actual:{' '}
              <span className="font-bold">{products.find((p) => p.id === adjustProduct)?.stock ?? 0}</span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              Usa esto para mermas, daños o correcciones manuales. Se descuenta de los lotes más antiguos primero.
            </p>
            <Input
              type="number"
              min="1"
              placeholder="Cantidad a reducir"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              autoFocus
            />
            <Button
              className="w-full"
              variant="outline"
              onClick={handleShrinkage}
              disabled={!adjustAmount || parseInt(adjustAmount) <= 0}
            >
              Reducir stock
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockPage;
