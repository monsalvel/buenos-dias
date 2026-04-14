import { useStore } from '@/store/useStore';
import { DollarSign, TrendingUp, CreditCard, ShoppingCart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const StatCard = ({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; color: string }) => (
  <Card className="animate-fade-in">
    <CardContent className="p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-lg font-bold font-display">{value}</p>
      </div>
    </CardContent>
  </Card>
);

const RecentSaleRow = ({ name, total, status }: { name: string; total: number; status: string }) => {
  const statusColors: Record<string, string> = {
    pagado: 'bg-success/10 text-success',
    abonado: 'bg-warning/10 text-warning',
    deuda: 'bg-destructive/10 text-destructive',
    anulado: 'bg-muted text-muted-foreground',
  };
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div>
        <p className="font-medium text-sm">{name}</p>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${statusColors[status] || ''}`}>{status}</span>
      </div>
      <p className="font-bold text-sm">${total.toFixed(2)}</p>
    </div>
  );
};

const Dashboard = () => {
  const { getTodayStats, sales, getFrequentCustomers } = useStore();
  const stats = getTodayStats();
  const frequentCustomers = getFrequentCustomers();
  const recentSales = [...sales].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">Buenos días ☀️</h1>
        <p className="text-muted-foreground text-sm">Resumen de tu panadería</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={DollarSign} label="Ingresos hoy" value={`$${stats.income.toFixed(2)}`} color="bg-primary/15 text-primary" />
        <StatCard icon={TrendingUp} label="Ganancia neta" value={`$${stats.profit.toFixed(2)}`} color="bg-success/15 text-success" />
        <StatCard icon={CreditCard} label="Por cobrar" value={`$${stats.receivables.toFixed(2)}`} color="bg-warning/15 text-warning" />
        <StatCard icon={ShoppingCart} label="Ventas hoy" value={`${stats.salesCount}`} color="bg-accent/15 text-accent-foreground" />
      </div>

      <Card>
        <CardContent className="p-4">
          <h2 className="font-display font-semibold mb-3">Ventas recientes</h2>
          {recentSales.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">No hay ventas aún</p>
          ) : (
            recentSales.map((sale) => (
              <RecentSaleRow key={sale.id} name={sale.customerName} total={sale.total} status={sale.status} />
            ))
          )}
        </CardContent>
      </Card>

      {frequentCustomers.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="font-display font-semibold mb-3">⭐ Clientes frecuentes</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {frequentCustomers.map((c) => (
                <div key={c.id} className="flex-shrink-0 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-lg">
                    {c.firstName[0]}
                  </div>
                  <p className="text-xs mt-1 font-medium">{c.firstName}</p>
                  <p className="text-[10px] text-muted-foreground">{c.totalPurchases} compras</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
