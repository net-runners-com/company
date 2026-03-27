# SPEC.md — プロジェクト仕様書

## プロジェクト概要

---

## ディレクトリ構成

```
company-test/
├── .claude/                    # Claude Code 設定
│   ├── hooks/                  # セッションフック
│   ├── skills/                 # グローバルスキル（8つ）
│   ├── logs/                   # フックログ
│   ├── settings.json           # プラグイン設定
│   └── settings.local.json     # パーミッション・フック設定
│
├── .company/                   # 仮想組織
│   ├── CLAUDE.md               # 組織ルール
│   ├── secretary/              # 秘書室（常設）
│   ├── research/               # リサーチ部
│   ├── engineering/            # エンジニアリング部
│   ├── pm/                     # PM部
│   ├── finance/                # 経理部
│   ├── sales/                  # 営業部
│   ├── sns/                    # SNS運用部（note, threads, etc.）
│   ├── dev/                    # 開発部
│   ├── newbiz/                 # 新規事業部
│   └── skills/                 # ローカルスキル（3つ）
│
├── features/                   # 独立機能モジュール
│   ├── line/                   # LINE Messaging API 連携
│   ├── meeting/                # 議事録ツール
│   └── preview/                # PPTXプレビュー（pptx-glimpse）
│
├── products/                   # プロダクト
│   ├── todo-app/               # React Native Expo TODO アプリ
│   └── www/                    # Webサイト群
│       ├── construction-lp/    # 建設LP（Vite + React）
│       ├── kusawake/           # 草分けLP
│       ├── sample-construction/# サンプル建設サイト
│       └── invoices/           # 請求書管理
│
├── docs/                       # VitePressドキュメント（未使用）
├── .github/                    # GitHub Actions（未使用）
├── .wrangler/                  # Cloudflare Wrangler キャッシュ（自動生成）
├── .mcp.json                   # MCP サーバー設定
├── .env                        # 環境変数
├── HANDOFF.md                  # セッション引き継ぎ
└── package.json                # ルート依存関係
```

---

## スキル一覧

### グローバルスキル（`.claude/skills/`）

| スキル | トリガー | 概要 |
|--------|----------|------|
| brainstorming | 自動（クリエイティブ作業前） | アイデアを設計に落とすための対話型ブレスト |
| handoff | /handoff | セッション引き継ぎ資料（HANDOFF.md）の作成・更新 |
| image-enhancer | 画像改善依頼時 | スクリーンショット・画像の高画質化 |
| kaizen | コード実装・リファクタ時 | 継続的改善（YAGNI、Poka-Yoke、標準化、JIT） |
| nano-banana | 画像生成依頼時 | Gemini CLI による画像生成・編集 |
| prompt-engineering | — | プロンプト設計・エージェント通信のガイド |
| ship-learn-next | 学習コンテンツ→実践 | 学習内容をShip-Learn-Nextサイクルに変換 |
| subagent-driven-development | 複数タスク実行時 | サブエージェント分散実行＋コードレビュー |

### ローカルスキル（`.company/skills/`）

| スキル | トリガー | 概要 |
|--------|----------|------|
| company | /company | 仮想カンパニー運営（秘書 → 部署振り分け） |
| note-article | /note-article | note.com 記事自動生成・投稿 |
| threads | /threads | Threads 自動投稿 |

---

## インストール済みプラグイン

`.claude/settings.json` で有効化:

| プラグイン | ソース | 用途 |
|-----------|--------|------|
| skill-creator | claude-plugins-official | スキルの作成・編集・評価 |
| document-skills | anthropic-agent-skills | ドキュメント系スキル群（PDF, PPTX, DOCX, XLSX, フロントエンド等） |
| claude-mem | thedotmack | クロスセッション永続メモリ |

---

## MCP サーバー

`.mcp.json` で設定:

| サーバー | パッケージ | 用途 |
|----------|-----------|------|
| context7 | `@upstash/context7-mcp` | ライブラリドキュメントのリアルタイム取得 |

---

## フック

`.claude/settings.local.json` → `.claude/hooks/` で定義:

| フック | ファイル | 動作 |
|--------|---------|------|
| SessionStart | `session-start.sh` | HANDOFF.md を自動注入してセッション継続 |
| *(無効)* | `stop-check.sh` | コンテキスト80%超で警告 |
| *(無効)* | `pre-compact-log.sh` | 圧縮ログ記録 |

---

## 依存関係

### ルート（`package.json`）

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| playwright | ^1.58.2 | ブラウザ自動操作 |
| vitepress | ^1.6.4 (dev) | ドキュメントサイト生成 |

### products/todo-app

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| expo | ~54.0.33 | React Native フレームワーク |
| react | 19.1.0 | UI ライブラリ |
| react-native | 0.81.5 | モバイルアプリ |
| @react-native-async-storage | 2.2.0 | ローカルストレージ |
| expo-router | ~6.0.23 | ルーティング |
| react-native-reanimated | ~4.1.1 | アニメーション |

### products/www/construction-lp

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| react | ^19.2.4 | UI ライブラリ |
| react-dom | ^19.2.4 | DOM レンダリング |
| vite | ^8.0.1 (dev) | ビルドツール |
| typescript | ~5.9.3 (dev) | 型チェック |

### features/preview

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| pptx-glimpse | ^0.6.0 | PPTX プレビュー変換 |
| tsx | ^4.21.0 (dev) | TypeScript 実行 |

### Python スクリプト（pip 管理外）

| ツール | パス | 用途 |
|--------|------|------|
| browser-use CLI | `~/.browser-use-env/bin/browser-use` | ブラウザ自動操作（note, Threads投稿） |
| gemini CLI | グローバル | 画像生成（Nano Banana） |

Python スクリプトは標準ライブラリのみ使用（subprocess, pathlib, json, base64, re 等）。
browser-use CLI を外部プロセスとして呼び出す構成。

---

## 環境変数

### `.env`（プロジェクトルート）

| キー | 用途 |
|------|------|
| GEMINI_API_KEY | Gemini API（画像生成） |
| BRAVE_SEARCH_API_KEY | Brave Search API |

### `features/line/.env`

| キー | 用途 |
|------|------|
| LINE_CHANNEL_ID | LINE チャネルID |
| LINE_CHANNEL_SECRET | LINE チャネルシークレット |
| LINE_ACCESS_TOKEN | LINE アクセストークン |
| LINE_USER_ID | LINE ユーザーID |

---

## パーミッション

`.claude/settings.local.json` で許可済み:

| パーミッション | 用途 |
|---------------|------|
| `Bash(gws calendar:*)` | Google Calendar 操作 |
| `WebSearch` | Web検索 |
| `WebFetch(domain:humalance.com)` | 特定サイト取得 |
| `WebFetch(domain:www.jtuc-rengo.or.jp)` | 特定サイト取得 |
| `WebFetch(domain:rimo.app)` | 特定サイト取得 |
| `WebFetch(domain:sg.wantedly.com)` | 特定サイト取得 |
| `Bash(npm install:*)` | npm パッケージインストール |
| `Bash(npx expo:*)` | Expo CLI コマンド |

---

## features/ 詳細

### line/
LINE Messaging API による双方向通知システム。

| ファイル | 役割 |
|---------|------|
| `webhook-server.mjs` | Webhook受信サーバー |
| `line-agent.sh` | メッセージ処理エージェント |
| `inbox/` | 受信メッセージ・メディア保存先 |

### meeting/
| ファイル | 役割 |
|---------|------|
| `meeting.sh` | 議事録処理スクリプト |

### preview/
| ファイル | 役割 |
|---------|------|
| `convert-pptx.ts` | PPTX→プレビュー変換 |
| `create-preview.sh` | プレビュー生成スクリプト |
| `src/index.ts` | Cloudflare Worker エントリ |
| `wrangler.toml` | Wrangler設定 |
