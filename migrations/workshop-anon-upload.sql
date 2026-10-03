-- ============================================================
-- ワークショップ参加者アップロード（列追加 + ポリシー）
-- Dashboard → SQL Editor でこのファイル全文を Run
-- ============================================================
-- 既存DBに expires_at / genre_id が無い場合でもそのまま実行できます
-- ============================================================

BEGIN;

-- 1) 必要な列
ALTER TABLE public.games ALTER COLUMN session_id DROP NOT NULL;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS genre_id TEXT;

-- genre_id の CHECK（未作成なら追加）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'games_genre_id_check'
      AND conrelid = 'public.games'::regclass
  ) THEN
    ALTER TABLE public.games
      ADD CONSTRAINT games_genre_id_check
      CHECK (genre_id IS NULL OR genre_id IN ('athletic', 'shooting', 'puzzle'));
  END IF;
END $$;

COMMENT ON COLUMN public.games.expires_at IS
  'NULL=期限なし（管理者永久保存）。ワークショップ作品はアップロードから2ヶ月後';

-- 2) 公開一覧: 期限切れを除外（既存ポリシーを差し替え）
DROP POLICY IF EXISTS "Public read games" ON public.games;
CREATE POLICY "Public read games" ON public.games
  FOR SELECT TO anon, authenticated
  USING (
    is_published = true
    AND (expires_at IS NULL OR expires_at > now())
  );

-- 3) 参加者 INSERT（workshop/ のみ）
DROP POLICY IF EXISTS "Workshop anon insert games" ON public.games;
CREATE POLICY "Workshop anon insert games" ON public.games
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    is_published = true
    AND storage_path LIKE 'workshop/%'
    AND genre_id IS NOT NULL
    AND expires_at IS NOT NULL
    AND session_id IS NULL
  );

-- 4) Storage: workshop/ 配下のみアップロード可（upsert 用に UPDATE も）
DROP POLICY IF EXISTS "Workshop anon upload game-files" ON storage.objects;
CREATE POLICY "Workshop anon upload game-files"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'game-files'
  AND name LIKE 'workshop/%'
);

DROP POLICY IF EXISTS "Workshop anon update game-files" ON storage.objects;
CREATE POLICY "Workshop anon update game-files"
ON storage.objects FOR UPDATE TO anon, authenticated
USING (
  bucket_id = 'game-files'
  AND name LIKE 'workshop/%'
)
WITH CHECK (
  bucket_id = 'game-files'
  AND name LIKE 'workshop/%'
);

DROP POLICY IF EXISTS "Workshop anon upload game-files like" ON storage.objects;
DROP POLICY IF EXISTS "Workshop anon update game-files like" ON storage.objects;

CREATE INDEX IF NOT EXISTS games_expires_at_idx ON public.games (expires_at)
  WHERE expires_at IS NOT NULL;

COMMIT;
