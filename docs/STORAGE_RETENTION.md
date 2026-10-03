# 作品 Storage 保存期間（2ヶ月）

## 方針

- **体験参加者がアップロードした作品**（および通常アップロード）は、原則 **アップロード日から2ヶ月** で Storage と DB から **自動削除**。
- 保護者向けメッセージ: 期限前に **ZIP でフォルダを保存** し、おうちで Antigravity 等で続きを作ってください。
- **管理者**が管理画面で「永久保存」にチェックした作品は `expires_at = NULL`（削除対象外）。

## 利用者向け表示

- 管理画面アップロード欄: 保存期間の説明文
- プレイ画面: 削除予定日の案内 + **📦 作品フォルダをZIPで保存** ボタン
- 期限切れ後: ギャラリー非表示・プレイURLは「削除済み」メッセージ

## 技術

| 項目 | 内容 |
|------|------|
| DB | `games.expires_at`（TIMESTAMPTZ, NULL=永久） |
| 公開 RLS | `expires_at IS NULL OR expires_at > now()` |
| 削除ジョブ | `npm run purge-expired`（要 `SUPABASE_SERVICE_ROLE_KEY`） |

### 既存 DB への適用

SQL Editor で **`migrations/retention.sql`** を実行。

### 自動削除の定期実行（推奨）

1. Dashboard → Settings → API → **service_role** を `.env` に `SUPABASE_SERVICE_ROLE_KEY` として追加（**Git にコミットしない**）
2. 週1回など: `npm run purge-expired`
3. または GitHub Actions の `schedule` で同コマンドを実行

## 定数変更

保存月数を変える場合: `src/utils/retention.js` の `RETENTION_MONTHS`。
