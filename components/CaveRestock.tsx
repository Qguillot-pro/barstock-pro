import React, { useMemo, useState } from 'react';
import { StockItem, StorageSpace, StockLevel, StockConsigne, Category, StockPriority, Transaction, UnfulfilledOrder, PendingOrder } from '../types';

interface RestockProps {
  items: StockItem[];
  storages: StorageSpace[];
  stockLevels: StockLevel[];
  consignes: StockConsigne[];
  priorities: StockPriority[];
  transactions: Transaction[];
  onAction: (itemId: string, storageId: string, qtyNeeded: number, qtyToOrder?: number, isRupture?: boolean) => void;
  categories: Category[];
  unfulfilledOrders: UnfulfilledOrder[];
  onCreateTemporaryItem: (name: string, quantity: number) => void;
  orders: PendingOrder[];
}

// Structure détaillée pour un emplacement spécifique
interface NeedDetail {
  storage: StorageSpace;
  currentQty: number;
  minQty: number;
  gap: number;
  priority: number;
}

// Structure regroupée par article
interface AggregatedNeed {
  item: StockItem;
  totalGap: number;
  maxPriority: number; // La priorité la plus haute parmi les besoins de cet article
  details: NeedDetail[];
  isUrgent?: boolean;
}

const CaveRestock: React.FC<RestockProps> = ({ items, storages, stockLevels, consignes, transactions, priorities, onAction, categories, unfulfilledOrders, onCreateTemporaryItem, orders }) => {
  // On garde selectedNeed pointant vers un détail spécifique pour réutiliser la modale existante
  const [selectedDetail, setSelectedDetail] = useState<{ item: StockItem, detail: NeedDetail } | null>(null);
  const [isTempItemModalOpen, setIsTempItemModalOpen] = useState(false);
  
  const [partialQty, setPartialQty] = useState<string>('');
  const [partialRestocks, setPartialRestocks] = useState<Set<string>>(new Set());

  // Champs pour l'article temporaire
  const [tempItemName, setTempItemName] = useState('');
  const [tempItemQty, setTempItemQty] = useState<number>(0);

  // Fonction pour déterminer si un item a déjà été remonté aujourd'hui
  const isRestockedToday = (itemId: string, storageId: string) => {
    const now = new Date();
    const startOfShift = new Date(now);
    if (now.getHours() < 4) {
        startOfShift.setDate(now.getDate() - 1);
    }
    startOfShift.setHours(4, 0, 0, 0);

    return transactions.some(t => {
        const tDate = new Date(t.date);
        return t.isCaveTransfer && 
               t.itemId === itemId && 
               t.storageId === storageId && 
               tDate >= startOfShift;
    });
  };
  
  // Vérifie si un item est en rupture client "active" (date < 24h)
  const isUrgentUnfulfilled = (itemId: string) => {
      const limit = new Date();
      limit.setHours(limit.getHours() - 24);
      return unfulfilledOrders.some(u => u.itemId === itemId && new Date(u.date) > limit);
  };

  // Vérifie si un item a été déclaré en rupture (via commande ou rupture client) AUJOURD'HUI
  const isRuptureToday = (itemId: string) => {
      const now = new Date();
      const startOfShift = new Date(now);
      if (now.getHours() < 4) {
          startOfShift.setDate(now.getDate() - 1);
      }
      startOfShift.setHours(4, 0, 0, 0);

      // Vérif rupture client
      const hasClientRupture = unfulfilledOrders.some(u => u.itemId === itemId && new Date(u.date) >= startOfShift);
      
      // Vérif commande "rupture"
      const hasStockRupture = orders.some(o => o.itemId === itemId && o.ruptureDate && new Date(o.ruptureDate) >= startOfShift);

      return hasClientRupture || hasStockRupture;
  };

  // Calcul des besoins de réassort regroupés par Article
  const aggregatedNeeds = useMemo<AggregatedNeed[]>(() => {
    const map = new Map<string, AggregatedNeed>();

    consignes.forEach(consigne => {
        const item = items.find(i => i.id === consigne.itemId);
        const storage = storages.find(s => s.id === consigne.storageId);
        
        if (!item || !storage) return;

        // 1. Récupération de la priorité
        const priorityObj = priorities.find(p => p.itemId === item.id && p.storageId === storage.id);
        let priority = priorityObj ? priorityObj.priority : 0;

        // Exception pour le Surstock (s0) : Priorité implicite élevée si non définie, pour qu'il apparaisse
        if (storage.id === 's0') {
            priority = 11;
        }

        // 2. EXCLUSION STRICTE DES PRIORITÉS 0 (sauf si forcé ci-dessus)
        if (priority === 0) return;

        const level = stockLevels.find(l => l.itemId === consigne.itemId && l.storageId === consigne.storageId);
        const currentQty = level?.currentQuantity || 0;
        const minQty = consigne.minQuantity;

        // Si on est en dessous de la consigne
        if (currentQty < minQty) {
            const rawGap = minQty - currentQty;
            let gap = 0;

            if (minQty <= 1) {
                gap = Math.ceil(rawGap);
            } else {
                gap = Math.floor(rawGap);
            }
            
            if (gap > 0) {
                const detail: NeedDetail = {
                    storage,
                    currentQty,
                    minQty,
                    gap,
                    priority
                };

                if (!map.has(item.id)) {
                    map.set(item.id, {
                        item,
                        totalGap: 0,
                        maxPriority: 0,
                        details: [],
                        isUrgent: isUrgentUnfulfilled(item.id)
                    });
                }

                const entry = map.get(item.id)!;
                entry.details.push(detail);
                entry.totalGap += gap;
                entry.maxPriority = Math.max(entry.maxPriority, priority);
                
                if (isUrgentUnfulfilled(item.id)) entry.isUrgent = true;
            }
        }
    });

    const list = Array.from(map.values());

    list.forEach(agg => {
        agg.details.sort((a, b) => b.priority - a.priority);
    });

    return list.sort((a, b) => {
        if (a.isUrgent !== b.isUrgent) return (b.isUrgent ? 1 : 0) - (a.isUrgent ? 1 : 0);
        
        if (b.maxPriority !== a.maxPriority) {
            return b.maxPriority - a.maxPriority;
        }
        return a.item.name.localeCompare(b.item.name);
    });

  }, [consignes, items, storages, stockLevels, priorities, unfulfilledOrders]);

  const groupedNeeds = useMemo(() => {
    const groups: Record<string, AggregatedNeed[]> = {};
    categories.forEach(c => groups[c] = []);
    
    // Assurer que la catégorie temporaire existe
    if (!groups['Produits Temporaires']) groups['Produits Temporaires'] = [];
    if (!groups['Autre']) groups['Autre'] = []; 

    aggregatedNeeds.forEach(agg => {
        const cat = agg.item.category || 'Autre';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(agg);
    });
    
    return groups;
  }, [aggregatedNeeds, categories]);

  const handleOpenModal = (item: StockItem, detail: NeedDetail) => {
    setSelectedDetail({ item, detail });
    setPartialQty(''); 
  };

  const handleComplete = () => {
    if (selectedDetail) {
        onAction(selectedDetail.item.id, selectedDetail.detail.storage.id, selectedDetail.detail.gap);
        setSelectedDetail(null);
    }
  };

  const handlePartial = () => {
    if (selectedDetail) {
        let normalized = partialQty.replace(',', '.');
        if (normalized === '.') normalized = '0';
        const qty = Math.floor(parseFloat(normalized));

        if (!isNaN(qty) && qty > 0) {
            setPartialRestocks(prev => new Set(prev).add(`${selectedDetail.item.id}-${selectedDetail.detail.storage.id}`));
            const orderQty = Math.max(0, selectedDetail.detail.gap - qty);
            onAction(selectedDetail.item.id, selectedDetail.detail.storage.id, qty, orderQty, true);
            setSelectedDetail(null);
        }
    }
  };

  const handleRupture = () => {
    if (selectedDetail) {
        onAction(selectedDetail.item.id, selectedDetail.detail.storage.id, 0, 0, true);
        setSelectedDetail(null);
    }
  };

  const handleCreateTempItem = () => {
      if (!tempItemName) return;
      onCreateTemporaryItem(tempItemName, tempItemQty);
      setTempItemName('');
      setTempItemQty(0);
      setIsTempItemModalOpen(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 relative">
      {/* MODAL GESTION STOCK */}
      {selectedDetail && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xl animate-in fade-in duration-300">
              <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-500"></div>
                  
                  <div className="space-y-1">
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{selectedDetail.item.name}</h3>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{selectedDetail.detail.storage.name}</p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Manque à combler (Entier)</p>
                      <p className="text-4xl font-black text-rose-500">{selectedDetail.detail.gap}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                      <button 
                          onClick={handleComplete}
                          className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-emerald-200 active:scale-95 transition-all"
                      >
                          Remontée Complète (+{selectedDetail.detail.gap})
                      </button>
                      
                      <div className="relative border-t border-slate-100 pt-3 mt-2">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 text-left">Ou Partielle + Commande</p>
                          <div className="flex gap-2">
                              <input 
                                  type="number" 
                                  step="1"
                                  placeholder="Qté..." 
                                  className="w-24 bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 border-2 rounded-xl text-center font-black text-lg outline-none"
                                  value={partialQty}
                                  onChange={e => { 
                                      if (/^\d*$/.test(e.target.value)) setPartialQty(e.target.value); 
                                  }}
                              />
                              <button 
                                  onClick={handlePartial}
                                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-200 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                                  disabled={!partialQty || parseInt(partialQty) <= 0}
                              >
                                  Valider & Commander
                              </button>
                          </div>
                      </div>

                      <div className="pt-2">
                        <button 
                            onClick={handleRupture}
                            className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all border border-slate-700"
                        >
                            Rupture (Ajouter à commander)
                        </button>
                      </div>
                  </div>

                  <button 
                      onClick={() => setSelectedDetail(null)}
                      className="absolute top-4 right-4 text-slate-300 hover:text-slate-500 p-2"
                  >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
              </div>
          </div>
      )}

      {/* MODAL PRODUIT NON PRÉVU */}
      {isTempItemModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xl animate-in fade-in duration-300">
              <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-500"></div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Produit Non Prévu</h3>
                  <p className="text-slate-500 text-xs font-bold">Création rapide d'un article temporaire en Surstock.</p>

                  <div className="space-y-4">
                      <div className="text-left space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom du produit</label>
                          <input 
                            type="text" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 outline-none focus:border-amber-500 transition-colors"
                            value={tempItemName}
                            onChange={(e) => setTempItemName(e.target.value)}
                            placeholder="Ex: Vin Spécial..."
                            autoFocus
                          />
                      </div>
                      <div className="text-left space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Consigne Surstock (Objectif)</label>
                          <input 
                            type="number"
                            step="1"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 outline-none focus:border-amber-500 transition-colors text-center"
                            value={tempItemQty}
                            onChange={(e) => setTempItemQty(parseInt(e.target.value) || 0)}
                          />
                          <p className="text-[9px] text-slate-400 italic">Si &gt; 0, l'article apparaîtra dans la liste des besoins (Stock actuel: 0).</p>
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                      <button 
                          onClick={() => setIsTempItemModalOpen(false)}
                          className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all"
                      >
                          Annuler
                      </button>
                      <button 
                          onClick={handleCreateTempItem}
                          disabled={!tempItemName}
                          className="py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-amber-200 active:scale-95 transition-all disabled:opacity-50"
                      >
                          Créer
                      </button>
                  </div>
              </div>
          </div>
      )}

      <header className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl border border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h1 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-white">Préparation Cave</h1>
            <p className="text-slate-400 text-xs font-bold mt-1">Trié par priorité décroissante. Stockages à priorité 0 masqués.</p>
        </div>
        <div className="flex items-center gap-4">
            <button 
                onClick={() => setIsTempItemModalOpen(true)}
                className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-amber-900/50 active:scale-95 transition-all flex items-center gap-2"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                Produit non prévu
            </button>
            <div className="bg-white/10 px-4 py-2 rounded-xl text-center">
                <span className="block text-2xl font-black">{aggregatedNeeds.length}</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Articles</span>
            </div>
        </div>
      </header>

      {Object.entries(groupedNeeds).map(([category, aggProducts]: [string, AggregatedNeed[]]) => {
          if (aggProducts.length === 0) return null;
          
          return (
            <div key={category} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b flex items-center gap-3">
                    <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
                    <h2 className="font-black text-slate-800 uppercase tracking-tight text-sm">{category}</h2>
                </div>
                <div className="divide-y divide-slate-100">
                    {aggProducts.map((agg) => {
                        const hasRuptureBadge = isRuptureToday(agg.item.id);
                        
                        return (
                        <div key={agg.item.id} className={`p-5 hover:bg-slate-50 transition-colors ${agg.isUrgent ? 'bg-rose-50/40' : ''}`}>
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                                        {agg.item.name}
                                        {agg.isUrgent && (
                                            <span className="bg-rose-500 text-white text-[9px] px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">URGENT</span>
                                        )}
                                        {agg.item.isTemporary && (
                                            <span className="bg-amber-500 text-white text-[9px] px-2 py-0.5 rounded-full uppercase tracking-widest">TEMP</span>
                                        )}
                                        {hasRuptureBadge && (
                                            <span className="bg-slate-700 text-white text-[9px] px-2 py-0.5 rounded-full uppercase tracking-widest font-black">FAIT / RUPTURE</span>
                                        )}
                                    </h3>
                                    <div className="flex gap-2 mt-1">
                                         <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider text-white ${agg.maxPriority >= 8 ? 'bg-rose-500' : (agg.maxPriority >= 5 ? 'bg-amber-500' : 'bg-indigo-400')}`}>
                                             Prio Max {agg.maxPriority}
                                         </span>
                                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            Manque Total: {agg.totalGap}
                                         </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 pl-4 border-l-2 border-slate-100">
                                {agg.details.map((detail) => {
                                    const alreadyDone = isRestockedToday(agg.item.id, detail.storage.id);
                                    const isPartial = partialRestocks.has(`${agg.item.id}-${detail.storage.id}`);
                                    
                                    return (
                                        <div key={detail.storage.id} className="flex items-center justify-between bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black text-slate-700 uppercase">{detail.storage.name}</span>
                                                    <span className={`text-[8px] font-bold px-1.5 rounded text-white ${detail.priority >= 8 ? 'bg-rose-400' : 'bg-slate-400'}`}>P{detail.priority}</span>
                                                    {alreadyDone && <span className="bg-emerald-100 text-emerald-600 text-[8px] font-black px-1.5 rounded uppercase flex items-center gap-1">✓ Fait</span>}
                                                    {isPartial && <span className="bg-amber-100 text-amber-600 text-[8px] font-black px-1.5 rounded uppercase">Partiel</span>}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                                                    Stock: {detail.currentQty} <span className="text-slate-300">/</span> Cons: {detail.minQty}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <span className="text-lg font-black text-rose-500">+{detail.gap}</span>
                                                </div>
                                                <button 
                                                    onClick={() => handleOpenModal(agg.item, detail)}
                                                    className="bg-white border border-slate-200 hover:bg-indigo-50 text-indigo-600 p-2 rounded-lg shadow-sm active:scale-95 transition-all"
                                                    title="Gérer ce stockage"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                  })}
                </div>
            </div>
          );
      })}

      {aggregatedNeeds.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
              <svg className="w-16 h-16 text-slate-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-bold text-slate-400">Tout est en ordre ! Aucun réapprovisionnement nécessaire.</p>
          </div>
      )}
    </div>
  );
};

export default CaveRestock;