import { useState, useEffect } from 'react';
import { TabId } from '@/types';
import { useStore } from '@/store/useStore';
import BottomNav from '@/components/BottomNav';
import Dashboard from '@/components/Dashboard';
import SalesPage from '@/components/SalesPage';
import CustomersPage from '@/components/CustomersPage';
import ProductsPage from '@/components/ProductsPage';
import StockPage from '@/components/StockPage';
import SettingsPage from '@/components/SettingsPage';
import PriceListsPage from '@/components/PriceListsPage';
import NotificationBell from '@/components/NotificationBell';

const pages: Record<TabId, React.ComponentType> = {
  dashboard: Dashboard,
  sales: SalesPage,
  customers: CustomersPage,
  products: ProductsPage,
  stock: StockPage,
  settings: SettingsPage,
  'price-lists': PriceListsPage,
};

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const { fetchAll, loading } = useStore();
  const ActivePage = pages[activeTab];

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 pt-6 pb-20">
        <div className="flex justify-end mb-2">
          <NotificationBell onNavigateToSales={() => setActiveTab('sales')} />
        </div>
        <ActivePage />
      </div>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
