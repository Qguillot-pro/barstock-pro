import React from 'react';
import { StockItem, Format, Category, UserRole, DLCProfile } from '../types';

interface ArticlesListProps {
  items: StockItem[];
  setItems: React.Dispatch<React.SetStateAction<StockItem[]>>;
  formats: Format[];
  categories: Category[];
  onDelete: (id: string) => void;
  userRole: UserRole;
  dlcProfiles?: DLCProfile[];
  onSync: (action: string, payload: any) => void;
  filter?: 'ALL' | 'TEMPORARY';
}

const ArticlesList: React.FC<ArticlesListProps> = ({ items, setItems, formats, categories, onDelete, userRole, dlcProfiles = [], onSync, filter = 'ALL' }) => {
  
  const displayedItems = filter === 'TEMPORARY' 
      ? items.filter(i => i.isTemporary) 
      : items;

  const updateItem = (id: string, field: keyof StockItem, value: any) => {
    setItems(prev => prev.map(i => {
        if (i.id === id) {
            const updated = { ...i, [field]: value };
            onSync('SAVE_ITEM', updated);
            return updated;
        }
        return i;
    }));
  };

  const integrateItem = (item: StockItem) => {
      // Pour valider l'intégration, on retire le flag isTemporary
      // On suppose que l'admin a fait les modifs nécessaires avant de cliquer
      const updated = { ...item, isTemporary: false };
      setItems(prev => prev.map(i => i.id === item.id ? updated : i));
      onSync('SAVE_ITEM', updated);
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      <div className={`p-6 border-b flex justify-between items-center ${filter === 'TEMPORARY' ? 'bg-amber-50' : 'bg-slate-50'}`}>
        <h2 className={`font-black uppercase tracking-tight flex items-center gap-2 ${filter === 'TEMPORARY' ? 'text-amber-800' : 'text-slate-800'}`}>
            <span className={`w-1.5 h-6 rounded-full ${filter === 'TEMPORARY' ? 'bg-amber-500' : 'bg-indigo-600'}`}></span>
            {filter === 'TEMPORARY' ? 'Intégration Articles Temporaires' : 'Base de Données Articles'}
        </h2>
        <span className={`text-[10px] font-black uppercase tracking-widest ${filter === 'TEMPORARY' ? 'text-amber-400' : 'text-slate-400'}`}>{displayedItems.length} références</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
            <tr>
              <th className="p-6">Produit</th>
              <th className="p-6 w-32">Code Article</th>
              <th className="p-6">Format</th>
              <th className="p-6">Catégorie</th>
              <th className="p-6">DLC Configuration</th>
              <th className="p-6 text-right">Prix Unit (€HT)</th>
              <th className="p-6 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayedItems.map(item => (
              <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors group relative ${item.isTemporary ? 'bg-amber-50/30' : ''}`}>
                <td className="p-6">
                  <input 
                    className="w-full bg-transparent border-b border-transparent focus:border-indigo-500 outline-none font-bold text-slate-900"
                    value={item.name}
                    onChange={e => updateItem(item.id, 'name', e.target.value)}
                  />
                  {item.isTemporary && <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-1 block">Temporaire</span>}
                </td>
                <td className="p-6">
                  <input 
                    className="w-full bg-transparent border-b border-transparent focus:border-indigo-500 outline-none font-bold text-xs text-slate-500 placeholder-slate-300"
                    value={item.articleCode || ''}
                    placeholder="-"
                    onChange={e => updateItem(item.id, 'articleCode', e.target.value)}
                  />
                </td>
                <td className="p-6">
                  <select 
                    className="bg-transparent outline-none font-bold text-slate-600 text-xs uppercase cursor-pointer"
                    value={item.formatId}
                    onChange={e => updateItem(item.id, 'formatId', e.target.value)}
                  >
                    {formats.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </td>
                <td className="p-6">
                  <select 
                    className="bg-transparent outline-none font-black text-indigo-600 text-[10px] uppercase tracking-tighter cursor-pointer"
                    value={item.category}
                    onChange={e => updateItem(item.id, 'category', e.target.value as Category)}
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td className="p-6">
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                        type="checkbox"
                        className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        checked={item.isDLC || false}
                        onChange={e => updateItem(item.id, 'isDLC', e.target.checked)}
                        />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${item.isDLC ? 'text-amber-500' : 'text-slate-300'}`}>Tracking</span>
                    </label>
                    {item.isDLC && (
                        <select 
                            className="bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 text-[10px] font-bold text-amber-700 outline-none"
                            value={item.dlcProfileId || ''}
                            onChange={(e) => updateItem(item.id, 'dlcProfileId', e.target.value)}
                        >
                            <option value="">Sélectionner Durée...</option>
                            {dlcProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    )}
                  </div>
                </td>
                <td className="p-6">
                  <input 
                    type="number"
                    step="0.01"
                    className="w-24 bg-transparent border-b border-transparent focus:border-indigo-500 outline-none text-right font-black text-slate-900"
                    value={item.pricePerUnit}
                    onChange={e => updateItem(item.id, 'pricePerUnit', Number(e.target.value))}
                  />
                </td>
                <td className="p-6 text-center relative z-10 flex items-center justify-center gap-2">
                  {userRole === 'ADMIN' && item.isTemporary && (
                      <div className="flex gap-2">
                          <button 
                            type="button"
                            onClick={() => onDelete(item.id)}
                            className="bg-rose-500 text-white px-3 py-1.5 rounded-lg font-black text-[9px] uppercase hover:bg-rose-600 shadow-sm transition-all"
                            title="Refuser et Supprimer"
                          >
                              Refuser
                          </button>
                          <button 
                            type="button"
                            onClick={() => integrateItem(item)}
                            className="bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-black text-[9px] uppercase hover:bg-emerald-600 shadow-sm transition-all"
                            title="Valider l'intégration définitive"
                          >
                              Intégrer
                          </button>
                      </div>
                  )}
                  {userRole === 'ADMIN' && !item.isTemporary && (
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDelete(item.id);
                      }}
                      className="p-3 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all active:scale-90 cursor-pointer shadow-sm border border-transparent hover:border-rose-100"
                      title={`Supprimer ${item.name}`}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {displayedItems.length === 0 && (
              <tr>
                <td colSpan={7} className="py-20 text-center italic text-slate-400 text-sm">Aucun produit trouvé.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ArticlesList;