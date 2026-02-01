-- A EXÉCUTER DANS L'ÉDITEUR SQL DE NEON
-- Ce script initialise la structure de la base de données.

-- 1. Tables de Configuration
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    pin TEXT NOT NULL
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS pin TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;

CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Config par défaut si inexistante
INSERT INTO app_config (key, value) VALUES ('temp_item_duration', '14_DAYS') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS storage_spaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
);

ALTER TABLE storage_spaces ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS formats (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    value NUMERIC DEFAULT 0
);

ALTER TABLE formats ADD COLUMN IF NOT EXISTS value NUMERIC DEFAULT 0;

CREATE TABLE IF NOT EXISTS categories (
    name TEXT PRIMARY KEY,
    sort_order INTEGER DEFAULT 0
);

ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS dlc_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    duration_hours INTEGER NOT NULL
);

-- 2. Table Principale Articles
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    article_code TEXT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    format_id TEXT NOT NULL,
    price_per_unit NUMERIC DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    is_dlc BOOLEAN DEFAULT FALSE,
    dlc_profile_id TEXT,
    sort_order INTEGER DEFAULT 0,
    is_draft BOOLEAN DEFAULT FALSE,
    is_temporary BOOLEAN DEFAULT FALSE
);

ALTER TABLE items ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT FALSE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_dlc BOOLEAN DEFAULT FALSE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS dlc_profile_id TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS article_code TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN DEFAULT FALSE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- 3. Tables Liées (Relations)
CREATE TABLE IF NOT EXISTS stock_levels (
    item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
    storage_id TEXT REFERENCES storage_spaces(id) ON DELETE CASCADE,
    quantity NUMERIC DEFAULT 0,
    PRIMARY KEY (item_id, storage_id)
);

CREATE TABLE IF NOT EXISTS stock_consignes (
    item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
    storage_id TEXT REFERENCES storage_spaces(id) ON DELETE CASCADE,
    min_quantity NUMERIC DEFAULT 0,
    PRIMARY KEY (item_id, storage_id)
);

CREATE TABLE IF NOT EXISTS stock_priorities (
    item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
    storage_id TEXT REFERENCES storage_spaces(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 0,
    PRIMARY KEY (item_id, storage_id)
);

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
    storage_id TEXT REFERENCES storage_spaces(id) ON DELETE SET NULL,
    type TEXT NOT NULL, -- 'IN' ou 'OUT'
    quantity NUMERIC NOT NULL,
    date TIMESTAMP DEFAULT NOW(),
    note TEXT,
    is_cave_transfer BOOLEAN DEFAULT FALSE,
    user_name TEXT
);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
    quantity NUMERIC NOT NULL,
    initial_quantity NUMERIC,
    date TIMESTAMP DEFAULT NOW(),
    status TEXT NOT NULL,
    user_name TEXT,
    rupture_date TIMESTAMP,
    ordered_at TIMESTAMP,
    received_at TIMESTAMP
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS rupture_date TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ordered_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS received_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS initial_quantity NUMERIC;

CREATE TABLE IF NOT EXISTS dlc_history (
    id TEXT PRIMARY KEY,
    item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
    storage_id TEXT REFERENCES storage_spaces(id) ON DELETE CASCADE,
    opened_at TIMESTAMP DEFAULT NOW(),
    user_name TEXT
);

CREATE TABLE IF NOT EXISTS unfulfilled_orders (
    id TEXT PRIMARY KEY,
    item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
    date TIMESTAMP DEFAULT NOW(),
    user_name TEXT
);

-- 4. Données Initiales
INSERT INTO storage_spaces (id, name, sort_order) VALUES 
('s1', 'Frigo Soft', 1), ('s2', 'Frigo Vin', 2), ('s3', 'Speed Rack', 3),
('s4', 'Etg Sirops', 4), ('s5', 'Etg Liqueurs', 5), ('s6', 'Pyramide', 6),
('s7', 'Etg Thé', 7), ('s8', 'Etg Vin Rouge', 8), ('s9', 'Frigo Back', 9),
('s10', 'Autres', 10), ('s0', 'Surstock', 99)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, name, role, pin) VALUES 
('admin', 'Administrateur', 'ADMIN', '2159'),
('admin_secours', 'Admin Secours', 'ADMIN', '0407'),
('b1', 'Barman', 'BARMAN', '0000')
ON CONFLICT (id) DO NOTHING;

INSERT INTO formats (id, name, value) VALUES 
('f1', '70cl', 70), ('f2', '75cl', 75), ('f3', '33cl', 33), ('f4', '25cl', 25), ('f5', '1L', 100)
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO categories (name, sort_order) VALUES 
('Spiritueux', 0), ('Vins', 1), ('Bières', 2), ('Softs', 3), ('Ingrédients Cocktail', 4), ('Autre', 5)
ON CONFLICT (name) DO NOTHING;

INSERT INTO dlc_profiles (id, name, duration_hours) VALUES 
('d1', '24 Heures', 24), ('d2', '2 Jours', 48), ('d3', '3 Jours', 72),
('d4', '5 Jours', 120), ('d5', '1 Semaine', 168), ('d6', '2 Semaines', 336),
('d7', '1 Mois', 720)
ON CONFLICT (id) DO NOTHING;