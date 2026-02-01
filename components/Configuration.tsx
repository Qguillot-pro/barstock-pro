import React, { useState } from 'react';
import { Category, StockItem, StorageSpace, Format, StockPriority, StockConsigne, User, DLCProfile, UserRole, AppConfig } from '../types';
import PriorityConfig from './PriorityConfig';

interface ConfigProps {
  setItems: React.Dispatch<React.SetStateAction<StockItem[]>>;
  setStorages: React.Dispatch<React.SetStateAction<StorageSpace[]>>;
  setFormats: React.Dispatch<React.SetStateAction<Format[]>>;
  storages: StorageSpace[];
  formats: Format[];
  priorities: StockPriority[];
  setPriorities: React.Dispatch<React.SetStateAction<StockPriority[]>>;
  consignes: StockConsigne[];
  setConsignes: React.Dispatch<React.SetStateAction<StockConsigne[]>>;
  items: StockItem[];
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  currentUser: User;
  dlcProfiles: DLCProfile[];
  setDlcProfiles: React.Dispatch<React.SetStateAction<DLCProfile[]>>;
  onSync: (action: string, payload: any) => void;
  appConfig: AppConfig;
  setAppConfig: React.Dispatch<React.SetStateAction<AppConfig>>;
}

const Configuration: React.FC<ConfigProps> = ({ 
  setItems, setStorages, setFormats, storages, formats, priorities, setPriorities, consignes, setConsignes, items,
  categories, setCategories, users, setUsers, currentUser, dlcProfiles, setDlcProfiles, onSync, appConfig, setAppConfig
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'priorities' | 'users' | 'dlc'>('general');
  
  // New Item States
  const [itemName, setItemName] = useState('');
  const [itemArticleCode, setItemArticleCode] = useState(''); 
  const [itemCat, setItemCat] = useState('');
  const [itemFormat, setItemFormat] = useState('');
  const [itemIsDlc, setItemIsDlc] = useState(false);
  const [itemDlcProfile, setItemDlcProfile] = useState('');

  const [storageName, setStorageName] = useState('');
  
  const [formatName, setFormatName] = useState('');
  const [formatValue, setFormatValue] = useState<number>(0); 

  const [newCatName, setNewCatName] = useState('');
  const [errorModal, setErrorModal] = useState<string | null>(null);
  
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('BARMAN');

  const [newDlcName, setNewDlcName] = useState('');
  const [newDlcDuration, setNewDlcDuration] = useState(24);
  const [newDlcUnit, setNewDlcUnit] = useState<'HOURS' | 'DAYS'>('HOURS');

  React.useEffect(() => {
      if (!itemCat && categories && categories.length > 0) setItemCat(categories[0]);
      if (!itemFormat && formats && formats.length > 0) setItemFormat(formats[0]?.id || '');
  }, [categories, formats]);

  const addProduct = () => {
    if (!itemName || !itemCat || !itemFormat) return;
    const newItem: StockItem = {
      id: Math.random().toString(36).substr(2, 9),
      articleCode: itemArticleCode,
      name: itemName,
      category: itemCat,
      formatId: itemFormat,
      pricePerUnit: 0,
      lastUpdated: new Date().toISOString(),
      isDLC: itemIsDlc,
      dlcProfileId: itemIsDlc ? itemDlcProfile : undefined,
      order: items.length,
      isDraft: true
    };
    setItems(prev => [...prev, newItem]);
    onSync('SAVE_ITEM', newItem);
    
    // Reset form
    setItemName('');
    setItemArticleCode('');
    setItemIsDlc(false);
    setItemDlcProfile('');
  };

  const handleConfigChange = (field: keyof AppConfig, value: any) => {
      setAppConfig(prev => ({ ...prev, [field]: value }));
      onSync('SAVE_CONFIG', { key: 'temp_item_duration', value: value });
  };

  const deleteFormat = (id: string) => {
    if (items.some(i => i.formatId === id)) {
      setErrorModal("Ce format est utilisé par des articles. Impossible de le supprimer.");
      return;
    }
    setFormats(prev => prev.filter(f => f.id !== id));
    onSync('DELETE_FORMAT', { id });
  };

  const deleteCategory = (cat: Category) => {
    if (items.some(i => i.category === cat)) {
      setErrorModal("Cette catégorie est utilisée par des articles. Impossible de la supprimer.");
      return;
    }
    setCategories(prev => prev.filter(c => c !== cat));
    onSync('DELETE_CATEGORY', { name: cat });
  };

  const moveCategory = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === categories.length - 1) return;

    const newCategories = [...categories];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    [newCategories[index], newCategories[targetIndex]] = [newCategories[targetIndex], newCategories[index]];
    
    setCategories(newCategories);
    onSync('REORDER_CATEGORIES', { categories: newCategories });
  };

  const addUser = () => {
    if (!newUserName || newUserPin.length !== 4) {
        setErrorModal("Le nom est requis et le code PIN doit contenir exactement 4 chiffres.");
        return;
    }
    const newUser: User = {
        id: 'u' + Date.now(),
        name: newUserName,
        role: newUserRole,
        pin: newUserPin
    };
    setUsers(prev => [...prev, newUser]);
    onSync('SAVE_USER', newUser);
    setNewUserName('');
    setNewUserPin('');
    setNewUserRole('BARMAN');
  };

  const updateUser = (id: string, field: keyof User, value: string) => {
    if (id === 'admin' && (field === 'role' || field === 'id')) return; 
    if (field === 'pin') {
        if (!/^\d*$/.test(value)) return;
        if (value.length > 4) return;
    }
    setUsers(prev => prev.map(u => {
        if (u.id === id) {
            const updated = { ...u, [field]: value };
            onSync('SAVE_USER', updated);
            return updated;
        }
        return u;
    }));
  };

  const deleteUser = (id: string) => {
      if (id === 'admin') return; 
      if (window.confirm("Supprimer cet utilisateur ?")) {
          setUsers(prev => prev.filter(u => u.id !== id));
      }
  };

  const addDlcProfile = () => {
    if (!newDlcName || newDlcDuration <= 0) return;
    const durationInHours = newDlcUnit === 'DAYS' ? newDlcDuration * 24 : newDlcDuration;
    const newProfile: DLCProfile = {
      id: 'd' + Date.now(),
      name: newDlcName,
      durationHours: durationInHours
    };
    setDlcProfiles(prev => [...prev, newProfile]);
    onSync('SAVE_DLC_PROFILE', newProfile);
    setNewDlcName('');
    setNewDlcDuration(24);
  };

  const deleteDlcProfile = (id: string) => {
    if (items.some(i => i.dlcProfileId === id)) {
      setErrorModal("Ce profil DLC est utilisé par des articles. Impossible de le supprimer.");
      return;
    }
    setDlcProfiles(prev => prev.filter(p => p.id !== id));
    onSync('DELETE_DLC_PROFILE', { id });
  };

  const addStorage = () => {
    if (!storageName) return;
    const newStorage = { id: 's' + Date.now(), name: storageName };
    setStorages(prev => [...prev.filter(s=>s.id!=='s0'), newStorage, prev.find(s=>s.id==='s0') || {id: 's0', name: 'Surstock'}]);
    onSync('SAVE_STORAGE', newStorage);
    setStorageName('');
  };

  const deleteStorage = (id: string) => {
    setStorages(prev => prev.filter(st => st.id !== id));
    onSync('DELETE_STORAGE', { id });
  };

  const addFormat = () => {
    if (!formatName) return;
    const newFormat: Format = { id: 'f' + Date.now(), name: formatName, value: formatValue };
    setFormats(prev => [...prev, newFormat]);
    onSync('SAVE_FORMAT', newFormat);
    setFormatName('');
    setFormatValue(0);
  };

  const addCategory = () => {
    if (!newCatName) return;
    setCategories(prev => [...prev, newCatName]);
    onSync('SAVE_CATEGORY', { name: newCatName });
    setNewCatName('');
  };

  const adminUser = users.find(u => u.id === 'admin');
  const staffUsers = users.filter(u => u.id !== 'admin');

  return (
    <div className="space-y-6 relative">
      {errorModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl border border-slate-200 text-center space-y-6">
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Action Impossible</h3>
            <p className="text-slate-600 font-medium leading-relaxed">{errorModal}</p>
            <button onClick={() => setErrorModal(null)} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-lg hover:bg-slate-800 transition-all uppercase tracking-widest active:scale-95">Fermer</button>
          </div>
        </div>
      )}

      <div className="flex border-b border-slate-200 overflow-x-auto">
        <button onClick={() => setActiveSubTab('general')} className={`px-6 py-3 font-black uppercase text-[10px] tracking-widest border-b-2 whitespace-nowrap ${activeSubTab === 'general' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Paramètres Généraux</button>
        <button onClick={() => setActiveSubTab('priorities')} className={`px-6 py-3 font-black uppercase text-[10px] tracking-widest border-b-2 whitespace-nowrap ${activeSubTab === 'priorities' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Priorités Stock</button>
        {currentUser?.role === 'ADMIN' && (
          <>
            <button onClick={() => setActiveSubTab('users')} className={`px-6 py-3 font-black uppercase text-[10px] tracking-widest border-b-2 whitespace-nowrap ${activeSubTab === 'users' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Utilisateurs</button>
            <button onClick={() => setActiveSubTab('dlc')} className={`px-6 py-3 font-black uppercase text-[10px] tracking-widest border-b-2 whitespace-nowrap ${activeSubTab === 'dlc' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Configuration DLC</button>
          </>
        )}
      </div>

      {activeSubTab === 'general' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
              <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-indigo-600 rounded-full"></span>Nouveau Produit</h3>
              
              <div className="space-y-4">
                <input className="w-full bg-slate-50 p-4 border rounded-2xl font-bold outline-none" placeholder="Nom du produit..." value={itemName} onChange={e => setItemName(e.target.value)} />
                <input className="w-full bg-slate-50 p-4 border rounded-2xl font-bold outline-none text-sm" placeholder="Code Article (Optionnel - ID API/POS)" value={itemArticleCode} onChange={e => setItemArticleCode(e.target.value)} />
                
                <div className="grid grid-cols-2 gap-4">
                    <select className="w-full bg-slate-50 p-4 border rounded-2xl font-bold outline-none" value={itemCat} onChange={e => setItemCat(e.target.value)}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
                    <select className="w-full bg-slate-50 p-4 border rounded-2xl font-bold outline-none" value={itemFormat} onChange={e => setItemFormat(e.target.value)}>{formats.map(f => f && <option key={f.id} value={f.id}>{f.name}</option>)}</select>
                </div>

                <div className="bg-slate-50 p-4 border rounded-2xl flex flex-col gap-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                      checked={itemIsDlc}
                      onChange={e => setItemIsDlc(e.target.checked)}
                    />
                    <span className="font-bold text-sm text-slate-700">Activer le Tracking DLC</span>
                  </label>
                  
                  {itemIsDlc && (
                    <select 
                      className="w-full bg-white p-3 border rounded-xl font-bold text-sm outline-none"
                      value={itemDlcProfile}
                      onChange={e => setItemDlcProfile(e.target.value)}
                    >
                      <option value="">-- Sélectionner un profil --</option>
                      {dlcProfiles.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.durationHours}h)</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <button onClick={addProduct} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700">Ajouter</button>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
              <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-amber-600 rounded-full"></span>Gestion des Formats</h3>
              <div className="flex gap-2">
                <input className="flex-1 bg-slate-50 p-4 border rounded-2xl font-bold outline-none" placeholder="Nom (ex: 70cl)..." value={formatName} onChange={e => setFormatName(e.target.value)} />
                <input type="number" className="w-24 bg-slate-50 p-4 border rounded-2xl font-bold outline-none text-center" placeholder="Val (70)" value={formatValue || ''} onChange={e => setFormatValue(parseFloat(e.target.value))} />
                <button onClick={addFormat} className="bg-amber-600 text-white px-6 rounded-2xl font-black uppercase tracking-widest hover:bg-amber-700">OK</button>
              </div>
              <div className="space-y-2">
                {formats.map(f => f && (
                  <div key={f.id} className="flex items-center justify-between bg-slate-50 px-5 py-3 rounded-2xl border group">
                    <div className="flex gap-2 items-center">
                        <span className="font-black text-[10px] uppercase tracking-widest">{f.name}</span>
                        {f.value ? <span className="bg-indigo-100 text-indigo-600 text-[9px] font-black px-1.5 rounded">{f.value}</span> : null}
                    </div>
                    <button onClick={() => deleteFormat(f.id)} className="text-rose-400 hover:text-rose-600 opacity-0 group-hover:opacity-100"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
              <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>Gestion des Catégories</h3>
              <div className="flex gap-2">
                <input className="flex-1 bg-slate-50 p-4 border rounded-2xl font-bold outline-none" placeholder="Nouvelle catégorie..." value={newCatName} onChange={e => setNewCatName(e.target.value)} />
                <button onClick={addCategory} className="bg-emerald-500 text-white px-6 rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-600">OK</button>
              </div>
              <div className="space-y-2">
                {categories.map((c, index) => c && (
                  <div key={c} className="flex items-center justify-between bg-slate-50 px-5 py-3 rounded-2xl border group">
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1">
                            <button 
                                onClick={() => moveCategory(index, 'up')}
                                disabled={index === 0}
                                className={`p-1 rounded bg-slate-100 hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 ${index === 0 ? 'opacity-20' : ''}`}
                            >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
                            </button>
                            <button 
                                onClick={() => moveCategory(index, 'down')}
                                disabled={index === categories.length - 1}
                                className={`p-1 rounded bg-slate-100 hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 ${index === categories.length - 1 ? 'opacity-20' : ''}`}
                            >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                        </div>
                        <span className="font-black text-[10px] uppercase tracking-widest">{c}</span>
                    </div>
                    <button onClick={() => deleteCategory(c)} className="text-rose-400 hover:text-rose-600 opacity-0 group-hover:opacity-100"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
              <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-slate-800 rounded-full"></span>Espaces de Stockage</h3>
              <div className="flex gap-2">
                <input className="flex-1 bg-slate-50 p-4 border rounded-2xl font-bold outline-none" placeholder="Nom..." value={storageName} onChange={e => setStorageName(e.target.value)} />
                <button onClick={addStorage} className="bg-slate-800 text-white px-6 rounded-2xl font-black uppercase tracking-widest">OK</button>
              </div>
              <div className="space-y-2">
                {storages.map(s => s && (
                  <div key={s.id} className="flex items-center justify-between bg-slate-50 px-5 py-3 rounded-2xl border group">
                    <span className="font-black text-[10px] uppercase tracking-widest">{s.name}</span>
                    {s.id !== 's0' && <button onClick={() => deleteStorage(s.id)} className="text-rose-400 hover:text-rose-600 opacity-0 group-hover:opacity-100"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
                <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-amber-500 rounded-full"></span>Durée de vie Articles Temporaires</h3>
                <p className="text-[10px] text-slate-400 font-medium">Les articles temporaires non intégrés après cette durée seront automatiquement supprimés.</p>
                <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold outline-none uppercase text-xs cursor-pointer focus:ring-2 focus:ring-amber-200 transition-all"
                    value={appConfig.tempItemDuration}
                    onChange={(e) => handleConfigChange('tempItemDuration', e.target.value)}
                >
                    <option value="3_DAYS">3 Jours</option>
                    <option value="7_DAYS">7 Jours</option>
                    <option value="14_DAYS">14 Jours</option>
                    <option value="1_MONTH">1 Mois</option>
                    <option value="3_MONTHS">3 Mois</option>
                    <option value="INFINITE">Infini (Ne jamais supprimer)</option>
                </select>
            </div>
          </div>
        </div>
      )}
      
      {activeSubTab === 'priorities' && (
        <PriorityConfig items={items} storages={storages} priorities={priorities} setPriorities={setPriorities} categories={categories} onSync={onSync} />
      )}
      
      {activeSubTab === 'users' && currentUser?.role === 'ADMIN' && (
         <div className="space-y-8">
           {adminUser && (
               <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm border-indigo-100 bg-indigo-50/20">
                    <h3 className="font-black text-sm uppercase flex items-center gap-2 mb-6"><span className="w-1.5 h-4 bg-slate-900 rounded-full"></span>Compte Administrateur</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Nom d'affichage</label>
                            <input type="text" value={adminUser.name} onChange={(e) => updateUser(adminUser.id, 'name', e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-indigo-100 transition-all" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Code PIN (Accès)</label>
                            <input type="text" value={adminUser.pin} maxLength={4} onChange={(e) => updateUser(adminUser.id, 'pin', e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl p-4 font-black outline-none text-center tracking-widest focus:ring-2 focus:ring-indigo-100 transition-all" />
                        </div>
                    </div>
               </div>
           )}

           <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
             <h3 className="font-black text-sm uppercase flex items-center gap-2 mb-6"><span className="w-1.5 h-4 bg-slate-400 rounded-full"></span>Gestion des Utilisateurs</h3>
             
             <div className="mb-8 p-6 bg-slate-50 rounded-3xl border border-slate-200 flex flex-col gap-4">
               <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1 w-full space-y-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Nom</label>
                      <input type="text" className="w-full bg-white border border-slate-200 rounded-2xl p-4 font-bold outline-none" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="Thomas" />
                  </div>
                  <div className="w-full md:w-32 space-y-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Rôle</label>
                      <select className="w-full bg-white border border-slate-200 rounded-2xl p-4 font-bold outline-none uppercase text-xs" value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as UserRole)}><option value="BARMAN">Barman</option><option value="ADMIN">Admin</option></select>
                  </div>
                  <div className="w-full md:w-32 space-y-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">PIN</label>
                      <input type="text" maxLength={4} className="w-full bg-white border border-slate-200 rounded-2xl p-4 font-black outline-none text-center tracking-widest" value={newUserPin} onChange={(e) => { if (/^\d*$/.test(e.target.value)) setNewUserPin(e.target.value); }} placeholder="0000" />
                  </div>
               </div>
               <button onClick={addUser} className="w-full bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-200">Ajouter l'utilisateur</button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {staffUsers.map(user => user && (
                 <div key={user.id} className="p-6 rounded-3xl border flex flex-col gap-4 bg-white border-slate-200 shadow-sm relative group">
                   <button onClick={() => deleteUser(user.id)} className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Supprimer l'utilisateur"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                   <div className="space-y-3">
                      <select value={user.role} onChange={(e) => updateUser(user.id, 'role', e.target.value)} className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded inline-block border-none outline-none cursor-pointer ${user.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}><option value="BARMAN">Barman</option><option value="ADMIN">Admin</option></select>
                      <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">Nom</label><input type="text" value={user.name || ''} onChange={(e) => updateUser(user.id, 'name', e.target.value)} className="w-full bg-slate-50 p-3 rounded-xl font-bold text-slate-800 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all" /></div>
                      <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">PIN</label><input type="text" value={user.pin || ''} maxLength={4} onChange={(e) => updateUser(user.id, 'pin', e.target.value)} className="w-full bg-slate-50 p-3 rounded-xl font-black text-slate-800 text-center tracking-widest outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all" /></div>
                   </div>
                 </div>
               ))}
               {staffUsers.length === 0 && (
                   <div className="col-span-full py-8 text-center text-slate-400 italic font-medium">Aucun membre dans l'équipe.</div>
               )}
             </div>
           </div>
         </div>
      )}

      {activeSubTab === 'dlc' && currentUser?.role === 'ADMIN' && (
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
           <h3 className="font-black text-sm uppercase flex items-center gap-2 mb-6"><span className="w-1.5 h-4 bg-amber-500 rounded-full"></span>Profils de DLC</h3>
           <div className="mb-8 p-6 bg-amber-50 rounded-3xl border border-amber-100 flex flex-col md:flex-row gap-4 items-end">
             <div className="flex-1 w-full space-y-2">
                <label className="text-[9px] font-black text-amber-600 uppercase tracking-widest ml-1">Nom du profil</label>
                <input type="text" className="w-full bg-white border border-amber-200 rounded-2xl p-4 font-bold outline-none" value={newDlcName} onChange={(e) => setNewDlcName(e.target.value)} />
             </div>
             <div className="w-full md:w-48 space-y-2">
                <label className="text-[9px] font-black text-amber-600 uppercase tracking-widest ml-1">Durée</label>
                <input type="number" min="1" className="w-full bg-white border border-amber-200 rounded-2xl p-4 font-bold outline-none text-center" value={newDlcDuration} onChange={(e) => setNewDlcDuration(parseInt(e.target.value) || 0)} />
             </div>
             <div className="w-full md:w-48 space-y-2">
                <label className="text-[9px] font-black text-amber-600 uppercase tracking-widest ml-1">Unité</label>
                <select className="w-full bg-white border border-amber-200 rounded-2xl p-4 font-bold outline-none" value={newDlcUnit} onChange={(e) => setNewDlcUnit(e.target.value as 'HOURS' | 'DAYS')}><option value="HOURS">Heure(s)</option><option value="DAYS">Jour(s)</option></select>
             </div>
             <button onClick={addDlcProfile} className="bg-amber-500 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-amber-600 shadow-lg shadow-amber-200">Ajouter</button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {dlcProfiles.map(p => p && (
               <div key={p.id} className="flex items-center justify-between p-5 rounded-2xl border border-slate-100 bg-white hover:shadow-md transition-all group">
                 <div><p className="font-black text-slate-800">{p.name || 'Profil'}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{p.durationHours >= 24 ? `${Number((p.durationHours / 24).toFixed(1))} Jour(s)` : `${p.durationHours} Heure(s)`}</p></div>
                 <button onClick={() => deleteDlcProfile(p.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 bg-slate-50 hover:bg-rose-50 p-2 rounded-xl"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
               </div>
             ))}
           </div>
        </div>
      )}
    </div>
  );
};

export default Configuration;