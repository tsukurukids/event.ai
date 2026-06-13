-- ============================================================
-- 体験イベント追加カラム（Supabase SQL Editor で実行してください）
-- experience.sql を実行済みの場合、このファイルを追加で実行してください
-- ============================================================

-- 開催日
ALTER TABLE experience_themes ADD COLUMN IF NOT EXISTS event_date DATE;

-- 体験画面に現在表示するイベントを示すフラグ
ALTER TABLE experience_themes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;
