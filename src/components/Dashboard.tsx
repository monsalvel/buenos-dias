import { useStore } from '@/store/useStore';
import { DollarSign, TrendingUp, CreditCard, ShoppingCart, RefreshCw, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useState } from 'react';
import EarningsDetail from '@/components/EarningsDetail';

const StatCard = ({ icon: Icon, label, value, color, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; color: string; onClick?: () => void }) => (
  <Card className={`animate-fade-in ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98] transition-transform' : ''}`} onClick={onClick}>
    <CardContent className="p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-lg font-bold font-display">{value}</p>
      </div>
      {onClick && <ChevronRight className="w-4 h-4 text-muted-foreground/50" />}
    </CardContent>
  </Card>
);

const RecentSaleRow = ({ name, total, status, sellerName }: { name: string; total: number; status: string; sellerName?: string }) => {
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
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${statusColors[status] || ''}`}>{status}</span>
          {sellerName && <span className="text-[10px] text-muted-foreground">🧑‍💼 {sellerName}</span>}
        </div>
      </div>
      <p className="font-bold text-sm">${total.toFixed(2)}</p>
    </div>
  );
};

const Dashboard = () => {
  const { getTodayStats, sales, getFrequentCustomers, bcvRate, fetchBcvRate } = useStore();
  const stats = getTodayStats();
  const frequentCustomers = getFrequentCustomers();
  const recentSales = [...sales].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const [refreshing, setRefreshing] = useState(false);
  const [showEarnings, setShowEarnings] = useState(false);

  const handleRefreshRate = async () => {
    setRefreshing(true);
    try { await fetchBcvRate(); } finally { setRefreshing(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">Buenos días ☀️</h1>
        <p className="text-muted-foreground text-sm">Resumen de tus ventas</p>
      </div>

      {/* BCV Rate */}
      <Card>
        <CardContent className="p-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Tasa BCV (USD)</p>
            <p className="text-lg font-bold font-display">
              {bcvRate ? `Bs. ${bcvRate.rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'No disponible'}
            </p>
            {bcvRate && <p className="text-[10px] text-muted-foreground">Actualizado: {new Date(bcvRate.fetchedAt).toLocaleString()}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={handleRefreshRate} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={DollarSign} label="Ingresos hoy" value={`$${stats.income.toFixed(2)}`} color="bg-primary/15 text-primary" />
        <StatCard icon={TrendingUp} label="Ganancia neta" value={`$${stats.profit.toFixed(2)}`} color="bg-success/15 text-success" onClick={() => setShowEarnings(true)} />
        <StatCard icon={CreditCard} label="Por cobrar" value={`$${stats.receivables.toFixed(2)}`} color="bg-warning/15 text-warning" />
        <StatCard icon={ShoppingCart} label="Ventas hoy" value={`${stats.salesCount}`} color="bg-accent/15 text-accent-foreground" />
      </div>

      {/* Earnings Detail Sheet */}
      <Sheet open={showEarnings} onOpenChange={setShowEarnings}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl">
          <SheetHeader className="mb-4">
            <SheetTitle className="font-display text-lg">📊 Análisis de Ganancias</SheetTitle>
            <SheetDescription>Desglose detallado de ingresos, costos y ganancias por producto</SheetDescription>
          </SheetHeader>
          <EarningsDetail />
        </SheetContent>
      </Sheet>

      <Card>
        <CardContent className="p-4">
          <h2 className="font-display font-semibold mb-3">Ventas recientes</h2>
          {recentSales.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">No hay ventas aún</p>
          ) : (
            recentSales.map((sale) => (
              <RecentSaleRow key={sale.id} name={sale.customerName} total={sale.total} status={sale.status} sellerName={sale.sellerName} />
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
