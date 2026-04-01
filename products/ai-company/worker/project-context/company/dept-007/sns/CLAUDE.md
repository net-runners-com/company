# SNS運用部門

## 役割
SNSアカウントの投稿管理・コンテンツ企画・効果分析を担当する。

## フォルダ構成

```
company/front-office/marketing/sns/
├── CLAUDE.md          # このファイル
├── line/              # LINE
├── x/                 # X（Twitter）
├── facebook/          # Facebook
├── threads/           # Threads
│   ├── threads-post.js
│   └── .threads-session.json
├── instagram/         # Instagram
└── note/              # note.com（記事自動投稿システム）
    ├── scripts/       # 生成・投稿スクリプト
    ├── references/    # スタイル・トピック定義
    ├── output/        # 生成記事
    └── logs/          # 投稿ログ
```

## 対応プラットフォーム

| プラットフォーム | フォルダ | 状態 |
|---------------|---------|------|
| LINE | line/ | 準備中 |
| X（Twitter） | x/ | 準備中 |
| Facebook | facebook/ | 準備中 |
| Threads | threads/ | 自動投稿スクリプトあり |
| Instagram | instagram/ | 準備中 |
| note.com | note/ | 記事自動生成・投稿システム稼働中 |

## ルール
- 各プラットフォームの投稿草稿は `{platform}/posts/YYYY-MM-DD.md`
- 投稿ステータス: draft → review → scheduled → posted
- 投稿には必ずプラットフォーム・ターゲット・ゴールを明記
- 完了時は秘書のTODOに報告を追記

## Threads 自動投稿

```bash
# テキスト直接指定
node company/front-office/marketing/sns/threads/threads-post.js "投稿テキスト"

# 投稿ファイルから
node company/front-office/marketing/sns/threads/threads-post.js --file posts/YYYY-MM-DD.md
```

初回は `headless: false` でブラウザが開くのでログインする。
セッションが `threads/.threads-session.json` に保存され、以降は自動ログイン。

## note.com 記事投稿

詳細は `.claude/skills/note-article/SKILL.md` を参照。
Threads詳細は `.claude/skills/threads/SKILL.md` を参照。

```bash
# 記事生成
python3 company/front-office/marketing/sns/note/scripts/generate_article.py --style ren

# 下書き投稿 → Playwright MCPで直接ブラウザ操作（手順は scripts/post_to_note.md 参照）
```
