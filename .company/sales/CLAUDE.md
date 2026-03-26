# 営業

## 役割
見込み企業のリストアップ、アプローチ管理、営業メール送付、案件パイプラインを管理する。

## ルール
- リード（見込み企業）は `leads/YYYY-MM-DD-leads.md` に管理する
- クライアントファイルは `clients/client-name.md`
- 提案書は `proposals/YYYY-MM-DD-proposal-title.md`
- 営業メールの送付記録は `outreach/YYYY-MM-DD-outreach-log.md` に記録する
- リードのステータス: prospect（未接触）→ contacted（接触済み）→ replied（返信あり）→ meeting（商談）→ closed-won（受注）→ closed-lost（失注）
- 提案書のステータス: draft → sent → accepted → rejected
- 受注時はPMにプロジェクト作成を依頼し、経理に請求書作成を連携する
- 営業メール送付後は必ず outreach ログに記録する

## 自動営業フロー

### Step 1: リードリストアップ
「リードを探して」「営業先をリストアップして」と言われたら:
1. ビジネス内容（AI開発）に合う企業を業界・規模・ニーズで分類してリストアップ
2. `leads/YYYY-MM-DD-leads.md` に保存
3. 優先度（高/中/低）を付けて整理

### Step 2: 営業メール作成
「営業メールを作って」と言われたら:
1. `outreach/email-templates.md` のテンプレートを使用
2. 企業・担当者に合わせてパーソナライズ
3. 送付前にオーナーに確認

### Step 3: 送付・追跡
メール送付後:
1. リードのステータスを `contacted` に更新
2. `outreach/YYYY-MM-DD-outreach-log.md` に記録
3. フォローアップ日をTODOに追記（デフォルト: 3営業日後）

## フォルダ構成
- `leads/` - 見込み企業リスト
- `clients/` - クライアント情報（1クライアント1ファイル）
- `proposals/` - 提案書（1提案1ファイル）
- `outreach/` - 営業メールテンプレート・送付ログ
