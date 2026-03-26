# 開発部門（アプリ・Webサービス）

## 役割
アプリ・Webサービスの設計・実装・インフラ・品質管理を担当する。

## 技術スタック
| レイヤー | 採用技術 |
|---------|---------|
| フロントエンド | Next.js (SSR) |
| デプロイ | Cloudflare Workers (OpenNext) / Vercel |
| バックエンド | Next.js API Routes / Cloudflare Workers |
| DB | Supabase (PostgreSQL + RLS) |
| 認証 | Supabase Auth |
| 決済 | Stripe (Webhook + リカーリング) |
| メール | Resend |
| AI | Gemini API / VoltAgent |
| 監視 | Discord通知（エラー・ステータス） |
| ドメイン | Cloudflare Registrar |

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
- `specs/` - 機能仕様書
- `bugs/` - バグトラッキング
- `infra/` - インフラ設定メモ（Cloudflare / Supabase / Stripe）
