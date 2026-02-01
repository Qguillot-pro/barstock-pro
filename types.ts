
export enum DefaultCategory {
  SPIRITS = 'Spiritueux',
  WINE = 'Vins',
  BEER = 'Bières',
  SOFT = 'Softs',
  COCKTAIL_COMPONENTS = 'Ingrédients Cocktail',
  OTHER = 'Autre'
}

export const CATEGORY_ORDER = [
  'Spiritueux',
  'Vins',
  'Bières',
  'Softs',
  'Ingrédients Cocktail',
  'Autre'
];

export type Category = string;
export type UserRole = 'ADMIN' | 'BARMAN';

export interface AppConfig {
  tempItemDuration: '3_DAYS' | '7_DAYS' | '14_DAYS' | '1_MONTH' | '3_MONTHS' | 'INFINITE';
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  pin: string;
}

export interface DLCProfile {
  id: string;
  name: string;
  durationHours: number;
}

export interface StorageSpace {
  id: string;
  name: string;
  order?: number; // Ordre d'affichage des colonnes
}

export interface Format {
  id: string;
  name: string;
  value?: number; // Contenance ou quantité unitaire (ex: 70 pour 70cl)
}

export interface StockItem {
  id: string;
  articleCode?: string; // Nouveau champ pour le code article (ex: ID POS Astério)
  name: string;
  category: Category;
  formatId: string;
  pricePerUnit: number;
  lastUpdated: string;
  createdAt?: string; // Date de création pour gestion temporaire
  isDLC?: boolean;
  dlcProfileId?: string;
  order: number;
  isDraft?: boolean;
  isTemporary?: boolean; // Indicateur produit non prévu
}

export interface DLCHistory {
  id: string;
  itemId: string;
  storageId: string;
  openedAt: string;
  userName?: string;
}

export interface StockConsigne {
  itemId: string;
  storageId: string;
  minQuantity: number;
}

export interface StockPriority {
  itemId: string;
  storageId: string;
  priority: number; 
}

export interface StockLevel {
  itemId: string;
  storageId: string;
  currentQuantity: number;
}

export interface Transaction {
  id: string;
  itemId: string;
  storageId: string;
  type: 'IN' | 'OUT';
  quantity: number;
  date: string;
  note?: string; 
  isCaveTransfer?: boolean;
  userName?: string;
}

export interface PendingOrder {
  id: string;
  itemId: string;
  quantity: number;
  initialQuantity?: number; // Quantité initialement commandée
  date: string;
  ruptureDate?: string;
  orderedAt?: string;
  status: 'PENDING' | 'ORDERED' | 'RECEIVED';
  receivedAt?: string;
  userName?: string;
}

export interface UnfulfilledOrder {
  id: string;
  itemId: string;
  date: string;
  userName?: string;
}