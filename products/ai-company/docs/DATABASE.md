# データベース構造

## 概要

| DB | 用途 | 場所 | 対象 |
|---|---|---|---|
| **PostgreSQL** | ユーザー認証・アカウント管理 | Docker (`pgdata` volume) | 全ユーザー共通 |
| **SQLite** | アプリデータ・チャット・ページ定義 | Docker (`worker-data` volume) `/workspace/data/store.db` | ユーザーごと（本番時Worker分離） |
| **Cloudflare R2** | ファイルストレージ | クラウド | ユーザーごと（prefix分離） |

---

## PostgreSQL（全ユーザー共通）

接続: `postgresql://postgres:postgres@db:5432/aicompany`

### users
| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | ユーザーID |
| email | TEXT UNIQUE | メールアドレス |
| password_hash | TEXT | bcryptハッシュ（Google OAuth: `__google_oauth__`） |
| name | TEXT | 表示名 |
| created_at | TIMESTAMPTZ | 作成日時 |

### google_tokens
| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | トークンID |
| user_id | UUID FK→users | ユーザー |
| scope | TEXT | OAuthスコープ（`https://www.googleapis.com/auth/calendar` 等） |
| access_token | TEXT | アクセストークン |
| refresh_token | TEXT | リフレッシュトークン |
| expires_at | TIMESTAMPTZ | 有効期限 |
| created_at | TIMESTAMPTZ | 作成日時 |
| updated_at | TIMESTAMPTZ | 更新日時 |
| **UNIQUE** | (user_id, scope) | |

### companies
| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | 会社ID |
| user_id | TEXT | オーナーユーザーID |
| name | TEXT | 会社名 |
| industry | TEXT | 業種 |
| mission | TEXT | ミッション |
| goals | TEXT | 目標 |
| created_at | TIMESTAMPTZ | 作成日時 |

### employees
| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | 社員ID |
| company_id | UUID FK→companies | 所属会社 |
| name | TEXT | 名前 |
| role | TEXT | 役職 |
| department | TEXT | 部署ID |
| personality | JSONB | 性格パラメータ |
| tone | TEXT | 口調 |
| skills | TEXT[] | スキル配列 |
| system_prompt | TEXT | カスタムプロンプト |
| avatar_url | TEXT | アバターURL |
| status | TEXT | `active` / `paused` / `archived` |
| sort_order | INT | 表示順 |
| greeting | TEXT | 挨拶文 |
| created_at | TIMESTAMPTZ | 作成日時 |

### tasks
| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | タスクID |
| company_id | UUID FK→companies | 会社 |
| employee_id | UUID FK→employees | 担当社員 |
| title | TEXT | タイトル |
| description | TEXT | 詳細 |
| status | TEXT | `pending` / `in_progress` / `done` / `cancelled` |
| priority | TEXT | `high` / `normal` / `low` |
| due_date | TIMESTAMPTZ | 期限 |
| parent_task_id | UUID FK→tasks | 親タスク |
| next_employee_id | UUID FK→employees | 次の担当 |
| result | TEXT | 結果 |
| created_at | TIMESTAMPTZ | 作成日時 |
| completed_at | TIMESTAMPTZ | 完了日時 |

### chat_messages（PostgreSQL版 — 未使用、SQLiteに移行済み）
| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | メッセージID |
| company_id | UUID FK | 会社 |
| employee_id | UUID FK | 社員 |
| role | TEXT | `user` / `assistant` |
| content | TEXT | 内容 |
| created_at | TIMESTAMPTZ | 日時 |

### その他テーブル（定義済み、mock→実データ移行待ち）
- `documents` — 見積書・請求書
- `projects` — プロジェクト
- `sns_accounts` — SNSアカウント
- `activity_logs` — アクティビティログ
- `schedule_events` — スケジュール

---

## SQLite（Worker内、ユーザーごと）

パス: `/workspace/data/store.db`

### data_store（汎用データストア）
| カラム | 型 | 説明 |
|---|---|---|
| id | TEXT PK | ドキュメントID |
| collection | TEXT NOT NULL | コレクション名 |
| data | JSON NOT NULL | データ本体 |
| created_at | TEXT | 作成日時（JST） |
| updated_at | TEXT | 更新日時（JST） |

**インデックス:**
- `idx_collection` — (collection)
- `idx_created` — (collection, created_at)

**使用中のコレクション:**

| collection | 用途 | 保存元 |
|---|---|---|
| `dashboards` | カスタムページ定義 | `POST /pages/generate` |
| `calendar_events` | ローカルカレンダー予定 | UI / エージェント |
| `news` | ニュース記事 | `POST /news/update` |
| `emails` | メール下書き・送信済み | エージェント / UI |
| `schedules` | 定期実行スケジュール | エージェント |
| `tasks_{emp_id}` | 社員別タスク | 進捗管理（指示）実行時 |
| `projects` | プロジェクトパイプライン | `POST /projects` |
| `nango_connections` | Nango接続記録 | Webhook |
| `sns_metrics` | SNSメトリクス | エージェント |
| `{任意}` | エージェントが自由に作成 | `POST /data/{collection}` |

### chat_threads（チャットスレッド）
| カラム | 型 | 説明 |
|---|---|---|
| id | TEXT PK | スレッドID (uuid8) |
| emp_id | TEXT NOT NULL | 社員ID |
| title | TEXT | タイトル（最初のメッセージから自動設定） |
| created_at | TEXT | 作成日時 |

**インデックス:**
- `idx_threads_emp` — (emp_id)

### chat_messages（チャットメッセージ）
| カラム | 型 | 説明 |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | メッセージID |
| thread_id | TEXT NOT NULL | スレッドID |
| emp_id | TEXT NOT NULL | 社員ID |
| role | TEXT NOT NULL | `user` / `assistant` |
| content | TEXT NOT NULL | メッセージ内容 |
| created_at | TEXT | 日時 |

**インデックス:**
- `idx_msgs_thread` — (thread_id)
- `idx_msgs_emp` — (emp_id)

---

## JSONファイル（Worker内）

### /workspace/data/employees.json
社員マスタ。Worker API で CRUD。

```json
{
  "emp-1": {
    "id": "emp-1",
    "name": "さくら",
    "role": "ひしょ",
    "department": "general-affairs",
    "tone": "やさしい敬語",
    "skills": ["スケジュール管理", "メモ整理"],
    "systemPrompt": "",
    "sessionId": null,
    "updatedAt": "2026-03-31T10:00:00"
  }
}
```

### /workspace/data/connectors.json
コネクタ設定（LINE/Slack/Discord）。

---

## Cloudflare R2（オブジェクトストレージ）

バケット: `ai-company-dev`
エンドポイント: `https://{account_id}.r2.cloudflarestorage.com`

### パス構造
```
employees/{emp_id}/           ← 社員フォルダ
  自己紹介.md                  ← プロフィール
  CLAUDE.md                    ← 個人ルール（育成用）
  uploads/                     ← アップロードファイル
  {成果物}.md                  ← エージェント作成ファイル

shared/{share_id}.html         ← 共有ページスナップショット
```

### API
- `GET /employee/{id}/files` — 一覧
- `GET /employee/{id}/files/read` — テキスト読み取り
- `POST /employee/{id}/files/write` — テキスト書き込み
- `POST /employee/{id}/files/upload` — ファイルアップロード
- `GET /employee/{id}/files/serve` — バイナリ配信
- `GET /employee/{id}/files/presign` — 署名付きURL発行（1時間有効）
- `POST /share` — 共有URL発行（ファイル: 24時間、ページ: 7日間）
