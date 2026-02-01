import React, { useState, useMemo, useEffect } from 'react';
import { StockItem, StorageSpace, StockConsigne, StockPriority } from '../types';

interface ConsignesProps {
  items: StockItem[];
  storages: StorageSpace[];
  consignes: StockConsigne[];
  priorities: StockPriority[];
  setConsignes: React.Dispatch<React.SetStateAction<StockConsigne[]>>;
  onSync?: (action: string, payload: any) => void;
}

const Consignes: React.FC<ConsignesProps> = ({ items, storages, consignes, priorities, setConsignes, onSync }) => {
  const [isEditOrderMode, setIsEditOrderMode] = useState(false);
  const [editingValue, setEditingValue] = useState<{key: string, val: string} | null>(null);
  const [filters, setFilters] = useState<string[]>([storages[0]?.id || 'all', storages[1]?.id || 'none', 'none']);
  
  // Utilisation de l'état local pour gérer les positions en cours d'édition
  const [storagePositions, setStoragePositions] = useState<Record<string, number>>({});

  useEffect(() => {
    const initial: Record<string, number> = {};
    storages.forEach(s => {
      initial[s.id] = s.order ?? 0;
    });
    setStoragePositions(initial);
  }, [storages]);


  // Gestion du blur pour sauvegarder et formater
  const handleInputBlur = (itemId: string, storageId: string, val: string) => {
    setEditingValue(null);
    let normalized = val.replace(',', '.');
    if (normalized === '.') normalized = '0';

    let num = parseFloat(normalized);

    if (isNaN(num) || num < 0) num = 0; // Prevent negative
    // Limite à 2 décimales
    num = Math.round(num * 100) / 100;

    setConsignes(prev => {
        const exists = prev.find(c => c.itemId === itemId && c.storageId === storageId);
        if (exists) {
            return prev.map(c => (c.itemId === itemId && c.storageId === storageId) ? { ...c, minQuantity: num } : c);
        }
        return [...prev, { itemId, storageId, minQuantity: num }];
    });

    if (onSync) onSync('SAVE_CONSIGNE', { itemId, storageId, minQuantity: num });
  };

  const handleInputChange = (itemId: string, storageId: string, val: string) => {
    // Autoriser uniquement chiffres, point, virgule
    if (!/^[0-9]*[.,]?[0-9]*$/.test(val)) return;
    
    const key = `${itemId}-${storageId}`;
    setEditingValue({ key, val: val });
  };

  const handlePositionChange = (storageId: string, newPos: number) => {
    setStoragePositions(prev => ({ ...prev, [storageId]: newPos }));
  };

  const handlePositionBlur = (storageId: string, newPos: number) => {
      if (onSync) {
          onSync('SAVE_STORAGE_ORDER', { id: storageId, order: newPos });
      }
  };

  const handleFilterChange = (index: number, value: string) => {
    const newFilters = [...filters];
    newFilters[index] = value;
    setFilters(newFilters);
  };

  const orderedStoragesWithLabels = useMemo(() => {
    const showAll = filters.includes('all');
    const activeStorageIds = Array.from(new Set(filters.filter(f => f !== 'none' && f !== 'all')));

    const sortedStorages = [...storages].sort((a, b) => {
        const posA = storagePositions[a.id] ?? (a.order ?? 999);
        const posB = storagePositions[b.id] ?? (b.order ?? 999);
        return posA - posB;
    });

    const filtered = showAll ? sortedStorages : sortedStorages.filter(s => activeStorageIds.includes(s.id));

    return filtered.map((s) => {
      const pos = storagePositions[s.id] ?? (s.order ?? 0);
      return { ...s, displayLabel: pos > 0 ? `S${pos}` : 'S?' };
    });
  }, [storages, storagePositions, filters]);

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b bg-slate-50 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h2 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-6 bg-indigo-600 rounded-full"></span>
              Consignes Stock
            </h2>
            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
              <span className={`text-[10px] font-black uppercase tracking-widest ${!isEditOrderMode ? 'text-indigo-600' : 'text-slate-400'}`}>Saisie Consignes</span>
              <button onClick={() => setIsEditOrderMode(!isEditOrderMode)} className={`relative w-10 h-5 rounded-full transition-colors ${isEditOrderMode ? 'bg-indigo-600' : 'bg-slate-200'}`} aria-label="Changer le mode d'édition"><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isEditOrderMode ? 'left-6' : 'left-1'}`}></div></button>
              <span className={`text-[10px] font-black uppercase tracking-widest ${isEditOrderMode ? 'text-indigo-600' : 'text-slate-400'}`}>Éditer Ordre</span>
            </div>
          </div>
        </div>
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map(i => <div key={i} className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Filtre Espace {i + 1}</label><select value={filters[i]} onChange={(e) => handleFilterChange(i, e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-600 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm"><option value="none">-- Aucun --</option><option value="all">Tous les espaces</option>{storages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>)}
            </div>
            <div className="flex items-start gap-2 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                <svg className="w-4 h-4 text-indigo-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-[10px] text-slate-500 font-medium leading-tight">
                    <strong className="text-indigo-700">Configuration requise :</strong> Pour saisir une consigne, assurez-vous que la priorité de l'article dans l'espace de stockage est supérieure à 0 (Menu Configuration &gt; Priorités Stock). La saisie est désactivée pour les emplacements à priorité 0.
                </p>
            </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
            <tr>
              <th className="p-6 sticky left-0 bg-white z-20 border-r shadow-[1px_0_0_0_#e2e8f0]">Article</th>
              {orderedStoragesWithLabels.map(s => (
                <th key={s.id} className={`p-6 text-center border-r min-w-[160px] transition-all ${s.id === 's0' ? 'bg-amber-50/50 text-amber-600' : ''}`}>
                  <div className="flex flex-col items-center gap-2">
                      <span className="whitespace-nowrap">{s.name}</span>
                      {isEditOrderMode && (
                          <div className="mt-1 group">
                              <label className="block text-[8px] text-indigo-400 mb-1 font-black">POS</label>
                              <input 
                                  type="number" 
                                  className="w-14 bg-white border border-indigo-200 rounded-lg p-1 text-center text-indigo-600 font-black" 
                                  value={storagePositions[s.id] ?? (s.order ?? 0)} 
                                  onChange={(e) => handlePositionChange(s.id, parseInt(e.target.value) || 0)} 
                                  onBlur={(e) => handlePositionBlur(s.id, parseInt(e.target.value) || 0)}
                              />
                          </div>
                      )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map(item => (
              <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="p-6 font-bold text-sm sticky left-0 bg-white z-10 border-r shadow-[2px_0_5px_rgba(0,0,0,0.02)]">{item.name}</td>
                {orderedStoragesWithLabels.map(s => {
                  const consigne = consignes.find(c => c.itemId === item.id && c.storageId === s.id);
                  const priority = priorities.find(p => p.itemId === item.id && p.storageId === s.id);
                  const currentVal = consigne?.minQuantity || 0;
                  const inputKey = `${item.id}-${s.id}`;
                  
                  const displayValue = editingValue?.key === inputKey 
                    ? editingValue.val 
                    : currentVal.toString().replace('.', ',');
                    
                  // FIX: Traiter undefined comme 0 explicitement.
                  const priorityVal = priority?.priority ?? 0;
                  const isZeroPriority = priorityVal === 0 && s.id !== 's0';
                  
                  return (
                    <td key={s.id} className={`p-4 text-center border-r transition-opacity relative ${isEditOrderMode ? 'opacity-40 select-none' : 'opacity-100'} ${s.id === 's0' ? 'bg-amber-50/10' : ''}`}>
                      <div className="flex justify-center">
                        <input 
                            type="text" 
                            inputMode="decimal" 
                            disabled={isEditOrderMode || isZeroPriority} 
                            className={`w-24 p-3 border border-slate-200 rounded-2xl text-center font-black text-lg text-slate-900 outline-none transition-all ${isZeroPriority ? 'bg-slate-100 opacity-50 cursor-not-allowed' : 'bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500'}`} 
                            value={displayValue} 
                            onChange={e => handleInputChange(item.id, s.id, e.target.value)}
                            onBlur={e => handleInputBlur(item.id, s.id, e.target.value)}
                            onFocus={e => e.target.select()}
                        />
                      </div>
                      {isZeroPriority && !isEditOrderMode && (
                        <div className="absolute top-2 right-2 w-4 h-4 bg-slate-300 rounded-full flex items-center justify-center shadow-sm" title="Priorité 0 : Saisie désactivée">
                            <span className="text-white font-bold text-[10px]">✕</span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Consignes;