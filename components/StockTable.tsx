import React, { useState, useMemo, useEffect } from 'react';
import { StockItem, StorageSpace, StockLevel, StockConsigne, StockPriority } from '../types';

interface StockTableProps {
  items: StockItem[];
  storages: StorageSpace[];
  stockLevels: StockLevel[];
  consignes?: StockConsigne[]; 
  priorities: StockPriority[];
  onUpdateStock: (itemId: string, storageId: string, qty: number) => void;
}

type FilterLevel = 'ALL' | 'RUPTURE' | 'LOW' | 'OK';

const StockTable: React.FC<StockTableProps> = ({ items, storages, stockLevels, priorities, onUpdateStock, consignes = [] }) => {
  const [activeTab, setActiveTab] = useState<'GLOBAL' | 'PRODUCT' | 'STORAGE'>('GLOBAL');
  const [filterLevel, setFilterLevel] = useState<FilterLevel>('ALL');

  // États pour onglet PRODUIT
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<StockItem | null>(null);

  // États pour onglet STOCKAGE
  const [selectedStorageId, setSelectedStorageId] = useState<string>('');

  // États pour les filtres de colonnes (Vue d'ensemble)
  const [columnFilters, setColumnFilters] = useState<string[]>(['all', 'none', 'none']);

  const [editingValue, setEditingValue] = useState<{ key: string, val: string } | null>(null);

  useEffect(() => {
      // Initialiser les filtres si nécessaire
      if (columnFilters[0] === 'all' && storages.length > 0) {
          // On garde 'all' par défaut
      }
  }, [storages]);

  // --- HANDLERS INPUT ---

  const handleInputChange = (itemId: string, storageId: string, value: string) => {
    if (!/^[0-9]*[.,]?[0-9]*$/.test(value)) return;
    setEditingValue({ key: `${itemId}-${storageId}`, val: value });
  };

  const handleInputBlur = (itemId: string, storageId: string, value: string) => {
    setEditingValue(null);
    let normalized = value.replace(',', '.');
    if (normalized === '.') normalized = '0';
    let num = parseFloat(normalized);
    if (isNaN(num) || num < 0) num = 0; // Prevent negative
    num = Math.round(num * 100) / 100;
    onUpdateStock(itemId, storageId, num);
  };

  const getDisplayValue = (itemId: string, storageId: string) => {
      const qty = stockLevels.find(l => l.itemId === itemId && l.storageId === storageId)?.currentQuantity || 0;
      const key = `${itemId}-${storageId}`;
      return editingValue?.key === key ? editingValue.val : qty.toString().replace('.', ',');
  };

  const getConsigneValue = (itemId: string, storageId: string) => {
      return consignes.find(c => c.itemId === itemId && c.storageId === storageId)?.minQuantity || 0;
  };

  const handleProductSearch = () => {
      const found = items.find(i => i.name.toLowerCase().includes(productSearch.toLowerCase()));
      if (found) setSelectedProduct(found);
      else alert("Produit non trouvé");
  };

  const handleColumnFilterChange = (index: number, value: string) => {
      const newFilters = [...columnFilters];
      newFilters[index] = value;
      setColumnFilters(newFilters);
  };

  // Calcul des colonnes à afficher
  const visibleStorages = useMemo(() => {
      const showAll = columnFilters.includes('all');
      if (showAll) {
          return storages; // Retourne tous les stockages triés par défaut
      }
      // Récupère les IDs sélectionnés qui ne sont pas 'none' ni 'all'
      const activeIds = columnFilters.filter(id => id !== 'none' && id !== 'all');
      // Retourne les stockages correspondants, dans l'ordre des filtres si possible, ou ordre naturel
      return storages.filter(s => activeIds.includes(s.id));
  }, [storages, columnFilters]);

  const filteredItems = items.filter(item => {
      if (filterLevel === 'ALL') return true;
      
      // On filtre pour voir si AU MOINS UN stockage VISIBLE correspond au critère
      return visibleStorages.some(s => {
          const priority = priorities.find(p => p.itemId === item.id && p.storageId === s.id)?.priority ?? 0;
          
          // Si priorité 0 et pas Surstock, on ignore pour le filtre (sauf si on veut explicitement voir les 0)
          if (priority === 0 && s.id !== 's0') return false; 

          const qty = stockLevels.find(l => l.itemId === item.id && l.storageId === s.id)?.currentQuantity || 0;
          const consigne = getConsigneValue(item.id, s.id);
          
          if (filterLevel === 'RUPTURE') return consigne > 0 && qty <= 0;
          if (filterLevel === 'LOW') return consigne > 0 && qty > 0 && qty < consigne;
          if (filterLevel === 'OK') return consigne > 0 && qty >= consigne;
          
          return false;
      });
  });

  return (
    <div className="space-y-6">
      
      {/* TABS NAVIGATION */}
      <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-sm flex max-w-4xl mx-auto flex-col md:flex-row gap-2 md:gap-0">
          <div className="flex-1 flex gap-1 w-full">
            <button 
                onClick={() => setActiveTab('GLOBAL')}
                className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'GLOBAL' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
                Vue d'ensemble
            </button>
            <button 
                onClick={() => setActiveTab('PRODUCT')}
                className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'PRODUCT' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
                Par Produit
            </button>
            <button 
                onClick={() => setActiveTab('STORAGE')}
                className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'STORAGE' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
                Par Espace
            </button>
          </div>
      </div>

      {activeTab === 'GLOBAL' && (
          <div className="bg-white rounded-3xl border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
              
              {/* FILTRES STOCKAGE (3 Colonnes) */}
              <div className="p-4 bg-slate-50 border-b grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[0, 1, 2].map(i => (
                      <div key={i} className="flex flex-col gap-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Filtre Espace {i + 1}</label>
                          <select 
                              value={columnFilters[i]} 
                              onChange={(e) => handleColumnFilterChange(i, e.target.value)} 
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black uppercase text-slate-600 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm cursor-pointer"
                          >
                              <option value="none">-- Aucun --</option>
                              <option value="all">Tous les espaces</option>
                              {storages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                      </div>
                  ))}
              </div>

              {/* FILTRES NIVEAUX (Rupture/Bas/OK) */}
              <div className="p-4 bg-white border-b flex justify-end gap-2 overflow-x-auto">
                  <button onClick={() => setFilterLevel('ALL')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${filterLevel === 'ALL' ? 'bg-slate-800 text-white' : 'bg-white text-slate-400 border'}`}>Tout</button>
                  <button onClick={() => setFilterLevel('RUPTURE')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${filterLevel === 'RUPTURE' ? 'bg-rose-500 text-white' : 'bg-white text-rose-500 border border-rose-100'}`}>Rupture (0)</button>
                  <button onClick={() => setFilterLevel('LOW')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${filterLevel === 'LOW' ? 'bg-blue-500 text-white' : 'bg-white text-blue-500 border border-blue-100'}`}>Bas (&lt; Cons)</button>
                  <button onClick={() => setFilterLevel('OK')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${filterLevel === 'OK' ? 'bg-emerald-500 text-white' : 'bg-white text-emerald-500 border border-emerald-100'}`}>OK (&gt; Cons)</button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        <tr>
                            <th className="p-4 border-r sticky left-0 bg-slate-100 z-10 w-64 shadow-[1px_0_0_0_#e2e8f0]">Produit</th>
                            {visibleStorages.map(s => <th key={s.id} className="p-4 text-center border-r min-w-[140px]">{s.name}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredItems.map(item => (
                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-4 sticky left-0 bg-white z-10 border-r shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm text-slate-900">{item.name}</span>
                                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{item.category}</span>
                                    </div>
                                </td>
                                {visibleStorages.map(s => {
                                    const priority = priorities.find(p => p.itemId === item.id && p.storageId === s.id)?.priority ?? 0;
                                    const stockLevel = stockLevels.find(l => l.itemId === item.id && l.storageId === s.id);
                                    const currentQty = stockLevel?.currentQuantity || 0;
                                    const consigne = getConsigneValue(item.id, s.id);
                                    
                                    const isZeroPriority = priority === 0 && s.id !== 's0';
                                    const showWarning = isZeroPriority && currentQty > 0;
                                    
                                    let inputColorClass = "bg-white border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/10";
                                    if (consigne > 0 && !isZeroPriority) {
                                        if (currentQty <= 0) inputColorClass = "bg-rose-50 border-rose-200 text-rose-600 focus:border-rose-500 focus:ring-rose-500/10";
                                        else if (currentQty < consigne) inputColorClass = "bg-blue-50 border-blue-200 text-blue-600 focus:border-blue-500 focus:ring-blue-500/10";
                                        else inputColorClass = "bg-emerald-50 border-emerald-200 text-emerald-600 focus:border-emerald-500 focus:ring-emerald-500/10";
                                    } else if (isZeroPriority) {
                                        inputColorClass = "bg-slate-50 border-slate-200 text-slate-500";
                                    }

                                    return (
                                        <td key={s.id} className={`p-2 border-r text-center relative ${isZeroPriority ? 'bg-slate-50/30' : ''}`}>
                                            <div className="flex justify-center items-center relative gap-2">
                                                <input 
                                                    type="text"
                                                    inputMode="decimal"
                                                    className={`w-14 border rounded-lg p-2 text-center font-black outline-none transition-all ring-2 ring-transparent focus:bg-white focus:ring-2 ${inputColorClass}`}
                                                    value={getDisplayValue(item.id, s.id)}
                                                    onChange={(e) => handleInputChange(item.id, s.id, e.target.value)}
                                                    onBlur={(e) => handleInputBlur(item.id, s.id, e.target.value)}
                                                    onFocus={(e) => e.target.select()}
                                                />
                                                {consigne > 0 && !isZeroPriority && (
                                                    <span className="text-[10px] font-bold text-slate-300 w-6 text-left">/ {consigne}</span>
                                                )}
                                                {showWarning && (
                                                    <div className="absolute -top-3 -right-2" title="Attention: Stock présent sur un emplacement à priorité 0">
                                                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">!</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                        {filteredItems.length === 0 && (
                            <tr><td colSpan={visibleStorages.length + 1} className="p-12 text-center italic text-slate-400">Aucun produit ne correspond aux filtres.</td></tr>
                        )}
                    </tbody>
                </table>
              </div>
          </div>
      )}

      {/* CONTENT: PRODUCT TAB */}
      {activeTab === 'PRODUCT' && (
          <div className="bg-white rounded-3xl border shadow-sm p-8 space-y-8 animate-in fade-in slide-in-from-bottom-2 max-w-4xl mx-auto">
              <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Rechercher un article</label>
                  <div className="flex gap-2">
                      <input 
                        list="items-list"
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-4 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                        placeholder="Ex: Vodka Absolut..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleProductSearch()}
                      />
                      <datalist id="items-list">
                          {items.map(i => <option key={i.id} value={i.name} />)}
                      </datalist>
                      <button 
                        onClick={handleProductSearch}
                        className="bg-indigo-600 text-white px-8 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                      >
                          Valider
                      </button>
                  </div>
              </div>

              {selectedProduct && (
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                      <h3 className="font-black text-xl text-slate-800 flex items-center gap-2">
                          <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                          {selectedProduct.name}
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {storages.map(storage => {
                              const priority = priorities.find(p => p.itemId === selectedProduct.id && p.storageId === storage.id)?.priority ?? 0;
                              const qty = stockLevels.find(l => l.itemId === selectedProduct.id && l.storageId === storage.id)?.currentQuantity || 0;
                              const consigne = getConsigneValue(selectedProduct.id, storage.id);
                              
                              const isZero = priority === 0 && storage.id !== 's0';
                              // Afficher si priorité > 0, ou si c'est s0, ou s'il y a du stock (même si prio 0 pour corriger)
                              if (isZero && qty === 0) return null;

                              let inputColorClass = "bg-white border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/10";
                              if (consigne > 0 && !isZero) {
                                  if (qty <= 0) inputColorClass = "bg-rose-50 border-rose-200 text-rose-600 focus:border-rose-500";
                                  else if (qty < consigne) inputColorClass = "bg-blue-50 border-blue-200 text-blue-600 focus:border-blue-500";
                                  else inputColorClass = "bg-emerald-50 border-emerald-200 text-emerald-600 focus:border-emerald-500";
                              }

                              return (
                                  <div key={storage.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                      <div className="flex flex-col">
                                          <span className="font-bold text-sm text-slate-600 uppercase">{storage.name}</span>
                                          {isZero && <span className="text-[9px] font-black text-amber-500 uppercase">Attention: Priorité 0</span>}
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <input 
                                            type="text"
                                            inputMode="decimal"
                                            className={`w-24 rounded-xl p-3 text-center font-black text-lg outline-none border focus:ring-4 transition-all ${inputColorClass}`}
                                            value={getDisplayValue(selectedProduct.id, storage.id)}
                                            onChange={(e) => handleInputChange(selectedProduct.id, storage.id, e.target.value)}
                                            onBlur={(e) => handleInputBlur(selectedProduct.id, storage.id, e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                        />
                                        {consigne > 0 && !isZero && <span className="text-xs font-black text-slate-300">/ {consigne}</span>}
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  </div>
              )}
          </div>
      )}

      {/* CONTENT: STORAGE TAB */}
      {activeTab === 'STORAGE' && (
          <div className="bg-white rounded-3xl border shadow-sm p-8 space-y-8 animate-in fade-in slide-in-from-bottom-2 max-w-4xl mx-auto">
              <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Sélectionner un espace</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer"
                    value={selectedStorageId}
                    onChange={(e) => setSelectedStorageId(e.target.value)}
                  >
                      <option value="">-- Choisir un espace --</option>
                      {storages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
              </div>

              {selectedStorageId && (
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                      <div className="overflow-y-auto max-h-[60vh] pr-2 space-y-3">
                          {items.map(item => {
                              const priority = priorities.find(p => p.itemId === item.id && p.storageId === selectedStorageId)?.priority ?? 0;
                              const qty = stockLevels.find(l => l.itemId === item.id && l.storageId === selectedStorageId)?.currentQuantity || 0;
                              const consigne = getConsigneValue(item.id, selectedStorageId);

                              const isZero = priority === 0 && selectedStorageId !== 's0';
                              if (isZero && qty === 0) return null;

                              let inputColorClass = "bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-indigo-500/10";
                              if (consigne > 0 && !isZero) {
                                  if (qty <= 0) inputColorClass = "bg-rose-50 border-rose-200 text-rose-600 focus:bg-white focus:border-rose-500";
                                  else if (qty < consigne) inputColorClass = "bg-blue-50 border-blue-200 text-blue-600 focus:bg-white focus:border-blue-500";
                                  else inputColorClass = "bg-emerald-50 border-emerald-200 text-emerald-600 focus:bg-white focus:border-emerald-500";
                              }

                              return (
                                  <div key={item.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl border-b border-slate-50 last:border-0 transition-colors">
                                      <div className="flex flex-col">
                                          <span className="font-bold text-sm text-slate-800">{item.name}</span>
                                          {isZero && <span className="text-[8px] font-black text-amber-500 uppercase">Non prévu ici (Prio 0)</span>}
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <input 
                                            type="text"
                                            inputMode="decimal"
                                            className={`w-20 border rounded-lg p-2 text-center font-black outline-none focus:ring-2 transition-all ${inputColorClass}`}
                                            value={getDisplayValue(item.id, selectedStorageId)}
                                            onChange={(e) => handleInputChange(item.id, selectedStorageId, e.target.value)}
                                            onBlur={(e) => handleInputBlur(item.id, selectedStorageId, e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                        />
                                        {consigne > 0 && !isZero && <span className="text-xs font-black text-slate-300 w-8">/ {consigne}</span>}
                                      </div>
                                  </div>
                              );
                          })}
                          {items.filter(item => {
                              const priority = priorities.find(p => p.itemId === item.id && p.storageId === selectedStorageId)?.priority ?? 0;
                              const qty = stockLevels.find(l => l.itemId === item.id && l.storageId === selectedStorageId)?.currentQuantity || 0;
                              return priority > 0 || selectedStorageId === 's0' || qty > 0;
                          }).length === 0 && (
                              <p className="text-center text-slate-400 italic py-8">Aucun article configuré pour cet espace.</p>
                          )}
                      </div>
                  </div>
              )}
          </div>
      )}

    </div>
  );
};

export default StockTable;