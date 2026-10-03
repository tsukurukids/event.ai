-- ============================================================
-- 作品 Storage 保存期間（2ヶ月）— 既存プロジェクト用
-- SQL Editor で bootstrap 済みの DB に追加実行
-- ============================================================

ALTER TABLE games ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

COMMENT ON COLUMN games.expires_at IS 'NULL=期限なし（管理者永久保存）。設定時はこの日時以降に自動削除対象';

-- 公開一覧から期限切れを除外
DROP POLICY IF EXISTS "Public read games" ON games;
CREATE POLICY "Public read games" ON games
  FOR SELECT TO anon
  USING (
    is_published = true
    AND (expires_at IS NULL OR expires_at > now())
  );

CREATE INDEX IF NOT EXISTS games_expires_at_idx ON games (expires_at)
  WHERE expires_at IS NOT NULL;
