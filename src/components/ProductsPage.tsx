import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Product } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const categoryLabels = { pan: '🍞 Pan', dona: '🍩 Dona', otro: '📦 Otro' };

type Currency = 'USD' | 'BS';

const ProductForm = ({ product, onSave, onClose, bcvRate }: { product?: Product; onSave: (data: any) => void; onClose: () => void; bcvRate: number | null }) => {
  const [name, setName] = useState(product?.name || '');
  const [category, setCategory] = useState(product?.category || 'pan');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [cost, setCost] = useState(product?.cost?.toString() || '');
  const [price, setPrice] = useState(product?.price?.toString() || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let finalCost = parseFloat(cost);
      let finalPrice = parseFloat(price);

      // If entered in Bs, convert to USD using BCV rate
      if (currency === 'BS' && bcvRate) {
        finalCost = finalCost / bcvRate;
        finalPrice = finalPrice / bcvRate;
      }

      await onSave({ name, category, cost: finalCost, price: finalPrice });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const costNum = parseFloat(cost) || 0;
  const priceNum = parseFloat(price) || 0;
  const margin = cost && price && priceNum > 0 ? ((priceNum - costNum) / priceNum * 100).toFixed(0) : null;

  // Show conversion preview
  const showConversion = currency === 'BS' && bcvRate && (costNum > 0 || priceNum > 0);
  const convertedCost = bcvRate ? costNum / bcvRate : 0;
  const convertedPrice = bcvRate ? priceNum / bcvRate : 0;

  const currencySymbol = currency === 'USD' ? '$' : 'Bs.';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej: Pan Francés" /></div>
      <div><Label>Categoría</Label>
        <Select value={category} onValueChange={(v: any) => setCategory(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pan">🥖 Pan</SelectItem>
            <SelectItem value="dona">🍩 Dona</SelectItem>
            <SelectItem value="otro">📦 Otro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Currency Toggle */}
      <div>
        <Label>Moneda</Label>
        <div className="flex gap-1 mt-1">
          <Button
            type="button"
            size="sm"
            variant={currency === 'USD' ? 'default' : 'outline'}
            className="flex-1 text-xs"
            onClick={() => setCurrency('USD')}
          >
            💵 Dólares (USD)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={currency === 'BS' ? 'default' : 'outline'}
            className="flex-1 text-xs"
            onClick={() => {
              if (!bcvRate) return;
              setCurrency('BS');
            }}
            disabled={!bcvRate}
          >
            🇻🇪 Bolívares (Bs)
          </Button>
        </div>
        {!bcvRate && (
          <p className="text-[10px] text-destructive mt-1">Tasa BCV no disponible. Actualiza la tasa para usar bolívares.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div><Label>Costo ({currencySymbol})</Label><Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} required /></div>
        <div><Label>Precio ({currencySymbol})</Label><Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required /></div>
      </div>

      {/* Conversion preview when using Bs */}
      {showConversion && (
        <div className="rounded-lg p-2.5 text-xs space-y-1"
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(139,92,246,0.06) 100%)',
            border: '1px solid rgba(59,130,246,0.12)',
          }}>
          <p className="text-muted-foreground font-medium text-[10px] uppercase tracking-wider">Equivalente en USD (Tasa: {bcvRate?.toFixed(2)})</p>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Costo:</span>
            <span className="font-semibold">${convertedCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Precio:</span>
            <span className="font-semibold">${convertedPrice.toFixed(2)}</span>
          </div>
        </div>
      )}

      {margin && <p className="text-sm text-muted-foreground">Margen: <span className="font-bold text-success">{margin}%</span></p>}
      <Button type="submit" className="w-full" disabled={submitting || (currency === 'BS' && !bcvRate)}>{submitting ? 'Guardando...' : (product ? 'Guardar cambios' : 'Agregar producto')}</Button>
    </form>
  );
};

const ProductsPage = () => {
  const { products, addProduct, updateProduct, deleteProduct, bcvRate } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | undefined>();

  const rate = bcvRate?.rate || null;

  const handleSave = async (data: any) => {
    if (editing) await updateProduct(editing.id, data);
    else await addProduct(data);
    setEditing(undefined);
  };

  const handleEdit = (p: Product) => { setEditing(p); setOpen(true); };
  const handleNew = () => { setEditing(undefined); setOpen(true); };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Productos</h1>
          <p className="text-muted-foreground text-sm">{products.filter(p => p.active).length} productos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={handleNew}><Plus className="w-4 h-4 mr-1" />Nuevo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Nuevo'} producto</DialogTitle></DialogHeader>
            <ProductForm product={editing} onSave={handleSave} onClose={() => setOpen(false)} bcvRate={rate} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {products.filter(p => p.active).map((p) => (
          <Card key={p.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{p.category === 'pan' ? '🍞' : p.category === 'dona' ? '🍩' : '📦'}</span>
                <div>
                  <p className="font-medium text-sm">{p.name}</p>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>Costo: ${p.cost.toFixed(2)}</span>
                    <span>•</span>
                    <span className="font-semibold text-foreground">Precio: ${p.price.toFixed(2)}</span>
                  </div>
                  {rate && (
                    <div className="flex gap-2 text-[10px] text-muted-foreground/70">
                      <span>Bs. {(p.cost * rate).toFixed(2)}</span>
                      <span>•</span>
                      <span>Bs. {(p.price * rate).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteProduct(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ProductsPage;
