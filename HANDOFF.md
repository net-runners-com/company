# セッション引き継ぎ資料

## 完了した作業

### 4層アーキテクチャ分離
- **front/**: Next.js BFF
- **back/**: FastAPI 共有API + Supabase PostgreSQL (14ルート)
- **worker/**: Claude Code CLI実行のみ (9ルート)
- **env/**: Dockerfile, docker-compose.yml, コンテナ構成.env

### Cloud Run デプロイ
- **staging**: https://eureka-back-staging-932022452995.asia-northeast1.run.app
- GCP: advance-verve-477206-d9, Artifact Registry eureka (asia-northeast1)
- ビルド: `docker buildx build --platform linux/amd64 -f env/back/Dockerfile -t asia-northeast1-docker.pkg.dev/advance-verve-477206-d9/eureka/back:latest --push .`

### Cloud Scheduler
- **eureka-news-update-staging**: 毎朝7時JST → staging /schedules/trigger

### Eureka LP
- `/` にサービス紹介ページ作成（ヒーロー、機能6つ、3ステップ、CTA）
- ログイン/サインアップページを「Eureka」ブランドに更新

### R2管理
- バケット: `eureka`, 環境別: `{R2_ENV}/`
- LINEプラグイン staging アップロード済み
- コネクタープラグイン: R2オンデマンドロード

### Fly.io
- `eureka-workers` アプリ作成済み
- worker_proxy.py 実装済み

## 作業中・未完了
- [ ] **Supabase Auth統合** (最優先):
  - `front/src/lib/auth.ts` — 現在NextAuth + pg直接。Supabase Auth SDKに置換
  - `front/src/app/login/page.tsx` — `signIn("credentials")` → `supabase.auth.signInWithPassword()`
  - `front/src/app/signup/page.tsx` — 同上 → `supabase.auth.signUp()`
  - `front/src/lib/auth-provider.tsx` — SessionProvider → Supabase AuthProvider
  - `front/src/middleware.ts` — NextAuth session check → Supabase session check
  - `front/src/app/api/auth/[...nextauth]/route.ts` — 削除
  - 初期社員自動登録ロジック（auth.ts L90-108）をback API経由に移行
  - `front/package.json` から next-auth, bcryptjs 削除
- [ ] **アカウント登録→コンテナ自動作成**: 登録時にFly.io Machine作成 (back/worker_proxy.py)
- [ ] **フロントBFF統一**: WORKER_URL直接参照 → back `/worker/{path}` 経由
- [ ] **RLSポリシー**: Supabase Auth の auth.uid() と連携
- [ ] **Vercel デプロイ**: front/
- [ ] **Production Cloud Run**: 必要時に再作成

## 決定事項
- **サービス名**: Eureka
- **認証**: Supabase Auth（NextAuthから移行）
- **本番構成**: Cloud Run (back) + Fly.io Machines (worker) + Vercel (front) + Supabase (DB+Auth)
- **cron**: Cloud Scheduler → Cloud Run `/schedules/trigger`
- **R2**: バケット `eureka`、環境別ディレクトリ (R2_ENV)

## 次回やるべきこと
1. **Supabase Auth実装**: supabase-js導入、ログイン/サインアップ書き換え、NextAuth削除
2. **登録フロー**: サインアップ → back APIで初期社員作成 + Fly Machine作成
3. **middleware**: Supabase session check
4. **Vercel デプロイ**

## コンテキスト
- **リポジトリ**: https://github.com/net-runners-com/company (main)
- **サービス名**: Eureka
- **GCP**: advance-verve-477206-d9
- **Supabase**: mzdnglqmungkdcllurdz (ap-northeast-2 pooler)
- **Supabase ANON KEY**: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZG5nbHFtdW5na2RjbGx1cmR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwOTU5MzcsImV4cCI6MjA5MDY3MTkzN30.0T8QuRrvbL6zo14c_DIDlp7hMMmtsLj2YIDSRTIwfEk
- **R2**: eureka バケット
- **Fly.io**: eureka-workers (Runners Net org)
- **Cloud Run staging**: eureka-back-staging-932022452995.asia-northeast1.run.app
- **Artifact Registry**: asia-northeast1-docker.pkg.dev/advance-verve-477206-d9/eureka/back
- **起動**: `docker compose -f env/docker-compose.yml up -d`
- **ポート**: front:3000, back:8001, worker:8000
- **テストユーザー**: dev@example.com (ID: 00000000-0000-0000-0000-000000000001)
- **注意**: sed使用禁止。Cloud RunはARM不可（--platform linux/amd64）
