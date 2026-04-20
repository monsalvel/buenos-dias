import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useStore } from '@/store/useStore';
import { PriceList, PriceListPrice, Product } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ListOrdered, Pencil, History, Lock, DollarSign, Tag } from 'lucide-react';

type Currency = 'USD' | 'BS';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' });

const EditPriceDialog = ({
  list,
  product,
  currentPrice,
  bcvRate,
  onClose,
}: {
  list: PriceList;
  product: Product;
  currentPrice: number | null;
  bcvRate: number | null;
  onClose: () => void;
}) => {
  const setProductPrice = useStore((s) => s.setProductPrice);
  const updateProduct = useStore((s) => s.updateProduct);
  const [currency, setCurrency] = useState<Currency>('USD');
  const [value, setValue] = useState(currentPrice != null ? String(currentPrice) : '');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const numericValue = parseFloat(value) || 0;
  const finalPrice = currency === 'BS' && bcvRate ? numericValue / bcvRate : numericValue;

  const handleSave = async () => {
    if (!Number.isFinite(finalPrice) || finalPrice < 0) {
      toast.error('Precio inválido');
      return;
    }
    setSubmitting(true);
    try {
      await setProductPrice(list.id, product.id, Number(finalPrice.toFixed(4)), note.trim() || undefined);
      // Keep product.cost / product.price in sync with the system list
      if (list.code === 'LISTA_PRECIO_VENTA_USD') {
        await updateProduct(product.id, { price: Number(finalPrice.toFixed(4)) });
      } else if (list.code === 'LISTA_PRECIO_COSTO_USD') {
        await updateProduct(product.id, { cost: Number(finalPrice.toFixed(4)) });
      }
      toast.success('Nueva versión de precio creada');
      onClose();
    } catch (e: any) {
      toast.error('No se pudo actualizar el precio', { description: e?.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted/40 p-3 space-y-1">
        <p className="text-sm font-semibold">{product.name}</p>
        <p className="text-xs text-muted-foreground">
          {list.name} · {list.kind === 'sale' ? 'Precio de venta' : 'Precio de costo'}
        </p>
        {currentPrice != null && (
          <p className="text-xs text-muted-foreground">
            Precio vigente: <span className="font-semibold text-foreground">${currentPrice.toFixed(2)}</span>
          </p>
        )}
      </div>

      <div>
        <Label>Moneda de captura</Label>
        <div className="flex gap-1 mt-1">
          <Button
            type="button"
            size="sm"
            variant={currency === 'USD' ? 'default' : 'outline'}
            className="flex-1 text-xs"
            onClick={() => setCurrency('USD')}
          >
            💵 USD
          </Button>
          <Button
            type="button"
            size="sm"
            variant={currency === 'BS' ? 'default' : 'outline'}
            className="flex-1 text-xs"
            onClick={() => bcvRate && setCurrency('BS')}
            disabled={!bcvRate}
          >
            🇻🇪 Bs
          </Button>
        </div>
      </div>

      <div>
        <Label>Nuevo precio ({currency === 'USD' ? '$' : 'Bs.'})</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        {currency === 'BS' && bcvRate && numericValue > 0 && (
          <p className="text-[11px] text-muted-foreground mt-1">
            Equivale a <span className="font-semibold text-foreground">${finalPrice.toFixed(2)}</span> (Tasa BCV {bcvRate.toFixed(2)})
          </p>
        )}
      </div>

      <div>
        <Label>Nota (opcional)</Label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Motivo del cambio (ej. ajuste por inflación)"
          rows={2}
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
        <Button onClick={handleSave} disabled={submitting || !value}>
          {submitting ? 'Guardando…' : 'Crear nueva versión'}
        </Button>
      </DialogFooter>
    </div>
  );
};

const HistoryDialog = ({
  list,
  product,
  onClose,
}: {
  list: PriceList;
  product: Product;
  onClose: () => void;
}) => {
  const fetchPriceHistory = useStore((s) => s.fetchPriceHistory);
  const [history, setHistory] = useState<PriceListPrice[] | null>(null);

  useEffect(() => {
    fetchPriceHistory(list.id, product.id)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [list.id, product.id, fetchPriceHistory]);

  return (
    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
      <div className="rounded-lg bg-muted/40 p-3">
        <p className="text-sm font-semibold">{product.name}</p>
        <p className="text-xs text-muted-foreground">{list.name}</p>
      </div>

      {history === null ? (
        <p className="text-sm text-muted-foreground text-center py-6">Cargando historial…</p>
      ) : history.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Sin versiones registradas</p>
      ) : (
        <div className="relative pl-4 space-y-3 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-px before:bg-border">
          {history.map((h, i) => {
            const isActive = h.validTo === null;
            const versionNumber = history.length - i;
            return (
              <div key={h.id} className="relative">
                <span
                  className={`absolute -left-[14px] top-1.5 w-3 h-3 rounded-full border-2 border-background ${
                    isActive ? 'bg-success' : 'bg-muted-foreground/40'
                  }`}
                />
                <Card className={isActive ? 'border-success/40' : ''}>
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={isActive ? 'default' : 'secondary'} className="text-[10px]">
                          v{versionNumber}
                        </Badge>
                        {isActive && (
                          <Badge variant="outline" className="text-[10px] border-success/40 text-success">
                            Vigente
                          </Badge>
                        )}
                      </div>
                      <span className="font-bold">${h.unitPrice.toFixed(2)}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Desde: {formatDate(h.validFrom)}
                      {h.validTo && <> · Hasta: {formatDate(h.validTo)}</>}
                    </p>
                    {h.note && <p className="text-xs italic text-muted-foreground">"{h.note}"</p>}
                    {h.createdByEmail && (
                      <p className="text-[10px] text-muted-foreground">por {h.createdByEmail}</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cerrar</Button>
      </DialogFooter>
    </div>
  );
};

const PriceListView = ({ list }: { list: PriceList }) => {
  const products = useStore((s) => s.products);
  const getActivePrice = useStore((s) => s.getActivePrice);
  const bcvRate = useStore((s) => s.bcvRate?.rate ?? null);

  const [editing, setEditing] = useState<Product | null>(null);
  const [historyFor, setHistoryFor] = useState<Product | null>(null);
  const [search, setSearch] = useState('');

  const activeProducts = useMemo(
    () => products.filter((p) => p.active).sort((a, b) => a.name.localeCompare(b.name)),
    [products]
  );

  const filtered = activeProducts.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <Input
        placeholder="Buscar producto…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="space-y-2">
        {filtered.map((p) => {
          const price = getActivePrice(list.id, p.id);
          return (
            <Card key={p.id}>
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {price != null ? (
                      <span className="font-semibold text-foreground">${price.toFixed(2)}</span>
                    ) : (
                      <span className="text-destructive">Sin precio</span>
                    )}
                    {price != null && bcvRate && (
                      <span className="text-muted-foreground/70">· Bs. {(price * bcvRate).toFixed(2)}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setHistoryFor(p)}
                    title="Ver historial"
                  >
                    <History className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setEditing(p)}
                    title="Editar precio"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">Sin productos</p>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar precio</DialogTitle>
            <DialogDescription>Se cerrará la versión actual y se creará una nueva.</DialogDescription>
          </DialogHeader>
          {editing && (
            <EditPriceDialog
              list={list}
              product={editing}
              currentPrice={getActivePrice(list.id, editing.id)}
              bcvRate={bcvRate}
              onClose={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyFor} onOpenChange={(o) => !o && setHistoryFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Historial de precios</DialogTitle>
            <DialogDescription>Versiones cronológicas para este producto.</DialogDescription>
          </DialogHeader>
          {historyFor && (
            <HistoryDialog list={list} product={historyFor} onClose={() => setHistoryFor(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const PriceListsPage = () => {
  const priceLists = useStore((s) => s.priceLists);
  const fetchPriceLists = useStore((s) => s.fetchPriceLists);
  const fetchActivePrices = useStore((s) => s.fetchActivePrices);

  useEffect(() => {
    if (priceLists.length === 0) fetchPriceLists();
    fetchActivePrices();
  }, [priceLists.length, fetchPriceLists, fetchActivePrices]);

  const sorted = useMemo(
    () => [...priceLists].sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'sale' ? -1 : 1)),
    [priceLists]
  );

  if (sorted.length === 0) {
    return (
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-2xl font-display font-bold">Listas de Precios</h1>
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </div>
    );
  }

  const defaultTab = sorted[0].id;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <ListOrdered className="w-6 h-6 text-primary" /> Listas de Precios
          </h1>
          <p className="text-muted-foreground text-sm">Versiones e historial por producto</p>
        </div>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="w-full grid" style={{ gridTemplateColumns: `repeat(${sorted.length}, minmax(0, 1fr))` }}>
          {sorted.map((l) => (
            <TabsTrigger key={l.id} value={l.id} className="text-xs gap-1">
              {l.kind === 'sale' ? <DollarSign className="w-3 h-3" /> : <Tag className="w-3 h-3" />}
              <span className="truncate">{l.kind === 'sale' ? 'Venta' : 'Costo'}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {sorted.map((l) => (
          <TabsContent key={l.id} value={l.id} className="space-y-3 mt-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <span className="truncate">{l.name}</span>
                  {l.isSystem && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Lock className="w-3 h-3" /> Sistema
                    </Badge>
                  )}
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  Código: <code className="bg-muted px-1 rounded">{l.code}</code> · Moneda: {l.currency}
                </p>
              </CardHeader>
              <CardContent>
                <PriceListView list={l} />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default PriceListsPage;
