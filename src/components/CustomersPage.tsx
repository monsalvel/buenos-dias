import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Customer } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Phone, MapPin, Star, MessageCircle } from 'lucide-react';

const CustomerForm = ({ customer, onSave, onClose }: { customer?: Customer; onSave: (data: any) => void; onClose: () => void }) => {
  const [firstName, setFirstName] = useState(customer?.firstName || '');
  const [lastName, setLastName] = useState(customer?.lastName || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [address, setAddress] = useState(customer?.address || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSave({ firstName, lastName, phone, address });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Nombre</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></div>
        <div><Label>Apellido (opcional)</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
      </div>
      <div><Label>Teléfono</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+584121234567" /></div>
      <div><Label>Dirección (opcional)</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle, casa, referencia" /></div>
      <Button type="submit" className="w-full" disabled={submitting}>{submitting ? 'Guardando...' : (customer ? 'Guardar' : 'Agregar cliente')}</Button>
    </form>
  );
};

const CustomersPage = () => {
  const { customers, addCustomer, updateCustomer, sales, storeSettings } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | undefined>();
  const [search, setSearch] = useState('');

  const filtered = customers.filter((c) =>
    `${c.firstName} ${c.lastName || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const getCustomerDebt = (customerId: string) => {
    return sales
      .filter((s) => s.customerId === customerId && s.status !== 'anulado')
      .reduce((sum, s) => sum + s.balance, 0);
  };

  const getCustomerPendingSales = (customerId: string) => {
    return sales.filter(
      (s) => s.customerId === customerId && s.balance > 0 && s.status !== 'anulado'
    );
  };

  const sendWhatsApp = (phone: string, name: string, customerId: string) => {
    const pendingSales = getCustomerPendingSales(customerId);
    const totalDebt = pendingSales.reduce((sum, s) => sum + s.balance, 0);

    let msg = `¡Hola ${name}! 👋🍞\n\n`;
    msg += `Te escribimos desde *${storeSettings?.storeName || 'la panadería'}* para recordarte que tienes un saldo pendiente.\n\n`;
    msg += `📋 *Detalle de pedidos pendientes:*\n`;

    pendingSales.forEach((sale, i) => {
      const date = new Date(sale.createdAt).toLocaleDateString('es-VE');
      msg += `\n🧾 *Pedido ${i + 1}* (${date})\n`;
      sale.items.forEach((item) => {
        msg += `  • ${item.productName} x${item.quantity} — $${item.subtotal.toFixed(2)}\n`;
      });
      msg += `  Total: $${sale.total.toFixed(2)} | Abonado: $${sale.amountPaid.toFixed(2)} | *Pendiente: $${sale.balance.toFixed(2)}*\n`;
    });

    msg += `\n💰 *Total pendiente: $${totalDebt.toFixed(2)}*\n`;

    if (storeSettings?.bank || storeSettings?.cedula || storeSettings?.phone) {
      msg += `\n🏦 *Datos para el pago:*\n`;
      if (storeSettings.bank) msg += `  Banco: ${storeSettings.bank}\n`;
      if (storeSettings.cedula) msg += `  Cédula: ${storeSettings.cedula}\n`;
      if (storeSettings.phone) msg += `  Teléfono: ${storeSettings.phone}\n`;
    }

    msg += `\n¡Gracias por tu preferencia! 😊🍞`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encoded}`, '_blank');
  };

  const handleSave = async (data: any) => {
    if (editing) await updateCustomer(editing.id, data);
    else await addCustomer(data);
    setEditing(undefined);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Clientes</h1>
          <p className="text-muted-foreground text-sm">{customers.length} registrados</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => { setEditing(undefined); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />Nuevo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Nuevo'} cliente</DialogTitle></DialogHeader>
            <CustomerForm customer={editing} onSave={handleSave} onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Input placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />

      <div className="space-y-2">
        {filtered.sort((a, b) => b.totalPurchases - a.totalPurchases).map((c) => {
          const debt = getCustomerDebt(c.id);
          return (
            <Card key={c.id} className="cursor-pointer" onClick={() => { setEditing(c); setOpen(true); }}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold">
                      {c.firstName[0]}{c.lastName ? c.lastName[0] : ''}
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <p className="font-medium text-sm">{c.firstName} {c.lastName}</p>
                        {c.totalPurchases >= 10 && <Star className="w-3 h-3 text-warning fill-warning" />}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3" />{c.phone}
                      </div>
                      {c.address && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />{c.address}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{c.totalPurchases} compras</p>
                      {debt > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs font-bold text-destructive">Debe: ${debt.toFixed(2)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-success"
                          onClick={(e) => { e.stopPropagation(); sendWhatsApp(c.phone, c.firstName, c.id); }}
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default CustomersPage;
