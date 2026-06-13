-- ====================================
-- 体験テーマ（Experience Themes）
-- Supabase SQL Editor で実行してください
-- ====================================

CREATE TABLE IF NOT EXISTS experience_themes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  welcome_title TEXT DEFAULT 'AI体験へようこそ！',
  welcome_subtitle TEXT DEFAULT '',
  welcome_description TEXT DEFAULT 'まずお手本ゲームを遊んで、素材をもらいましょう！',
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
