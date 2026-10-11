-- ギャラリー管理者画面用: 認証ユーザーが games / Storage を管理できるようにする
-- （workshop-gallery.sql で Auth manage ポリシーが落ちている環境向け）

-- games: 認証済みユーザーは全件の読み取り・追加・更新・削除が可能
DROP POLICY IF EXISTS "Auth manage games" ON public.games;
CREATE POLICY "Auth manage games" ON public.games
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Storage: 認証済みユーザーは game-files を管理可能
DROP POLICY IF EXISTS "Auth manage game-files" ON storage.objects;
CREATE POLICY "Auth manage game-files"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'game-files')
WITH CHECK (bucket_id = 'game-files');

-- 管理者追加作品は admin/ 配下・期限なし（トリガーが workshop/ 以外を触らないことを確認）
-- workshop_set_expiry トリガーは storage_path LIKE 'workshop/%' のときだけ expires_at をセットする想定
