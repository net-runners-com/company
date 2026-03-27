# AI Company - アーキテクチャドキュメント

## 開発環境構成

```
docker-compose up
├── frontend   (Next.js 15 + API Routes)  localhost:3000
├── worker     (FastAPI + Claude Code CLI) localhost:8000
└── db         (PostgreSQL 16)             localhost:5432
```

### サービス詳細

| サービス | イメージ | 役割 | ホットリロード |
|---------|---------|------|-------------|
| frontend | node:22-alpine | UI + API Routes | `src/`, `public/` マウント |
| worker | python:3.12-slim | タスク実行、SNS自動化、LLM連携 | `worker/app/` マウント |
| db | postgres:16-alpine | データストア | pgdata ボリューム永続化 |

### 環境変数

| 変数 | サービス | 説明 |
|------|---------|------|
| `NODE_ENV` | frontend | development |
| `WORKER_URL` | frontend | worker への接続先 (http://worker:8000) |
| `DATABASE_URL` | frontend, worker | PostgreSQL 接続文字列 |
| `GEMINI_API_KEY` | worker | 画像生成用 |
| `R2_ACCOUNT_ID` | worker | Cloudflare R2 アカウント |
| `R2_ENDPOINT` | worker | R2 エンドポイント |
| `R2_BUCKET` | worker | R2 バケット名 (ai-company-dev) |
| `R2_ACCESS_KEY_ID` | worker | R2 認証 |
| `R2_SECRET_ACCESS_KEY` | worker | R2 認証 |

### 通信フロー

```
ブラウザ
  ↓ HTTP
frontend (Next.js API Routes)  ← Zustand (クライアント状態)
  ↓ POST http://worker:8000
worker (FastAPI)
  ├── Claude Code CLI (LLM処理)
  ├── browser-use (SNS自動投稿)
  └── R2 (メディアアップロード)
  ↓ SQL
db (PostgreSQL)
```

---

## 本番構成（予定）

```
Vercel          → frontend (Next.js + API Routes)
Fly.io Machines → worker (FastAPI + Chrome + Claude Code)
Supabase        → DB + Auth + Realtime
Cloudflare R2   → メディアストレージ
```

| 環境 | frontend | worker | DB | Storage |
|------|----------|--------|-----|---------|
| 開発 | Docker localhost:3000 | Docker localhost:8000 | Docker localhost:5432 | R2 ai-company-dev |
| ステージング | Vercel Preview | Fly.io staging | Supabase staging | R2 ai-company-staging |
| 本番 | Vercel Production | Fly.io production | Supabase production | R2 ai-company-prod |

---

## 技術スタック

### Frontend
- **Next.js 15.3** (App Router, React 19)
- **Tailwind CSS 4** (PostCSS統合)
- **Zustand 5** (クライアント状態管理)
- **react-nice-avatar** (アバター生成)
- **TypeScript 5.8** (strict mode)

### Worker
- **Python 3.12**
- **FastAPI** (非同期APIサーバー)
- **uvicorn** (ASGIサーバー)
- **psycopg2** (PostgreSQL接続)
- **httpx** (HTTP クライアント)
- Claude Code CLI (コンテナ内インストール)
- browser-use (将来: SNS自動化)

### Database
- **PostgreSQL 16** (9テーブル、UUID主キー)
- スキーマ: `worker/db/init.sql`
- ER図: `docs/er-diagram.md`

### Storage
- **Cloudflare R2** (S3互換)
- バケット: `ai-company-dev`
- 用途: 画像、ドキュメント、動画

---

## ディレクトリ構成

```
ai-company/
├── docker-compose.yml          # 開発環境オーケストレーション
├── Dockerfile.frontend         # フロント用 Docker イメージ
├── .env                        # 環境変数（gitignore対象）
├── .env.example                # 環境変数テンプレート
├── .dockerignore
├── next.config.ts
├── tsconfig.json
├── package.json
├── postcss.config.mjs
├── SPEC.md                     # プロダクト仕様書
│
├── docs/
│   ├── architecture.md         # このドキュメント
│   └── er-diagram.md           # ER図
│
├── src/
│   ├── app/
│   │   ├── layout.tsx          # ルートレイアウト (I18nProvider)
│   │   ├── page.tsx            # ランディングページ
│   │   ├── globals.css         # グローバルCSS (テーマ、シャドウ)
│   │   └── (app)/
│   │       ├── layout.tsx      # アプリレイアウト (Sidebar + main)
│   │       ├── home/           # ダッシュボード (部門別社員一覧)
│   │       ├── dashboard/      # 分析 (統計 + チャート)
│   │       ├── tasks/          # タスク管理
│   │       ├── schedule/       # スケジュール (カレンダー + リスト)
│   │       ├── projects/       # プロジェクト管理
│   │       ├── revenue/        # 売上 (週/月/年チャート)
│   │       ├── documents/      # 見積書・請求書
│   │       ├── sns/            # SNS連携管理
│   │       ├── activity/       # アクティビティログ
│   │       ├── settings/       # 設定
│   │       ├── onboarding/     # オンボーディング
│   │       └── employee/
│   │           ├── create/     # 社員作成ウィザード
│   │           └── [id]/       # 社員詳細 (チャット/タスク/設定)
│   │
│   ├── components/
│   │   ├── sidebar.tsx         # サイドバーナビ (fixed, 10項目)
│   │   ├── employee-card.tsx   # 社員カード (アバター/詳細/スキル)
│   │   ├── employee-avatar.tsx # react-nice-avatar ラッパー
│   │   └── chat-view.tsx       # チャットUI (バブル/入力)
│   │
│   ├── lib/
│   │   ├── api.ts              # モックAPIレイヤー (将来DB接続)
│   │   ├── constants.ts        # getRoleLabel, getStatusConfig
│   │   ├── utils.ts            # timeAgo (i18n対応)
│   │   └── i18n/
│   │       ├── index.ts        # Context, useI18n hook
│   │       ├── provider.tsx    # I18nProvider (localStorage保存)
│   │       └── locales/
│   │           ├── en.ts       # 英語翻訳
│   │           └── ja.ts       # 日本語翻訳
│   │
│   ├── stores/
│   │   ├── chat.ts             # チャットメッセージ (per employee)
│   │   ├── company.ts          # 会社情報
│   │   └── employees.ts        # 社員一覧
│   │
│   ├── types/
│   │   └── index.ts            # 全型定義
│   │
│   └── data/
│       └── mock.ts             # モックデータ
│
├── worker/
│   ├── Dockerfile              # Worker用 Docker イメージ
│   ├── .dockerignore
│   ├── requirements.txt        # Python依存関係
│   ├── app/
│   │   ├── __init__.py
│   │   └── main.py             # FastAPI エントリポイント
│   └── db/
│       └── init.sql            # DBスキーマ初期化
│
└── public/                     # 静的アセット
```
