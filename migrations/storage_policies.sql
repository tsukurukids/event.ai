-- ============================================================
-- game-files バケットの公開読み取りポリシー
-- Supabase SQL Editor で実行してください
-- ============================================================

-- experience フォルダ以下を匿名ユーザーがリスト・ダウンロードできるようにする
CREATE POLICY "Public read experience materials"
ON storage.objects FOR SELECT TO anon
USING (
  bucket_id = 'game-files'
  AND (storage.foldername(name))[1] = 'experience'
);

-- 認証済みユーザーはバケット全体を読める（管理者用）
CREATE POLICY "Auth read all game-files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'game-files');
