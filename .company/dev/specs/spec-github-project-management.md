# features/git — GitHub プロジェクト管理機能 設計書

作成日: 2026-03-26
ステータス: 設計中

---

## 1. 概要・目的

company リポジトリに Issue 駆動開発の基盤を整備する。
すべての作業は Issue から始まり、ブランチ→PR→マージ→Close のサイクルで管理する。

### 解決する課題
- タスクが散在して追跡できない
- なぜこのコードを変更したのか半年後に追えない
- プロジェクトの全体像が見えない

---

## 2. 全体アーキテクチャ

```mermaid
graph TB
    subgraph "GitHub Issue駆動開発フロー"
        A[💡 タスク発生] --> B[📝 Issue作成]
        B --> C[🏷️ ラベル・マイルストーン設定]
        C --> D[📋 Projects ボードに自動追加]
        D --> E[🌿 ブランチ作成<br/>feature/#123-xxx]
        E --> F[💻 開発・コミット]
        F --> G[🔀 PR作成<br/>Closes #123]
        G --> H{レビュー・CI}
        H -->|OK| I[✅ マージ]
        H -->|NG| F
        I --> J[🔒 Issue自動Close]
        J --> K[📋 Projects 完了に移動]
    end

    style A fill:#4A90D9,color:#fff
    style I fill:#27AE60,color:#fff
    style J fill:#27AE60,color:#fff
```

---

## 3. ブランチ戦略: GitHub Flow

```mermaid
gitGraph
    commit id: "initial"
    branch "feature/#1-add-auth"
    commit id: "feat: add login form"
    commit id: "feat: add auth API"
    checkout main
    merge "feature/#1-add-auth" id: "Merge PR #2" tag: "v0.1.0"
    branch "fix/#3-fix-validation"
    commit id: "fix: email validation"
    checkout main
    merge "fix/#3-fix-validation" id: "Merge PR #4"
    branch "feature/#5-add-dashboard"
    commit id: "feat: dashboard layout"
    commit id: "feat: chart component"
    checkout main
    merge "feature/#5-add-dashboard" id: "Merge PR #6" tag: "v0.2.0"
```

### ルール
- 永続ブランチは `main` のみ（常にデプロイ可能）
- `main` への直接 push 禁止
- マージは **Squash and Merge**（履歴をきれいに保つ）
- リリースは **タグ** で管理（`v1.0.0` 形式）

### ブランチ命名規則
```
feature/#<Issue番号>-<簡潔な説明>   例: feature/#42-add-user-auth
fix/#<Issue番号>-<簡潔な説明>       例: fix/#55-fix-null-check
hotfix/#<Issue番号>-<簡潔な説明>    例: hotfix/#60-critical-security
docs/#<Issue番号>-<簡潔な説明>      例: docs/#70-update-api-docs
```

---

## 4. GitHub Projects ボード設計

```mermaid
graph LR
    subgraph "カンバンボード"
        A["📥 起票<br/>(Triage)"] --> B["📋 未着手<br/>(ToDo)"]
        B --> C["🔨 対応中<br/>(In Progress)"]
        C --> D["👀 レビュー待ち<br/>(Review)"]
        D --> E["✅ 完了<br/>(Done)"]
    end

    style A fill:#E0E0E0,color:#333
    style B fill:#4A90D9,color:#fff
    style C fill:#F39C12,color:#fff
    style D fill:#9B59B6,color:#fff
    style E fill:#27AE60,color:#fff
```

### ステータス定義

| ステータス | 意味 | 自動化 |
|-----------|------|--------|
| 起票 | Issue作成直後 | Issue作成時に自動設定 |
| 未着手 | 優先度決定済み、着手待ち | 手動 |
| 対応中 | 作業中 | ブランチ作成で自動移動(将来) |
| レビュー待ち | PR作成済み、確認待ち | PR作成で自動移動(将来) |
| 完了 | マージ・クローズ済み | Issue Close時に自動移動 |

### カスタムフィールド

| フィールド | 値 | 用途 |
|-----------|-----|------|
| 優先度 | 🔴 High / 🟡 Medium / 🟢 Low | 着手順の判断 |
| サイズ | S(〜1h) / M(〜半日) / L(1日〜) | 見積もり |

---

## 5. ラベル設計

```mermaid
graph TD
    subgraph "タイプ"
        T1["type:bug 🔴"]
        T2["type:feature 🔵"]
        T3["type:enhancement 💧"]
        T4["type:refactor 🟢"]
        T5["type:docs 🩷"]
        T6["type:chore 🟣"]
    end
    subgraph "優先度"
        P1["priority:high 🔴"]
        P2["priority:medium 🟡"]
        P3["priority:low 🟢"]
    end
    subgraph "サイズ"
        S1["size:S"]
        S2["size:M"]
        S3["size:L"]
    end
```

### labels.json

```json
[
  {"name": "type:bug",          "color": "FC2C2B", "description": "不具合の修正"},
  {"name": "type:feature",      "color": "0E4BDB", "description": "新機能の追加"},
  {"name": "type:enhancement",  "color": "A2EEEF", "description": "既存機能の改善"},
  {"name": "type:refactor",     "color": "AFD38D", "description": "リファクタリング"},
  {"name": "type:docs",         "color": "F4BFD0", "description": "ドキュメント"},
  {"name": "type:chore",        "color": "D4C5F9", "description": "設定変更・雑務"},
  {"name": "priority:high",     "color": "B60205", "description": "最優先"},
  {"name": "priority:medium",   "color": "FBCA04", "description": "通常"},
  {"name": "priority:low",      "color": "0E8A16", "description": "余裕があれば"},
  {"name": "size:S",            "color": "EDEDED", "description": "〜1時間"},
  {"name": "size:M",            "color": "C5DEF5", "description": "〜半日"},
  {"name": "size:L",            "color": "BFD4F2", "description": "1日以上"}
]
```

---

## 6. Issueライフサイクル（シーケンス図）

```mermaid
sequenceDiagram
    actor User as 開発者
    participant GH as GitHub
    participant Proj as Projects Board
    participant CI as GitHub Actions

    User->>GH: Issue作成（テンプレート使用）
    GH->>CI: Issue openedイベント発火
    CI->>Proj: Issueをボードに自動追加（起票）
    User->>GH: ラベル・マイルストーン設定
    User->>User: Projectsで「未着手」に移動

    User->>GH: ブランチ作成 feature/#123-xxx
    User->>User: 開発・コミット
    User->>GH: PR作成（Closes #123）
    GH->>CI: PR openedイベント発火
    CI->>CI: Lint・テスト実行

    alt CI成功
        User->>GH: Squash & Merge
        GH->>GH: Issue #123 自動Close
        GH->>Proj: ステータス→完了
    else CI失敗
        CI->>User: エラー通知
        User->>User: 修正・再push
    end
```

---

## 7. ファイル構成（実装するもの）

```
.github/
├── ISSUE_TEMPLATE/
│   ├── bug_report.yml          # バグ報告テンプレート
│   ├── feature_request.yml     # 機能リクエストテンプレート
│   └── config.yml              # 空Issue無効化
├── pull_request_template.md    # PRテンプレート
├── labels.json                 # ラベル定義
└── workflows/
    ├── add-to-project.yml      # Issue→Project自動追加
    ├── sync-labels.yml         # ラベル自動同期
    └── deploy-docs.yml         # (既存)
```

---

## 8. 実装フェーズ

```mermaid
graph LR
    P1["Phase 1<br/>テンプレート整備"] --> P2["Phase 2<br/>ラベル設定"]
    P2 --> P3["Phase 3<br/>Projects作成"]
    P3 --> P4["Phase 4<br/>Actions自動化"]

    style P1 fill:#4A90D9,color:#fff
    style P2 fill:#4A90D9,color:#fff
    style P3 fill:#F39C12,color:#fff
    style P4 fill:#F39C12,color:#fff
```

| フェーズ | 内容 | 前提 |
|---------|------|------|
| Phase 1 | Issue/PRテンプレート配置 | なし |
| Phase 2 | labels.json作成・ラベル同期 | gh auth済み |
| Phase 3 | GitHub Projects ボード作成 | gh auth済み |
| Phase 4 | GitHub Actions（自動追加・ラベル同期） | PAT設定 |

---

## 9. 受け入れ条件

- [ ] Issue テンプレート2種（バグ報告・機能リクエスト）が使える
- [ ] PRテンプレートが PR作成時に自動表示される
- [ ] ラベルが labels.json 通りに設定されている
- [ ] GitHub Projects ボードが5ステータスで作成されている
- [ ] Issue作成時に Projects へ自動追加される
- [ ] ブランチ命名規則が CLAUDE.md に記載されている
