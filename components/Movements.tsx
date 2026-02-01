import React, { useState, useMemo } from 'react';
import { StockItem, Transaction, StorageSpace, UnfulfilledOrder, Format } from '../types';

interface MovementsProps {
  items: StockItem[];
  transactions: Transaction[];
  storages: StorageSpace[];
  onTransaction: (itemId: string, type: 'IN' | 'OUT', qty: number) => void;
  onOpenKeypad: (config: any) => void;
  unfulfilledOrders: UnfulfilledOrder[];
  onReportUnfulfilled: (itemId: string) => void;
  onCreateTemporaryItem?: (name: string, quantity: number) => void;
  formats: Format[];
}

const Movements: React.FC<MovementsProps> = ({ items, transactions, storages, onTransaction, unfulfilledOrders, onReportUnfulfilled, onCreateTemporaryItem, formats }) => {
  const [activeTab, setActiveTab] = useState<'MOVEMENTS' | 'UNFULFILLED'>('MOVEMENTS');
  
  const [search, setSearch] = useState('');
  const [qty, setQty] = useState<string>('1');
  
  const [unfulfilledSearch, setUnfulfilledSearch] = useState('');

  const [dlcModalOpen, setDlcModalOpen] = useState(false);
  const [pendingDlcItem, setPendingDlcItem] = useState<StockItem | null>(null);

  const [isTempItemModalOpen, setIsTempItemModalOpen] = useState(false);
  const [tempItemName, setTempItemName] = useState('');
  const [tempItemQty, setTempItemQty] = useState<number>(0);

  const handleAction = (type: 'IN' | 'OUT') => {
    const searchNormalized = search.trim().toLowerCase();
    const item = items.find(i => i.name.trim().toLowerCase() === searchNormalized);

    if (!item) {
        alert(`Produit "${search}" introuvable.\nVeuillez sélectionner un produit existant dans la liste.`);
        return;
    }

    let normalized = qty.replace(',', '.');
    if (normalized === '.') normalized = '0';
    let quantity = parseFloat(normalized);
    
    if (isNaN(quantity) || quantity <= 0) {
        quantity = 1;
    }

    if (type === 'OUT' && item.isDLC) {
        setPendingDlcItem(item);
        setDlcModalOpen(true);
    } else {
        onTransaction(item.id, type, quantity);
        setSearch('');
        setQty('1');
    }
  };

  const confirmDlcAction = () => {
    if (pendingDlcItem) {
        let normalized = qty.replace(',', '.');
        if (normalized === '.') normalized = '0';
        const quantity = parseFloat(normalized) || 1;
        
        onTransaction(pendingDlcItem.id, 'OUT', quantity);
        setSearch('');
        setQty('1');
        setDlcModalOpen(false);
        setPendingDlcItem(null);
    }
  };

  const handleAddUnfulfilled = () => {
      const searchNormalized = unfulfilledSearch.trim().toLowerCase();
      const item = items.find(i => i.name.trim().toLowerCase() === searchNormalized);
      
      if (item) {
          if (window.confirm(`Déclarer une rupture client pour "${item.name}" ?\n\nCela mettra tous les stocks de ce produit à 0 et le marquera comme URGENT.`)) {
              onReportUnfulfilled(item.id);
              setUnfulfilledSearch('');
          }
      } else {
          alert(`Produit "${unfulfilledSearch}" introuvable.\nAssurez-vous de sélectionner un produit existant dans la liste.`);
      }
  };

  const handleExportUnfulfilled = () => {
    if (unfulfilledOrders.length === 0) return;
    
    let csv = "\uFEFFDate,Heure,Utilisateur,Produit,Format\n";
    unfulfilledOrders.forEach(u => {
      const it = items.find(i => i.id === u.itemId);
      const fmt = formats.find(f => f.id === it?.formatId);
      const d = new Date(u.date);
      csv += `"${d.toLocaleDateString()}","${d.toLocaleTimeString()}","${u.userName || '-'}","${it?.name || 'Inconnu'}","${fmt?.name || 'N/A'}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ruptures_clients_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  const handleCreateTempItem = () => {
      if (!tempItemName || !onCreateTemporaryItem) return;
      onCreateTemporaryItem(tempItemName, tempItemQty);
      setTempItemName('');
      setTempItemQty(0);
      setIsTempItemModalOpen(false);
  };

  const groupedTransactions = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    // Type étendu pour inclure les noms de stockages
    const grouped: (Transaction & { count: number, storageNames: Set<string> })[] = [];
    
    sorted.forEach((current) => {
        const currentQty = Number(current.quantity);
        const currentStorageName = storages.find(s => s.id === current.storageId)?.name || 'Inconnu';

        if (grouped.length === 0) {
            grouped.push({ 
                ...current, 
                quantity: currentQty, 
                count: 1,
                storageNames: new Set([currentStorageName])
            });
            return;
        }

        const last = grouped[grouped.length - 1];
        const currentDate = new Date(current.date);
        const lastDate = new Date(last.date);
        
        const isSameTime = Math.abs(currentDate.getTime() - lastDate.getTime()) < 60000;
        const isSameItem = current.itemId === last.itemId;
        const isSameType = current.type === last.type;
        // On NE groupe PAS par storageId pour permettre le regroupement multi-stockage
        const isSameUser = current.userName === last.userName;

        if (isSameTime && isSameItem && isSameType && isSameUser) {
            last.quantity = Number(last.quantity) + currentQty;
            last.count += 1;
            last.storageNames.add(currentStorageName);
        } else {
            grouped.push({ 
                ...current, 
                quantity: currentQty, 
                count: 1,
                storageNames: new Set([currentStorageName])
            });
        }
    });

    return grouped.slice(0, 50);
  }, [transactions, storages]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto relative">
      {/* DLC MODAL */}
      {dlcModalOpen && pendingDlcItem && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl border border-slate-200 text-center space-y-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-amber-500"></div>
                <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Rappel DLC</h3>
                    <p className="text-slate-500 font-bold">Merci d'apposer l'étiquette DLC sur le produit :</p>
                    <p className="text-xl font-black text-indigo-600">{pendingDlcItem.name}</p>
                </div>
                <div className="flex gap-4 pt-4">
                    <button onClick={() => setDlcModalOpen(false)} className="flex-1 bg-slate-100 text-slate-400 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all">Annuler</button>
                    <button onClick={confirmDlcAction} className="flex-1 bg-amber-500 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-amber-600 shadow-xl shadow-amber-200 transition-all active:scale-95">Valider</button>
                </div>
            </div>
        </div>
      )}

      {/* PRODUIT NON PREVU MODAL */}
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
                      <button onClick={() => setIsTempItemModalOpen(false)} className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all">Annuler</button>
                      <button onClick={handleCreateTempItem} disabled={!tempItemName} className="py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-amber-200 active:scale-95 transition-all disabled:opacity-50">Créer</button>
                  </div>
              </div>
          </div>
      )}

      {/* Tabs */}
      <div className="flex bg-slate-200 p-1 rounded-2xl">
          <button 
              onClick={() => setActiveTab('MOVEMENTS')}
              className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'MOVEMENTS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
              Mouvements Standards
          </button>
          <button 
              onClick={() => setActiveTab('UNFULFILLED')}
              className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'UNFULFILLED' ? 'bg-white text-rose-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
              Commandes non-honorées
          </button>
      </div>

      {activeTab === 'MOVEMENTS' && (
        <>
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-sm font-black uppercase flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-indigo-600 rounded-full"></span>
                        Nouveau Mouvement
                    </h2>
                    {onCreateTemporaryItem && (
                        <button 
                            onClick={() => setIsTempItemModalOpen(true)}
                            className="bg-amber-50 text-amber-600 px-3 py-1.5 rounded-lg font-black text-[9px] uppercase hover:bg-amber-100 transition-colors flex items-center gap-1 border border-amber-100"
                        >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Produit non prévu
                        </button>
                    )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Produit</label>
                    <input 
                    list="items-list" 
                    className="w-full bg-slate-50 p-3 border rounded-xl outline-none font-bold" 
                    placeholder="Rechercher produit..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    />
                    <datalist id="items-list">
                    {items.map(i => <option key={i.id} value={i.name} />)}
                    </datalist>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantité</label>
                    <input 
                    type="text"
                    inputMode="decimal"
                    className="w-full bg-slate-50 p-3 border rounded-xl outline-none font-bold text-center" 
                    value={qty}
                    onChange={e => {
                        if (/^[0-9]*[.,]?[0-9]*$/.test(e.target.value)) setQty(e.target.value);
                    }}
                    />
                </div>
                </div>

                <div className="flex gap-4">
                <button 
                    className="flex-1 bg-rose-500 text-white py-4 rounded-xl font-black uppercase text-xs hover:bg-rose-600 transition-all shadow-lg shadow-rose-100"
                    onClick={() => handleAction('OUT')}
                >
                    Sortie (-)
                </button>
                <button 
                    className="flex-1 bg-emerald-500 text-white py-4 rounded-xl font-black uppercase text-xs hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100"
                    onClick={() => handleAction('IN')}
                >
                    Entrée (+)
                </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b">
                    <h3 className="font-black text-slate-800 uppercase tracking-tight text-[10px]">Historique récent (Regroupé)</h3>
                </div>
                <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-left">
                    <thead className="bg-white text-[9px] uppercase text-slate-400 font-black tracking-widest border-b">
                    <tr>
                        <th className="p-4">Date</th>
                        <th className="p-4">Utilisateur</th>
                        <th className="p-4">Produit</th>
                        <th className="p-4 text-right">Qté</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y">
                    {groupedTransactions.map((t, idx) => {
                        const item = items.find(i => i.id === t.itemId);
                        const storageNames = Array.from(t.storageNames).join(' / ');
                        return (
                        <tr key={`${t.id}-${idx}`} className="hover:bg-slate-50">
                            <td className="p-4 text-[10px] text-slate-400">
                                {new Date(t.date).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-4">
                                <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase tracking-wider">{t.userName || 'Inconnu'}</span>
                            </td>
                            <td className="p-4">
                                <div className="flex flex-col">
                                    <span className="font-bold text-sm flex items-center gap-2">
                                        {item?.name || 'Inconnu'}
                                        {item?.isTemporary && (
                                            <span className="bg-amber-500 text-white text-[8px] px-1.5 py-0.5 rounded uppercase tracking-widest">TEMP</span>
                                        )}
                                    </span>
                                    <span className="text-[9px] text-slate-400 uppercase">
                                        ({storageNames})
                                    </span>
                                </div>
                            </td>
                            <td className={`p-4 font-black text-right ${t.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {t.type === 'IN' ? '+' : '-'}{parseFloat(Number(t.quantity).toFixed(2))}
                            </td>
                        </tr>
                        );
                    })}
                    </tbody>
                </table>
                </div>
            </div>
        </>
      )}

      {activeTab === 'UNFULFILLED' && (
         <>
            <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 shadow-sm">
                <h2 className="text-sm font-black uppercase mb-2 flex items-center gap-2 text-rose-700">
                <span className="w-1.5 h-4 bg-rose-500 rounded-full"></span>
                Déclarer une Rupture Client
                </h2>
                <p className="text-[10px] text-rose-500 mb-6 font-medium">Ajoute le produit à la liste des manques urgents et met les stocks à 0.</p>
                
                <div className="flex gap-2">
                    <input 
                    list="items-list-unfulfilled" 
                    className="flex-1 bg-white p-3 border border-rose-200 rounded-xl outline-none font-bold text-rose-900 placeholder-rose-300" 
                    placeholder="Produit manquant..."
                    value={unfulfilledSearch}
                    onChange={e => setUnfulfilledSearch(e.target.value)}
                    />
                    <datalist id="items-list-unfulfilled">
                       {items.map(i => <option key={i.id} value={i.name} />)}
                    </datalist>
                    <button 
                        onClick={handleAddUnfulfilled}
                        className="bg-rose-500 text-white px-6 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-rose-600 transition-all shadow-lg shadow-rose-200 active:scale-95"
                    >
                        Ajouter
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden min-h-[200px] flex flex-col">
                <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                    <h3 className="font-black text-slate-800 uppercase tracking-tight text-[10px]">Historique Ruptures Clients</h3>
                    <button 
                        onClick={handleExportUnfulfilled} 
                        disabled={unfulfilledOrders.length === 0}
                        className={`text-[10px] font-black uppercase tracking-widest transition-colors ${unfulfilledOrders.length === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-indigo-600 hover:text-indigo-800 hover:underline'}`}
                    >
                        Exporter CSV
                    </button>
                </div>
                <div className="max-h-80 overflow-y-auto flex-1">
                <table className="w-full text-left">
                    <thead className="bg-white text-[9px] uppercase text-slate-400 font-black tracking-widest border-b sticky top-0">
                    <tr>
                        <th className="p-4">Date</th>
                        <th className="p-4">Heure</th>
                        <th className="p-4">Utilisateur</th>
                        <th className="p-4">Produit</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y">
                    {unfulfilledOrders.map((u) => {
                        const item = items.find(i => i.id === u.itemId);
                        const d = new Date(u.date);
                        return (
                        <tr key={u.id} className="hover:bg-slate-50">
                            <td className="p-4 text-[10px] font-bold text-slate-600">
                                {d.toLocaleDateString()}
                            </td>
                            <td className="p-4 text-[10px] font-bold text-slate-400">
                                {d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                            </td>
                            <td className="p-4">
                                <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase tracking-wider">{u.userName || '-'}</span>
                            </td>
                            <td className="p-4">
                                <span className="font-black text-sm text-rose-600">{item?.name || 'Inconnu'}</span>
                            </td>
                        </tr>
                        );
                    })}
                    {unfulfilledOrders.length === 0 && (
                        <tr><td colSpan={4} className="p-12 text-center text-slate-400 italic text-sm">Aucune commande non-honorée enregistrée.</td></tr>
                    )}
                    </tbody>
                </table>
                </div>
            </div>
         </>
      )}
    </div>
  );
};

export default Movements;