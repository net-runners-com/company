# セッション引き継ぎ資料

## 完了した作業

### デプロイ完了
- **Vercel**: https://eureka-mu-ten.vercel.app/ (eureka-front リポジトリ)
- **Cloud Run staging**: https://eureka-back-staging-932022452995.asia-northeast1.run.app
- **Cloud Scheduler**: eureka-news-update-staging (毎朝7時JST)
- **Fly.io**: eureka-workers アプリ作成済み

### リポジトリ分割
- https://github.com/net-runners-com/eureka-front (Next.js)
- https://github.com/net-runners-com/eureka-back (FastAPI)
- https://github.com/net-runners-com/eureka-worker (Claude Code CLI)
- https://github.com/net-runners-com/company (モノレポ、元リポ)

### Supabase Auth移行
- NextAuth完全削除 (auth.ts, [...nextauth]/route.ts, google-connector.ts, callback/)
- supabase-js導入、login/signup Supabase Auth対応
- auth-provider.tsx: useAuth() hook
- middleware.ts: Supabase cookie check
- sidebar, home: useSession → useAuth

### WORKER_URL廃止
- フロント17ファイルのWORKER_URL → BACK_URL + /worker/ プロキシ経由に統一
- front/.envからWORKER_URL削除

### Fly Machines管理API
- back/routes/machines.py: create/start/stop/delete/status
- auth/setup: サインアップ時にFly Machine自動作成

### LP
- Eureka紹介ページ (/, ヒーロー, 機能6つ, 3ステップ, CTA)
- ブランドカラー: violet-600

### ビルド修正
- Next.js脆弱性修正 (CVE-2025-66478)
- ConnectorData型にwebhookUrl追加
- ChatStore型にactiveEmployeeId追加

## 次回やるべきこと
1. **Supabase Auth設定**: ダッシュボードでメール認証有効化、Google OAuth設定
2. **サインアップテスト**: Vercelで実際にアカウント作成→初期社員作成確認
3. **eureka-frontとモノレポの同期方法決定**: 今は手動コピー。git subtreeかCI/CDで自動化
4. **Fly Worker イメージビルド・プッシュ**: eureka-workersにDockerイメージ登録
5. **RLSポリシー**: Supabase Auth uid() と連携
6. **front/.envクリーンアップ**: DATABASE_URL, Google OAuth不要

## 決定事項
- **サービス名**: Eureka
- **認証**: Supabase Auth
- **本番構成**: Vercel (front) + Cloud Run (back) + Fly.io Machines (worker) + Supabase (DB+Auth)
- **cron**: Cloud Scheduler → Cloud Run /schedules/trigger
- **R2**: eureka バケット、R2_ENV で環境切替
- **WORKER_URL廃止**: 全てBACK_URL経由

## コンテキスト
- **Vercel**: https://eureka-mu-ten.vercel.app/
- **Cloud Run staging**: eureka-back-staging-932022452995.asia-northeast1.run.app
- **GCP**: advance-verve-477206-d9
- **Supabase**: mzdnglqmungkdcllurdz (ap-northeast-2 pooler)
- **R2**: eureka バケット
- **Fly.io**: eureka-workers (Runners Net org)
- **Artifact Registry**: asia-northeast1-docker.pkg.dev/advance-verve-477206-d9/eureka/back
- **テストユーザー**: まだなし（Supabase Authで新規作成必要）
- **注意**: sed使用禁止。Cloud RunはARM不可（--platform linux/amd64）。eureka-frontリポジトリはモノレポから手動同期中
