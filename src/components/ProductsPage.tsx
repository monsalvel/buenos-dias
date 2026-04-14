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

const ProductForm = ({ product, onSave, onClose }: { product?: Product; onSave: (data: any) => void; onClose: () => void }) => {
  const [name, setName] = useState(product?.name || '');
  const [category, setCategory] = useState(product?.category || 'pan');
  const [cost, setCost] = useState(product?.cost?.toString() || '');
  const [price, setPrice] = useState(product?.price?.toString() || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSave({ name, category, cost: parseFloat(cost), price: parseFloat(price) });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const margin = cost && price ? ((parseFloat(price) - parseFloat(cost)) / parseFloat(price) * 100).toFixed(0) : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej: Pan Francés" /></div>
      <div><Label>Categoría</Label>
        <Select value={category} onValueChange={(v: any) => setCategory(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pan">🍞 Pan</SelectItem>
            <SelectItem value="dona">🍩 Dona</SelectItem>
            <SelectItem value="otro">📦 Otro</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Costo ($)</Label><Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} required /></div>
        <div><Label>Precio ($)</Label><Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required /></div>
      </div>
      {margin && <p className="text-sm text-muted-foreground">Margen: <span className="font-bold text-success">{margin}%</span></p>}
      <Button type="submit" className="w-full" disabled={submitting}>{submitting ? 'Guardando...' : (product ? 'Guardar cambios' : 'Agregar producto')}</Button>
    </form>
  );
};

const ProductsPage = () => {
  const { products, addProduct, updateProduct, deleteProduct } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | undefined>();

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
          <p className="text-muted-foreground text-sm">{products.length} productos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={handleNew}><Plus className="w-4 h-4 mr-1" />Nuevo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Nuevo'} producto</DialogTitle></DialogHeader>
            <ProductForm product={editing} onSave={handleSave} onClose={() => setOpen(false)} />
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
