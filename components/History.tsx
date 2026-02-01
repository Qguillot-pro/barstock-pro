import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, PendingOrder, StockItem, StorageSpace, UnfulfilledOrder, Format } from '../types';

interface HistoryProps {
  transactions: Transaction[];
  orders: PendingOrder[];
  items: StockItem[];
  storages: StorageSpace[];
  unfulfilledOrders: UnfulfilledOrder[];
  onUpdateOrderQuantity?: (orderIds: string[], newQuantity: number) => void;
  formats: Format[];
}

type PeriodFilter = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

const History: React.FC<HistoryProps> = ({ transactions, orders, items, storages, unfulfilledOrders, onUpdateOrderQuantity, formats }) => {
  const [activeTab, setActiveTab] = useState<'MOVEMENTS' | 'CLIENT_RUPTURE' | 'STOCK_RUPTURE' | 'RECEIVED'>('MOVEMENTS');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('DAY');
  
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth()); 
  const [selectedWeek, setSelectedWeek] = useState<string>(''); 
  const [selectedDay, setSelectedDay] = useState<string>(new Date().toISOString().split('T')[0]); 

  const [editedQuantities, setEditedQuantities] = useState<Record<string, number>>({});
  const [validatedGroups, setValidatedGroups] = useState<Set<string>>(() => {
      const saved = localStorage.getItem('barstock_validated_receipts');
      return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  useEffect(() => {
      localStorage.setItem('barstock_validated_receipts', JSON.stringify(Array.from(validatedGroups)));
  }, [validatedGroups]);

  const availableWeeks = useMemo(() => {
      const weeks = [];
      const d = new Date(selectedYear, 0, 1);
      while (d.getDay() !== 1) {
          d.setDate(d.getDate() + 1);
      }
      
      let weekNum = 1;
      const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

      while (d.getFullYear() === selectedYear) {
          const weekStart = new Date(d);
          const weekEnd = new Date(d);
          weekEnd.setDate(weekEnd.getDate() + 6);
          
          const label = `S${weekNum} (${monthNames[weekStart.getMonth()]})`;
          const value = weekNum.toString();
          
          weeks.push({ value, label, start: weekStart, end: weekEnd });
          
          d.setDate(d.getDate() + 7);
          weekNum++;
      }
      return weeks;
  }, [selectedYear]);

  useEffect(() => {
      if (availableWeeks.length > 0 && !selectedWeek) {
         const now = new Date();
         const current = availableWeeks.find(w => now >= w.start && now <= w.end);
         setSelectedWeek(current ? current.value : availableWeeks[0].value);
      }
  }, [availableWeeks, selectedWeek]);


  const getBarDate = (date: Date) => {
    const d = new Date(date);
    if (d.getHours() < 4) {
      d.setDate(d.getDate() - 1);
    }
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const checkDateInFilter = (dateStr: string) => {
      const date = new Date(dateStr);
      const barDate = new Date(date);
      if (barDate.getHours() < 4) {
          barDate.setDate(barDate.getDate() - 1);
      }

      if (periodFilter === 'DAY') {
          const target = new Date(selectedDay);
          return barDate.getFullYear() === target.getFullYear() &&
                 barDate.getMonth() === target.getMonth() &&
                 barDate.getDate() === target.getDate();
      }

      if (periodFilter === 'WEEK') {
          const weekObj = availableWeeks.find(w => w.value === selectedWeek);
          if (!weekObj) return false;
          const evtDate = new Date(dateStr); 
          return evtDate >= weekObj.start && evtDate <= weekObj.end;
      }

      if (periodFilter === 'MONTH') {
          return barDate.getFullYear() === selectedYear && barDate.getMonth() === selectedMonth;
      }

      if (periodFilter === 'YEAR') {
          return barDate.getFullYear() === selectedYear;
      }

      return true;
  };

  const filteredTransactions = useMemo(() => {
    return transactions
        .filter(t => checkDateInFilter(t.date))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, periodFilter, selectedDay, selectedWeek, selectedMonth, selectedYear, availableWeeks]);

  const filteredUnfulfilled = useMemo(() => {
      return unfulfilledOrders
        .filter(u => checkDateInFilter(u.date))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [unfulfilledOrders, periodFilter, selectedDay, selectedWeek, selectedMonth, selectedYear, availableWeeks]);
  
  const filteredReceived = useMemo(() => {
      return orders.filter(o => o.status === 'RECEIVED' && o.receivedAt && checkDateInFilter(o.receivedAt));
  }, [orders, periodFilter, selectedDay, selectedWeek, selectedMonth, selectedYear, availableWeeks]);

  const filteredPending = useMemo(() => {
      return orders.filter(o => o.status !== 'RECEIVED' && o.ruptureDate && checkDateInFilter(o.ruptureDate));
  }, [orders, periodFilter, selectedDay, selectedWeek, selectedMonth, selectedYear, availableWeeks]);

  const displayTransactions = useMemo(() => {
    const grouped: Transaction[] = [];
    filteredTransactions.forEach((current) => {
        const currentQty = Number(current.quantity);
        if (grouped.length === 0) {
            grouped.push({ ...current, quantity: currentQty });
            return;
        }
        const last = grouped[grouped.length - 1];
        const currentDate = new Date(current.date);
        const lastDate = new Date(last.date);
        const isSameTime = Math.abs(currentDate.getTime() - lastDate.getTime()) < 60000; 
        const isSameItem = current.itemId === last.itemId;
        const isSameType = current.type === last.type;
        const isSameUser = current.userName === last.userName;
        if (isSameTime && isSameItem && isSameType && isSameUser) {
            last.quantity = Number(last.quantity) + currentQty;
        } else {
            grouped.push({ ...current, quantity: currentQty });
        }
    });
    return grouped;
  }, [filteredTransactions]);

  const groupedReceivedOrders = useMemo(() => {
    const dayGroups: Record<string, { date: Date, items: Record<string, { item: StockItem, orders: PendingOrder[], totalQty: number, initialQty: number }> }> = {};

    filteredReceived.forEach(o => {
        if (!o.receivedAt) return;
        const item = items.find(i => i.id === o.itemId);
        if (!item) return;

        const date = new Date(o.receivedAt);
        const barDate = getBarDate(date);
        const dateKey = barDate.toISOString().split('T')[0];

        if (!dayGroups[dateKey]) {
            dayGroups[dateKey] = { date: barDate, items: {} };
        }

        if (!dayGroups[dateKey].items[item.id]) {
            dayGroups[dateKey].items[item.id] = { item, orders: [], totalQty: 0, initialQty: 0 };
        }

        dayGroups[dateKey].items[item.id].orders.push(o);
        dayGroups[dateKey].items[item.id].totalQty += o.quantity;
        // Si initialQuantity n'est pas défini, on suppose qu'il était égal à la quantité reçue (ou on met 0)
        dayGroups[dateKey].items[item.id].initialQty += (o.initialQuantity ?? o.quantity);
    });
    
    return Object.entries(dayGroups)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([key, data]) => ({
            key,
            dateLabel: data.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
            items: Object.values(data.items)
        }));

  }, [filteredReceived, items]);

  const handleQuantityChange = (groupKey: string, val: string) => {
      if (/^\d*$/.test(val)) {
          setEditedQuantities(prev => ({ ...prev, [groupKey]: parseInt(val) || 0 }));
      }
  };

  const handleValidateReceipt = (groupKey: string, ids: string[], qty: number) => {
      if (onUpdateOrderQuantity) {
          onUpdateOrderQuantity(ids, qty);
          setValidatedGroups(prev => new Set(prev).add(groupKey));
      }
  };

  const getFormatName = (formatId?: string) => {
      return formats.find(f => f.id === formatId)?.name || 'N/A';
  };

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    let filename = "export.csv";

    if (activeTab === 'MOVEMENTS') {
        filename = `mouvements_${periodFilter}_${new Date().toISOString().slice(0,10)}.csv`;
        csvContent += "Date,Heure,Utilisateur,Produit,Format,Type,Quantité\n";
        displayTransactions.forEach(t => {
            const item = items.find(i => i.id === t.itemId);
            const d = new Date(t.date);
            const fmt = getFormatName(item?.formatId);
            csvContent += `"${d.toLocaleDateString()}","${d.toLocaleTimeString()}","${t.userName || '-'}","${item?.name || 'Inconnu'}","${fmt}","${t.type}","${t.quantity}"\n`;
        });
    } else if (activeTab === 'CLIENT_RUPTURE') {
        filename = `ruptures_clients_${periodFilter}_${new Date().toISOString().slice(0,10)}.csv`;
        csvContent += "Date,Heure,Utilisateur,Produit,Format\n";
        filteredUnfulfilled.forEach(u => {
            const item = items.find(i => i.id === u.itemId);
            const d = new Date(u.date);
            const fmt = getFormatName(item?.formatId);
            csvContent += `"${d.toLocaleDateString()}","${d.toLocaleTimeString()}","${u.userName || '-'}","${item?.name || 'Inconnu'}","${fmt}"\n`;
        });
    } else if (activeTab === 'STOCK_RUPTURE') {
        filename = `articles_tension_${periodFilter}_${new Date().toISOString().slice(0,10)}.csv`;
        csvContent += "Date,Type,Produit,Format,Statut,Quantité\n";
        filteredPending.forEach(o => {
            const item = items.find(i => i.id === o.itemId);
            const isOrdered = o.status === 'ORDERED' && o.orderedAt;
            const dateStr = isOrdered 
                ? (o.orderedAt ? new Date(o.orderedAt).toLocaleDateString() : '-')
                : (o.ruptureDate ? new Date(o.ruptureDate).toLocaleDateString() : '-');
            const typeStr = isOrdered ? 'Date Commande' : 'Date Rupture';
            
            const fmt = getFormatName(item?.formatId);
            csvContent += `"${dateStr}","${typeStr}","${item?.name || 'Inconnu'}","${fmt}","${o.status}","${o.quantity}"\n`;
        });
    } else if (activeTab === 'RECEIVED') {
        filename = `receptions_${periodFilter}_${new Date().toISOString().slice(0,10)}.csv`;
        csvContent += "Date Réception,Produit,Format,Catégorie,Qté Reçue,Qté Commandée\n";
        groupedReceivedOrders.forEach(group => {
            group.items.forEach(it => {
               const fmt = getFormatName(it.item.formatId);
               csvContent += `"${group.dateLabel}","${it.item.name}","${fmt}","${it.item.category}","${it.totalQty}","${it.initialQty}"\n`;
            });
        });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <div className="space-y-6">
      
      {/* HEADER: TABS + FILTERS */}
      <div className="flex flex-col gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          
          <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-100">
              <button onClick={() => setActiveTab('MOVEMENTS')} className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'MOVEMENTS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>Mouvements</button>
              <button onClick={() => setActiveTab('CLIENT_RUPTURE')} className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'CLIENT_RUPTURE' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>Ruptures Clients</button>
              <button onClick={() => setActiveTab('STOCK_RUPTURE')} className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'STOCK_RUPTURE' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>Art. Sous Tension</button>
              <button onClick={() => setActiveTab('RECEIVED')} className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'RECEIVED' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>Art. Reçus</button>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                  <select 
                    value={periodFilter} 
                    onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
                    className="bg-slate-100 border-none rounded-lg px-3 py-2 text-xs font-black uppercase text-slate-700 outline-none cursor-pointer"
                  >
                      <option value="DAY">Par Jour</option>
                      <option value="WEEK">Par Semaine</option>
                      <option value="MONTH">Par Mois</option>
                      <option value="YEAR">Par Année</option>
                  </select>

                  {periodFilter === 'DAY' && (
                      <input 
                        type="date" 
                        value={selectedDay}
                        onChange={(e) => setSelectedDay(e.target.value)}
                        className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 outline-none"
                      />
                  )}

                  {periodFilter === 'WEEK' && (
                      <>
                        <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-700">
                           {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <select value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-700">
                           {availableWeeks.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                        </select>
                      </>
                  )}

                  {periodFilter === 'MONTH' && (
                      <>
                        <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-700">
                           {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-700">
                           {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((m, i) => (
                               <option key={i} value={i}>{m}</option>
                           ))}
                        </select>
                      </>
                  )}

                   {periodFilter === 'YEAR' && (
                        <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-700">
                           {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                   )}
              </div>

              <button 
                onClick={handleExportCSV}
                className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-700 shadow-lg active:scale-95 transition-all"
              >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" /></svg>
                  Export CSV
              </button>
          </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          
          {activeTab === 'MOVEMENTS' && (
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b">
                        <tr>
                            <th className="p-4">Date/Heure</th>
                            <th className="p-4">Utilisateur</th>
                            <th className="p-4">Produit</th>
                            <th className="p-4">Type</th>
                            <th className="p-4 text-right">Quantité</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {displayTransactions.map((t, idx) => {
                            const item = items.find(i => i.id === t.itemId);
                            return (
                                <tr key={`${t.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 text-xs font-bold text-slate-600">
                                        {new Date(t.date).toLocaleDateString()} <span className="text-slate-400 text-[10px]">{new Date(t.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                    </td>
                                    <td className="p-4 text-xs font-bold text-slate-800">{t.userName || '-'}</td>
                                    <td className="p-4 font-black text-slate-900">{item?.name || 'Inconnu'}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider ${t.type === 'IN' ? (t.isCaveTransfer ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600') : 'bg-rose-100 text-rose-600'}`}>
                                            {t.type === 'IN' ? (t.isCaveTransfer ? 'Cave' : 'Entrée') : 'Sortie'}
                                        </span>
                                    </td>
                                    <td className={`p-4 text-right font-black ${t.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {t.type === 'IN' ? '+' : '-'}{parseFloat(Number(t.quantity).toFixed(2))}
                                    </td>
                                </tr>
                            );
                        })}
                        {displayTransactions.length === 0 && (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic text-sm">Aucun mouvement pour cette période.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
          )}

          {activeTab === 'CLIENT_RUPTURE' && (
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="p-4 bg-rose-50 border-b border-rose-100">
                    <h3 className="text-rose-700 font-black uppercase text-xs tracking-widest flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-rose-500 rounded-full"></span>
                        Commandes Non-Honorées (Rupture Service)
                    </h3>
                </div>
                <table className="w-full text-left">
                    <thead className="bg-white text-[9px] uppercase text-slate-400 font-black tracking-widest border-b">
                    <tr>
                        <th className="p-4">Date</th>
                        <th className="p-4">Heure</th>
                        <th className="p-4">Utilisateur</th>
                        <th className="p-4">Produit</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y">
                    {filteredUnfulfilled.map((u) => {
                        const item = items.find(i => i.id === u.itemId);
                        const d = new Date(u.date);
                        return (
                        <tr key={u.id} className="hover:bg-slate-50">
                            <td className="p-4 text-[10px] font-bold text-slate-600">{d.toLocaleDateString()}</td>
                            <td className="p-4 text-[10px] font-bold text-slate-400">{d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                            <td className="p-4"><span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase tracking-wider">{u.userName || '-'}</span></td>
                            <td className="p-4"><span className="font-black text-sm text-rose-600">{item?.name || 'Inconnu'}</span></td>
                        </tr>
                        );
                    })}
                    {filteredUnfulfilled.length === 0 && (
                        <tr><td colSpan={4} className="p-12 text-center text-slate-400 italic text-sm">Aucune rupture client signalée sur cette période.</td></tr>
                    )}
                    </tbody>
                </table>
              </div>
          )}

          {activeTab === 'STOCK_RUPTURE' && (
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                  <div className="p-4 bg-amber-50 border-b border-amber-100 flex justify-between items-center">
                      <h3 className="text-amber-700 font-black uppercase text-xs tracking-widest flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          Historique Tension Stock
                      </h3>
                  </div>
                  <table className="w-full text-left">
                      <thead className="bg-white text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">
                          <tr>
                              <th className="p-4">Date</th>
                              <th className="p-4">Produit</th>
                              <th className="p-4">Statut</th>
                              <th className="p-4 text-right">Quantité commandée</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {filteredPending.map(o => {
                              const item = items.find(i => i.id === o.itemId);
                              const isOrdered = o.status === 'ORDERED';
                              return (
                                  <tr key={o.id} className="hover:bg-slate-50">
                                      <td className="p-4">
                                          <div className="flex flex-col">
                                              <span className={`text-xs font-bold ${isOrdered ? 'text-indigo-600' : 'text-rose-500'}`}>
                                                  {isOrdered && o.orderedAt 
                                                    ? new Date(o.orderedAt).toLocaleDateString()
                                                    : (o.ruptureDate ? new Date(o.ruptureDate).toLocaleDateString() : '-')
                                                  }
                                              </span>
                                              <span className="text-[9px] text-slate-400 font-bold uppercase">
                                                  {isOrdered ? 'Date Commande' : 'Date Rupture'}
                                              </span>
                                          </div>
                                      </td>
                                      <td className="p-4 font-black text-slate-900">{item?.name || 'Inconnu'}</td>
                                      <td className="p-4">
                                          <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider ${o.status === 'PENDING' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                              {o.status === 'PENDING' ? 'À Commander' : 'Commandé'}
                                          </span>
                                      </td>
                                      <td className="p-4 text-right font-bold text-slate-700">{o.quantity}</td>
                                  </tr>
                              );
                          })}
                          {filteredPending.length === 0 && (
                              <tr><td colSpan={4} className="p-12 text-center text-slate-400 italic">Aucune tension détectée sur cette période.</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          )}

          {activeTab === 'RECEIVED' && (
              <div className="space-y-6">
                  {groupedReceivedOrders.map((dayGroup) => (
                      <div key={dayGroup.key} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                          <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center gap-2">
                              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                              <h3 className="text-emerald-900 font-black uppercase text-xs tracking-widest capitalize">{dayGroup.dateLabel}</h3>
                          </div>
                          <table className="w-full text-left">
                              <thead className="bg-white text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">
                                  <tr>
                                      <th className="p-4">Produit</th>
                                      <th className="p-4">Catégorie</th>
                                      <th className="p-4 text-right">Qté Commandée</th>
                                      <th className="p-4 text-right w-48">Qté Reçue</th>
                                      <th className="p-4 w-20 text-center">État</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                  {dayGroup.items.map((group) => {
                                      const groupKey = `${dayGroup.key}-${group.item.id}`;
                                      const isValidated = validatedGroups.has(groupKey);
                                      
                                      const displayValue = isValidated 
                                            ? group.totalQty 
                                            : (editedQuantities[groupKey] !== undefined ? editedQuantities[groupKey] : 0);

                                      return (
                                          <tr key={group.item.id} className={isValidated ? 'bg-emerald-50/30' : 'hover:bg-slate-50'}>
                                              <td className="p-4 font-bold text-slate-800">{group.item.name}</td>
                                              <td className="p-4 text-xs font-bold text-slate-400 uppercase">{group.item.category}</td>
                                              <td className="p-4 text-right font-bold text-slate-500">{group.initialQty}</td>
                                              <td className="p-4 text-right">
                                                  <div className="flex items-center justify-end gap-2">
                                                      <input 
                                                        type="text" 
                                                        inputMode="numeric"
                                                        value={displayValue}
                                                        onChange={(e) => handleQuantityChange(groupKey, e.target.value)}
                                                        disabled={isValidated}
                                                        className={`w-20 text-center font-black p-2 rounded-lg border outline-none transition-all ${isValidated ? 'bg-transparent border-transparent text-emerald-600' : 'bg-white border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'}`}
                                                      />
                                                      {!isValidated && (
                                                          <button 
                                                            onClick={() => handleValidateReceipt(groupKey, group.orders.map(o => o.id), displayValue)}
                                                            className="bg-slate-900 text-white p-2 rounded-lg hover:bg-emerald-500 transition-colors shadow-sm"
                                                            title="Valider la réception"
                                                          >
                                                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                          </button>
                                                      )}
                                                  </div>
                                              </td>
                                              <td className="p-4 text-center">
                                                  {isValidated ? (
                                                      <span className="text-emerald-500 font-bold text-xs flex justify-center"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></span>
                                                  ) : (
                                                      <span className="text-slate-300 text-[10px] font-bold uppercase">À Valider</span>
                                                  )}
                                              </td>
                                          </tr>
                                      );
                                  })}
                              </tbody>
                          </table>
                      </div>
                  ))}
                  {groupedReceivedOrders.length === 0 && (
                      <div className="p-12 text-center bg-white rounded-2xl border border-dashed text-slate-400 italic">
                          Aucun historique de réception pour cette période.
                      </div>
                  )}
              </div>
          )}
      </div>
    </div>
  );
};

export default History;