/**
 * Supabase Setup Script
 * Run this to create tables, RLS policies, storage bucket, and initial data
 * 
 * Usage: node setup-supabase.mjs
 */

const SUPABASE_URL = 'https://gomrcutfkrtainozukdw.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  🔧 Supabase テーブルセットアップ                              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  このスクリプトを使わなくても、Supabase ダッシュボードの        ║
║  SQL Editor で直接 SQL を実行できます。                        ║
║                                                              ║
║  手順:                                                        ║
║  1. https://supabase.com/dashboard にログイン                 ║  
║  2. プロジェクト選択 → SQL Editor                              ║
║  3. 下記の SQL をコピー＆ペーストして「Run」                    ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);

  console.log(`--- ここから SQL をコピー ---\n`);
  console.log(getSQL());
  console.log(`\n--- ここまで ---`);

  console.log(`\n\n⚠️  また、Storage の設定も必要です:`);
  console.log(`1. Supabase ダッシュボード → Storage`);
  console.log(`2. 「New bucket」→ 名前: game-files`);
  console.log(`3. Public bucket を ON にする`);
  console.log(`4. 作成後、Policies → New Policy → 以下を設定:`);
  console.log(`   - SELECT: Allow public access (anon)`);
  console.log(`   - INSERT/UPDATE/DELETE: Allow authenticated users only\n`);

  console.log(`\n⚠️  管理者ユーザーの作成も必要です:`);
  console.log(`1. Supabase ダッシュボード → Authentication → Users`);
  console.log(`2. 「Add user」→ メールアドレスとパスワードを設定`);
  console.log(`3. このメールとパスワードで管理者ログインできます\n`);

  process.exit(0);
}

// If service key is provided, run setup via API
async function setup() {
  console.log('🔧 Setting up Supabase...');

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: getSQL() }),
  });

  if (res.ok) {
    console.log('✅ Tables created successfully!');
  } else {
    console.log('❌ Error:', await res.text());
  }
}

function getSQL() {
  return `-- ====================================
-- テーブル作成
-- ====================================

CREATE TABLE IF NOT EXISTS locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '🏙️',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  label TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  time TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  entry_file TEXT DEFAULT 'index.html',
  is_published BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- ====================================
-- RLS (Row Level Security) 有効化
-- ====================================

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- 公開読み取りポリシー
CREATE POLICY "Public read locations" ON locations FOR SELECT USING (true);
CREATE POLICY "Public read events" ON events FOR SELECT USING (true);
CREATE POLICY "Public read sessions" ON sessions FOR SELECT USING (true);
CREATE POLICY "Public read games" ON games FOR SELECT TO anon USING (is_published = true);
CREATE POLICY "Auth read all games" ON games FOR SELECT TO authenticated USING (true);

-- 認証済みユーザーの書き込みポリシー
CREATE POLICY "Auth manage locations" ON locations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth manage events" ON events FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth manage sessions" ON sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth manage games" ON games FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ====================================
-- 初期データ投入
-- ====================================

INSERT INTO locations (name, icon, sort_order) VALUES 
  ('那覇市開催', '🏙️', 0),
  ('うるま市開催', '🌊', 1);`;
}

setup();
