# セッション引き継ぎ資料

## 完了した作業

### SaaS基盤 — 認証
- **NextAuth v4**: メール/パスワード + Google OAuth
  - `src/lib/auth.ts`, `src/app/login/page.tsx`, `src/app/signup/page.tsx`
  - `src/middleware.ts` — (app)配下全ルート保護
  - サインアップ時に秘書・営業・経理の3名を自動作成

### サイドバー動的化
- `src/components/sidebar.tsx` — 登録社員の部署に応じてページ表示/非表示
- 固定: ホーム・指示・社員・カレンダー・アクティビティ・設定
- 部署連動: 秘書室(general-affairs), 営業(sales), 財務(accounting/finance), SNS(marketing), 自動化(dev)
- セッションからユーザー名表示 + ログアウトボタン

### mockデータ → Worker API 移行
- `src/lib/api.ts`: getEmployees, getEmployee, createEmployee, updateEmployee, getTasks, getScheduleEvents を Worker API / SQLite 経由に
- ホームページ、社員一覧、社員追加を全面書き直し
- DEFAULT_EMPLOYEES 自動シード廃止 — 社員追加はAPI経由のみ

### ホームページ
- 部署カード4列グリッド（部署名・説明・メンバーアバター・ステータス）
- カードクリック → createPortalモーダルでメンバー一覧表示

### 社員一覧ページ
- 部署カード → 社員カードのネスト構造
- mockDepartments依存排除

### 社員追加ページ
- 部署ドロップダウン（プリセット12部署 + 既存部署マージ + 「新しい部署を作成」）
- 役割はフリーテキスト入力
- 作成時にR2へ自己紹介.md自動生成

### 社員詳細ページ
- プロフィールタブ追加（自己紹介.md をMarkdownレンダリング）
- タブ順: チャット → プロフィール → タスク → スキル → フォルダ → 設定
- フォルダタブ: PDF/画像プレビュー対応、Markdownレンダリング、ページスクロール対応

### チャットスレッド（SQLite）
- `chat_threads`, `chat_messages` テーブル
- 左サイドバーにスレッドリスト + 新規チャットボタン
- スレッドタイトル: 最初のユーザーメッセージから自動設定（「新規チャット」がデフォルト）
- 毎回直近50件の履歴をシステムプロンプトに注入

### チャット内ファイルリンク
- `/workspace/` パス + ファイル名パターン（.md, .txt, .json, .pdf 等）を自動検出してクリッカブルに
- クリックでFilePreviewModal表示

### ファイルプレビューモーダル
- PDF: iframe表示 + 「新しいタブで開く」ボタン
- 画像: インラインプレビュー
- Markdown: ReactMarkdownレンダリング
- テキスト: monospace表示
- コードブロック: 明るい背景に修正

### ファイルブラウザ（R2-backed）
- PDF/画像: serve URLでインライン表示
- Markdown: プレビュー/編集切替
- ページスクロール対応

### LINE メッセージルーティング
- `POST /line/route` — ルーティングエージェント
- `POST /employee/{id}/chat/sync` — 社員キャラで一時エージェント起動（claude -p）
- 返信プレフィックス: `社員名（役職）: メッセージ`
- CHAT_LOGS_DIR参照エラー修正済み → SQLiteの_read_chat_log使用

### SQLite 汎用データストア
- `/workspace/data/store.db`
- `data_store` + `chat_threads` + `chat_messages` テーブル
- CRUD API: `/data/{collection}`

### 経理機能
- 仕訳帳・経費タブ（リアルデータ、ページネーション10件）
- 自動仕訳タブ削除済み

### 指示（進捗管理）ページ `/progress`
- 案件入力 → PMエージェントがパイプライン自動生成
- 左: 案件一覧（プログレスバー）、右: パイプラインビュー
- 各ステップ: 前のステップ完了後のみ実行可能
- 「実行」クリックで即座にUI「実行中」表示
- 完了ステップに成果物ファイルリンク（クリックでモーダルプレビュー）
- 実行時に社員のタスク一覧（`tasks_{emp_id}` コレクション）にも自動追加
- 旧「指示」ページ (`/directive`) 削除済み

### カレンダーページ `/schedule`
- mockデータ → SQLite data_store (`calendar_events`) に移行
- 「予定を追加」ボタン + モーダル（タイトル・日付・時間・種類・説明）

### 営業ページ
- サマリーカード削除
- メールタブ追加（宛先・件名・本文 → Gmail送信）

### Nango 統合
- Worker API: session, proxy, connections, integrations, webhook
- Nango MCP: `.mcp.json` に追加
- フロント設定ページ: 連絡連携（LINE/Slack/Discord）+ アプリ連携（Nango Connect UI）タブ分離
- Google系プラグイン削除 → Nango移行
- `docker-compose.yml` に NANGO_SECRET_KEY

### R2 オブジェクトストレージ
- ファイルブラウザ全API R2経由
- エージェント実行: R2→ローカル同期、完了後ローカル→R2同期
- boto3 追加

### PDF生成
- 全エージェントのシステムプロンプトにPDF生成ルール追加
- テンプレート: `/workspace/company/back-office/accounting/templates/` (fpdf2)
- 見積書・請求書・契約書・納品書

### アクティビティ通知
- `src/components/activity-toast.tsx` — 右下トースト通知
- 15秒ポーリング、新着アシスタント返信を検出
- ×ボタンで個別に閉じ可能

### 組織図ページ
- 作成後サイドバーから削除済み

## 作業中・未完了
- [ ] **カスタムダッシュボード**: `/dashboard/[slug]` 動的ページ、widgets JSON駆動 — 設計済み未実装
- [ ] **マルチテナント**: company_id WHERE句、Row Level Security
- [ ] **settings/page.tsx 型エラー**: webhookUrl property が ConnectorData 型にない
- [ ] **Google OAuth テスト**: Nango Custom developer app設定必要
- [ ] **max-turns**: main.py復元版で3のまま（15/20に再変更必要）
- [ ] **課金**: 後回し

## 決定事項
- **認証**: NextAuth v4 + メール/パスワード + Google OAuth
- **コネクタ2層**: メッセージング(LINE/Slack/Discord)=自前Webhook、その他=Nango
- **データストア**: SQLite汎用 `/data/{collection}`
- **社員フォルダ**: R2。エージェント実行時のみローカル同期
- **ページ動的表示**: 部署連動ビルトイン + カスタムダッシュボード(未実装)のハイブリッド
- **初期社員**: サインアップ時にさくら(秘書)・りく(営業)・あおい(経理)自動作成
- **PDF**: 見積書・請求書・納品書・契約書はfpdf2テンプレートでPDF生成
- **チャット履歴**: SQLite、直近50件をシステムプロンプト注入

## 次回やるべきこと
1. **カスタムダッシュボード実装**: `/dashboard/[slug]` + widgets system
2. **max-turns修正**: main.py の `"--max-turns", "3"` を `"15"` に（sedは使わずEditツールで）
3. **settings型エラー修正**
4. **マルチテナント**: company_id紐付け

## コンテキスト
- **プロジェクト**: `products/ai-company/` — Next.js 15.3 + FastAPI Worker + Docker
- **Worker**: `worker/app/main.py` (~2500行) — 全API
- **SQLite**: `/workspace/data/store.db` — data_store, chat_threads, chat_messages
- **R2**: `employees/{emp-id}/` プレフィックス
- **Nango**: Secret Key in `.env`, Webhook = `{PUBLIC_URL}/nango/webhook`
- **注意**: `sed -i` でmain.pyが空になった事故あり。sed使用禁止、Editツールで編集すること
- **主要ファイル**:
  - `worker/app/main.py` — 全API
  - `src/components/sidebar.tsx` — 動的サイドバー
  - `src/components/chat-view.tsx` — チャットUI（スレッド対応）
  - `src/components/file-preview-modal.tsx` — PDF/画像/MD プレビュー
  - `src/components/file-browser.tsx` — ファイルブラウザ（R2）
  - `src/components/activity-toast.tsx` — トースト通知
  - `src/stores/chat.ts` — チャットストア（スレッド対応）
  - `src/lib/auth.ts` — NextAuth設定
  - `src/lib/google-connector.ts` — Google段階的OAuth
  - `src/app/(app)/progress/page.tsx` — 指示（進捗管理）
  - `src/app/(app)/home/page.tsx` — ダッシュボード（4列部署カード）
  - `src/app/(app)/finance/page.tsx` — 経理（ページネーション付き）
  - `src/app/(app)/schedule/page.tsx` — カレンダー（イベント追加）
  - `src/app/(app)/settings/page.tsx` — 設定（連絡連携+アプリ連携）
