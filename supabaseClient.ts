import { createClient } from '@supabase/supabase-js';

// On récupère les clés depuis les variables d'environnement
// Fix: Cast import.meta to any to resolve TS error "Property 'env' does not exist on type 'ImportMeta'"
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || (import.meta as any).env?.VITE_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Les clés Supabase sont manquantes dans les variables d'environnement !");
}

export const supabase = createClient(supabaseUrl, supabaseKey);