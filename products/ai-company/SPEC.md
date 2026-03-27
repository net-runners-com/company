# AI Company — プロダクト仕様書

## 1. プロダクト概要

| 項目 | 内容 |
|------|------|
| プロダクト名 | AI Company（仮） |
| コンセプト | AI社員を作って、一人で会社を回すSaaS |
| ターゲット | 一人社長、個人事業主、フリーランス（40代非技術者） |
| プラットフォーム | Webアプリ（PC/スマホ/タブレット） |
| コア技術 | Claude Code CLI + Playwright on クラウドコンテナ |

### 何ができるか

- 自分好みのAI社員を作成（名前、性格、得意分野、アバター）
- 社員にチャットで指示（記事書いて、調べて、投稿して）
- SNS自動運用（note.com、Threads、LINE対応）
- タスク管理・進捗追跡
- 社員同士の連携（リサーチ → ライター → 投稿）
- 24/7稼働（クラウドで常時対応、PC不要）

---

## 2. 画面遷移

```
URL アクセス
│
├── 未ログイン → [ランディングページ]
│   ├── サービス説明
│   ├── 料金プラン
│   └── [新規登録] / [ログイン] → Supabase Auth
│
├── ログイン済み・会社未作成 → [オンボーディング]
│   ├── Step 1: 会社作成
│   │   └── 会社名、業種、ミッション入力
│   ├── Step 2: 初期社員（秘書）自動作成
│   │   └── 名前・性格をカスタマイズ可能
│   └── Step 3: 完了 → ホーム
│
└── ログイン済み・会社あり → [ホーム（オフィス）]
    │
    ├── 社員カード一覧
    │   └── カードクリック → [社員詳細]
    │       ├── [チャット] タブ
    │       │   └── テキスト入力 → VPSコンテナでCLI実行 → ストリーミング返答
    │       ├── [タスク] タブ
    │       │   └── 依頼済みタスクの一覧・進捗
    │       └── [設定] タブ
    │           └── 性格・スキル・アバター編集
    │
    ├── [+ 社員を追加] → [社員作成]
    │   ├── Step 1: 基本情報（名前、役職、担当領域）
    │   ├── Step 2: パーソナリティ（性格、口調、得意分野）
    │   ├── Step 3: アバター（AI生成 or アップロード）
    │   └── 完了 → ホームに戻る
    │
    ├── サイドバー: [ダッシュボード]
    │   ├── 全社員の稼働状況
    │   ├── 今日のタスク完了数
    │   ├── SNS投稿状況
    │   └── コスト概要
    │
    ├── サイドバー: [SNS連携]
    │   ├── 連携済みアカウント一覧
    │   └── [+ アカウント連携] → [認証画面]
    │       └── noVNCでコンテナ内Chromeを表示 → ユーザーがログイン → Cookie自動保存
    │
    ├── サイドバー: [アクティビティ]
    │   └── 全社員の作業ログ（時系列）
    │
    └── サイドバー: [設定]
        ├── 会社情報の編集
        ├── プラン・課金管理（Stripe）
        └── データエクスポート
```

---

## 3. 機能一覧

### 3.1 会社管理

| 機能 | 説明 |
|------|------|
| 会社作成 | 名前、業種、ミッション、目標を設定 |
| 会社情報編集 | 作成後も変更可能 |
| データエクスポート | 全データをJSON/ZIPでエクスポート |

### 3.2 社員管理

| 機能 | 説明 |
|------|------|
| 社員作成 | 名前、役職、担当、性格、口調、得意分野を設定 |
| アバター設定 | AI生成 or 画像アップロード（R2保存） |
| 社員編集 | パーソナリティ・スキルをいつでも変更 |
| 社員の一時停止/削除 | 不要な社員を無効化 |
| system_prompt自動生成 | 社員設定からCLI用プロンプトを自動生成 |

### 3.3 チャット

| 機能 | 説明 |
|------|------|
| テキストチャット | 社員への指示・相談 |
| 会話コンテキスト | VPSコンテナ内で保持（DBに保存しない） |
| ファイル添付 | 画像・PDFを送信（R2保存） |
| ストリーミング表示 | Claude応答をリアルタイム表示（SSE） |
| 会話リセット | コンテキストをクリアして新規会話 |

### 3.4 タスク管理

| 機能 | 説明 |
|------|------|
| タスク作成 | チャット経由 or 手動作成 |
| ステータス管理 | pending → in_progress → done |
| 優先度 | high / normal / low |
| 期限設定 | due_date |
| 社員間タスク連携 | 社員Aの完了 → 社員Bに自動パス |

### 3.5 SNS連携

| 機能 | 説明 |
|------|------|
| アカウント連携 | noVNCでコンテナ内Chromeにログイン → Cookie自動保存 |
| note.com投稿 | 記事生成 → プレビュー → 下書き/公開 |
| Threads投稿 | テキスト生成 → トピック設定 → 投稿 |
| LINE受信/返信 | Webhook常時受信 → AI返信 |
| 投稿スケジュール | 日時指定で予約投稿 |
| セッション切れ通知 | 再ログイン必要時に通知 |

### 3.6 ダッシュボード

| 機能 | 説明 |
|------|------|
| 社員稼働状況 | 各社員の現在のステータス |
| タスク概要 | 完了/進行中/未着手の件数 |
| SNS投稿実績 | 今日/今週の投稿数 |
| コスト表示 | API使用量・月額コスト |

---

## 4. SNS認証フロー（noVNC方式）

```
┌─ ブラウザ（ユーザー）────────────────────────┐
│                                              │
│  [SNS連携] → [note.comを連携] ボタン          │
│    │                                         │
│    ▼                                         │
│  noVNC ビューアが開く（iframe）               │
│    → コンテナ内Chromeのデスクトップが表示      │
│    → note.com ログインページが開いている       │
│    → ユーザーがID/PW入力 (2FAも対応)          │
│    → ログイン成功                             │
│    → Cookie がコンテナのChromeプロファイルに保存│
│    → 「連携完了」表示、noVNC閉じる             │
│                                              │
└──────────────────────────────────────────────┘

※ ユーザーから見ると「ブラウザの中にブラウザが表示されてログインするだけ」
※ インストール不要、特別な操作なし
```

### セッション管理

| イベント | 動作 |
|---------|------|
| 投稿前 | ログイン状態を自動チェック |
| セッション有効 | そのまま投稿実行 |
| セッション切れ | タスクをキューに保持 + ユーザーに通知 |
| 再ログイン | noVNCで再度ログイン → キュー自動消化 |

---

## 5. 技術スタック

### フロントエンド

| 技術 | 理由 |
|------|------|
| Next.js 15 (App Router) | SSR/SSG、API Routes、Vercelデプロイ |
| React 19 | UI |
| Tailwind CSS 4 | 柔らかいUI |
| Zustand | 状態管理（軽量） |
| noVNC (client) | SNS認証時のブラウザ表示 |

### バックエンド

| 技術 | 理由 |
|------|------|
| Next.js API Routes / Hono | APIエンドポイント |
| Supabase Auth | ユーザー認証 |
| Supabase PostgreSQL | DB（アカウント情報、社員設定、タスク） |
| Cloudflare R2 | 画像・動画・文章ストレージ |
| Stripe | サブスクリプション課金 |

### インフラ

| 技術 | 理由 |
|------|------|
| Vercel | フロントエンド + API ホスティング |
| Fly.io Machines | ユーザー別コンテナ（Chrome + CLI） |
| noVNC + Xvfb | コンテナ内Chromeのリモート表示 |
| Playwright or browser-use | ブラウザ自動化（未定） |
| レジデンシャルプロキシ | SNS投稿時の日本住宅IP |

### コンテナ内構成（per ユーザー）

```
Docker Container (Fly.io Machine)
├── Xvfb (仮想ディスプレイ)
├── Google Chrome
├── noVNC Server (認証時のみ起動)
├── Playwright or browser-use
├── Claude Code CLI
├── 会話コンテキスト (Volume永続化)
├── Chrome Profile (Volume永続化)
└── プロキシ設定 (レジデンシャルIP経由)
```

---

## 6. アーキテクチャ

```
┌─ ブラウザ（ユーザー）──────┐
│  Next.js SaaS UI            │
│  PC / スマホ / タブレット    │
└──────────┬──────────────────┘
           │ HTTPS
┌──────────▼──────────────────┐
│  Vercel                      │
│  ├── Next.js (SSR + API)     │
│  ├── Supabase Auth連携       │
│  ├── Stripe Webhook          │
│  └── Fly Machines API呼び出し │
└──────────┬──────────────────┘
           │
     ┌─────┴──────────────────┐
     ▼                        ▼
┌──────────┐          ┌──────────────────────┐
│ Supabase │          │ Fly.io Machines       │
│ ├ Auth   │          │                      │
│ ├ DB     │          │ ┌────────┐ ┌────────┐│
│ └ Realtime│         │ │User A  │ │User B  ││
└──────────┘          │ │Chrome  │ │Chrome  ││
                      │ │CLI     │ │CLI     ││
┌──────────────┐      │ │noVNC   │ │noVNC   ││
│ Cloudflare R2│      │ │Context │ │Context ││
│ 画像・動画    │      │ │Volume  │ │Volume  ││
└──────────────┘      │ └────────┘ └────────┘│
                      │ (タスク時のみ起動)     │
                      └──────────────────────┘
                               │
                      ┌────────▼─────────┐
                      │ レジデンシャル      │
                      │ プロキシ           │
                      │ (日本住宅IP)       │
                      └──────────────────┘
```

### データの流れ

```
チャット:
  ブラウザ → Vercel API → Fly Container (Claude Code CLI) → SSEで返答

SNS投稿:
  チャットで「投稿して」→ task_queueに追加
  → Container がキューを取得
  → Chrome + プロキシ経由で投稿
  → 結果をSupabaseに記録

SNS認証:
  ブラウザ → noVNC → Container内Chrome → ユーザーがログイン → Cookie保存

LINE:
  LINE → Webhook (Vercel) → Container (Claude Code CLI) → LINE API返信

ファイル:
  アップロード → Vercel API → Cloudflare R2 → URLをDBに保存
```

---

## 7. データベース設計（Supabase PostgreSQL）

### 方針

- **DBに保存する**: アカウント情報、社員設定、タスク、キュー、ログ
- **DBに保存しない**: 会話履歴・コンテキスト（VPSコンテナ内Volume）
- **R2に保存する**: 画像、動画、文章ファイル

### テーブル一覧

```
users              ユーザー（Supabase Auth連携）
companies          会社情報
employees          AI社員
tasks              タスク管理
task_queue         非同期タスクキュー
sns_accounts       SNS連携アカウント
activity_logs      アクティビティログ
```

### 7.1 users

```sql
CREATE TABLE users (
  id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name       TEXT,
  plan               TEXT DEFAULT 'free' CHECK (plan IN ('free','lite','pro','business')),
  stripe_customer_id TEXT,
  container_id       TEXT,          -- Fly Machine ID
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);
```

### 7.2 companies

```sql
CREATE TABLE companies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  industry    TEXT,
  mission     TEXT,
  goals       TEXT,
  settings    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

### 7.3 employees

```sql
CREATE TABLE employees (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL,
  department    TEXT,
  personality   JSONB DEFAULT '{}',
  tone          TEXT,
  skills        JSONB DEFAULT '[]',
  system_prompt TEXT,
  avatar_url    TEXT,              -- R2 URL
  status        TEXT DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

### 7.4 tasks

```sql
CREATE TABLE tasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  description       TEXT,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','cancelled')),
  priority          TEXT DEFAULT 'normal' CHECK (priority IN ('high','normal','low')),
  due_date          TIMESTAMPTZ,
  parent_task_id    UUID REFERENCES tasks(id) ON DELETE SET NULL,
  next_employee_id  UUID REFERENCES employees(id) ON DELETE SET NULL,
  result            TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  completed_at      TIMESTAMPTZ
);
```

### 7.5 task_queue

```sql
CREATE TABLE task_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id     UUID REFERENCES employees(id) ON DELETE SET NULL,
  type            TEXT NOT NULL CHECK (type IN ('text','browser')),
  action          TEXT NOT NULL,
  payload         JSONB NOT NULL,
  status          TEXT DEFAULT 'queued' CHECK (status IN ('queued','processing','done','failed')),
  retry_count     INTEGER DEFAULT 0,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  executed_at     TIMESTAMPTZ
);
```

### 7.6 sns_accounts

```sql
CREATE TABLE sns_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  platform          TEXT NOT NULL CHECK (platform IN ('note','threads','line','x','instagram')),
  account_name      TEXT,
  profile_name      TEXT,
  session_valid     BOOLEAN DEFAULT true,
  last_checked_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
-- Cookie はコンテナ内Chrome Profileに保存（DBには入れない）
```

### 7.7 activity_logs

```sql
CREATE TABLE activity_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id  UUID REFERENCES employees(id) ON DELETE SET NULL,
  type         TEXT NOT NULL CHECK (type IN ('chat','task','sns_post','error','system')),
  summary      TEXT NOT NULL,
  detail       JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

### ER図

```
users 1──1 companies (1ユーザー1会社)
companies 1──N employees
companies 1──N tasks
companies 1──N sns_accounts
companies 1──N activity_logs
companies 1──N task_queue

employees 1──N tasks
employees 1──N task_queue
employees 1──N activity_logs

tasks N──1 tasks (parent_task_id)
tasks N──1 employees (next_employee_id)
```

### インデックス

```sql
CREATE INDEX idx_companies_user ON companies(user_id);
CREATE INDEX idx_employees_company ON employees(company_id);
CREATE INDEX idx_tasks_employee_status ON tasks(employee_id, status);
CREATE INDEX idx_tasks_company ON tasks(company_id, status);
CREATE INDEX idx_task_queue_status ON task_queue(status, created_at);
CREATE INDEX idx_activity_logs_company ON activity_logs(company_id, created_at);
CREATE INDEX idx_sns_accounts_company ON sns_accounts(company_id, platform);
```

### Row Level Security

```sql
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE sns_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- 全テーブル共通パターン: company_id経由でuser_idを検証
CREATE POLICY "own_data" ON companies
  USING (user_id = auth.uid());

CREATE POLICY "own_data" ON employees
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- tasks, task_queue, sns_accounts, activity_logs も同様
```

### タスク連携トリガー

```sql
CREATE OR REPLACE FUNCTION handle_task_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'done' AND NEW.next_employee_id IS NOT NULL THEN
    INSERT INTO tasks (company_id, employee_id, title, description, status)
    VALUES (
      NEW.company_id,
      NEW.next_employee_id,
      '連携: ' || NEW.title,
      '前タスクの結果: ' || COALESCE(NEW.result, ''),
      'pending'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_task_done
  AFTER UPDATE ON tasks
  FOR EACH ROW
  WHEN (OLD.status != 'done' AND NEW.status = 'done')
  EXECUTE FUNCTION handle_task_completion();
```

---

## 8. API設計

### 認証

```
Authorization: Bearer <Supabase JWT>
```

### エンドポイント

#### 会社

```
POST   /api/companies              会社作成
GET    /api/companies/me           自分の会社取得
PATCH  /api/companies/me           会社更新
```

#### 社員

```
POST   /api/employees              社員作成
GET    /api/employees              社員一覧
GET    /api/employees/:id          社員詳細
PATCH  /api/employees/:id          社員更新
DELETE /api/employees/:id          社員アーカイブ
```

#### チャット（コンテナ経由）

```
POST   /api/chat/:employee_id      メッセージ送信 → SSEストリーミング返答
GET    /api/chat/:employee_id/history  会話履歴取得（コンテナから）
DELETE /api/chat/:employee_id      会話リセット
```

#### タスク

```
POST   /api/tasks                  タスク作成
GET    /api/tasks                  タスク一覧
PATCH  /api/tasks/:id              タスク更新
```

#### SNS

```
POST   /api/sns/accounts           アカウント登録
GET    /api/sns/accounts           アカウント一覧
GET    /api/sns/accounts/:id/health ヘルスチェック
DELETE /api/sns/accounts/:id       連携解除
POST   /api/sns/auth/:id/start    noVNCセッション開始 → WebSocket URL返却
```

#### ダッシュボード

```
GET    /api/dashboard              全体概要
GET    /api/activity               アクティビティログ
```

#### コンテナ管理（内部API）

```
POST   /api/internal/containers/:user_id/start   コンテナ起動
POST   /api/internal/containers/:user_id/stop    コンテナ停止
GET    /api/internal/containers/:user_id/status   状態確認
```

### チャットのフロー

```
POST /api/chat/:employee_id
  Body: { "content": "note記事書いて" }

Server:
  1. ユーザーのコンテナが停止中なら起動（~3秒）
  2. コンテナ内のClaude Code CLIに送信
     - 社員のsystem_prompt付き
     - コンテナ内の会話コンテキスト継続
  3. SSE (Server-Sent Events) でストリーミング返答
  4. ブラウザタスク発生 → task_queueに追加
  5. activity_logsに記録

Response: SSE stream
  data: {"type":"text","content":"記事を生成します..."}
  data: {"type":"text","content":"タイトル: ..."}
  data: {"type":"task_created","task_id":"xxx"}
  data: {"type":"done"}
```

---

## 9. UIデザイン方針

### コンセプト: 「どうぶつの森」的バーチャルオフィス

業務ツールではなく**自分の小さな会社を覗いている感覚**。
社員たちが働いている温かい空間をイメージ。
40代非技術者が直感的に操作できる、親しみやすさ最優先。

### デザイン原則

| 原則 | 具体的に |
|------|---------|
| やわらかい | 直線より曲線、角丸は大きめ(16-20px)、影はぼかし強め |
| あたたかい | 自然素材風テクスチャ、木目・リネン・クラフト紙の質感 |
| 生きている | 社員が待機中にまばたき・小さな動き、吹き出しがふわっと出る |
| シンプル | 1画面に要素を詰め込まない、余白を贅沢に使う |
| 専門用語ゼロ | 「デプロイ」→「公開」、「タスク」→「おしごと」、「ダッシュボード」→「今日のようす」 |

### ビジュアルスタイル

```
背景:
  やわらかいグラデーション + 微かなテクスチャ（リネン風）
  時間帯で色が変わる（朝: 暖色、昼: 明るい、夜: 落ち着いた青）

社員カード:
  まるっこいカード、ふわっとした影
  アバターはキャラクター風（2D イラスト or AI生成）
  状態によって表情・ポーズが変わる
    稼働中 → 作業してるポーズ
    待機中 → にっこり
    休止中 → おやすみ

チャット:
  ふきだし型（LINEのような見た目）
  社員のアバターがふきだしの横に小さく表示
  入力中は「...」がぽよぽよアニメーション

ボタン:
  大きめ、角丸、押したときに心地よい沈み込みアニメーション
  アイコン + テキストのセット（アイコンだけにしない）

通知:
  画面上部からスライドイン、やさしいチャイム音（オプション）
  「さくらが記事を書き上げました！」のような人間的な文面
```

### カラーパレット

```
┌─ メインカラー ─────────────────────────────┐
│  Leaf Green:   #7BC47F  (葉っぱの緑)       │
│  Sky Blue:     #87CEEB  (空色)             │
│  Sand:         #F5E6CA  (砂浜・木の温かみ)  │
│  Sakura:       #FFB7C5  (桜色)             │
│  Earth Brown:  #8B7355  (土・木目)          │
└────────────────────────────────────────────┘

┌─ ベースカラー ─────────────────────────────┐
│  Background:   #FFF8F0  (あたたかいクリーム) │
│  Surface:      #FFFFFF                     │
│  Text:         #4A3728  (こげ茶)            │
│  SubText:      #A89585  (薄茶)             │
│  Border:       #E8DDD0  (ベージュ)          │
└────────────────────────────────────────────┘

┌─ ステータスカラー ─────────────────────────┐
│  Active:       #7BC47F  (緑)               │
│  Working:      #FFD93D  (黄)               │
│  Sleeping:     #B0C4DE  (薄い青灰)          │
│  Alert:        #FF8A80  (やさしい赤)        │
└────────────────────────────────────────────┘
```

### フォント

```
見出し:  "Zen Maru Gothic" (丸ゴシック、Google Fonts)
本文:    "Zen Maru Gothic" Regular
数字:    "Nunito" (丸みのある欧文)
```

### 社員カード

```
╭─────────────────────────────╮
│ ◜                         ◝ │
│       ┌─────────┐           │
│       │ (◕‿◕)  │  ← アバター（丸枠、影つき）
│       └─────────┘           │
│                             │
│     🌿 さくら               │
│     ひしょ ・ 🟢 おしごと中  │
│                             │
│ ╭─────────────────────────╮ │
│ │ 「今日もがんばりますね！」 │ │  ← ふきだし
│ ╰─────────────────────────╯ │
│                             │
│  ╭──────────╮ ╭──────────╮  │
│  │ 話しかける │ │ おしごと3 │  │  ← 丸ボタン
│  ╰──────────╯ ╰──────────╯  │
│ ◟                         ◞ │
╰─────────────────────────────╯
  ↑ 全体がふわっとした影つき
```

### ホーム画面（オフィス）

```
╭──────────────────────────────────────────────╮
│  🏠 わたしのオフィス           [+ なかまを増やす] │
│                                                │
│  「おはようございます！今日もいい天気ですね」      │
│   ↑ 秘書からの一言（時間帯で変わる）              │
│                                                │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │ さくら   │  │ たくみ   │  │ ことは   │       │
│  │  秘書    │  │ ライター │  │ リサーチ │       │
│  │ おしごと中│  │  待機中  │  │  待機中  │       │
│  └─────────┘  └─────────┘  └─────────┘       │
│                                                │
│  ── 今日のようす ──                              │
│  🌱 おしごと完了: 3件                            │
│  📝 投稿: note 1件、Threads 2件                 │
│  💬 LINE: 5件のやりとり                          │
│                                                │
╰──────────────────────────────────────────────╯
```

### アニメーション仕様

| トリガー | アニメーション | 時間 |
|---------|-------------|------|
| 画面遷移 | ふわっとフェードイン | 300ms ease-out |
| カードホバー | わずかに浮き上がる（translateY -4px） | 200ms |
| ボタンクリック | 沈み込み → 戻る（scale 0.95 → 1） | 150ms |
| 新しいメッセージ | ふきだしがぽよっと出現（scale 0 → 1） | 250ms spring |
| 通知 | 上からスライドイン | 400ms ease-out |
| 社員の待機アニメ | ゆっくり上下に揺れる | 3s infinite ease-in-out |
| ローディング | 葉っぱがくるくる回る | 1s infinite |

### レスポンシブ

| デバイス | レイアウト |
|---------|----------|
| PC (1024px+) | サイドバー + メインエリア |
| タブレット (768-1023px) | サイドバー折りたたみ + メイン |
| スマホ (〜767px) | ボトムナビ + メインのみ |

---

## 10. 料金モデル

### プラン

| プラン | 月額 | 内容 |
|--------|------|------|
| Free | ¥0 | 社員2人、月30メッセージ、SNS連携なし |
| Lite | ¥980 | 社員5人、月300メッセージ、SNS連携1つ |
| Pro | ¥2,980 | 社員無制限、メッセージ無制限、SNS無制限、24/7 |
| Business | ¥9,800 | 優先実行、API上限拡大、専用サポート |

### コスト構造（1ユーザーあたり月額）

| 項目 | Free | Lite | Pro | Business |
|------|------|------|-----|----------|
| コンテナ | ¥0 | ¥30 | ¥60 | ¥120 |
| Anthropic API | ¥0 | ¥200 | ¥500 | ¥1,500 |
| プロキシ | ¥0 | ¥300 | ¥500 | ¥500 |
| R2 | ¥0 | ¥10 | ¥30 | ¥100 |
| **変動コスト計** | **¥0** | **¥540** | **¥1,090** | **¥2,220** |
| **粗利率** | — | **45%** | **63%** | **77%** |

### 損益分岐点

```
固定コスト:
  Vercel Pro        ¥3,000
  Supabase Pro      ¥3,000
  Fly.io (最小)     ¥2,000
  ドメイン等         ¥500
  合計              ¥8,500/月

Pro (¥2,980) のみ: 5人で黒字
Lite + Pro 混合:    8-12人で黒字
```

---

## 11. フェーズ計画

### Phase 1: MVP（Web + コンテナ）

**目標:** 動くSaaSを自分で使える状態にする

| 項目 | 内容 |
|------|------|
| 期間 | 3-4週間 |
| 構成 | Next.js (Vercel) + Supabase + Fly.io 1台 + R2 |
| 機能 | 会社作成、社員作成、チャット、タスク管理 |

**マイルストーン:**
1. Next.jsプロジェクト + Supabase + R2セットアップ
2. DBマイグレーション（全テーブル作成 + RLS）
3. Supabase Auth（メール/パスワード）
4. オンボーディング画面（会社作成）
5. ホーム画面（社員カード一覧）
6. 社員作成画面（アバターアップロード → R2）
7. Fly.ioコンテナ構築（Chrome + CLI + Xvfb）
8. チャット画面（SSEストリーミング）
9. タスク管理画面

### Phase 2: SNS連携

**目標:** SNS自動投稿が動く

| 項目 | 内容 |
|------|------|
| 期間 | 2-3週間 |
| 追加 | noVNC認証、レジデンシャルプロキシ、タスクキュー |

**マイルストーン:**
1. noVNC + Xvfb環境構築（コンテナ内）
2. SNS認証フロー（noVNC → ログイン → Cookie保存）
3. レジデンシャルプロキシ設定
4. タスクキュー実装（browser投稿の非同期実行）
5. LINE Webhook常駐化
6. セッション切れ検知 + 通知

### Phase 3: マルチテナント（SaaS公開）

**目標:** 課金ユーザーに提供

| 項目 | 内容 |
|------|------|
| 期間 | 3-4週間 |
| 追加 | コンテナ per ユーザー、Stripe課金 |

**マイルストーン:**
1. Fly Machines APIでコンテナ動的起動/停止
2. Stripe連携（サブスクリプション + Webhook）
3. プラン制限の実装（社員数、メッセージ数）
4. ランディングページ
5. ベータテスト

### Phase 4: 拡張

| 項目 | 内容 |
|------|------|
| 社員間連携 | パイプライン自動実行 |
| SNS拡張 | X、Instagram、Facebook |
| モバイル最適化 | レスポンシブ or PWA |
| 社員テンプレート | 業種別プリセット |
| マーケットプレイス | テンプレート共有/販売 |
| AI画像アバター | プロフィール写真の自動生成 |

---

## 12. セキュリティ

| 対象 | 対策 |
|------|------|
| ユーザー認証 | Supabase Auth (JWT) |
| データ分離 | Supabase RLS（Row Level Security） |
| SNS Cookie | コンテナ内Volumeに保存（DB外） |
| noVNC接続 | ワンタイムトークン + WSS暗号化 |
| ファイル | R2バケットポリシーでユーザー分離 |
| コンテナ分離 | Fly.io VMレベル分離 |
| API通信 | HTTPS (TLS 1.3) |

---

## 13. ディレクトリ構成

```
products/ai-company/
├── SPEC.md                      # この仕様書
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── app/
│   ├── layout.tsx               # ルートレイアウト
│   ├── page.tsx                 # ランディングページ
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx           # サイドバー付きレイアウト
│   │   ├── onboarding/page.tsx  # オンボーディング
│   │   ├── home/page.tsx        # ホーム（オフィス）
│   │   ├── employee/
│   │   │   ├── create/page.tsx  # 社員作成
│   │   │   └── [id]/
│   │   │       ├── page.tsx     # 社員詳細
│   │   │       ├── chat/page.tsx
│   │   │       └── tasks/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── sns/page.tsx
│   │   ├── activity/page.tsx
│   │   └── settings/page.tsx
│   └── api/
│       ├── companies/route.ts
│       ├── employees/route.ts
│       ├── chat/[employeeId]/route.ts   # SSE
│       ├── tasks/route.ts
│       ├── sns/route.ts
│       ├── dashboard/route.ts
│       └── internal/
│           └── containers/route.ts
├── components/
│   ├── ui/                      # shadcn/ui
│   ├── employee-card.tsx
│   ├── chat-view.tsx
│   ├── task-list.tsx
│   ├── sidebar.tsx
│   └── novnc-viewer.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts            # ブラウザ用
│   │   └── server.ts            # サーバー用
│   ├── r2.ts                    # Cloudflare R2 client
│   ├── fly.ts                   # Fly Machines API
│   └── stripe.ts                # Stripe
├── stores/
│   ├── company.ts
│   ├── employees.ts
│   └── chat.ts
├── supabase/
│   └── migrations/
│       └── 001_initial.sql
├── container/
│   ├── Dockerfile               # ユーザーコンテナイメージ
│   ├── entrypoint.sh
│   └── novnc-setup.sh
└── public/
    └── default-avatars/
```
