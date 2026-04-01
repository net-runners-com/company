# 開発部門（アプリ・Webサービス）

## 役割
アプリ・Webサービスの設計・実装・インフラ・品質管理を担当する。

## 技術スタック
| レイヤー | 採用技術 |
|---------|---------|
| フロントエンド | Next.js (SSR) / Vite + React + TypeScript |
| デプロイ | Cloudflare Workers (OpenNext) / Vercel |
| バックエンド | Next.js API Routes / Cloudflare Workers |
| DB | Supabase (PostgreSQL + RLS) |
| 認証 | Supabase Auth |
| 決済 | Stripe (Webhook + リカーリング) |
| メール | Resend |
| AI | Claude API / Gemini API / VoltAgent |
| 監視 | Discord通知（エラー・ステータス） |
| ドメイン | Cloudflare Registrar |
| PDF生成 | Python fpdf2（日本語: ヒラギノ角ゴシック W3/W6） |
| プレゼン生成 | PptxGenJS（Node.js） |

## 開発の鉄則

### 設計ファースト
- **コードを書く前に設計書を書く**。`specs/` に仕様書を作成してから着手
- Mermaid図を使ってフロー・シーケンス・アーキテクチャを可視化する
- 設計書には必ず「受け入れ条件」チェックリストを含める

### Issue駆動開発（GitHub Flow）
- すべての作業は Issue → ブランチ → PR → マージ → Close のサイクルで回す
- ブランチ命名: `feature/#<Issue番号>-<説明>` / `fix/#<Issue番号>-<説明>`
- 永続ブランチは `main` のみ。直接pushは禁止
- マージは Squash and Merge。リリースはタグ（`v1.0.0`）で管理
- 詳細設計: `specs/spec-github-project-management.md` を参照

### 品質チェック
- 実装後は必ずブラウザで目視確認する（Chrome MCP toolsで自動スクショ可能）
- レスポンシブ対応はPC/SP両方で確認
- ビルドエラーゼロを確認してからPR作成

## ルール
- プロジェクト管理: `projects/[project-name]/` 以下に配置
- 仕様書: `specs/[feature-name].md`
- バグ報告: `bugs/YYYY-MM-DD-[summary].md`（ステータス: open / in-progress / resolved）
- インフラ設定メモ: `infra/`
- Supabaseは必ずRLS・CHECK制約・user_id = auth.uid()を設定
- Stripe実装時はテストカード検証必須
- セキュリティとUXは最優先
- 完了したら秘書のTODOに報告を追記

## 開発フェーズ（ミニマム）
1. 問題言語化 → コスト試算 → テーブル設計
2. Cloudflare/Vercelセットアップ → GitHub自動デプロイ
3. Supabase: スキーマ設計 → RLS設定 → API実装
4. Stripe連携（必要な場合）
5. 監視・アラート設定
6. リリース → フィードバック収集

## フォルダ構成
- `projects/` - プロジェクトごとの進捗・ドキュメント
- `specs/` - 機能仕様書・設計書
- `bugs/` - バグトラッキング
- `infra/` - インフラ設定メモ（Cloudflare / Supabase / Stripe）

---

## 実証済み知見

### LP制作（静的サイト・React）

#### Vite + React + TypeScript でのLP構築
- `npm create vite@latest [name] -- --template react-ts` で初期化
- コンポーネント分割: Nav / Hero / Services / Works / Strengths / Process / Message / About / Contact / Footer
- 1コンポーネント1ファイル、`src/components/` に配置

#### デザインパターン（建築・不動産・士業系LP向け）
- **カラー**: ダークネイビー（`#0c1222`）+ アンバーアクセント（`#c57d12`）が信頼感と高級感を両立
- **フォント**: `Noto Serif JP`（見出し）+ `Noto Sans JP`（本文）。Google Fontsで読み込み
- **ナビ**: `position: fixed` + スクロール時に `backdrop-filter: blur()` で背景変化
- **ヒーロー**: `min-height: 100vh` + Unsplash画像 + `linear-gradient` オーバーレイ + 実績数値（社会的証明）
- **カードUI**: `border-top: 3px solid accent` + `hover: translateY(-6px) + box-shadow`
- **CTAボタン**: `hover: translateY(-2px) + box-shadow` で浮き上がり演出
- **セクション構造**: 英語ラベル（小さく）→ 日本語タイトル（大きく）→ バー装飾 → 説明文

#### レスポンシブ対応
- `clamp()` でフォントサイズ・paddingを自動調整（breakpoint不要のケースが多い）
- ハンバーガーメニュー: CSSだけで実装可能（`transform: rotate` でアニメーション）
- グリッド: `grid-template-columns: repeat(auto-fit, minmax(Xpx, 1fr))` で自動折り返し

#### 画像
- Unsplashの画像URLに `?w=1800&q=80` を付けてサイズ・品質を指定
- `loading="lazy"` を必ず付与
- カードの画像ホバー: `transform: scale(1.06)` + `overflow: hidden` + `transition: 0.6s`

### PDF帳票生成（Python fpdf2）

- macOSの日本語フォント: `/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc`（本文）/ `W6.ttc`（太字）
- 実行: `/usr/bin/python3`（システムPython。venv内ではなくこちらを使う）
- テンプレートは `company/back-office/accounting/templates/` に配置。PARAMSを変更するだけでPDF出力
- 対応帳票: 請求書（源泉徴収ON/OFF）、見積書、売買契約書

### プレゼン資料生成（PptxGenJS）

- `/tmp/pptx-build/` に `node_modules` を配置（プロジェクトルートを汚さない）
- `node スクリプト.js` で `.pptx` 直接生成
- カラーパレットを `const C = { ... }` で一元管理するとスライド全体の統一感が保てる
- **データには必ず出典を付ける**。各スライドに `addSource()` ヘルパーで出典テキストを配置
- 最終スライドに出典一覧を入れる

### Git / GitHub 運用
- `.gitignore` に必ず含める: `.env`, `*.env`, `.DS_Store`, `my/`（個人情報）, `.claude/`, `node_modules/`
- 初回コミットは全体像がわかるメッセージにする
- `gh` CLI（GitHub CLI）: `brew install gh` でインストール。Issue/PR/Projects操作に使う
