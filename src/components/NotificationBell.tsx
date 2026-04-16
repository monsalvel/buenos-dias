import { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { getLocalDateString } from '@/lib/utils';

interface CreditAlert {
  saleId: string;
  customerName: string;
  balance: number;
  dueDate: string;
  type: 'due_today' | 'overdue';
  items: { productName: string; quantity: number; subtotal: number }[];
}

const NotificationBell = ({ onNavigateToSales }: { onNavigateToSales?: () => void }) => {
  const { sales } = useStore();
  const [open, setOpen] = useState(false);

  const alerts = useMemo<CreditAlert[]>(() => {
    const todayStr = getLocalDateString();
    return sales
      .filter((s) => s.status !== 'anulado' && s.status !== 'pagado' && s.dueDate)
      .map((s) => {
        const dueStr = s.dueDate!;
        const isDueToday = dueStr === todayStr;
        const isOverdue = dueStr < todayStr;
        if (!isDueToday && !isOverdue) return null;
        return {
          saleId: s.id,
          customerName: s.customerName,
          balance: s.balance,
          dueDate: dueStr,
          type: isDueToday ? 'due_today' : 'overdue',
          items: s.items.map((i) => ({ productName: i.productName, quantity: i.quantity, subtotal: i.subtotal })),
        } as CreditAlert;
      })
      .filter(Boolean) as CreditAlert[];
  }, [sales]);

  const dueToday = alerts.filter((a) => a.type === 'due_today');
  const overdue = alerts.filter((a) => a.type === 'overdue');
  const count = alerts.length;

  return (
    <>
      <Button variant="ghost" size="icon" className="relative" onClick={() => setOpen(true)}>
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-pulse">
            {count}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl">
          <SheetHeader className="mb-4">
            <SheetTitle className="font-display text-lg">🔔 Notificaciones</SheetTitle>
            <SheetDescription>Créditos que vencen hoy o están vencidos</SheetDescription>
          </SheetHeader>

          <div className="space-y-4 overflow-y-auto max-h-[calc(80vh-120px)]">
            {count === 0 && (
              <p className="text-center text-muted-foreground text-sm py-8">No hay alertas pendientes 🎉</p>
            )}

            {dueToday.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-warning mb-2">⏰ Vencen hoy ({dueToday.length})</h3>
                {dueToday.map((a) => (
                  <AlertCard key={a.saleId} alert={a} onNavigate={() => { setOpen(false); onNavigateToSales?.(); }} />
                ))}
              </div>
            )}

            {overdue.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-destructive mb-2">🚨 Vencidos ({overdue.length})</h3>
                {overdue.map((a) => (
                  <AlertCard key={a.saleId} alert={a} onNavigate={() => { setOpen(false); onNavigateToSales?.(); }} />
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

const AlertCard = ({ alert, onNavigate }: { alert: CreditAlert; onNavigate: () => void }) => (
  <Card className={`mb-2 border-l-4 ${alert.type === 'due_today' ? 'border-l-warning' : 'border-l-destructive'}`}>
    <CardContent className="p-3">
      <div className="flex justify-between items-start mb-1">
        <p className="font-medium text-sm">{alert.customerName}</p>
        <span className="font-bold text-sm text-destructive">${alert.balance.toFixed(2)}</span>
      </div>
      <div className="space-y-0.5 mb-2">
        {alert.items.map((item, i) => (
          <p key={i} className="text-xs text-muted-foreground">
            {item.quantity}x {item.productName} — ${item.subtotal.toFixed(2)}
          </p>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          Vence: {new Date(alert.dueDate + 'T00:00:00').toLocaleDateString('es-VE')}
        </p>
        <Button variant="outline" size="sm" className="h-6 text-xs" onClick={onNavigate}>
          Ir a ventas
        </Button>
      </div>
    </CardContent>
  </Card>
);

export default NotificationBell;
