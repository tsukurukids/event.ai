# 新しい Supabase プロジェクト — セットアップ手順

旧プロジェクト（Storage 超過で 402）から **新規プロジェクト** に切り替える手順です。

---

## 0. Cursor から Supabase MCP（おすすめ・設定の半自動化）

Dashboard をあまり触りたくない場合、**Supabase 公式 MCP** で SQL 実行・テーブル確認・キー取得などが Cursor 上からできます。

1. 本リポジトリに **`.cursor/mcp.json`** を置いてあります（`project_ref=hbwhbggpuluiljljdbxs`）。別プロジェクトなら URL の ref を差し替え。  
2. **Cursor を再起動**（または Settings → MCP でサーバー一覧を更新）。  
3. **MCP → supabase** が表示されたら **Connect / ログイン**（ブラウザで Supabase OAuth）。  
4. チャットで「bootstrap.sql を実行して」「game-files ある？」などと依頼 → エージェントが MCP 経由で操作。

公式: [Supabase MCP](https://supabase.com/docs/guides/getting-started/mcp) / Dashboard の **Connect → MCP** タブからも同じ URL をコピーできます。

**注意:** Organization が **402 Storage 超過** のときは、MCP 経由の SQL も **同じく失敗** します。その場合は **別 Organization でプロジェクト作成** か Pro が先です。

---

## 1. Supabase でプロジェクト作成

1. [Supabase Dashboard](https://supabase.com/dashboard) にログイン  
2. **New project**  
3. Organization: **tsukuru**（Free のままなら **アクティブプロジェクトが2つまで** — 旧プロジェクトは **Pause** すると枠を空けられる）  
4. リージョン: 日本に近い **Northeast Asia (Tokyo)** 推奨  
5. DB パスワードを控える  

作成完了まで 1〜2 分待つ。

---

## 2. API キーをコピー

**Project Settings → API**

| 項目 | 用途 |
|------|------|
| **Project URL** | `VITE_SUPABASE_URL` |
| **anon public** | `VITE_SUPABASE_ANON_KEY`（フロント・Git にコミット可） |
| **service_role** | **秘密** — サーバー用のみ。Git に載せない |

---

## 3. ローカル `.env` を更新

プロジェクトルートの `.env` を編集:

```env
VITE_SUPABASE_URL=https://【新プロジェクトID】.supabase.co
（**末尾に `/rest/v1/` を付けない** — supabase-js が自動で付けます）
VITE_SUPABASE_ANON_KEY=【anon key】
```

保存後、開発サーバーを再起動:

```bash
npm run dev
```

---

## 4. Storage バケット

**Storage → New bucket**

| 設定 | 値 |
|------|-----|
| Name | `game-files`（コード固定。変更不可） |
| Public bucket | **ON** |

---

## 5. データベース + Storage ポリシー

**SQL Editor → New query**

リポジトリの **`supabase/bootstrap.sql`** を開き、**全文コピー → Run**。

成功すると:

- テーブル（ギャラリー + 体験）
- RLS（期限切れ作品は非公開）
- 開催地2件の初期データ
- `game-files` 用 Storage ポリシー

が入ります。

**すでに bootstrap 実行済み**で `expires_at` が無い場合は、追加で **`migrations/retention.sql`** を Run（[STORAGE_RETENTION.md](./STORAGE_RETENTION.md)）。

---

## 6. 管理者ユーザー

**Authentication → Users → Add user → Create new user**

- メール / パスワードを設定  
- **Confirm email** は開発中 OFF でも可（Auth 設定による）

`admin.html` からこのアカウントでログイン。

---

## 7. 動作確認チェックリスト

- [ ] `http://localhost:3000/` — 開催地が2件表示  
- [ ] `http://localhost:3000/admin.html` — ログイン → 開催日追加 → **ゲームフォルダアップロード**  
- [ ] 公開サイトで作品プレビュー・プレイ  
- [ ] `http://localhost:3000/experience.html` — 体験イベント（管理画面から1件作成・公開）

---

## 8. 本番（Vercel）

[Vercel](https://vercel.com) → プロジェクト **event-ai-wine**（等）→ **Settings → Environment Variables**

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

を **新プロジェクトの値** に更新 → **Redeploy**。

---

## 9. 新プロジェクトなのに 402 が出る場合

**組織（Organization）単位**で Storage 超過すると、**同じ org 内の新プロジェクトもすべて 402** になることがあります。

対処:

1. **別 Organization** を新規作成 → その中で Free プロジェクトを作る（いちばん確実に空の枠）  
2. または **Pro にアップグレード** → 旧 Storage を整理  
3. または **サポート** に quota / 孤立ファイルの整理を依頼  

---

## 10. 旧プロジェクトについて

- 402 中は旧 Storage は触れないことが多い  
- 不要なら **Pause project** で無料枠を節約  
- データ移行は旧プロジェクト復旧後に Export、または **PC に残っているフォルダを再アップロード**

---

## 11. ストレージを長く使うコツ（再発防止）

- テスト作品は定期的に削除  
- 画像の巨大フォルダは整理  
- **`storage.objects` を SQL で DELETE しない**（実ファイルが残り quota だけ増える）  
- イベントごとに容量を見る（Dashboard → Usage）

---

## 関連ファイル

| ファイル | 内容 |
|----------|------|
| `supabase/bootstrap.sql` | 新規プロジェクト一括 SQL |
| `setup.sql` | 旧来版（`image_url` なし。新規は bootstrap 推奨） |
| `migrations/storage_policies.sql` | bootstrap に統合済み |
