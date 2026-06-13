-- ====================================
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
  ('うるま市開催', '🌊', 1);

-- ====================================
-- 体験テーマ（Experience）
-- ====================================

CREATE TABLE IF NOT EXISTS experience_themes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  welcome_title TEXT DEFAULT 'AI体験へようこそ！',
  welcome_subtitle TEXT DEFAULT '',
  welcome_description TEXT DEFAULT 'ジャンルを選んで、お手本ゲームを遊んでみよう！',
  event_date DATE,
  is_active BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS experience_games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  theme_id UUID REFERENCES experience_themes(id) ON DELETE CASCADE,
  genre_label TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  game_url TEXT,
  storage_path TEXT,
  entry_file TEXT DEFAULT 'index.html',
  materials_storage_path TEXT,
  sort_order INT DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE experience_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE experience_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read published themes" ON experience_themes
  FOR SELECT TO anon USING (is_published = true);
CREATE POLICY "Auth read all themes" ON experience_themes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth manage themes" ON experience_themes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public read published exp games" ON experience_games
  FOR SELECT TO anon USING (is_published = true);
CREATE POLICY "Auth read all exp games" ON experience_games
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth manage exp games" ON experience_games
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
