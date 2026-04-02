# セッション引き継ぎ資料

## 完了した作業

### 4層アーキテクチャ分離
- **front/**: Next.js BFF
- **back/**: FastAPI 共有API + Supabase PostgreSQL (14ルート)
  - employees, data, chat, user, connectors (CRUD+Google OAuth+providers), schedules (APScheduler), news, share, pages (generate/update含む), nango, files (R2), calendar, worker_proxy
- **worker/**: Claude Code CLI実行のみ (9ルート)
  - agent, chat, projects, accounting, general_chat, connectors (webhook), line, rules, health
- **env/**: Dockerfile, docker-compose.yml, コンテナ構成.env

### DB移行
- SQLite → Supabase PostgreSQL (aws-1-ap-northeast-2 pooler)
- 全テーブル user_id UUID 付き
- データ移行完了 (社員10, データ105, スレッド50, メッセージ346)

### R2管理
- バケット: `eureka`
- 環境別ディレクトリ: `{R2_ENV}/employees/`, `{R2_ENV}/plugins/`
- R2_ENV: development / staging / production
- コネクタープラグイン: R2からオンデマンドロード（worker再ビルド不要）
- ファイルブラウザ・スキル: backから直接R2操作

### Worker スリム化
- 削除済み: db.py, data.py, user.py, share.py, nango.py, files.py, schedules.py, employees.py, pages.py, news.py (GET)
- APScheduler: backに移行、タスク実行は worker `/agent/run` にHTTP
- pages generate/update: backが `/agent/run` 呼んでHTML抽出・保存
- connector plugins: R2管理に移行、ローカルディレクトリ削除

### Fly.io
- アプリ `eureka-workers` 作成済み
- FLY_API_TOKEN を back/.env に設定済み
- worker_proxy.py: Fly Machines API連携（マシン作成/起動/停止）実装済み

### 進捗管理ページ
- バックグラウンド実行、中断機能、ポーリング、並列エージェント、UI改善

## 作業中・未完了
- [ ] **本番デプロイ構成の実装**:
  - Cloud Run: back API デプロイ
  - Cloud Scheduler: cron → Cloud Run エンドポイント
  - Fly.io Machines: worker（ユーザー別オンデマンド）
  - Vercel: front デプロイ
- [ ] **フロントBFF統一**: WORKER_URL直接参照 → back `/worker/{path}` プロキシ経由に
- [ ] **Supabase Auth統合**: NextAuth → Supabase Auth
- [ ] **RLSポリシー**: マルチテナント
- [ ] **SPEC.md再作成**: 4層アーキテクチャ版

## 決定事項
- **AI認証**: ANTHROPIC_API_KEY方式
- **本番構成**: Cloud Run (back) + Fly.io Machines (worker) + Vercel (front) + Supabase (DB)
  - Cloud Scheduler でcron管理（APScheduler置き換え）
- **R2**: バケット `eureka`、環境別ディレクトリ (`R2_ENV`)
- **コネクタープラグイン**: R2管理、オンデマンドロード
- **WORKER_URL は動的**: backのworker_proxyがDBからユーザー別URL取得

## 次回やるべきこと
1. **Cloud Run デプロイ**: back/ のDockerイメージをGCRにpush → Cloud Run作成
2. **Cloud Scheduler設定**: cronジョブ → Cloud Run `/schedules/trigger` 
3. **Fly.io Worker テスト**: eureka-workersにテストマシン作成・起動確認
4. **Vercel デプロイ**: front/ をVercelに接続
5. **フロントBFF → worker_proxy統一**

## コンテキスト
- **リポジトリ**: https://github.com/net-runners-com/company (main)
- **Supabase**: mzdnglqmungkdcllurdz (ap-northeast-2), pooler接続
- **R2**: eureka バケット, development/ プレフィックス
- **Fly.io**: eureka-workers アプリ (Runners Net org)
- **起動**: `docker compose -f env/docker-compose.yml up -d`
- **ポート**: front:3000, back:8001, worker:8000
- **主要ファイル**:
  - `env/docker-compose.yml`
  - `back/app/main.py` (14ルーター)
  - `back/app/db.py` (DATABASE_URL)
  - `back/app/r2.py` (R2_ENV対応)
  - `back/app/routes/worker_proxy.py` (Fly Machines連携)
  - `back/app/routes/schedules.py` (APScheduler + worker /agent/run)
  - `back/app/routes/connectors.py` (CRUD + OAuth + R2 providers)
  - `back/app/routes/pages.py` (generate/update via /agent/run)
  - `worker/app/main.py` (9ルーター)
  - `worker/app/routes/agent.py` (汎用実行)
  - `worker/app/back_client.py` (Worker→Back通信)
  - `worker/app/plugin_loader.py` (R2オンデマンド)
- **注意**: sed使用禁止（ファイル破損事故あり）
- **DNS**: Supabase direct接続不可、pooler使用
