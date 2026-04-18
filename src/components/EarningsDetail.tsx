import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  BarChart3,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductPerformance {
  productId: string;
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  margin: number;
}

const fmt = (n: number) => `$${n.toFixed(2)}`;

const EarningsDetail = () => {
  const { sales, batches, products } = useStore();

  const data = useMemo(() => {
    const activeSales = sales.filter((s) => s.status !== 'anulado');
    const totalRevenue = activeSales.reduce((sum, s) => sum + s.total, 0);
    const totalCost = activeSales.reduce((sum, s) => sum + s.totalCost, 0);
    const totalProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Per-product breakdown
    const productMap = new Map<string, ProductPerformance>();
    for (const sale of activeSales) {
      for (const item of sale.items) {
        const existing = productMap.get(item.productId);
        const itemRevenue = item.unitPrice * item.quantity;
        const itemCost = item.unitCost * item.quantity;
        if (existing) {
          existing.totalQuantity += item.quantity;
          existing.totalRevenue += itemRevenue;
          existing.totalCost += itemCost;
          existing.totalProfit += itemRevenue - itemCost;
          existing.margin = existing.totalRevenue > 0 ? (existing.totalProfit / existing.totalRevenue) * 100 : 0;
        } else {
          const profit = itemRevenue - itemCost;
          productMap.set(item.productId, {
            productId: item.productId,
            productName: item.productName,
            totalQuantity: item.quantity,
            totalRevenue: itemRevenue,
            totalCost: itemCost,
            totalProfit: profit,
            margin: itemRevenue > 0 ? (profit / itemRevenue) * 100 : 0,
          });
        }
      }
    }
    const productBreakdown = [...productMap.values()].sort((a, b) => b.totalProfit - a.totalProfit);
    const top10 = productBreakdown.slice(0, 10);

    // Last 30 days trend (local dates)
    const days: { date: string; label: string; revenue: number; cost: number; profit: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({
        date: key,
        label: d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }),
        revenue: 0,
        cost: 0,
        profit: 0,
      });
    }
    const dayMap = new Map(days.map((d) => [d.date, d]));
    for (const s of activeSales) {
      const dt = new Date(s.createdAt);
      dt.setHours(0, 0, 0, 0);
      const key = dt.toISOString().slice(0, 10);
      const bucket = dayMap.get(key);
      if (bucket) {
        bucket.revenue += s.total;
        bucket.cost += s.totalCost;
        bucket.profit += s.total - s.totalCost;
      }
    }

    // Per-batch performance
    const batchPerf = batches.map((b) => {
      const product = products.find((p) => p.id === b.productId);
      let revenue = 0;
      let unitsSold = b.quantityReceived - b.quantityRemaining;
      let profit = 0;
      for (const s of activeSales) {
        for (const it of s.items) {
          if (it.productId === b.productId && Math.abs(it.unitCost - b.unitCost) < 0.001) {
            revenue += it.unitPrice * it.quantity;
            profit += (it.unitPrice - it.unitCost) * it.quantity;
          }
        }
      }
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      return {
        id: b.id,
        productName: product?.name || 'Producto',
        receivedAt: b.receivedAt,
        unitCost: b.unitCost,
        received: b.quantityReceived,
        remaining: b.quantityRemaining,
        unitsSold,
        revenue,
        profit,
        margin,
      };
    }).sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

    return {
      activeSales,
      totalRevenue,
      totalCost,
      totalProfit,
      profitMargin,
      productBreakdown,
      top10,
      days,
      batchPerf,
    };
  }, [sales, batches, products]);

  if (data.activeSales.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/40" />
        <p className="text-muted-foreground text-sm">Aún no hay ventas registradas</p>
        <p className="text-muted-foreground/60 text-xs">Cuando registres ventas verás los gráficos</p>
      </div>
    );
  }

  const PIE_COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))', '#94a3b8', '#a78bfa', '#fb923c'];

  return (
    <div className="space-y-4 max-h-[78vh] overflow-y-auto pr-1">
      {/* Top KPIs always visible */}
      <div className="grid grid-cols-3 gap-2">
        <KpiCard icon={DollarSign} label="Ingresos" value={fmt(data.totalRevenue)} tone="primary" />
        <KpiCard icon={TrendingDown} label="Costos" value={fmt(data.totalCost)} tone="destructive" />
        <KpiCard
          icon={TrendingUp}
          label="Ganancia"
          value={fmt(data.totalProfit)}
          tone={data.totalProfit >= 0 ? 'success' : 'destructive'}
        />
      </div>

      <Tabs defaultValue="resumen" className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="resumen" className="text-xs">Resumen</TabsTrigger>
          <TabsTrigger value="tendencia" className="text-xs">Tendencia</TabsTrigger>
          <TabsTrigger value="productos" className="text-xs">Productos</TabsTrigger>
          <TabsTrigger value="lotes" className="text-xs">Lotes</TabsTrigger>
        </TabsList>

        {/* RESUMEN */}
        <TabsContent value="resumen" className="space-y-3 mt-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground">Margen general</span>
                <span className={cn('text-sm font-bold', data.profitMargin >= 0 ? 'text-success' : 'text-destructive')}>
                  {data.profitMargin.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(Math.max(data.profitMargin, 0), 100)}%`,
                    background:
                      data.profitMargin >= 50
                        ? 'hsl(var(--success))'
                        : data.profitMargin >= 25
                          ? 'hsl(var(--warning))'
                          : 'hsl(var(--destructive))',
                  }}
                />
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-muted-foreground/70">
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-2">
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Ventas activas</p>
              <p className="text-xl font-bold font-display">{data.activeSales.length}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Productos vendidos</p>
              <p className="text-xl font-bold font-display">{data.productBreakdown.length}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Ticket promedio</p>
              <p className="text-xl font-bold font-display">
                {fmt(data.activeSales.length > 0 ? data.totalRevenue / data.activeSales.length : 0)}
              </p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Lotes activos</p>
              <p className="text-xl font-bold font-display">
                {data.batchPerf.filter((b) => b.remaining > 0).length}
              </p>
            </CardContent></Card>
          </div>
        </TabsContent>

        {/* TENDENCIA */}
        <TabsContent value="tendencia" className="mt-3">
          <Card>
            <CardContent className="p-3">
              <p className="text-xs font-semibold mb-2">Últimos 30 días</p>
              <ChartContainer
                config={{
                  revenue: { label: 'Ingresos', color: 'hsl(var(--primary))' },
                  cost: { label: 'Costos', color: 'hsl(var(--destructive))' },
                  profit: { label: 'Ganancia', color: 'hsl(var(--success))' },
                }}
                className="h-[260px] w-full"
              >
                <AreaChart data={data.days} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad-rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="grad-prof" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="grad-cost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} />
                  <YAxis tick={{ fontSize: 10 }} width={40} />
                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#grad-rev)" />
                  <Area type="monotone" dataKey="cost" stroke="hsl(var(--destructive))" strokeWidth={1.5} fill="url(#grad-cost)" />
                  <Area type="monotone" dataKey="profit" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#grad-prof)" />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRODUCTOS */}
        <TabsContent value="productos" className="space-y-3 mt-3">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-primary" />
                <p className="text-xs font-semibold">Top 10 por ganancia</p>
              </div>
              <ChartContainer
                config={{ totalProfit: { label: 'Ganancia', color: 'hsl(var(--success))' } }}
                className="h-[280px] w-full"
              >
                <BarChart data={data.top10} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="productName" tick={{ fontSize: 10 }} width={80} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="totalProfit" fill="hsl(var(--success))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <p className="text-xs font-semibold mb-2">Participación en ingresos</p>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={data.top10}
                    dataKey="totalRevenue"
                    nameKey="productName"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {data.top10.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LOTES */}
        <TabsContent value="lotes" className="space-y-2 mt-3">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-4 h-4 text-primary" />
            <p className="text-xs font-semibold">Margen por lote (stock viejo vs nuevo)</p>
          </div>
          {data.batchPerf.length === 0 ? (
            <p className="text-center text-muted-foreground text-xs py-6">
              Aún no hay lotes. Agrega stock desde la sección Inventario.
            </p>
          ) : (
            <div className="space-y-2">
              {data.batchPerf.map((b) => (
                <Card key={b.id}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold leading-tight">{b.productName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(b.receivedAt).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}
                          {' · '}Costo {fmt(b.unitCost)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn('text-sm font-bold', b.profit >= 0 ? 'text-success' : 'text-destructive')}>
                          {fmt(b.profit)}
                        </p>
                        <p className={cn('text-[10px] font-medium', b.margin >= 40 ? 'text-success' : b.margin >= 20 ? 'text-warning' : 'text-destructive')}>
                          {b.margin.toFixed(0)}% margen
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
                      <div>
                        <p className="text-muted-foreground">Recibidos</p>
                        <p className="font-bold text-xs">{b.received}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Vendidos</p>
                        <p className="font-bold text-xs">{b.unitsSold}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Restan</p>
                        <p className="font-bold text-xs">{b.remaining}</p>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${b.received > 0 ? (b.unitsSold / b.received) * 100 : 0}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

interface KpiCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: 'primary' | 'success' | 'destructive';
}

const KpiCard = ({ icon: Icon, label, value, tone }: KpiCardProps) => {
  const toneClasses = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    success: 'bg-success/10 text-success border-success/20',
    destructive: 'bg-destructive/10 text-destructive border-destructive/20',
  }[tone];
  return (
    <div className={cn('rounded-xl p-3 border', toneClasses)}>
      <div className="flex items-center gap-1 mb-1">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">{label}</span>
      </div>
      <p className="text-base font-bold font-display">{value}</p>
    </div>
  );
};

export default EarningsDetail;
