-- 現在表示中の体験イベントを指定するフラグ
ALTER TABLE experience_themes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;
