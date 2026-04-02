# セッション引き継ぎ資料

## 完了した作業

### 4層アーキテクチャ分離
- **front/**: Next.js BFF
- **back/**: FastAPI 共有API + Supabase PostgreSQL (14ルート)
- **worker/**: Claude Code CLI実行のみ (9ルート: agent, chat, projects, accounting, general_chat, connectors, line, rules, health)
- **env/**: Dockerfile, docker-compose.yml, コンテナ構成.env

### Cloud Run デプロイ
- **staging**: https://eureka-back-staging-932022452995.asia-northeast1.run.app
- **production**: 削除済み（必要時に再作成）
- GCP: advance-verve-477206-d9, Artifact Registry eureka (asia-northeast1)
- ビルド: `docker buildx build --platform linux/amd64 -f env/back/Dockerfile -t asia-northeast1-docker.pkg.dev/advance-verve-477206-d9/eureka/back:latest --push .`

### Cloud Scheduler
- **eureka-news-update-staging**: 毎朝7時JST → staging /schedules/trigger
- back/schedules.py に `/schedules/trigger` エンドポイント追加済み

### R2管理
- バケット: `eureka`
- 環境別: `{R2_ENV}/employees/`, `{R2_ENV}/plugins/`
- LINEプラグイン staging にアップロード済み (manifest.json, handler.py, icon.svg)
- コネクタープラグイン: R2からオンデマンドロード

### Fly.io
- アプリ `eureka-workers` 作成済み
- FLY_API_TOKEN 設定済み
- worker_proxy.py: Fly Machines API連携実装済み

### Worker スリム化
- 9ルートのみ（全てclaude CLI/Playwright/ローカルファイル依存）
- `/agent/run`: 汎用エージェント実行エンドポイント
- APScheduler: backに移行済み（Cloud Scheduler経由）
- R2: sync_to_local/sync_from_local + _r2_read のみ

## 作業中・未完了
- [ ] **LPページ**: `/` にEurekaサービス紹介 + CTA（登録/ログイン）
- [ ] **Supabase Auth統合**: NextAuth → Supabase Auth に切替
  - メール/パスワード + Google OAuth
  - auth.users 連携 + RLS
  - NextAuth関連コード削除
- [ ] **アカウント登録→コンテナ自動作成**: 登録時にFly.io Machine作成
- [ ] **フロントBFF統一**: WORKER_URL直接参照 → back `/worker/{path}` プロキシ経由
- [ ] **RLSポリシー**: マルチテナント
- [ ] **Vercel デプロイ**: front/

## 決定事項
- **サービス名**: Eureka
- **認証**: Supabase Auth（NextAuthから移行）
- **本番構成**: Cloud Run (back) + Fly.io Machines (worker) + Vercel (front) + Supabase (DB)
- **cron**: Cloud Scheduler → Cloud Run `/schedules/trigger`
- **R2**: バケット `eureka`、環境別ディレクトリ (R2_ENV)
- **コネクタープラグイン**: R2管理、オンデマンドロード

## 次回やるべきこと
1. **LPページ作成**: `/` にEureka紹介、料金、CTA
2. **Supabase Auth実装**: サインアップ/ログイン、NextAuth削除
3. **登録フロー**: サインアップ → Fly Machine作成 → オンボーディング
4. **Vercel デプロイ**: front/ 接続
5. **フロントBFF → worker_proxy統一**

## コンテキスト
- **リポジトリ**: https://github.com/net-runners-com/company (main)
- **サービス名**: Eureka
- **GCP**: advance-verve-477206-d9
- **Supabase**: mzdnglqmungkdcllurdz (ap-northeast-2 pooler)
- **R2**: eureka バケット
- **Fly.io**: eureka-workers (Runners Net org)
- **Cloud Run staging**: eureka-back-staging
- **Artifact Registry**: asia-northeast1-docker.pkg.dev/advance-verve-477206-d9/eureka/back
- **起動 (dev)**: `docker compose -f env/docker-compose.yml up -d`
- **ポート**: front:3000, back:8001, worker:8000
- **テストユーザー**: dev@example.com (ID: 00000000-0000-0000-0000-000000000001)
- **注意**: sed使用禁止。Cloud RunはARM不可（--platform linux/amd64必須）
