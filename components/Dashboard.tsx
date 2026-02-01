import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { StockItem, Category, StockLevel, StockConsigne, DLCHistory, DLCProfile, UserRole } from '../types';

interface DashboardProps {
  items: StockItem[];
  stockLevels: StockLevel[];
  consignes: StockConsigne[];
  categories: Category[];
  dlcHistory?: DLCHistory[];
  dlcProfiles?: DLCProfile[];
  userRole?: UserRole;
  onNavigateToIntegration?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ items, stockLevels, consignes, categories, dlcHistory = [], dlcProfiles = [], userRole, onNavigateToIntegration }) => {
  // Helper to get total stock for an item across all storages
  const getItemTotalStock = (itemId: string) => 
    stockLevels.filter(sl => sl.itemId === itemId).reduce((acc, curr) => acc + curr.currentQuantity, 0);

  // Helper to get total min consigne for an item across all storages
  const getItemMinConsigne = (itemId: string) => 
    consignes.filter(c => c.itemId === itemId).reduce((acc, curr) => acc + curr.minQuantity, 0);

  const chartData = items.map(item => {
    const currentStock = getItemTotalStock(item.id);
    const minStock = getItemMinConsigne(item.id);
    return {
      name: item.name,
      stock: currentStock,
      min: minStock,
      ratio: minStock > 0 ? (currentStock / minStock) * 100 : 100
    };
  });

  const categoryDistribution = categories.map(cat => ({
    name: cat,
    value: items.filter(i => i.category === cat).length
  }));

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  const lowStockCount = items.filter(item => {
    const total = getItemTotalStock(item.id);
    const min = getItemMinConsigne(item.id);
    return min > 0 && total <= min;
  }).length;

  const totalItemsCount = items.reduce((acc, item) => acc + getItemTotalStock(item.id), 0);
  const tempItemsCount = items.filter(i => i.isTemporary).length;

  // DLC Expiration Logic
  const expiredDlcCount = dlcHistory.filter(h => {
      const item = items.find(i => i.id === h.itemId);
      const profile = dlcProfiles.find(p => p.id === item?.dlcProfileId);
      if (!profile) return false;
      
      const expirationDate = new Date(new Date(h.openedAt).getTime() + profile.durationHours * 60 * 60 * 1000);
      return new Date() > expirationDate;
  }).length;

  return (
    <div className="space-y-6">
      <div className={`grid grid-cols-1 md:grid-cols-3 ${userRole === 'ADMIN' ? 'lg:grid-cols-4' : ''} gap-6`}>
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Alertes Réappro</p>
            <p className={`text-4xl font-black ${lowStockCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {lowStockCount} <span className="text-lg opacity-50 font-bold">RÉF.</span>
            </p>
          </div>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${lowStockCount > 0 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
        </div>
        
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Alertes DLC Expirées</p>
              <p className={`text-4xl font-black ${expiredDlcCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                {expiredDlcCount} <span className="text-lg opacity-50 font-bold">PROD.</span>
              </p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${expiredDlcCount > 0 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Volume Stock</p>
            <p className="text-4xl font-black text-slate-900">
              {totalItemsCount} <span className="text-lg opacity-50 font-bold">UNIT.</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </div>
        </div>

        {userRole === 'ADMIN' && (
             <div 
                className="bg-amber-50 p-8 rounded-2xl shadow-sm border border-amber-100 flex items-center justify-between cursor-pointer hover:bg-amber-100 transition-colors"
                onClick={onNavigateToIntegration}
             >
                <div>
                    <p className="text-xs font-black text-amber-600 uppercase tracking-widest mb-1">Articles à intégrer</p>
                    <p className="text-4xl font-black text-amber-600">
                    {tempItemsCount}
                    </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-white text-amber-500 flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                </div>
            </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 h-[450px]">
          <h3 className="text-sm font-black uppercase tracking-widest mb-8 text-slate-800 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-rose-500 rounded-full"></span>
            Niveaux Critiques par Article
          </h3>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={chartData.filter(d => d.stock <= d.min * 1.5).sort((a,b) => a.ratio - b.ratio)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} fontSize={10} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                cursor={{ fill: '#f8fafc' }}
              />
              <Bar dataKey="stock" radius={[4, 4, 0, 0]} barSize={40}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.stock <= entry.min ? '#f43f5e' : '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 h-[450px]">
          <h3 className="text-sm font-black uppercase tracking-widest mb-8 text-slate-800 flex items-center gap-2">
             <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
             Répartition des Références
          </h3>
          <ResponsiveContainer width="100%" height="85%">
            <PieChart>
              <Pie
                data={categoryDistribution.filter(d => d.value > 0)}
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={110}
                paddingAngle={8}
                dataKey="value"
                stroke="none"
              >
                {categoryDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-4 mt-2">
            {categoryDistribution.filter(d => d.value > 0).map((cat, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{cat.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;