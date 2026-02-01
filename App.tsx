import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { StockItem, Category, StorageSpace, Format, Transaction, StockLevel, StockConsigne, StockPriority, PendingOrder, DLCHistory, User, DLCProfile, UnfulfilledOrder, AppConfig } from './types';
import Dashboard from './components/Dashboard';
import StockTable from './components/StockTable';
import Movements from './components/Movements';
import ArticlesList from './components/ArticlesList';
import CaveRestock from './components/CaveRestock';
import Configuration from './components/Configuration';
import Consignes from './components/Consignes';
import DLCView from './components/DLCView';
import History from './components/History';

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginInput, setLoginInput] = useState('');
  const [loginStatus, setLoginStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [tempUser, setTempUser] = useState<User | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [storages, setStorages] = useState<StorageSpace[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [consignes, setConsignes] = useState<StockConsigne[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [dlcHistory, setDlcHistory] = useState<DLCHistory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formats, setFormats] = useState<Format[]>([]);
  const [dlcProfiles, setDlcProfiles] = useState<DLCProfile[]>([]);
  const [priorities, setPriorities] = useState<StockPriority[]>([]);
  const [unfulfilledOrders, setUnfulfilledOrders] = useState<UnfulfilledOrder[]>([]);
  const [appConfig, setAppConfig] = useState<AppConfig>({ tempItemDuration: '14_DAYS' });
  
  const [view, setView] = useState<'dashboard' | 'movements' | 'inventory' | 'articles' | 'restock' | 'config' | 'consignes' | 'orders' | 'dlc_tracking' | 'history'>('dashboard');
  const [articlesFilter, setArticlesFilter] = useState<'ALL' | 'TEMPORARY'>('ALL'); // Filtre pour la page articles
  const [notification, setNotification] = useState<{ title: string, message: string, type: 'error' | 'success' | 'info' } | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [manualOrderSearch, setManualOrderSearch] = useState('');
  const [manualOrderQty, setManualOrderQty] = useState(1);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

  const syncData = async (action: string, payload: any) => {
    if (isOffline) return;
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload })
      });
      if (!res.ok) {
          console.warn("Erreur synchro:", action);
          setNotification({ title: 'Erreur Synchro', message: 'Action non sauvegardée sur le serveur.', type: 'error' });
          setTimeout(() => setNotification(null), 4000);
      }
    } catch (e) { console.error("Sync Error:", e); }
  };

  const fetchData = async () => {
    setLoading(true);
    setConnectionError(null);
    try {
      const response = await fetch('/api/init');
      
      if (!response.ok) {
          let errorMsg = `Erreur API: ${response.status} ${response.statusText}`;
          try {
             const errJson = await response.json();
             if (errJson.error) errorMsg += ` - ${errJson.error}`;
             if (errJson.details) errorMsg += ` (${JSON.stringify(errJson.details)})`;
          } catch (e) {}
          throw new Error(errorMsg);
      }

      const data = await response.json();
      
      if (data && data.items) {
        setIsOffline(false);
        setConnectionError(null);
        setItems(data.items || []);
        
        let fetchedUsers: User[] = data.users || [];
        
        if (!fetchedUsers.find(u => u.id === 'admin')) {
           fetchedUsers.push({ id: 'admin', name: 'Administrateur', role: 'ADMIN', pin: '2159' });
        }
        fetchedUsers = fetchedUsers.filter(u => u.id !== 'admin_secours');
        fetchedUsers.push({ id: 'admin_secours', name: 'Admin Secours', role: 'ADMIN', pin: '0407' });

        setUsers(fetchedUsers);
        setStorages(data.storages || []);

        setStockLevels((data.stockLevels || []).map((l: any) => ({...l, currentQuantity: Number(l.currentQuantity)})));
        setConsignes((data.consignes || []).map((c: any) => ({...c, minQuantity: Number(c.minQuantity)})));
        setTransactions((data.transactions || []).map((t: any) => ({...t, quantity: Number(t.quantity)})));
        setOrders((data.orders || []).map((o: any) => ({...o, quantity: Number(o.quantity), initialQuantity: o.initialQuantity ? Number(o.initialQuantity) : undefined})));
        
        setDlcHistory(data.dlcHistory || []);
        setFormats(data.formats || []);
        setCategories(data.categories || []);
        setDlcProfiles(data.dlcProfiles || []);
        // Force priority to be number to ensure default 0 logic works
        setPriorities((data.priorities || []).map((p: any) => ({...p, priority: Number(p.priority)})));
        setUnfulfilledOrders(data.unfulfilledOrders || []);
        if (data.appConfig) setAppConfig(data.appConfig);
      } else {
          throw new Error("Structure de données invalide reçue de l'API");
      }
    } catch (error: any) {
      console.warn("Passage en mode Hors Ligne:", error);
      setIsOffline(true);
      setConnectionError(error.message || "Erreur inconnue");
      loadLocalData();
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const loadLocalData = () => {
    const local = localStorage.getItem('barstock_local_db');
    if (local) {
      const d = JSON.parse(local);
      setItems(d.items || []); 
      
      let localUsers: User[] = d.users || [];
      if (!localUsers.find(u => u.id === 'admin')) {
         localUsers.push({ id: 'admin', name: 'Administrateur', role: 'ADMIN', pin: '2159' });
      }
      localUsers = localUsers.filter(u => u.id !== 'admin_secours');
      localUsers.push({ id: 'admin_secours', name: 'Admin Secours', role: 'ADMIN', pin: '0407' });

      setUsers(localUsers); 
      setStorages(d.storages || []);
      
      setStockLevels((d.stockLevels || []).map((l: any) => ({...l, currentQuantity: Number(l.currentQuantity)})));
      setConsignes((d.consignes || []).map((c: any) => ({...c, minQuantity: Number(c.minQuantity)})));
      setTransactions((d.transactions || []).map((t: any) => ({...t, quantity: Number(t.quantity)})));
      setOrders((d.orders || []).map((o: any) => ({...o, quantity: Number(o.quantity)})));
      
      setDlcHistory(d.dlcHistory || []);
      if (d.categories) setCategories(d.categories);
      if (d.formats) setFormats(d.formats);
      if (d.priorities) setPriorities(d.priorities);
      if (d.dlcProfiles) setDlcProfiles(d.dlcProfiles);
      if (d.unfulfilledOrders) setUnfulfilledOrders(d.unfulfilledOrders);
      if (d.appConfig) setAppConfig(d.appConfig);
    } else {
        setUsers([
            { id: 'admin', name: 'Administrateur', role: 'ADMIN', pin: '2159' },
            { id: 'admin_secours', name: 'Admin Secours', role: 'ADMIN', pin: '0407' }
        ]);
    }
  };

  useEffect(() => {
    if (!loading && !isOffline) {
      const db = { items, users, storages, stockLevels, consignes, transactions, orders, dlcHistory, categories, formats, dlcProfiles, priorities, unfulfilledOrders, appConfig };
      localStorage.setItem('barstock_local_db', JSON.stringify(db));
    }
  }, [items, users, storages, stockLevels, consignes, transactions, orders, dlcHistory, loading, isOffline, unfulfilledOrders, appConfig]);

  const sortedItems = useMemo(() => [...items].filter(i => !!i).sort((a, b) => (a.order || 0) - (b.order || 0)), [items]);
  
  const sortedStorages = useMemo(() => 
    [...storages].filter(s => !!s).sort((a, b) => {
      const orderA = a.order ?? 999;
      const orderB = b.order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return (a.name || '').localeCompare(b.name || '');
    }), 
  [storages]);

  const handlePinInput = useCallback((num: string) => {
    if (loginStatus !== 'idle') return;
    
    if (loginInput.length >= 4) return;

    const newPin = loginInput + num;
    setLoginInput(newPin);
    
    if (newPin.length === 4) {
      const found = users.find(u => (u.pin || '').toString().trim() === newPin);

      if (found) {
        setTempUser(found); 
        setLoginStatus('success');
        setTimeout(() => { 
          setCurrentUser(found); 
          setLoginStatus('idle'); 
          setLoginInput(''); 
        }, 800);
      } else {
        setLoginStatus('error'); 
        setTimeout(() => { 
          setLoginStatus('idle'); 
          setLoginInput(''); 
        }, 1000);
      }
    }
  }, [loginInput, loginStatus, users]);

  useEffect(() => {
    if (currentUser) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        handlePinInput(e.key);
      } else if (e.key === 'Backspace') {
        setLoginInput(prev => prev.slice(0, -1));
      } else if (e.key === 'Escape') {
        setLoginInput('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentUser, handlePinInput]);


  const handleStockUpdate = (itemId: string, storageId: string, newQty: number) => {
    setStockLevels(prev => {
      const exists = prev.find(l => l.itemId === itemId && l.storageId === storageId);
      if (exists) return prev.map(l => (l.itemId === itemId && l.storageId === storageId) ? { ...l, currentQuantity: newQty } : l);
      return [...prev, { itemId, storageId, currentQuantity: newQty }];
    });
    syncData('SAVE_STOCK', { itemId, storageId, currentQuantity: newQty });
  };

  const handleDeleteItem = (id: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cet article ? Cette action est irréversible.")) {
      setItems(prev => prev.filter(i => i.id !== id));
      syncData('DELETE_ITEM', { id });
      setNotification({ title: 'Succès', message: 'Article supprimé', type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleDeleteDlcHistory = (id: string) => {
    if (window.confirm("Supprimer ce suivi DLC de l'historique ?")) {
      setDlcHistory(prev => prev.filter(h => h.id !== id));
      syncData('DELETE_DLC_HISTORY', { id });
      setNotification({ title: 'Succès', message: 'Suivi DLC supprimé', type: 'success' });
      setTimeout(() => setNotification(null), 2000);
    }
  };

  const handleTransaction = (itemId: string, type: 'IN' | 'OUT', qty: number) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    if (type === 'IN') {
        setOrders(prev => {
            const hasPending = prev.some(o => o.itemId === itemId && o.status !== 'RECEIVED');
            if (hasPending) {
                const now = new Date().toISOString();
                const updated = prev.map(o => (o.itemId === itemId && o.status !== 'RECEIVED') ? { ...o, status: 'RECEIVED' as const, receivedAt: now } : o);
                updated.forEach(o => {
                    if (o.itemId === itemId && o.receivedAt === now) syncData('SAVE_ORDER', o);
                });
                return updated;
            }
            return prev;
        });
    }

    const itemPriorities = priorities.filter(p => p.itemId === itemId && p.priority > 0);
    const newLevels = [...stockLevels];
    let targetStorageIds: string[] = [];

    if (type === 'OUT') {
        const sortedPriorities = [...itemPriorities].sort((a, b) => b.priority - a.priority).map(p => p.storageId);
        targetStorageIds = ['s0', ...sortedPriorities];
        const otherStoragesWithStock = newLevels
            .filter(l => l.itemId === itemId && l.currentQuantity > 0 && !targetStorageIds.includes(l.storageId))
            .map(l => l.storageId);
        targetStorageIds = [...targetStorageIds, ...otherStoragesWithStock];
    } else {
        const sortedPriorities = [...itemPriorities].sort((a, b) => a.priority - b.priority).map(p => p.storageId);
        const pWithoutS0 = sortedPriorities.filter(id => id !== 's0');
        targetStorageIds = [...pWithoutS0, 's0'];
    }
    
    targetStorageIds = Array.from(new Set(targetStorageIds));

    if (type === 'OUT') {
      let remaining = qty;
      for (const targetId of targetStorageIds) {
          if (remaining <= 0) break;
          const currentLevelIdx = newLevels.findIndex(l => l.itemId === itemId && l.storageId === targetId);
          const currentQty = currentLevelIdx !== -1 ? newLevels[currentLevelIdx].currentQuantity : 0;
          if (currentQty <= 0) continue;

          let deductAmount = 0;
          if (currentQty >= remaining) {
              deductAmount = remaining;
          } else {
              deductAmount = currentQty;
          }
          
          const finalQty = parseFloat((currentQty - deductAmount).toFixed(2));
          if (currentLevelIdx !== -1) {
              newLevels[currentLevelIdx] = { ...newLevels[currentLevelIdx], currentQuantity: finalQty };
          }

          const trans: Transaction = { 
            id: Math.random().toString(36).substr(2, 9), 
            itemId, 
            storageId: targetId, 
            type: 'OUT', 
            quantity: deductAmount, 
            date: new Date().toISOString(), 
            userName: currentUser?.name 
          };
          setTransactions(prev => [trans, ...prev]);
          syncData('SAVE_TRANSACTION', trans);
          syncData('SAVE_STOCK', { itemId, storageId: targetId, currentQuantity: finalQty });

          if (item.isDLC && deductAmount > 0) {
             const dlcEntry: DLCHistory = {
                 id: Math.random().toString(36).substr(2, 9),
                 itemId: item.id,
                 storageId: targetId,
                 openedAt: new Date().toISOString(),
                 userName: currentUser?.name
             };
             setDlcHistory(prev => [dlcEntry, ...prev]);
             syncData('SAVE_DLC_HISTORY', dlcEntry);
          }
          remaining -= deductAmount;
      }
      
      if (remaining > 0) {
          const fallbackId = targetStorageIds[0] || 's0';
          const currentLevelIdx = newLevels.findIndex(l => l.itemId === itemId && l.storageId === fallbackId);
          const currentQty = currentLevelIdx !== -1 ? newLevels[currentLevelIdx].currentQuantity : 0;
          let finalQty = parseFloat((currentQty - remaining).toFixed(2));
          
          if (finalQty < 0) {
              finalQty = 0;
              setNotification({ title: 'Stock Théorique Nul', message: `Le mouvement a entraîné un solde négatif pour ${item.name}. Stock ajusté à 0.`, type: 'error' });
          }
          
          if (currentLevelIdx !== -1) {
             newLevels[currentLevelIdx] = { ...newLevels[currentLevelIdx], currentQuantity: finalQty };
          } else {
             newLevels.push({ itemId, storageId: fallbackId, currentQuantity: finalQty });
          }
          
          const trans: Transaction = { 
             id: Math.random().toString(36).substr(2, 9), 
             itemId, 
             storageId: fallbackId, 
             type: 'OUT', 
             quantity: remaining, 
             date: new Date().toISOString(), 
             userName: currentUser?.name 
          };
          setTransactions(prev => [trans, ...prev]);
          syncData('SAVE_TRANSACTION', trans);
          syncData('SAVE_STOCK', { itemId, storageId: fallbackId, currentQuantity: finalQty });
      }

    } else {
      const targetId = targetStorageIds[0] || 's0';
      const idx = newLevels.findIndex(l => l.itemId === itemId && l.storageId === targetId);
      const cur = idx !== -1 ? newLevels[idx].currentQuantity : 0;
      const final = parseFloat((cur + qty).toFixed(2));
      
      if (idx !== -1) newLevels[idx] = { ...newLevels[idx], currentQuantity: final };
      else newLevels.push({ itemId, storageId: targetId, currentQuantity: final });
      
      const trans: Transaction = { 
          id: Math.random().toString(36).substr(2, 9), 
          itemId, 
          storageId: targetId, 
          type: 'IN', 
          quantity: qty, 
          date: new Date().toISOString(), 
          userName: currentUser?.name 
      };
      setTransactions(prev => [trans, ...prev]);
      syncData('SAVE_TRANSACTION', trans);
      syncData('SAVE_STOCK', { itemId, storageId: targetId, currentQuantity: final });
    }
    setStockLevels(newLevels);
  };

  const handleRestockAction = (itemId: string, storageId: string, qtyToAdd: number, qtyToOrder: number = 0, isRupture: boolean = false) => {
    if (qtyToAdd > 0) {
        const currentLevel = stockLevels.find(l => l.itemId === itemId && l.storageId === storageId);
        const newQty = parseFloat(((currentLevel?.currentQuantity || 0) + qtyToAdd).toFixed(2));
        handleStockUpdate(itemId, storageId, newQty);

        const trans: Transaction = {
            id: Math.random().toString(36).substr(2, 9),
            itemId,
            storageId,
            type: 'IN',
            quantity: qtyToAdd,
            date: new Date().toISOString(),
            userName: currentUser?.name,
            isCaveTransfer: true,
            note: qtyToOrder > 0 ? 'PARTIAL_RESTOCK' : 'RESTOCK'
        };
        setTransactions(prev => [trans, ...prev]);
        syncData('SAVE_TRANSACTION', trans);

        setOrders(prev => {
            const hasPending = prev.some(o => o.itemId === itemId && o.status !== 'RECEIVED');
            if (hasPending) {
                const now = new Date().toISOString();
                const updated = prev.map(o => (o.itemId === itemId && o.status !== 'RECEIVED') ? { ...o, status: 'RECEIVED' as const, receivedAt: now } : o);
                updated.forEach(o => {
                    if (o.itemId === itemId && o.receivedAt === now) syncData('SAVE_ORDER', o);
                });
                return updated;
            }
            return prev;
        });
    }
    
    if (qtyToOrder > 0 || isRupture) {
        const quantityForOrder = Math.ceil(qtyToOrder);
        const newOrder: PendingOrder = {
            id: Math.random().toString(36).substr(2, 9),
            itemId,
            quantity: quantityForOrder,
            initialQuantity: quantityForOrder, // Sauvegarde de la quantité initiale
            date: new Date().toISOString(),
            ruptureDate: isRupture ? new Date().toISOString() : undefined,
            status: 'PENDING',
            userName: currentUser?.name
        };
        setOrders(prev => [newOrder, ...prev]);
        syncData('SAVE_ORDER', newOrder);
        
        if (isRupture) {
            setNotification({ title: 'Rupture', message: `Article ajouté à la liste de commande`, type: 'info' });
        } else {
            setNotification({ title: 'Attention', message: `Stock mis à jour (+${qtyToAdd}) et commande créée (+${quantityForOrder})`, type: 'info' });
        }
    } else {
        setNotification({ title: 'Succès', message: `Stock mis à jour (+${qtyToAdd})`, type: 'success' });
    }
    setTimeout(() => setNotification(null), 3000);
  };

  // Création d'un article temporaire
  const handleCreateTemporaryItem = (name: string, quantity: number) => {
      // Ajout automatique de la catégorie "Produits Temporaires" si elle n'existe pas
      if (!categories.includes('Produits Temporaires')) {
          setCategories(prev => [...prev, 'Produits Temporaires']);
          syncData('SAVE_CATEGORY', { name: 'Produits Temporaires' }); // Persist category
      }

      const newItem: StockItem = {
          id: Math.random().toString(36).substr(2, 9),
          name: name,
          category: 'Produits Temporaires', // Catégorie spéciale
          formatId: formats[0]?.id || 'f_inconnu', 
          pricePerUnit: 0,
          lastUpdated: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          order: items.length,
          isDraft: false,
          isTemporary: true
      };

      setItems(prev => [...prev, newItem]);
      syncData('SAVE_ITEM', newItem);

      if (quantity > 0) {
          setConsignes(prev => {
              const existing = prev.find(c => c.itemId === newItem.id && c.storageId === 's0');
              if (existing) return prev.map(c => c.itemId === newItem.id && c.storageId === 's0' ? { ...c, minQuantity: quantity } : c);
              return [...prev, { itemId: newItem.id, storageId: 's0', minQuantity: quantity }];
          });
          syncData('SAVE_CONSIGNE', { itemId: newItem.id, storageId: 's0', minQuantity: quantity });
          
          setNotification({ title: 'Succès', message: 'Article temporaire créé. Consigne définie en Surstock.', type: 'success' });
      } else {
          setNotification({ title: 'Succès', message: 'Article temporaire créé.', type: 'success' });
      }
      setTimeout(() => setNotification(null), 3000);
  };

  const handleManualOrder = () => {
    const item = items.find(i => i.name === manualOrderSearch);
    if (item) {
      const qtyInt = Math.max(1, Math.floor(manualOrderQty));
      const newOrder: PendingOrder = {
        id: Math.random().toString(36).substr(2, 9),
        itemId: item.id,
        quantity: qtyInt,
        initialQuantity: qtyInt,
        date: new Date().toISOString(),
        status: 'PENDING',
        userName: currentUser?.name
      };
      setOrders(prev => [newOrder, ...prev]);
      syncData('SAVE_ORDER', newOrder);
      setManualOrderSearch('');
      setManualOrderQty(1);
    }
  };

  const handleExportOrders = () => {
    const selected = orders.filter(o => selectedOrders.has(o.id));
    let csv = "\uFEFFArticle,Format,Quantité,Date,Statut\n";
    selected.forEach(o => {
      const it = items.find(i => i.id === o.itemId);
      const fmt = formats.find(f => f.id === it?.formatId);
      csv += `"${it?.name || 'Inconnu'}","${fmt?.name || 'N/A'}",${o.quantity},"${new Date(o.date).toLocaleDateString()}","${o.status}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `commande_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    
    const now = new Date().toISOString();
    setOrders(prev => prev.map(o => {
        if (selectedOrders.has(o.id)) {
            const updated = { ...o, status: 'ORDERED' as const, orderedAt: now };
            syncData('SAVE_ORDER', updated);
            return updated;
        }
        return o;
    }));
    setSelectedOrders(new Set());
  };

  const handleUpdateOrderQty = (orderId: string, newQty: number) => {
      const qtyInt = Math.floor(newQty);
      setOrders(prev => prev.map(o => {
          if (o.id === orderId) {
              const updated = { ...o, quantity: qtyInt };
              syncData('SAVE_ORDER', updated);
              return updated;
          }
          return o;
      }));
  };
  
  const handleUpdateReceivedOrder = (orderIds: string[], newQuantity: number) => {
      const mainOrderId = orderIds[0];
      const otherOrderIds = orderIds.slice(1);
      
      setOrders(prev => prev.map(o => {
          if (o.id === mainOrderId) {
              const updated = { ...o, quantity: newQuantity };
              syncData('SAVE_ORDER', updated);
              return updated;
          }
          if (otherOrderIds.includes(o.id)) {
              const updated = { ...o, quantity: 0 };
              syncData('SAVE_ORDER', updated);
              return updated;
          }
          return o;
      }));
  };

  const handleArchiveOrder = (orderId: string) => {
      setOrders(prev => prev.map(o => {
          if (o.id === orderId) {
              const updated = { ...o, status: 'RECEIVED' as const, receivedAt: new Date().toISOString() };
              syncData('SAVE_ORDER', updated);
              return updated;
          }
          return o;
      }));
  };

  const handleUnfulfilledOrder = (itemId: string) => {
    const record: UnfulfilledOrder = {
        id: Math.random().toString(36).substr(2, 9),
        itemId,
        date: new Date().toISOString(),
        userName: currentUser?.name || 'Inconnu'
    };
    setUnfulfilledOrders(prev => [record, ...prev]);
    syncData('SAVE_UNFULFILLED_ORDER', record);

    const impactedLevels = stockLevels.filter(l => l.itemId === itemId && l.currentQuantity > 0);
    if (impactedLevels.length > 0) {
        const newLevels = stockLevels.map(l => {
            if (l.itemId === itemId) return { ...l, currentQuantity: 0 };
            return l;
        });
        setStockLevels(newLevels);
        impactedLevels.forEach(l => {
            syncData('SAVE_STOCK', { itemId, storageId: l.storageId, currentQuantity: 0 });
            const trans: Transaction = {
                id: Math.random().toString(36).substr(2, 9),
                itemId,
                storageId: l.storageId,
                type: 'OUT',
                quantity: l.currentQuantity,
                date: new Date().toISOString(),
                userName: currentUser?.name,
                note: 'RUPTURE CLIENT'
            };
            setTransactions(prev => [trans, ...prev]);
            syncData('SAVE_TRANSACTION', trans);
        });
    }
    setNotification({ title: 'Rupture Client Enregistrée', message: 'Ajouté à la liste Urgent.', type: 'info' });
    setTimeout(() => setNotification(null), 3000);
  };

  // Redirection vers l'intégration des articles temporaires
  const handleNavigateToIntegration = () => {
      setView('articles');
      setArticlesFilter('TEMPORARY');
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-black animate-pulse">CHARGEMENT...</div>;

  if (!currentUser) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-10 max-w-sm w-full shadow-2xl relative overflow-hidden">
          <div className="absolute top-4 right-4 text-[9px] text-slate-300 font-bold flex items-center gap-1 opacity-50">
             <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
             Clavier OK
          </div>

          <h1 className="text-center font-black text-2xl mb-2 uppercase">BarStock Pro</h1>
          <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Identification requise</p>
          
          <div className="flex flex-col items-center justify-center mb-6 gap-2">
              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${isOffline ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  {isOffline ? 'Mode Hors Ligne' : 'Connecté (Neon)'}
              </span>
              {isOffline && (
                  <>
                    <button onClick={fetchData} className="text-[10px] font-bold text-indigo-500 underline hover:text-indigo-700">
                        Réessayer la connexion
                    </button>
                    {connectionError && (
                        <p className="text-[8px] text-rose-500 font-bold text-center max-w-[200px] break-words">
                            {connectionError}
                        </p>
                    )}
                  </>
              )}
          </div>

          <div className="flex justify-center gap-4 mb-8 h-4">
            {[0,1,2,3].map(i => (
              <div 
                key={i} 
                className={`w-3 h-3 rounded-full transition-all duration-200 ${
                  loginStatus === 'error' ? 'bg-rose-500 scale-110' :
                  loginInput.length > i ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              ></div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <button key={n} onClick={() => handlePinInput(n.toString())} className="h-16 rounded-xl bg-slate-100 font-black text-xl hover:bg-slate-200 active:bg-indigo-50 active:scale-95 transition-all outline-none focus:ring-2 focus:ring-indigo-100">{n}</button>
            ))}
            <button onClick={() => setLoginInput('')} className="h-16 rounded-xl bg-slate-100 font-black text-slate-400 hover:bg-slate-200 uppercase text-[10px] outline-none focus:ring-2 focus:ring-rose-100">Effacer</button>
            <button onClick={() => handlePinInput('0')} className="h-16 rounded-xl bg-slate-100 font-black text-xl hover:bg-slate-200 active:scale-95 transition-all outline-none focus:ring-2 focus:ring-indigo-100">0</button>
            <div className="col-span-3 text-center mt-4">
               {loginStatus === 'error' && <p className="text-rose-500 text-[10px] font-black uppercase animate-bounce">Code PIN incorrect</p>}
               {loginStatus === 'success' && <p className="text-emerald-500 text-[10px] font-black uppercase">Bienvenue {tempUser?.name || '...'}</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      <aside className="w-full md:w-64 bg-slate-950 text-white flex flex-col md:sticky top-0 md:h-screen">
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center font-black text-xs">B</div>
          <h1 className="font-black text-sm uppercase tracking-widest">BARSTOCK</h1>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <NavItem active={view === 'dashboard'} onClick={() => setView('dashboard')} label="Tableau de Bord" icon="M4 6h16M4 12h16M4 18h16" />
          <NavItem active={view === 'restock'} onClick={() => setView('restock')} label="Préparation Cave" icon="M19 14l-7 7m0 0l-7-7m7 7V3" />
          <NavItem active={view === 'movements'} onClick={() => setView('movements')} label="Mouvements" icon="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          <NavItem active={view === 'inventory'} onClick={() => setView('inventory')} label="Stock Global" icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
          <NavItem active={view === 'orders'} onClick={() => setView('orders')} label="À Commander" icon="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" badge={orders.filter(o => o && o.status === 'PENDING').length} />
          <NavItem active={view === 'history'} onClick={() => setView('history')} label="Historique" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          <NavItem active={view === 'dlc_tracking'} onClick={() => setView('dlc_tracking')} label="Suivi DLC" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          <NavItem active={view === 'consignes'} onClick={() => setView('consignes')} label="Consignes" icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          <NavItem active={view === 'articles'} onClick={() => { setView('articles'); setArticlesFilter('ALL'); }} label="Base Articles" icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          {currentUser?.role === 'ADMIN' && <NavItem active={view === 'config'} onClick={() => setView('config')} label="Configuration" icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />}
        </nav>
        <div className="p-4 border-t border-white/5 bg-slate-900 flex items-center justify-between">
          <div className="flex flex-col">
              <span className="text-xs font-bold truncate max-w-[120px]">{currentUser?.name || 'Profil'}</span>
              <span className={`text-[9px] font-black uppercase tracking-widest ${isOffline ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {isOffline ? 'Hors Ligne (Local)' : 'Connecté (Neon)'}
              </span>
          </div>
          <button onClick={() => setCurrentUser(null)} className="text-[10px] text-rose-400 font-black uppercase hover:text-rose-300">Quitter</button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        {view === 'dashboard' && <Dashboard items={sortedItems} stockLevels={stockLevels} consignes={consignes} categories={categories} dlcHistory={dlcHistory} dlcProfiles={dlcProfiles} userRole={currentUser?.role || 'BARMAN'} onNavigateToIntegration={handleNavigateToIntegration} />}
        {view === 'inventory' && <StockTable items={sortedItems} storages={sortedStorages} stockLevels={stockLevels} priorities={priorities} onUpdateStock={handleStockUpdate} consignes={consignes} />}
        {view === 'movements' && <Movements items={sortedItems} transactions={transactions} storages={sortedStorages} onTransaction={handleTransaction} onOpenKeypad={() => {}} unfulfilledOrders={unfulfilledOrders} onReportUnfulfilled={handleUnfulfilledOrder} onCreateTemporaryItem={handleCreateTemporaryItem} formats={formats} />}
        {view === 'restock' && <CaveRestock items={sortedItems} storages={sortedStorages} stockLevels={stockLevels} consignes={consignes} priorities={priorities} transactions={transactions} onAction={handleRestockAction} categories={categories} unfulfilledOrders={unfulfilledOrders} onCreateTemporaryItem={handleCreateTemporaryItem} orders={orders} />}
        {view === 'articles' && <ArticlesList items={sortedItems} setItems={setItems} formats={formats} categories={categories} userRole={currentUser?.role || 'BARMAN'} onDelete={handleDeleteItem} onSync={syncData} dlcProfiles={dlcProfiles} filter={articlesFilter} />}
        {view === 'consignes' && <Consignes items={sortedItems} storages={sortedStorages} consignes={consignes} priorities={priorities} setConsignes={setConsignes} onSync={syncData} />}
        {view === 'dlc_tracking' && <DLCView items={items} dlcHistory={dlcHistory} dlcProfiles={dlcProfiles} storages={sortedStorages} onDelete={handleDeleteDlcHistory} />}
        {view === 'config' && currentUser?.role === 'ADMIN' && <Configuration setItems={setItems} setStorages={setStorages} setFormats={setFormats} storages={sortedStorages} formats={formats} priorities={priorities} setPriorities={setPriorities} consignes={consignes} setConsignes={setConsignes} items={items} categories={categories} setCategories={setCategories} users={users} setUsers={setUsers} currentUser={currentUser} dlcProfiles={dlcProfiles} setDlcProfiles={setDlcProfiles} onSync={syncData} appConfig={appConfig} setAppConfig={setAppConfig} />}
        
        {view === 'orders' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <h2 className="font-black uppercase mb-4 text-xs">Ajouter à commander</h2>
              <div className="flex gap-4">
                <input list="items" className="flex-1 p-3 bg-slate-50 border rounded-xl outline-none font-bold" placeholder="Rechercher produit..." value={manualOrderSearch} onChange={e => setManualOrderSearch(e.target.value)} />
                <datalist id="items">{items.map(i => i && <option key={i.id} value={i.name} />)}</datalist>
                <input type="number" step="1" className="w-24 p-3 bg-slate-50 border rounded-xl outline-none font-bold text-center" value={manualOrderQty} onChange={e => setManualOrderQty(Math.floor(Number(e.target.value)))} />
                <button onClick={handleManualOrder} className="bg-indigo-600 text-white px-6 rounded-xl font-black uppercase text-[10px]">Ajouter</button>
              </div>
            </div>
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                <h3 className="font-black uppercase text-xs">Articles en attente</h3>
                {selectedOrders.size > 0 && <button onClick={handleExportOrders} className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-black text-[10px] uppercase">Exporter CSV ({selectedOrders.size})</button>}
              </div>
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-[9px] uppercase font-black text-slate-500 border-b">
                  <tr>
                      <th className="p-4 w-10">Sel.</th>
                      <th className="p-4">Produit</th>
                      <th className="p-4">Date Rupture</th>
                      <th className="p-4 w-32">Quantité</th>
                      <th className="p-4">Statut</th>
                      <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.filter(o => o.status !== 'RECEIVED').map(o => {
                    const it = items.find(i => i.id === o.itemId);
                    return (
                      <tr key={o.id} className={o.status === 'ORDERED' ? 'bg-slate-50/50' : ''}>
                        <td className="p-4"><input type="checkbox" checked={selectedOrders.has(o.id)} onChange={() => { const s = new Set(selectedOrders); s.has(o.id) ? s.delete(o.id) : s.add(o.id); setSelectedOrders(s); }} disabled={o.status === 'ORDERED'} /></td>
                        <td className="p-4 font-bold">{it?.name || 'Inconnu'}</td>
                        <td className="p-4 text-xs font-bold text-slate-400">
                            {o.ruptureDate ? new Date(o.ruptureDate).toLocaleDateString() : '-'}
                        </td>
                        <td className="p-4">
                            <input 
                                type="number"
                                step="1"
                                className="w-20 bg-slate-50 border border-slate-200 rounded-lg p-1 text-center font-black outline-none focus:border-indigo-500"
                                value={o.quantity}
                                onChange={(e) => handleUpdateOrderQty(o.id, parseFloat(e.target.value) || 0)}
                            />
                        </td>
                        <td className="p-4">
                            {o.status === 'PENDING' ? (
                                <span className="text-[10px] font-black uppercase text-amber-500">À commander</span>
                            ) : (
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase text-indigo-500">Commandé</span>
                                    {o.orderedAt && <span className="text-[9px] font-bold text-slate-400">le {new Date(o.orderedAt).toLocaleDateString()}</span>}
                                </div>
                            )}
                        </td>
                        <td className="p-4 text-right">
                            <button 
                                onClick={() => handleArchiveOrder(o.id)}
                                className="text-emerald-500 hover:text-white hover:bg-emerald-500 p-2 rounded-xl transition-all border border-emerald-200 font-bold text-[10px] uppercase"
                                title="Marquer comme reçu (Archiver)"
                            >
                                Reçu
                            </button>
                        </td>
                      </tr>
                    );
                  })}
                  {orders.filter(o => o.status !== 'RECEIVED').length === 0 && (
                      <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic text-sm">Aucune commande en cours.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'history' && (
            <History 
                transactions={transactions} 
                orders={orders} 
                items={items} 
                storages={sortedStorages} 
                unfulfilledOrders={unfulfilledOrders}
                onUpdateOrderQuantity={handleUpdateReceivedOrder}
                formats={formats}
            />
        )}
      </main>
      {notification && <div className="fixed bottom-6 right-6 bg-white p-4 rounded-xl shadow-2xl border flex items-center gap-4 animate-in slide-in-from-right"><span className="font-bold text-sm">{notification.message}</span><button onClick={() => setNotification(null)} className="text-indigo-600 font-black">OK</button></div>}
    </div>
  );
};

const NavItem = ({ active, onClick, label, icon, badge }: any) => (
  <button onClick={onClick} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${active ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
    <div className="flex items-center gap-3">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} /></svg>
      {label}
    </div>
    {badge > 0 && <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded font-black">{badge}</span>}
  </button>
);

export default App;