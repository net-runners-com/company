# 毎日自動投稿フロー

エージェントが実行する手順:

1. **記事生成**: `python3 scripts/generate_article.py --style ren`
2. **タイトル取得**: `output/{style}/{timestamp}/title.txt` を読む
3. **本文取得**: `output/{style}/{timestamp}/article.md` を読む
4. **Playwright MCPで投稿**: `post_to_note.md` の手順に従って投稿
5. **ログ記録**: `logs/posts.log` に投稿ログを追記

スケジューラー（`POST /schedules`）で毎日実行可能。
