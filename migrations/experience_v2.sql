-- 開催イベントに日付カラムを追加（任意）
ALTER TABLE experience_themes ADD COLUMN IF NOT EXISTS event_date DATE;
