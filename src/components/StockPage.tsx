import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, Plus, Minus, AlertTriangle, Search } from 'lucide-react';
import { toast } from 'sonner';

const StockPage = () => {
  const { products, updateProduct } = useStore();
  const [search, setSearch] = useState('');
  const [adjustProduct, setAdjustProduct] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState<'add' | 'remove'>('add');

  const activeProducts = products.filter((p) => p.active);
  const filtered = activeProducts.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const lowStock = activeProducts.filter((p) => (p.stock ?? 0) <= 5);

  const handleAdjust = async () => {
    const amount = parseInt(adjustAmount);
    if (!adjustProduct || isNaN(amount) || amount <= 0) return;

    const product = products.find((p) => p.id === adjustProduct);
    if (!product) return;

    const currentStock = product.stock ?? 0;
    const newStock = adjustType === 'add' ? currentStock + amount : Math.max(0, currentStock - amount);

    try {
      await updateProduct(adjustProduct, { stock: newStock });
      toast.success(`Stock actualizado: ${product.name} → ${newStock} uds`);
      setAdjustProduct(null);
      setAdjustAmount('');
    } catch {
      toast.error('Error al actualizar stock');
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">📦 Inventario</h1>
        <p className="text-muted-foreground text-sm">Control de stock de productos</p>
      </div>

      {/* Low stock alert */}
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Product list */}
      <div className="space-y-2">
        {filtered.map((product) => {
          const stock = product.stock ?? 0;
          const isLow = stock <= 5;
          return (
            <Card key={product.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isLow ? 'bg-warning/15 text-warning' : 'bg-primary/15 text-primary'}`}>
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{product.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">{product.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right mr-2">
                    <p className={`text-lg font-bold font-display ${isLow ? 'text-warning' : ''}`}>{stock}</p>
                    <p className="text-[10px] text-muted-foreground">uds</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => { setAdjustProduct(product.id); setAdjustType('add'); setAdjustAmount(''); }}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => { setAdjustProduct(product.id); setAdjustType('remove'); setAdjustAmount(''); }}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">No hay productos</p>
        )}
      </div>

      {/* Adjust Dialog */}
      <Dialog open={!!adjustProduct} onOpenChange={() => setAdjustProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              {adjustType === 'add' ? '➕ Agregar stock' : '➖ Reducir stock'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {products.find((p) => p.id === adjustProduct)?.name} — Stock actual:{' '}
              <span className="font-bold">{products.find((p) => p.id === adjustProduct)?.stock ?? 0}</span>
            </p>
            <Input
              type="number"
              min="1"
              placeholder="Cantidad"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              autoFocus
            />
            <Button className="w-full" onClick={handleAdjust} disabled={!adjustAmount || parseInt(adjustAmount) <= 0}>
              {adjustType === 'add' ? 'Agregar' : 'Reducir'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockPage;
