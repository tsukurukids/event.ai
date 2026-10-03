# バックエンド構成 — Supabase / Turso ほか（確認メモ v0.1）

> イベント規模でも **コストを抑えつつ** 運用できるか。  
> 「Supabase（スペース）以外に **Turso** なども行けるか？」への回答と、このリポジトリ固有の制約。

**関連:** [SYSTEM_OVERVIEW.md](../SYSTEM_OVERVIEW.md) / [EVENT_WORKSHOP_REQUIREMENTS.md](./EVENT_WORKSHOP_REQUIREMENTS.md)

---

## 1. いま Supabase で何をしているか

| 機能 | 用途 | コード上の例 |
|------|------|----------------|
| **PostgreSQL** | 開催地・開催日・作品メタ・体験テーマ | `supabase.from('games').select(...)` |
| **RLS** | 公開は `is_published` のみ、管理は `authenticated` | `setup.sql` ポリシー |
| **Auth** | 管理画面ログインのみ | `supabase.auth.signOut()` |
| **Storage** | ゲームフォルダ・素材ZIP・公開URL | `game-files` バケット、`getPublicUrl` |
| **ブラウザ直結** | Vite 静的サイト + `anon` キー | `src/supabase.js` |

**ワークショップ追加後の負荷**

- DB: 作品行・イベント設定（**小さい**）
- Storage: スターターZIP × 3 ＋ **参加者全員のゲームフォルダ（画像多め）** → **ここが容量の主因**

---

## 2. 無料枠のざっくり比較（2026年時点・公式ページベース）

| サービス | 無料で得られるもの | このプロジェクトでのボトルネック |
|----------|-------------------|-----------------------------------|
| **Supabase Free** | DB **500MB**、ファイル **1GB**、Auth、Storage API、RLS | **1GB Storage**（作品・素材が増えると先に厳しい）。1週間無操作で **プロジェクト一時停止** |
| **Turso Free** | libSQL **5GB**（DB用）、読取 5億行/月 など | **ファイル置き場はない**。Auth もない |
| **Cloudflare R2** | 10GB ストレージ、 egress 無料枠あり（要アカウント） | DB は別途（D1 / Turso 等） |
| **Vercel** | 静的ホスティング（本番 `event-ai-wine.vercel.app`） | バックエンド・大容量ファイル保存は別 |

※ 料金は変更されるため、本番前に [Supabase Pricing](https://supabase.com/pricing) / [Turso Pricing](https://turso.tech/pricing) で再確認すること。

---

## 3. Turso（ターソー）は「行けるか？」

### 結論

| 置き換え対象 | Turso だけで代替できる？ |
|--------------|-------------------------|
| PostgreSQL（メタデータ） | **○ 可能**（スキーマを SQLite/libSQL 向けに書き換え） |
| Supabase Auth | **× 不可** → Clerk / Auth.js / 会場PIN+API など別途 |
| Supabase Storage（ゲームファイル） | **× 不可** → R2 / S3 / Blob / PocketBase ファイル等が必要 |
| ブラウザから anon で DB+Storage | **△ 非推奨** → **API（Worker / Edge Function）** 経由が安全 |

**Turso は「安い・十分な DB」には向くが、今の Supabase 一式のドロップイン代替ではない。**

### Turso に移す場合のアーキテクチャ（案）

```
[Vite 静的サイト]
       ↓ HTTPS
[Cloudflare Worker / Vercel Function]  ← サービスロール・Turso トークンはサーバーのみ
       ↓                    ↓
   [Turso libSQL]      [R2 等オブジェクトストレージ]
   locations/events/games   game-files 相当
```

- 参加者フォルダアップロード: **multipart → Worker → R2** + Turso に `games` 行 INSERT（要件 v0.3 の anon 投稿は API で `event_id` 検証）
- ギャラリー読み取り: 公開 API または R2 の public URL + Turso から一覧

**工数目安:** 現行 Supabase 直結比 **中〜大**（全 `supabase.from` / `storage` 呼び出しの差し替え + 認証 + デプロイ）

### Postgres → Turso で気をつける点

- `UUID` / `gen_random_uuid()` → SQLite では `TEXT` + アプリ側 UUID など
- `TIMESTAMPTZ` → `TEXT` ISO8601 または INTEGER
- **RLS** → Turso には Postgres RLS と同じものはない。**API 層で権限**を実装
- 既存 `setup.sql` / `migrations/*.sql` は **そのままは流せない**（変換が必要）

---

## 4. おすすめ方針（コスト × 工数）

### A. 当面は Supabase のまま（推奨・工数最小）

- メタデータ 500MB はイベント数分 **十分**
- コスト問題はまず **Storage 1GB** → 古い開催の作品整理、画像圧縮、不要ファイル削除
- 無停止運用: 無操作停止対策（月1回ダッシュボードアクセス or Pro）
- 参加者アップロード追加も **既存 Storage + RLS 拡張** が最短

**「多少でも行ける」= 小規模イベントなら Free のまま現実的。**

### B. Storage だけ安く広げる（ハイブリッド）

- DB / Auth は Supabase 維持
- 新規大容量のみ **R2** 等（CDN URL を `storage_path` に保存する形に変更）
- 工数: **中**（`gameHtml.js` / アップロード経路の分岐）

### C. Turso + R2 + Worker（長期的な低コスト）

- トラフィック・作品数が増え、Supabase Pro の Storage 従量が気になり始めたら検討
- 工数: **大**（フル移行 or 段階移行）

### D. PocketBase（代替の一本化）

- SQLite + 管理UI + ファイル + 簡易 Auth が **1パッケージ**
- 自前 VPS / PocketBase Cloud。イベント規模なら **Supabase Free と同等かそれ以下**になりうる
- 工数: **大**（データモデル再設計、管理画面作り直し or PocketBase Admin 利用）

---

## 5. このプロジェクト固有の注意（Turso 検討時も共通）

1. **ゲームファイルは DB ではなくオブジェクトストレージ** — Turso の 5GB Free は「作品 HTML 置き場」にはならない  
2. **日本語パス** — Storage キーは ASCII 安全化済み（`dashboard.js`）。どのストレージでも同ルール  
3. **公開 URL** — 現状 `getPublicUrl` + iframe `srcdoc` / fetch。R2 移行時も **CORS・Content-Type** を再確認  
4. **Vercel** — フロントはそのまま。Turso を使うなら **Edge API** を Vercel Functions か Cloudflare に追加

---

## 6. 判断チェックリスト

| 質問 | Supabase 継続 | Turso + R2 移行 |
|------|---------------|-----------------|
| 1イベントの作品合計 < 1GB 程度？ | ◎ | 不要 |
| すぐワークショップ MVP を出したい？ | ◎ | △ |
| 開発者が API / Worker を書ける？ | 任意 | 必須 |
| 月額 0 円を最優先？ | Free で可（Storage 要監視） | 可能だが初期工数大 |
| 管理画面 Auth をそのまま？ | ◎ | 作り直し |

---

## 7. 推奨結論（v0.1）

1. **Phase 1（ワークショップ MVP）は Supabase 継続** — DB・Auth・Storage・参加者アップロード RLS を拡張するのが最短。  
2. **Turso は「行ける」が DB 部分のみ**。ファイルと管理 Auth を含めると **別ストレージ + API** が必須。  
3. コスト監視は **Supabase Dashboard → Storage 使用量** を先に見る。逼迫したら **B（R2 ハイブリッド）** を検討し、全面移行は **C** は作品数・月額が伸びてからで十分。

---

## 改訂履歴

| 版 | 日付 | 内容 |
|----|------|------|
| v0.1 | 2026-10-02 | Supabase 利用整理、Turso 可否、代替案 |
