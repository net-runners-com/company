# AI Company - シーケンス図

## 1. ページ表示（一般的なデータ取得）

```mermaid
sequenceDiagram
    actor User as ユーザー
    participant Browser as ブラウザ
    participant Next as frontend<br/>(Next.js)
    participant API as API Routes
    participant DB as PostgreSQL

    User->>Browser: ページアクセス
    Browser->>Next: GET /home
    Next->>Browser: HTML + JS 返却
    Browser->>API: fetch /api/employees
    API->>DB: SELECT * FROM employees WHERE company_id = ?
    DB-->>API: rows
    API-->>Browser: JSON
    Browser->>Browser: Zustand store 更新
    Browser->>User: UI レンダリング
```

## 2. チャット（AI社員との会話）

```mermaid
sequenceDiagram
    actor User as ユーザー
    participant Browser as ブラウザ
    participant API as API Routes
    participant Worker as worker<br/>(FastAPI)
    participant Claude as Claude Code CLI
    participant DB as PostgreSQL

    User->>Browser: メッセージ入力「記事書いて」
    Browser->>API: POST /api/chat/send
    API->>DB: INSERT INTO chat_messages (role='user')
    API->>Worker: POST /tasks/execute {type: "chat", employee_id, content}
    API-->>Browser: {status: "accepted"}
    Browser->>Browser: ローディング表示

    Worker->>DB: SELECT FROM employees WHERE id = ? (性格・口調取得)
    Worker->>Claude: claude --prompt "社員のペルソナで応答"
    Claude-->>Worker: AI応答テキスト
    Worker->>DB: INSERT INTO chat_messages (role='assistant')
    Worker->>DB: INSERT INTO activity_logs (type='chat')

    Browser->>API: GET /api/chat/messages?employee_id=
    API->>DB: SELECT FROM chat_messages
    DB-->>API: messages
    API-->>Browser: JSON
    Browser->>User: 応答バブル表示
```

## 3. SNS自動投稿（note.com記事投稿）

```mermaid
sequenceDiagram
    actor User as ユーザー
    participant Browser as ブラウザ
    participant API as API Routes
    participant Worker as worker<br/>(FastAPI)
    participant Claude as Claude Code CLI
    participant BU as browser-use
    participant Note as note.com
    participant R2 as Cloudflare R2
    participant DB as PostgreSQL

    User->>Browser: 「note記事を書いて投稿して」
    Browser->>API: POST /api/tasks/create
    API->>DB: INSERT INTO tasks (status='pending')
    API->>Worker: POST /tasks/execute {type: "sns_post", platform: "note"}
    API-->>Browser: {task_id, status: "accepted"}

    Note over Worker: Phase 1: 記事生成
    Worker->>DB: SELECT FROM companies (ミッション・目標)
    Worker->>Claude: claude --prompt "記事を生成"
    Claude-->>Worker: 記事テキスト + タイトル
    Worker->>DB: UPDATE tasks SET status='in_progress'

    Note over Worker: Phase 2: サムネイル生成（オプション）
    Worker->>R2: PUT /images/thumbnail.png
    R2-->>Worker: URL

    Note over Worker: Phase 3: ブラウザ自動投稿
    Worker->>BU: note.comにログイン（Chrome Profile）
    BU->>Note: ページ操作（タイトル・本文入力）
    Note-->>BU: 投稿完了
    BU-->>Worker: 投稿URL

    Worker->>DB: UPDATE tasks SET status='done', result=投稿URL
    Worker->>DB: INSERT INTO activity_logs (type='sns_post')

    Browser->>API: GET /api/tasks/:id (ポーリング)
    API->>DB: SELECT FROM tasks
    API-->>Browser: {status: "done", result: URL}
    Browser->>User: 完了通知 + 投稿リンク
```

## 4. タスク実行（社員間ハンドオフ）

```mermaid
sequenceDiagram
    actor User as ユーザー
    participant API as API Routes
    participant Worker as worker
    participant Claude as Claude Code CLI
    participant DB as PostgreSQL

    User->>API: POST /api/tasks/create {employee: ことは, next_employee: たくみ}
    API->>DB: INSERT INTO tasks (employee_id=emp-3, next_employee_id=emp-2)
    API->>Worker: POST /tasks/execute {task_id}

    Note over Worker: Step 1: ことは（リサーチャー）が調査
    Worker->>DB: SELECT employee WHERE id=emp-3
    Worker->>Claude: claude --prompt "競合調査して"
    Claude-->>Worker: 調査結果
    Worker->>DB: UPDATE tasks SET status='done', result=調査結果
    Worker->>DB: INSERT INTO activity_logs

    Note over Worker: Step 2: 自動ハンドオフ → たくみ（ライター）
    Worker->>DB: INSERT INTO tasks (employee_id=emp-2, parent_task_id=task-3)
    Worker->>DB: SELECT employee WHERE id=emp-2
    Worker->>Claude: claude --prompt "調査結果を元に記事を書いて"
    Claude-->>Worker: 記事テキスト
    Worker->>DB: UPDATE tasks SET status='done'
    Worker->>DB: INSERT INTO activity_logs
```

## 5. 見積書・請求書作成

```mermaid
sequenceDiagram
    actor User as ユーザー
    participant Browser as ブラウザ
    participant API as API Routes
    participant Worker as worker
    participant R2 as Cloudflare R2
    participant DB as PostgreSQL

    User->>Browser: 見積書作成フォーム入力
    Browser->>API: POST /api/documents/create
    API->>DB: INSERT INTO documents (type='estimate', status='draft')
    API-->>Browser: {document_id}

    User->>Browser: 「PDFで送信」
    Browser->>API: POST /api/documents/:id/send
    API->>Worker: POST /documents/generate-pdf {document_id}
    Worker->>DB: SELECT FROM documents WHERE id = ?
    Worker->>Worker: PDF生成
    Worker->>R2: PUT /documents/EST-2026-001.pdf
    R2-->>Worker: PDF URL
    Worker->>DB: UPDATE documents SET status='sent'
    Worker-->>API: {pdf_url}
    API-->>Browser: {status: "sent", pdf_url}
    Browser->>User: PDF ダウンロードリンク表示
```

## 6. オンボーディング（初回セットアップ）

```mermaid
sequenceDiagram
    actor User as ユーザー
    participant Browser as ブラウザ
    participant API as API Routes
    participant Worker as worker
    participant DB as PostgreSQL

    User->>Browser: 「はじめる」クリック
    Browser->>Browser: /onboarding に遷移

    Note over Browser: Step 1: 会社情報入力
    User->>Browser: 会社名・業種を入力
    User->>Browser: 「次へ」

    Note over Browser: Step 2: ミッション入力
    User->>Browser: ミッション・目標を入力
    User->>Browser: 「次へ」

    Note over Browser: Step 3: 完了
    User->>Browser: 「ダッシュボードへ」
    Browser->>API: POST /api/companies/create
    API->>DB: INSERT INTO companies
    API->>DB: INSERT INTO employees (さくら / 秘書 / デフォルト社員)
    API-->>Browser: {company_id}
    Browser->>Browser: Zustand store 更新
    Browser->>Browser: /home に遷移
    Browser->>User: ダッシュボード表示
```

## 7. スケジュール表示（カレンダービュー）

```mermaid
sequenceDiagram
    actor User as ユーザー
    participant Browser as ブラウザ
    participant API as API Routes
    participant DB as PostgreSQL

    User->>Browser: /schedule アクセス
    Browser->>API: GET /api/schedule?month=2026-03
    API->>DB: SELECT FROM schedule_events WHERE date BETWEEN ? AND ?
    DB-->>API: events
    API-->>Browser: JSON

    Browser->>Browser: 月カレンダーグリッド描画
    Browser->>Browser: イベントを日付セルに配置
    Browser->>User: カレンダー表示

    User->>Browser: 3/27 セルをクリック
    Browser->>Browser: 右パネルに 3/27 のイベント詳細表示
    Browser->>User: イベント一覧（時間・タイトル・メンバー）

    User->>Browser: 「←」月ナビクリック
    Browser->>API: GET /api/schedule?month=2026-02
    API->>DB: SELECT FROM schedule_events ...
    API-->>Browser: JSON
    Browser->>User: 2月カレンダー表示
```

## 8. プロジェクト管理

```mermaid
sequenceDiagram
    actor User as ユーザー
    participant Browser as ブラウザ
    participant API as API Routes
    participant DB as PostgreSQL

    User->>Browser: 「新規プロジェクト」クリック
    Browser->>Browser: 作成モーダル表示

    User->>Browser: プロジェクト情報入力
    Browser->>API: POST /api/projects/create
    API->>DB: INSERT INTO projects
    API-->>Browser: {project_id}

    Note over Browser: 予算消化の更新
    User->>Browser: タスク完了報告
    Browser->>API: POST /api/projects/:id/expense
    API->>DB: UPDATE projects SET spent = spent + ?
    API-->>Browser: updated project

    Browser->>Browser: プログレスバー更新
    Browser->>User: 予算消化率表示（色分け: 緑→黄→赤）
```

## 通信まとめ

```mermaid
flowchart LR
    B[ブラウザ] -->|fetch| API[Next.js API Routes]
    API -->|SQL| DB[(PostgreSQL)]
    API -->|HTTP POST| W[Worker FastAPI]
    W -->|SQL| DB
    W -->|CLI| C[Claude Code]
    W -->|browser-use| SNS[SNS各種]
    W -->|S3 API| R2[Cloudflare R2]
```
