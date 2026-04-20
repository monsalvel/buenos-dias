import { useState } from 'react';
import { LayoutDashboard, ShoppingCart, Users, Package, Settings, Warehouse, MoreHorizontal, ChevronRight, ListOrdered } from 'lucide-react';
import { TabId } from '@/types';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const primary: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
  { id: 'sales', label: 'Ventas', icon: ShoppingCart },
  { id: 'customers', label: 'Clientes', icon: Users },
];

const secondary: {
  id: TabId;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'stock', label: 'Stock', description: 'Inventario y lotes', icon: Warehouse },
  { id: 'products', label: 'Productos', description: 'Catálogo y precios', icon: Package },
  { id: 'price-lists', label: 'Listas de Precios', description: 'Versiones e historial de precios', icon: ListOrdered },
  { id: 'settings', label: 'Ajustes', description: 'Datos del negocio y cuenta', icon: Settings },
];

const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const isSecondaryActive = secondary.some((s) => s.id === activeTab);

  const renderItem = (
    id: TabId | 'more',
    label: string,
    Icon: React.ComponentType<{ className?: string }>,
    active: boolean,
    onClick: () => void,
  ) => (
    <button
      key={id}
      onClick={onClick}
      className={cn(
        'flex-1 h-full flex flex-col items-center justify-center gap-1 transition-colors',
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-full transition-all px-3 py-1',
          active ? 'bg-primary/10' : 'bg-transparent',
        )}
      >
        <Icon className="w-5 h-5" />
      </span>
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  );

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch h-16 max-w-lg mx-auto">
        {primary.map(({ id, label, icon }) =>
          renderItem(id, label, icon, activeTab === id, () => onTabChange(id)),
        )}

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            {renderItem('more', 'Más', MoreHorizontal, isSecondaryActive || moreOpen, () => setMoreOpen(true))}
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-2xl border-t-0 max-w-lg mx-auto pb-[calc(env(safe-area-inset-bottom)+1rem)]"
          >
            <SheetHeader className="text-left mb-2">
              <SheetTitle className="font-display">Más opciones</SheetTitle>
            </SheetHeader>
            <div className="space-y-2">
              {secondary.map(({ id, label, description, icon: Icon }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      onTabChange(id);
                      setMoreOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left',
                      active
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border bg-background hover:bg-muted/50',
                    )}
                  >
                    <div
                      className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                        active ? 'bg-primary/15 text-primary' : 'bg-muted text-foreground',
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-semibold leading-tight', active && 'text-primary')}>
                        {label}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
};

export default BottomNav;
