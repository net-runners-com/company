# AI Company - ER Diagram

```mermaid
erDiagram
    companies ||--o{ employees : "has"
    companies ||--o{ tasks : "has"
    companies ||--o{ sns_accounts : "has"
    companies ||--o{ activity_logs : "has"
    companies ||--o{ chat_messages : "has"
    companies ||--o{ documents : "has"
    companies ||--o{ projects : "has"
    companies ||--o{ schedule_events : "has"
    employees ||--o{ tasks : "assigned"
    employees ||--o{ activity_logs : "generates"
    employees ||--o{ chat_messages : "participates"

    companies {
        uuid id PK
        text user_id
        text name
        text industry
        text mission
        text goals
        timestamptz created_at
    }

    employees {
        uuid id PK
        uuid company_id FK
        text name
        text role
        text department
        jsonb personality
        text tone
        text[] skills
        text system_prompt
        text avatar_url
        text status "active | paused | archived"
        int sort_order
        text greeting
        timestamptz created_at
    }

    tasks {
        uuid id PK
        uuid company_id FK
        uuid employee_id FK
        text title
        text description
        text status "pending | in_progress | done | cancelled"
        text priority "high | normal | low"
        timestamptz due_date
        uuid parent_task_id FK "self-ref"
        uuid next_employee_id FK "handoff"
        text result
        timestamptz created_at
        timestamptz completed_at
    }

    sns_accounts {
        uuid id PK
        uuid company_id FK
        text platform "note | threads | line | x | instagram"
        text account_name
        text profile_name
        boolean session_valid
        timestamptz last_checked_at
        timestamptz created_at
    }

    activity_logs {
        uuid id PK
        uuid company_id FK
        uuid employee_id FK "nullable"
        text type "chat | task | sns_post | error | system"
        text summary
        jsonb detail
        timestamptz created_at
    }

    chat_messages {
        uuid id PK
        uuid company_id FK
        uuid employee_id FK
        text role "user | assistant"
        text content
        timestamptz created_at
    }

    documents {
        uuid id PK
        uuid company_id FK
        text type "estimate | invoice"
        text number
        text client_name
        text subject
        jsonb items "DocumentItem[]"
        int subtotal
        int tax
        int total
        text status "draft | sent | paid | overdue | cancelled"
        date issue_date
        date due_date
        timestamptz paid_at
        timestamptz created_at
    }

    projects {
        uuid id PK
        uuid company_id FK
        text name
        text description
        text client_name
        text status "active | completed | on_hold | cancelled"
        int budget
        int spent
        date start_date
        date end_date
        uuid[] members "employee IDs"
        timestamptz created_at
    }

    schedule_events {
        uuid id PK
        uuid company_id FK
        text title
        text description
        date date
        text start_time
        text end_time
        text type "meeting | deadline | review | other"
        uuid[] employee_ids
        timestamptz created_at
    }
```

## Relationships

| Parent | Child | Type | ON DELETE |
|--------|-------|------|----------|
| companies | employees | 1:N | CASCADE |
| companies | tasks | 1:N | CASCADE |
| companies | sns_accounts | 1:N | CASCADE |
| companies | activity_logs | 1:N | CASCADE |
| companies | chat_messages | 1:N | CASCADE |
| companies | documents | 1:N | CASCADE |
| companies | projects | 1:N | CASCADE |
| companies | schedule_events | 1:N | CASCADE |
| employees | tasks | 1:N | SET NULL |
| employees | activity_logs | 1:N | SET NULL |
| employees | chat_messages | 1:N | CASCADE |
| tasks | tasks (parent) | self-ref | - |
| employees | tasks (next) | handoff | - |

## Notes

- `companies` が全テーブルの親。マルチテナントの基点。
- `tasks.parent_task_id` で親子タスク、`next_employee_id` で社員間のタスクハンドオフ。
- `projects.members` と `schedule_events.employee_ids` は UUID 配列（正規化よりシンプルさ優先）。
- `documents.items` は JSONB 配列（`{name, quantity, unitPrice, amount}[]`）。
