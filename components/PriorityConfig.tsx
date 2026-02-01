import React, { useState } from 'react';
import { StockItem, StorageSpace, StockPriority, Category } from '../types';

interface PriorityConfigProps {
  items: StockItem[];
  storages: StorageSpace[];
  priorities: StockPriority[];
  setPriorities: React.Dispatch<React.SetStateAction<StockPriority[]>>;
  categories: Category[];
  onSync?: (action: string, payload: any) => void;
}

const PriorityConfig: React.FC<PriorityConfigProps> = ({ items, storages, priorities, setPriorities, categories, onSync }) => {
  const [bulkCategory, setBulkCategory] = useState<Category | 'ALL'>('ALL');
  const [bulkStorage, setBulkStorage] = useState<string>(storages.find(s => s.id !== 's0')?.id || storages[0]?.id || '');
  const [bulkValue, setBulkValue] = useState<number>(0);

  const updatePriority = (itemId: string, storageId: string, priority: number) => {
    if (storageId === 's0') return;

    setPriorities(prev => {
      const filtered = prev.filter(p => !(p.itemId === itemId && p.storageId === storageId));
      return [...filtered, { itemId, storageId, priority }];
    });
    
    if (onSync) onSync('SAVE_PRIORITY', { itemId, storageId, priority });
  };

  const handleBulkApply = () => {
    if (bulkStorage === 's0') {
        alert("La priorité du Surstock est gérée par le système et ne peut pas être modifiée en masse.");
        return;
    }
    const itemsToUpdate = items.filter(item => bulkCategory === 'ALL' || item.category === bulkCategory);
    if (itemsToUpdate.length === 0) return;
    
    if (window.confirm(`Appliquer la priorité ${bulkValue} à ${itemsToUpdate.length} articles (${bulkCategory}) dans "${storages.find(s => s.id === bulkStorage)?.name}" ?`)) {
      setPriorities(prev => {
        const updatedItemIds = new Set(itemsToUpdate.map(i => i.id));
        const filtered = prev.filter(p => !(p.storageId === bulkStorage && updatedItemIds.has(p.itemId)));
        const newRules: StockPriority[] = itemsToUpdate.map(item => ({ itemId: item.id, storageId: bulkStorage, priority: bulkValue }));
        return [...filtered, ...newRules];
      });
      
      // Batch sync or individual sync? Simple approach: loop individual sync for now, or assume this is a rare action.
      // Ideally, backend should support batch, but for simplicity we iterate.
      itemsToUpdate.forEach(item => {
          if (onSync) onSync('SAVE_PRIORITY', { itemId: item.id, storageId: bulkStorage, priority: bulkValue });
      });
    }
  };

  const getPriority = (itemId: string, storageId: string) => {
    if (storageId === 's0') return 11;
    return priorities.find(p => p.itemId === itemId && p.storageId === storageId)?.priority || 0;
  };

  return (
    <div className="space-y-6">
      <div className="bg-indigo-50/50 border-2 border-indigo-100 p-6 rounded-[2rem] shadow-sm">
        <h3 className="font-black text-xs uppercase tracking-widest text-indigo-900 mb-6 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          Modification de Masse
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Catégorie Cible</label><select className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none" value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value as Category | 'ALL')}><option value="ALL">Toutes les catégories</option>{categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
          <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Espace de Stockage</label><select className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none" value={bulkStorage} onChange={(e) => setBulkStorage(e.target.value)}>{storages.map(s => <option key={s.id} value={s.id} disabled={s.id === 's0'}>{s.name} {s.id === 's0' ? '(Verrouillé)' : ''}</option>)}</select></div>
          <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Niveau de Priorité (0-10)</label><div className="flex bg-white border border-indigo-200 rounded-xl p-1 gap-1"><input type="range" min="0" max="10" className="flex-1 accent-indigo-600" value={bulkValue} onChange={(e) => setBulkValue(parseInt(e.target.value))} /><span className="w-10 text-center font-black text-indigo-600">{bulkValue}</span></div></div>
          <button onClick={handleBulkApply} disabled={bulkStorage === 's0'} className="bg-indigo-600 text-white p-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 disabled:bg-slate-300">Appliquer</button>
        </div>
      </div>
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <tr><th className="p-4 border-r sticky left-0 bg-slate-100 z-10 w-64">Produit</th>{storages.map(s => <th key={s.id} className="p-4 text-center border-r min-w-[320px]">{s.name}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 sticky left-0 bg-white z-10 border-r shadow-[2px_0_5px_rgba(0,0,0,0.02)]"><div className="flex flex-col"><span className="font-bold text-sm text-slate-900">{item.name}</span><span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{item.category}</span></div></td>
                  {storages.map(s => {
                    const currentP = getPriority(item.id, s.id);
                    return (
                      <td key={s.id} className="p-4 border-r text-center">
                        {s.id === 's0' ? <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-lg text-[10px] font-black">SURSTOCK</span> : <div className="inline-flex bg-slate-100 p-1 rounded-lg gap-0.5">{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => <button key={v} onClick={() => updatePriority(item.id, s.id, v)} className={`w-7 h-8 rounded font-bold text-[11px] ${currentP === v ? (v === 0 ? 'bg-slate-800 text-white' : 'bg-indigo-600 text-white') : 'text-slate-400 hover:bg-white'}`}>{v}</button>)}</div>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PriorityConfig;