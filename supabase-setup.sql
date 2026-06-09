-- 大西庫存管理系統：Supabase 資料庫初始化腳本
-- 使用方式：貼到 Supabase SQL Editor 執行
-- https://supabase.com/dashboard/project/eufvrsahzywtxhrobgms/sql/new

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS locations (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  type       text NOT NULL CHECK (type IN ('warehouse', 'branch')),
  is_active  boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  unit       text DEFAULT '個',
  is_active  boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id uuid REFERENCES locations(id) ON DELETE CASCADE,
  product_id  uuid REFERENCES products(id)  ON DELETE CASCADE,
  quantity    integer DEFAULT 0,
  threshold   integer DEFAULT 10,
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(location_id, product_id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type          text NOT NULL CHECK (type IN ('inbound', 'outbound', 'transfer')),
  product_id    uuid REFERENCES products(id),
  from_location uuid REFERENCES locations(id),
  to_location   uuid REFERENCES locations(id),
  quantity      integer NOT NULL,
  operator      text,
  note          text,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  status      text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  operator    text NOT NULL,
  note        text,
  to_location uuid REFERENCES locations(id),
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id   uuid REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  quantity   integer NOT NULL
);

-- ============================================================
-- VIEW
-- ============================================================

CREATE OR REPLACE VIEW v_inventory_summary AS
SELECT
  p.name      AS product_name,
  l.name      AS location_name,
  i.quantity,
  i.threshold,
  p.unit,
  (i.quantity < i.threshold) AS is_low_stock
FROM inventory i
JOIN products  p ON i.product_id  = p.id
JOIN locations l ON i.location_id = l.id;

-- ============================================================
-- RLS（讓 anon key 可以讀寫）
-- ============================================================

ALTER TABLE locations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory           ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON locations            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON products             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON inventory            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON transactions         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON purchase_orders      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON purchase_order_items FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 示範資料
-- ============================================================

-- 地點（1 倉庫 + 3 分店）
INSERT INTO locations (name, type) VALUES
  ('大西倉庫', 'warehouse'),
  ('士捷分店', 'branch'),
  ('石牌分店', 'branch'),
  ('旗艦分店', 'branch')
ON CONFLICT (name) DO NOTHING;

-- 品項（27 項）
INSERT INTO products (name, unit) VALUES
  ('大腸',         '包'),
  ('魷魚',         '包'),
  ('蚵仔',         '包'),
  ('麵線',         '袋'),
  ('750 杯',       '箱'),
  ('750 蓋',       '箱'),
  ('520 杯',       '箱'),
  ('520 蓋',       '箱'),
  ('390 杯',       '箱'),
  ('390 蓋',       '箱'),
  ('雞排',         '箱'),
  ('雞翅',         '箱'),
  ('豆付',         '盤'),
  ('泡菜',         '袋'),
  ('8 兩紙袋',     '箱'),
  ('6 兩紙袋',     '箱'),
  ('4 兩紙袋',     '箱'),
  ('西瓜汁',       '杯'),
  ('冰塊',         '包'),
  ('蔬菜泥',       '包'),
  ('豬血糕醬',     '袋'),
  ('大豬',         '隻'),
  ('小豬',         '隻'),
  ('透明大麵線袋', '個'),
  ('一袋杯紅',     '個'),
  ('購物袋',       '個'),
  ('香菜',         '份')
ON CONFLICT (name) DO NOTHING;

-- 庫存初始化（全部 0，老闆用「新增異動 → 進貨入倉」補貨）
-- threshold 暫設預設值，之後可直接在 Supabase 修改
INSERT INTO inventory (location_id, product_id, quantity, threshold)
SELECT
  l.id,
  p.id,
  0,
  CASE l.type WHEN 'warehouse' THEN 10 ELSE 5 END
FROM locations l, products p
ON CONFLICT (location_id, product_id) DO NOTHING;
