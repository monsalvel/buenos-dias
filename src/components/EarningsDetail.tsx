import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Package, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface ProductPerformance {
  productId: string;
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  margin: number;
}

const EarningsDetail = () => {
  const { sales } = useStore();

  const { activeSales, totalRevenue, totalCost, totalProfit, profitMargin, productBreakdown } = useMemo(() => {
    const activeSales = sales.filter((s) => s.status !== 'anulado');

    const totalRevenue = activeSales.reduce((sum, s) => sum + s.total, 0);
    const totalCost = activeSales.reduce((sum, s) => sum + s.totalCost, 0);
    const totalProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Aggregate by product
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

    return { activeSales, totalRevenue, totalCost, totalProfit, profitMargin, productBreakdown };
  }, [sales]);

  const maxProfit = Math.max(...productBreakdown.map((p) => Math.abs(p.totalProfit)), 1);

  if (activeSales.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/40" />
        <p className="text-muted-foreground text-sm">Aún no hay ventas registradas</p>
        <p className="text-muted-foreground/60 text-xs">Cuando registres ventas, aquí verás el desglose de ganancias</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        {/* Revenue */}
        <div className="relative rounded-xl p-3 overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0.04) 100%)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(59,130,246,0.15)',
          }}>
          <div className="flex items-center gap-1 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[10px] text-blue-600 font-medium uppercase tracking-wide">Ingresos</span>
          </div>
          <p className="text-base font-bold text-blue-700">${totalRevenue.toFixed(2)}</p>
        </div>

        {/* Costs */}
        <div className="relative rounded-xl p-3 overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.04) 100%)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(239,68,68,0.15)',
          }}>
          <div className="flex items-center gap-1 mb-1">
            <TrendingDown className="w-3.5 h-3.5 text-red-500" />
            <span className="text-[10px] text-red-600 font-medium uppercase tracking-wide">Costos</span>
          </div>
          <p className="text-base font-bold text-red-700">${totalCost.toFixed(2)}</p>
        </div>

        {/* Net Profit */}
        <div className="relative rounded-xl p-3 overflow-hidden"
          style={{
            background: totalProfit >= 0
              ? 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(34,197,94,0.04) 100%)'
              : 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.04) 100%)',
            backdropFilter: 'blur(12px)',
            border: totalProfit >= 0
              ? '1px solid rgba(34,197,94,0.2)'
              : '1px solid rgba(239,68,68,0.2)',
          }}>
          <div className="flex items-center gap-1 mb-1">
            <TrendingUp className={`w-3.5 h-3.5 ${totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`} />
            <span className={`text-[10px] font-medium uppercase tracking-wide ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>Ganancia</span>
          </div>
          <p className={`text-base font-bold ${totalProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            ${totalProfit.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Profit Margin Indicator */}
      <div className="relative rounded-xl p-4 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(59,130,246,0.06) 100%)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(139,92,246,0.12)',
        }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground">Margen de ganancia general</span>
          <span className={`text-sm font-bold ${profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {profitMargin.toFixed(1)}%
          </span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-muted/50 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${Math.min(Math.max(profitMargin, 0), 100)}%`,
              background: profitMargin >= 50
                ? 'linear-gradient(90deg, #22c55e, #10b981)'
                : profitMargin >= 25
                ? 'linear-gradient(90deg, #eab308, #22c55e)'
                : 'linear-gradient(90deg, #ef4444, #eab308)',
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-muted-foreground/60">0%</span>
          <span className="text-[10px] text-muted-foreground/60">50%</span>
          <span className="text-[10px] text-muted-foreground/60">100%</span>
        </div>
      </div>

      {/* Product Breakdown */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-display font-bold">Desglose por producto</h3>
          <span className="text-[10px] text-muted-foreground ml-auto">{productBreakdown.length} productos</span>
        </div>
        <div className="space-y-2">
          {productBreakdown.map((product, index) => (
            <Card key={product.productId} className="overflow-hidden border-0"
              style={{
                background: 'rgba(255,255,255,0.6)',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold"
                      style={{
                        background: index === 0
                          ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                          : index === 1
                          ? 'linear-gradient(135deg, #94a3b8, #64748b)'
                          : index === 2
                          ? 'linear-gradient(135deg, #cd7f32, #b8860b)'
                          : 'linear-gradient(135deg, rgba(0,0,0,0.05), rgba(0,0,0,0.1))',
                        color: index < 3 ? 'white' : 'inherit',
                      }}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight">{product.productName}</p>
                      <p className="text-[10px] text-muted-foreground">{product.totalQuantity} unidades vendidas</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-0.5 justify-end">
                      {product.totalProfit >= 0 ? (
                        <ArrowUpRight className="w-3 h-3 text-green-500" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3 text-red-500" />
                      )}
                      <span className={`text-sm font-bold ${product.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${product.totalProfit.toFixed(2)}
                      </span>
                    </div>
                    <span className={`text-[10px] font-medium ${product.margin >= 40 ? 'text-green-500' : product.margin >= 20 ? 'text-yellow-600' : 'text-red-500'}`}>
                      {product.margin.toFixed(0)}% margen
                    </span>
                  </div>
                </div>

                {/* Profit Bar */}
                <div className="relative w-full h-1.5 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min((Math.abs(product.totalProfit) / maxProfit) * 100, 100)}%`,
                      background: product.totalProfit >= 0
                        ? 'linear-gradient(90deg, #22c55e, #10b981)'
                        : 'linear-gradient(90deg, #ef4444, #f87171)',
                    }}
                  />
                </div>

                {/* Revenue vs Cost mini comparison */}
                <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                  <span>Ingreso: <span className="font-semibold text-foreground">${product.totalRevenue.toFixed(2)}</span></span>
                  <span>Costo: <span className="font-semibold text-foreground">${product.totalCost.toFixed(2)}</span></span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Summary Footer */}
      <div className="relative rounded-xl p-4 text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(34,197,94,0.06) 0%, rgba(59,130,246,0.06) 100%)',
          border: '1px solid rgba(34,197,94,0.1)',
        }}>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Resumen total</p>
        <p className="text-xs text-muted-foreground">
          {activeSales.length} ventas · {productBreakdown.length} productos · Margen {profitMargin.toFixed(1)}%
        </p>
      </div>
    </div>
  );
};

export default EarningsDetail;
