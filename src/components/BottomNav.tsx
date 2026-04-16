import { LayoutDashboard, ShoppingCart, Users, Package, Settings, Warehouse } from 'lucide-react';
import { TabId } from '@/types';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
  { id: 'sales', label: 'Ventas', icon: ShoppingCart },
  { id: 'stock', label: 'Stock', icon: Warehouse },
  { id: 'customers', label: 'Clientes', icon: Users },
  { id: 'products', label: 'Productos', icon: Package },
  { id: 'settings', label: 'Ajustes', icon: Settings },
];

const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
              activeTab === id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
