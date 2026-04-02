# セッション引き継ぎ資料

## 完了した作業

### 4層アーキテクチャ分離 (Phase 1-4)
- **フォルダ構成**: `front/` `back/` `worker/` `env/` に分離
- **back/ 共有APIサーバー**: FastAPI + Supabase PostgreSQL、13ルート実装
  - employees, data, chat, user, connectors (CRUD+Google OAuth), schedules (APScheduler), news, share, pages, nango, files (R2), worker_proxy (Fly.io Machines連携)
- **DB移行**: SQLite → Supabase PostgreSQL (aws-1-ap-northeast-2)
  - 全テーブルに `user_id UUID` 追加、データ移行完了 (社員10, データ105, スレッド50, メッセージ346)
- **Worker スリム化**: claude CLI実行 + webhook + R2 sync のみに
  - 削除済み: db.py, data.py, user.py, share.py, nango.py, files.py, schedules.py
  - 残ルート: agent.py, chat.py, projects.py, accounting.py, pages.py, news.py, general_chat.py, line.py, connectors.py (webhook), rules.py, health.py, employees.py (proxy)
- **BFF接続先分離**: CRUD系→BACK_URL(:8001), 実行系→WORKER_URL(:8000)
- **Worker動的プロキシ**: `back/app/routes/worker_proxy.py` — ユーザー別Fly.ioコンテナにルーティング
- **APScheduler**: workerからbackに移行。タスク実行はworker `/agent/run` にHTTP

### env/ ディレクトリ構成
- `env/docker-compose.yml` — 3サービス (frontend, back, worker)
- `env/{front,back,worker}/Dockerfile` — ビルド定義
- `env/{front,back,worker}/.env` — コンテナ構成依存変数 (TZ, BACK_URL等)
- `{front,back,worker}/.env` — シークレット・アプリ設定
- `{service}/.env.development`, `.env.staging` — 環境切替用 (gitignore)

### 進捗管理ページ改善
- バックグラウンド実行 (asyncio.create_task)、ページ離脱しても継続
- 中断機能 (SIGTERM + タスクキャンセル)
- 3秒ポーリングでリアルタイム状態更新
- 重い工程の複数エージェント並列実行
- タイムアウト10分に拡大
- UI全面改善 (タイムライン、グラデーション、エラー表示等)

### その他
- サイドバー key重複修正
- Supabaseプロジェクト接続 (mzdnglqmungkdcllurdz)
- 不要プロジェクト削除 (todo-app, www, SPEC.md, DATABASE.md等)

## 作業中・未完了
- [ ] **フロントBFF → backのworker_proxy経由に統一**: 現在フロントの一部がまだWORKER_URLを直接参照
- [ ] **worker/employees.py**: 完全なbackプロキシ — 削除可能だがそのまま
- [ ] **コネクタープラグイン外部化**: worker/connector-plugins/ をR2やGitHubから取得する仕組み
- [ ] **worker/project-context/ クリーンアップ**: 不要ファイル (preview/node_modules, inbox/media等)

## 決定事項
- **AI認証**: ANTHROPIC_API_KEY方式 (CLI OAuth廃止)
- **仮想コンテナ**: Fly.io Machines (per user, オンデマンド)
- **DB**: Supabase PostgreSQL (ローカルDB不要)
- **定期実行**: back側APScheduler → worker `/agent/run` にHTTPで投げる
- **R2**: list/read/write/presign はback、sync_to_local/sync_from_local はworker
- **env分離**: コンテナ構成 (env/.env) とシークレット (service/.env) を分離
- **WORKER_URL は動的**: 本番ではユーザー別。backのworker_proxyがDBからURL引いてプロキシ

## 次回やるべきこと
1. **Phase 5: 本番デプロイ基盤** — Fly.io + Vercel + CI/CD (GitHub Actions)
2. **フロントBFF統一**: WORKER_URL直接参照 → back `/worker/{path}` プロキシ経由に
3. **Supabase Auth統合**: NextAuth → Supabase Auth (or 併用)
4. **RLSポリシー適用**: マルチテナント対応
5. **SPEC.md再作成**: 4層アーキテクチャ反映版 (前のは削除済み)

## コンテキスト
- **リポジトリ**: https://github.com/net-runners-com/company (main ブランチ)
- **Supabase**: mzdnglqmungkdcllurdz (ap-northeast-2), pooler接続
- **起動**: `docker compose -f env/docker-compose.yml up -d`
- **ポート**: front:3000, back:8001, worker:8000
- **主要ファイル**:
  - `env/docker-compose.yml` — サービス定義
  - `back/app/main.py` — 共有API (13ルーター)
  - `back/app/db.py` — PostgreSQL接続 (DATABASE_URL)
  - `back/app/r2.py` — R2全操作 (list/read/write/presign)
  - `back/app/routes/worker_proxy.py` — Worker動的プロキシ + Fly Machines API
  - `back/app/routes/schedules.py` — APScheduler + CRUD
  - `back/app/routes/connectors.py` — CRUD + Google OAuth
  - `back/app/routes/files.py` — ファイルブラウザ + スキル (R2)
  - `worker/app/main.py` — Workerエントリ (11ルーター)
  - `worker/app/routes/agent.py` — 汎用エージェント実行 POST /agent/run
  - `worker/app/back_client.py` — Worker→Back HTTP通信
  - `worker/app/r2.py` — sync_to_local/sync_from_local のみ
- **注意**: `sed -i` でファイルが空になった事故あり。sed使用禁止、Editツールで編集すること
- **DNS**: Supabase direct接続 (db.xxx.supabase.co) はDNS解決不可。pooler (aws-1-ap-northeast-2.pooler.supabase.com) を使う
