import { useState } from 'react';
import { TabId } from '@/types';
import BottomNav from '@/components/BottomNav';
import Dashboard from '@/components/Dashboard';
import SalesPage from '@/components/SalesPage';
import CustomersPage from '@/components/CustomersPage';
import ProductsPage from '@/components/ProductsPage';

const pages: Record<TabId, React.ComponentType> = {
  dashboard: Dashboard,
  sales: SalesPage,
  customers: CustomersPage,
  products: ProductsPage,
};

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const ActivePage = pages[activeTab];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 pt-6 pb-20">
        <ActivePage />
      </div>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
