
import React, { useState } from 'react';
import { Format, Category, DefaultCategory } from '../types';

interface ImportDataProps {
  onImport: (data: any[]) => void;
  formats: Format[];
}

const ImportData: React.FC<ImportDataProps> = ({ onImport, formats }) => {
  const [sheetUrl, setSheetUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCsvImport = async () => {
    if (!sheetUrl.includes('docs.google.com/spreadsheets')) {
      alert("Veuillez entrer une URL Google Sheets valide.");
      return;
    }

    setLoading(true);
    try {
      const baseIdx = sheetUrl.indexOf('/d/');
      const endIdx = sheetUrl.indexOf('/', baseIdx + 3);
      const sheetId = sheetUrl.substring(baseIdx + 3, endIdx);
      
      // We use the export=csv endpoint which is more reliable for direct parsing
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;

      const response = await fetch(csvUrl, {
        method: 'GET',
        mode: 'cors', // Ensure CORS is handled
        headers: { 'Accept': 'text/csv' }
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}. Vérifiez que le document est partagé 'Tous les utilisateurs disposant du lien'.`);
      }
      
      const csvText = await response.text();
      const rows = csvText.split('\n').map(row => {
        // Simple CSV splitter that handles basic commas (not perfect for quoted strings, but sufficient for item names)
        return row.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
      });
      
      // START AT ROW 3 (Index 2)
      // Column B (Index 1) contains the items
      let currentCategory: Category = DefaultCategory.OTHER;
      const importedItems = [];

      for (let i = 2; i < rows.length; i++) {
        const row = rows[i];
        const cellB = row[1]; // Column B

        if (!cellB) continue;

        // Fixed: Logic to detect if Cell B is a category header or a product
        // Using DefaultCategory enum values as a reference
        const foundCat = Object.values(DefaultCategory).find(c => {
          const searchStr = String(cellB).toLowerCase();
          const targetStr = String(c).toLowerCase();
          return searchStr === targetStr || searchStr.includes(targetStr);
        });
        
        if (foundCat) {
          currentCategory = foundCat;
          continue; // It's a category header, skip adding as product
        }

        // 2. Otherwise, treat as a product
        importedItems.push({
          name: cellB,
          categorie: currentCategory,
          raw: row
        });
      }

      if (importedItems.length === 0) {
        alert("Aucun produit détecté à partir de la ligne 3 dans la colonne B.");
      } else {
        onImport(importedItems);
        alert(`${importedItems.length} produits importés avec succès.`);
      }
    } catch (error) {
      console.error("Import Error:", error);
      alert("Échec de la récupération des données. Assurez-vous que le lien est correct et accessible publiquement.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-indigo-50 border border-indigo-100 p-8 rounded-[2.5rem] space-y-5 shadow-inner">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-indigo-900 flex items-center gap-3 uppercase text-xs tracking-widest">
          <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center shadow-lg">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          Importation Google Sheets
        </h3>
        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">Lecture: Col B / Ligne 3+</span>
      </div>
      
      <div className="flex gap-3">
        <input 
          type="text"
          className="flex-1 p-5 bg-white border border-indigo-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-sm shadow-sm transition-all"
          placeholder="https://docs.google.com/spreadsheets/d/..."
          value={sheetUrl}
          onChange={e => setSheetUrl(e.target.value)}
        />
        <button 
          onClick={handleCsvImport}
          disabled={loading}
          className="bg-indigo-600 text-white px-10 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95 shadow-xl shadow-indigo-200"
        >
          {loading ? 'Chargement...' : 'Synchroniser'}
        </button>
      </div>
    </div>
  );
};

export default ImportData;
