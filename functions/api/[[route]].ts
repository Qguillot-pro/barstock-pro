import { Pool } from '@neondatabase/serverless';

interface Env {
  DATABASE_URL: string;
}

// Define Cloudflare Pages types locally to avoid compilation errors
interface EventContext<Env, P extends string, Data> {
  request: Request;
  functionPath: string;
  waitUntil: (promise: Promise<any>) => void;
  passThroughOnException: () => void;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  env: Env;
  params: Record<P, string | string[]>;
  data: Data;
}

type PagesFunction<Env = unknown, Params extends string = any, Data extends Record<string, unknown> = Record<string, unknown>> = (
  context: EventContext<Env, Params, Data>
) => Response | Promise<Response>;

// Helper pour les réponses CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // Gestion des requêtes OPTIONS (Pre-flight CORS)
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!env.DATABASE_URL) {
    return new Response(JSON.stringify({ error: "Configuration serveur manquante (DATABASE_URL)" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  // Initialisation du Pool Neon
  const pool = new Pool({ connectionString: env.DATABASE_URL });

  try {
    const url = new URL(request.url);
    const path = url.pathname; // ex: /api/init

    // --- GET ROUTE: INITIALISATION ---
    if (request.method === 'GET' && path.includes('/init')) {
      const [items, users, storages, stockLevels, consignes, transactions, orders, dlcHistory, formats, categories, priorities, dlcProfiles, unfulfilledOrders, appConfig] = await Promise.all([
        pool.query('SELECT * FROM items ORDER BY sort_order ASC'),
        pool.query('SELECT * FROM users'),
        pool.query('SELECT * FROM storage_spaces ORDER BY sort_order ASC, name ASC'),
        pool.query('SELECT * FROM stock_levels'),
        pool.query('SELECT * FROM stock_consignes'),
        pool.query('SELECT * FROM transactions ORDER BY date DESC LIMIT 1000'),
        pool.query('SELECT * FROM orders ORDER BY date DESC'),
        pool.query('SELECT * FROM dlc_history ORDER BY opened_at DESC LIMIT 500'),
        pool.query('SELECT * FROM formats'),
        pool.query('SELECT * FROM categories ORDER BY sort_order ASC'),
        pool.query('SELECT * FROM stock_priorities'),
        pool.query('SELECT * FROM dlc_profiles'),
        pool.query('SELECT * FROM unfulfilled_orders ORDER BY date DESC LIMIT 500'),
        pool.query('SELECT * FROM app_config')
      ]);

      const configMap: any = { tempItemDuration: '14_DAYS' };
      appConfig.rows.forEach(row => {
          if (row.key === 'temp_item_duration') configMap.tempItemDuration = row.value;
      });

      // Nettoyage automatique (fire and forget logic, mais await pour edge workers)
      // Note: Sur Edge, il vaut mieux faire ça en background, mais ici on le fait en inline pour simplifier
      try {
        let interval = null;
        const durationSetting = configMap.tempItemDuration;
        
        if (durationSetting === '3_DAYS') interval = "3 days";
        else if (durationSetting === '7_DAYS') interval = "7 days";
        else if (durationSetting === '14_DAYS') interval = "14 days";
        else if (durationSetting === '1_MONTH') interval = "1 month";
        else if (durationSetting === '3_MONTHS') interval = "3 months";
        
        if (interval) {
            await pool.query(`
                DELETE FROM items 
                WHERE is_temporary = true 
                AND created_at < NOW() - INTERVAL '${interval}'
            `);
        }
      } catch (e) { console.error("Cleanup error", e); }

      const responseBody = {
          items: items.rows.map(row => ({
            id: row.id,
            articleCode: row.article_code,
            name: row.name,
            category: row.category,
            formatId: row.format_id,
            pricePerUnit: parseFloat(row.price_per_unit || '0'),
            lastUpdated: row.last_updated,
            createdAt: row.created_at,
            isDLC: row.is_dlc,
            dlcProfileId: row.dlc_profile_id,
            order: row.sort_order,
            isDraft: row.is_draft,
            isTemporary: row.is_temporary
          })),
          users: users.rows,
          storages: storages.rows.map(s => ({ id: s.id, name: s.name, order: s.sort_order })),
          stockLevels: stockLevels.rows.map(row => ({ itemId: row.item_id, storageId: row.storage_id, currentQuantity: parseFloat(row.quantity || '0') })),
          consignes: consignes.rows.map(row => ({ itemId: row.item_id, storageId: row.storage_id, minQuantity: parseFloat(row.min_quantity || '0') })),
          transactions: transactions.rows.map(t => ({
              ...t, 
              itemId: t.item_id, 
              storageId: t.storage_id, 
              quantity: parseFloat(t.quantity || '0'),
              isCaveTransfer: t.is_cave_transfer, 
              userName: t.user_name
          })),
          orders: orders.rows.map(row => ({ 
              id: row.id, 
              itemId: row.item_id, 
              quantity: parseFloat(row.quantity || '0'),
              initialQuantity: row.initial_quantity ? parseFloat(row.initial_quantity) : null,
              date: row.date, 
              status: row.status, 
              userName: row.user_name,
              ruptureDate: row.rupture_date,
              orderedAt: row.ordered_at,
              receivedAt: row.received_at
          })),
          dlcHistory: dlcHistory.rows.map(d => ({...d, itemId: d.item_id, storageId: d.storage_id, openedAt: d.opened_at, userName: d.user_name})),
          formats: formats.rows.map(f => ({ id: f.id, name: f.name, value: parseFloat(f.value || '0') })),
          categories: categories.rows.map(c => c.name),
          priorities: priorities.rows.map(p => ({ itemId: p.item_id, storageId: p.storage_id, priority: p.priority })),
          dlcProfiles: dlcProfiles.rows.map(p => ({ id: p.id, name: p.name, durationHours: p.duration_hours })),
          unfulfilledOrders: unfulfilledOrders.rows.map(u => ({ id: u.id, itemId: u.item_id, date: u.date, userName: u.user_name })),
          appConfig: configMap
      };

      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // --- POST ROUTE: ACTIONS ---
    if (request.method === 'POST') {
      const bodyText = await request.text();
      const { action, payload } = JSON.parse(bodyText || '{}');

      switch (action) {
        case 'SAVE_CONFIG': {
            const { key, value } = payload;
            await pool.query(`
                INSERT INTO app_config (key, value) VALUES ($1, $2)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
            `, [key, value]);
            break;
        }

        case 'SAVE_ITEM': {
          const { id, name, articleCode, category, formatId, pricePerUnit, isDLC, dlcProfileId, order, isDraft, isTemporary, createdAt } = payload;
          await pool.query(`
            INSERT INTO items (id, article_code, name, category, format_id, price_per_unit, is_dlc, dlc_profile_id, sort_order, is_draft, is_temporary, created_at, last_updated)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, NOW()), NOW())
            ON CONFLICT (id) DO UPDATE SET
              article_code = EXCLUDED.article_code,
              name = EXCLUDED.name, category = EXCLUDED.category, format_id = EXCLUDED.format_id,
              price_per_unit = EXCLUDED.price_per_unit, is_dlc = EXCLUDED.is_dlc, 
              dlc_profile_id = EXCLUDED.dlc_profile_id, sort_order = EXCLUDED.sort_order, 
              is_draft = EXCLUDED.is_draft, is_temporary = EXCLUDED.is_temporary, last_updated = NOW()
          `, [id, articleCode, name, category, formatId, pricePerUnit, isDLC, dlcProfileId, order, isDraft, isTemporary, createdAt]);
          break;
        }

        case 'DELETE_ITEM': {
          await pool.query('DELETE FROM items WHERE id = $1', [payload.id]);
          break;
        }

        case 'SAVE_STOCK': {
          const { itemId, storageId, currentQuantity } = payload;
          await pool.query(`
            INSERT INTO stock_levels (item_id, storage_id, quantity)
            VALUES ($1, $2, $3)
            ON CONFLICT (item_id, storage_id) DO UPDATE SET quantity = EXCLUDED.quantity
          `, [itemId, storageId, currentQuantity]);
          break;
        }

        case 'SAVE_TRANSACTION': {
          const { id, itemId, storageId, type, quantity, date, note, isCaveTransfer, userName } = payload;
          await pool.query(`
            INSERT INTO transactions (id, item_id, storage_id, type, quantity, date, note, is_cave_transfer, user_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [id, itemId, storageId, type, quantity, date, note, isCaveTransfer, userName]);
          break;
        }

        case 'SAVE_ORDER': {
          const { id, itemId, quantity, initialQuantity, date, status, userName, ruptureDate, orderedAt, receivedAt } = payload;
          await pool.query(`
            INSERT INTO orders (id, item_id, quantity, initial_quantity, date, status, user_name, rupture_date, ordered_at, received_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO UPDATE SET
              status = EXCLUDED.status,
              quantity = EXCLUDED.quantity,
              initial_quantity = EXCLUDED.initial_quantity,
              rupture_date = EXCLUDED.rupture_date,
              ordered_at = EXCLUDED.ordered_at,
              received_at = EXCLUDED.received_at
          `, [id, itemId, quantity, initialQuantity, date, status, userName, ruptureDate, orderedAt, receivedAt]);
          break;
        }

        case 'SAVE_UNFULFILLED_ORDER': {
            const { id, itemId, date, userName } = payload;
            await pool.query(`
                INSERT INTO unfulfilled_orders (id, item_id, date, user_name)
                VALUES ($1, $2, $3, $4)
            `, [id, itemId, date, userName]);
            break;
        }

        case 'SAVE_DLC_HISTORY': {
            const { id, itemId, storageId, openedAt, userName } = payload;
            await pool.query(`
                INSERT INTO dlc_history (id, item_id, storage_id, opened_at, user_name)
                VALUES ($1, $2, $3, $4, $5)
            `, [id, itemId, storageId, openedAt, userName]);
            break;
        }

        case 'DELETE_DLC_HISTORY': {
            await pool.query('DELETE FROM dlc_history WHERE id = $1', [payload.id]);
            break;
        }

        case 'SAVE_USER': {
            const { id, name, role, pin } = payload;
            await pool.query(`
                INSERT INTO users (id, name, role, pin)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, pin = EXCLUDED.pin
            `, [id, name, role, pin]);
            break;
        }

        case 'SAVE_STORAGE': {
            const { id, name } = payload;
            await pool.query(`
                INSERT INTO storage_spaces (id, name) VALUES ($1, $2)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            `, [id, name]);
            break;
        }

        case 'SAVE_STORAGE_ORDER': {
            const { id, order } = payload;
            await pool.query(`
                UPDATE storage_spaces SET sort_order = $2 WHERE id = $1
            `, [id, order]);
            break;
        }

        case 'DELETE_STORAGE': {
            await pool.query('DELETE FROM storage_spaces WHERE id = $1', [payload.id]);
            break;
        }

        case 'SAVE_FORMAT': {
            const { id, name, value } = payload;
            await pool.query(`
                INSERT INTO formats (id, name, value) VALUES ($1, $2, $3)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, value = EXCLUDED.value
            `, [id, name, value]);
            break;
        }
        
        case 'DELETE_FORMAT': {
            await pool.query('DELETE FROM formats WHERE id = $1', [payload.id]);
            break;
        }

        case 'SAVE_CATEGORY': {
            const { name } = payload;
            await pool.query(`
                INSERT INTO categories (name, sort_order) 
                VALUES ($1, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories))
                ON CONFLICT (name) DO NOTHING
            `, [name]);
            break;
        }

        case 'DELETE_CATEGORY': {
            await pool.query('DELETE FROM categories WHERE name = $1', [payload.name]);
            break;
        }

        case 'REORDER_CATEGORIES': {
            const { categories } = payload; 
            for (let i = 0; i < categories.length; i++) {
                await pool.query('UPDATE categories SET sort_order = $1 WHERE name = $2', [i, categories[i]]);
            }
            break;
        }

        case 'SAVE_PRIORITY': {
            const { itemId, storageId, priority } = payload;
            await pool.query(`
                INSERT INTO stock_priorities (item_id, storage_id, priority)
                VALUES ($1, $2, $3)
                ON CONFLICT (item_id, storage_id) DO UPDATE SET priority = EXCLUDED.priority
            `, [itemId, storageId, priority]);
            break;
        }

        case 'SAVE_CONSIGNE': {
            const { itemId, storageId, minQuantity } = payload;
            await pool.query(`
                INSERT INTO stock_consignes (item_id, storage_id, min_quantity)
                VALUES ($1, $2, $3)
                ON CONFLICT (item_id, storage_id) DO UPDATE SET min_quantity = EXCLUDED.min_quantity
            `, [itemId, storageId, minQuantity]);
            break;
        }
        
        case 'SAVE_DLC_PROFILE': {
            const { id, name, durationHours } = payload;
            await pool.query(`
                INSERT INTO dlc_profiles (id, name, duration_hours)
                VALUES ($1, $2, $3)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, duration_hours = EXCLUDED.duration_hours
            `, [id, name, durationHours]);
            break;
        }

        case 'DELETE_DLC_PROFILE': {
            await pool.query('DELETE FROM dlc_profiles WHERE id = $1', [payload.id]);
            break;
        }

        default:
          return new Response(JSON.stringify({ error: 'Action inconnue' }), { status: 400, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  } catch (error: any) {
    console.error('Erreur DB:', error);
    return new Response(JSON.stringify({ 
        error: 'Erreur Base de Données', 
        details: error.message 
    }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  } finally {
    // context.waitUntil(pool.end()); // Optionnel sur Serverless, le pool gère
  }
};
