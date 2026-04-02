# 4層アーキテクチャ分離計画

## 現状 → 目標

```
【現状】2層                          【目標】4層
┌─────────────┐                     ┌─────────────┐
│ フロント     │                     │ フロント     │ Vercel
│ Next.js      │                     │ Next.js BFF  │ git push で更新
└──────┬───────┘                     └──────┬───────┘
       │                                    │
┌──────▼───────┐                     ┌──────▼───────┐
│ Worker(全部)  │                     │ API (共有)    │ FastAPI 1〜数台
│ FastAPI       │                     │ ビジネスロジック│ バグ修正ここだけ
│ + SQLite      │                     └──┬────────┬──┘
│ + claude CLI  │                        │        │
│ + Playwright  │                  ┌─────▼──┐ ┌───▼──────────┐
│ + R2同期      │                  │ DB      │ │ Worker(per user)│
└───────────────┘                  │Supabase │ │ Anthropic SDK   │
                                   │PostgreSQL│ │ + tool_use      │
                                   │ RLS付き  │ │ + Playwright    │
                                   └─────────┘ │ + R2同期        │
                                               │ コード薄い       │
                                               └─────────────────┘
```

---

## 調査結果サマリ

### DB アクセス
- 5テーブル: data_store, chat_threads, chat_messages, employees, connectors
- 159箇所のDB参照（13ファイル）
- 最多: chat.py(28), data.py(24), projects.py(19)
- ORM未使用（全て生SQL）

### Claude CLI 呼び出し
- **14箇所**のsubprocess呼び出し
- うち **7箇所は単純テキスト生成** → `messages.create()` で即置換可能
- 5箇所はファイル操作付き → `tool_use` が必要
- 2箇所はブラウザ操作 → Workerコンテナ側に残す
- Node.js Agent SDK ラッパー (`claude-agent.mjs`) が既に存在

### フロントAPI (BFF)
- 28個のroute.tsファイル
- 14個がシンプルプロキシ、10個がアクション分岐ルーター
- 3個がSSEストリーミング
- `WORKER_URL` で接続先を切り替え可能 → API分離後もBFF構造は維持

### PostgreSQL準備状況
- docker-compose.ymlにPostgreSQL定義済み
- `init.sql` にスキーマ定義済み
- だがアプリは完全にSQLite依存（PostgreSQLは未使用）
- `DATABASE_URL` 環境変数は定義済みだが無視されている

---

## フェーズ計画

### Phase 1: DB層の抽象化（SQLite → PostgreSQL移行準備）

**目的:** DBアクセスを1箇所に集約し、PostgreSQLに切り替え可能にする

**やること:**
1. `worker/app/db.py` にDB抽象レイヤーを作成
   - 現在の `_get_db()` → SQLite を維持しつつ
   - `DATABASE_URL` が設定されていれば PostgreSQL に切り替える分岐
   - `asyncpg` (async) or `psycopg2` (sync) で接続
2. 13ファイル・159箇所のDB呼び出しを抽象レイヤー経由に統一
   - 直接 `conn.execute(SQL)` → ヘルパー関数 `db.query()`, `db.insert()`, `db.update()` 等
3. `init.sql` のスキーマを現在のSQLiteスキーマと整合させる
   - data_store のような汎用テーブルはPostgreSQLでも維持（JSONB活用）
   - employees, connectors を正規化テーブルに移行するかは要判断

**検証:**
- `DATABASE_URL` なし → SQLiteで既存動作が壊れない
- `DATABASE_URL` あり → docker-compose の PostgreSQL に接続して同じ動作

**対象ファイル:**
- `worker/app/db.py` — 全面書き直し
- `worker/app/routes/chat.py` — 28箇所
- `worker/app/routes/data.py` — 24箇所
- `worker/app/routes/projects.py` — 19箇所
- `worker/app/routes/pages.py` — 17箇所
- `worker/app/routes/schedules.py` — 15箇所
- `worker/app/employee.py` — 11箇所
- `worker/app/routes/user.py` — 9箇所
- `worker/app/routes/employees.py` — 8箇所
- `worker/app/routes/news.py` — 8箇所
- `worker/app/routes/connectors.py` — 7箇所
- `worker/app/routes/nango.py` — 5箇所
- `worker/app/routes/share.py` — 5箇所
- `worker/app/routes/general_chat.py` — 3箇所

---

### Phase 2: Claude CLI → Anthropic SDK 移行

**目的:** `claude -p` subprocess呼び出しを Anthropic Python SDK に置き換え

**やること:**

#### Step 1: 単純テキスト生成（7箇所）— `messages.create()` で置換
| ファイル | 行 | 用途 |
|---------|---|------|
| `routes/news.py:38` | ニュースJSON生成 | `messages.create()` |
| `routes/projects.py:98` | タスク分解JSON | `messages.create()` |
| `routes/projects.py:192` | パイプラインJSON | `messages.create()` |
| `routes/pages.py:83` | HTML生成 | `messages.create()` |
| `routes/pages.py:196` | HTML更新 | `messages.create()` |
| `routes/chat.py:381` | プロフィール抽出JSON | `messages.create()` |
| `routes/general_chat.py:51` | 単純チャット | `messages.create()` |
| `routes/line.py:48` | ルーティング判定JSON | `messages.create()` |

#### Step 2: ファイル操作付き（5箇所）— `tool_use` で置換
| ファイル | 行 | 用途 |
|---------|---|------|
| `routes/schedules.py:50` | タスク実行 + ファイル保存 |
| `routes/projects.py:134` | 指示実行 + ファイル保存 |
| `routes/projects.py:269` | ステップ実行 + ファイル保存 |
| `routes/chat.py:627` | チャット + ファイル操作 |
| `routes/general_chat.py:85` | ストリーミング + ブラウザ |

#### Step 3: エージェントSDKラッパー統合
- 既存の `claude-agent.mjs` (Node.js Agent SDK) を参考に
- Python版のtool_useループを実装
- ツール定義: file_read, file_write, file_list, bash（制限付き）

**検証:**
- 既存のチャット・プロジェクト実行が同じ結果を返す
- `ANTHROPIC_API_KEY` 環境変数のみで認証が通る

---

### Phase 3: API層の分離（Worker → 共有API + 薄いWorker）

**目的:** ビジネスロジックをWorkerから分離し、共有APIサーバーにする

**やること:**

#### 共有API（新サービス）に移すもの:
| ルート | ファイル | 理由 |
|-------|---------|------|
| 社員管理 | `employees.py` | CRUD、DB操作のみ |
| タスク管理 | `data.py` | CRUD、DB操作のみ |
| プロジェクト管理 | `projects.py` (パイプライン管理部分) | 司令塔ロジック |
| チャット履歴 | `chat.py` (履歴CRUD部分) | DB操作のみ |
| スケジュール | `schedules.py` (CRUD部分) | DB操作のみ |
| 経理 | `accounting.py` | DB操作のみ |
| ニュース | `news.py` | テキスト生成 + DB |
| ページ管理 | `pages.py` | テキスト生成 + DB |
| ユーザー設定 | `user.py` | DB操作のみ |
| コネクタ管理 | `connectors.py`, `nango.py` | DB + 外部API |
| LINE | `line.py` | ルーティング + DB |
| 共有ページ | `share.py` | DB読み取り |
| ルール | `rules.py` | ファイル読み書き → DB移行 |

#### ユーザーコンテナ（Worker）に残すもの:
| 機能 | 理由 |
|------|------|
| エージェント実行（tool_use ループ） | ファイル操作がローカル必須 |
| R2同期 | コンテナ内 ↔ R2 |
| Playwright（ブラウザ操作） | コンテナ内Chrome |
| `/workspace/` ファイル管理 | ローカルファイルシステム |

#### 通信フロー:
```
フロント → BFF → 共有API → DB（大半のリクエスト）
                    │
                    └→ Worker（エージェント実行が必要な場合のみ）
                         │
                         └→ 完了後、共有APIに結果をPOST
```

**Workerコンテナの新API（薄い）:**
```
POST /agent/run     — タスク実行（system_prompt, message, workdir）
POST /agent/cancel  — タスク中断
GET  /agent/status  — 実行状態
POST /files/sync    — R2同期
GET  /files/list    — ファイル一覧
POST /browser/run   — Playwright実行
```

**検証:**
- 共有APIのみ再デプロイ → ユーザーコンテナに影響なし
- Workerコンテナのコード量が大幅に減ること（18ルート → 5-6エンドポイント）

---

### Phase 4: Supabase PostgreSQL 本格移行

**目的:** SQLiteを完全廃止、Supabase PostgreSQLに一本化

**やること:**
1. Supabaseプロジェクト作成
2. Phase 1 で作った抽象レイヤーの `DATABASE_URL` を Supabase に向ける
3. RLS ポリシー適用（SPEC.md Section 7 に定義済み）
4. `company_id` カラム追加 → マルチテナント対応
5. 既存データの移行スクリプト（SQLite → PostgreSQL）
6. Supabase Auth 統合（NextAuth → Supabase Auth に切り替え or 併用）

**検証:**
- RLS が正しく動作し、他テナントのデータが見えない
- レスポンスタイムが SQLite と同等以下

---

### Phase 5: 本番デプロイ基盤

**目的:** Fly.io + Vercel + Supabase の本番構成

**やること:**
1. フロント → Vercel デプロイ
2. 共有API → Fly.io (単一 or 2台構成)
3. Worker → Fly.io Machines (per user, オンデマンド起動)
4. CI/CD パイプライン（GitHub Actions）
   - フロント: `git push` → Vercel 自動デプロイ
   - 共有API: `git push` → Docker build → Fly deploy
   - Worker: Docker build → レジストリ push → ローリングアップデート
5. 監視・アラート（SPEC.md Section 13.7）
6. バックアップ（SPEC.md Section 13.6）

---

## 実行順序と依存関係

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4 ──→ Phase 5
DB抽象化     SDK移行     API分離     Supabase     本番デプロイ
                                    移行

※ Phase 1, 2 は並行作業可能
※ Phase 3 は Phase 1, 2 の両方が完了してから
※ Phase 4, 5 は順番に
```

## 規模感

| Phase | 対象ファイル数 | 変更箇所 | 難易度 |
|-------|-------------|---------|--------|
| 1 | 14ファイル | ~159箇所 | ★★★ |
| 2 | 8ファイル | ~14箇所 | ★★☆ |
| 3 | 18ルート分割 | 大規模 | ★★★★ |
| 4 | DB + Auth | 中規模 | ★★★ |
| 5 | インフラ | CI/CD | ★★☆ |
