#!/bin/bash
# LINE メッセージ監視 → Claude Code で処理 → LINE返信
# Usage: bash line-agent.sh &

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
QUEUE="$SCRIPT_DIR/inbox/queue.jsonl"
ENV_FILE="$SCRIPT_DIR/.env"

# .env読み込み
source "$ENV_FILE"

touch "$QUEUE"

# 起動時に既存行をスキップ（新着のみ処理）
SKIP_LINES=$(wc -l < "$QUEUE" | tr -d ' ')

echo "[line-agent] 監視開始: $QUEUE (既存${SKIP_LINES}件スキップ)"

tail -n +$((SKIP_LINES + 1)) -f "$QUEUE" | while IFS= read -r line; do
  # JSON解析
  MESSAGE=$(echo "$line" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['message'])")
  USER_ID=$(echo "$line" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['userId'])")
  TIMESTAMP=$(echo "$line" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['timestamp'])")
  MEDIA_TYPE=$(echo "$line" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('type','text'))" 2>/dev/null)
  MEDIA_PATH=$(echo "$line" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('mediaPath',''))" 2>/dev/null)
  ORIGINAL_FILENAME=$(echo "$line" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('originalFilename',''))" 2>/dev/null)

  echo "[line-agent] $(date '+%H:%M:%S') 受信: $MESSAGE (type=$MEDIA_TYPE, from $USER_ID)"

  # ローディング表示
  curl -s -X POST https://api.line.me/v2/bot/chat/loading/start \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $LINE_ACCESS_TOKEN" \
    -d "{\"chatId\":\"$USER_ID\",\"loadingSeconds\":60}" > /dev/null

  # === メディア処理（画像・ファイル）===
  if [ -n "$MEDIA_PATH" ] && [ -f "$MEDIA_PATH" ]; then
    echo "[line-agent] 📷 メディア処理: $MEDIA_PATH (type=$MEDIA_TYPE)"

    COMPANY_DIR="$SCRIPT_DIR/../../.company"

    if [ "$MEDIA_TYPE" = "image" ]; then
      # 画像 → Claude Vision で解析
      VISION_PROMPT="この画像を分析してください。

## 分類ルール
以下のいずれかに分類し、対応する情報を抽出してJSON形式で返してください。
JSONの後に、ユーザーへのLINE返信メッセージを書いてください。

### 領収書・レシートの場合
\`\`\`json
{\"type\":\"receipt\",\"date\":\"YYYY-MM-DD\",\"amount\":1280,\"store\":\"店名\",\"items\":\"内容\",\"category\":\"経費区分\"}
\`\`\`
返信例: ✅ 領収書を記録しました: ¥1,280 ○○商店（昼食代）

### 名刺の場合
\`\`\`json
{\"type\":\"namecard\",\"name\":\"氏名\",\"company\":\"会社名\",\"title\":\"役職\",\"phone\":\"電話番号\",\"email\":\"メール\"}
\`\`\`
返信例: 📇 名刺を登録しました: 山田太郎様（○○株式会社）

### 請求書の場合
\`\`\`json
{\"type\":\"invoice\",\"from\":\"送り元\",\"amount\":50000,\"due_date\":\"YYYY-MM-DD\",\"description\":\"内容\"}
\`\`\`
返信例: 📄 請求書: ¥50,000（○○会社、支払期限: YYYY-MM-DD）

### その他の画像
\`\`\`json
{\"type\":\"other\",\"description\":\"内容の説明\"}
\`\`\`
返信例: 内容の説明を1-2文で

---
必ずJSON部分と返信メッセージ部分を分けて出力してください。
JSONは \`\`\`json ... \`\`\` で囲んでください。"

      RESULT=$(claude --dangerously-skip-permissions -p "まず画像ファイル $MEDIA_PATH をReadツールで読み込んでください。その上で以下の指示に従ってください。

$VISION_PROMPT" 2>/dev/null)

      # JSONを抽出
      JSON_DATA=$(echo "$RESULT" | sed -n '/```json/,/```/p' | sed '1d;$d')
      DATA_TYPE=$(echo "$JSON_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin).get('type','other'))" 2>/dev/null || echo "other")

      # 経理自動記録（領収書の場合）
      if [ "$DATA_TYPE" = "receipt" ]; then
        EXPENSE_DATE=$(echo "$JSON_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin)['date'])" 2>/dev/null)
        EXPENSE_AMOUNT=$(echo "$JSON_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin)['amount'])" 2>/dev/null)
        EXPENSE_STORE=$(echo "$JSON_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin)['store'])" 2>/dev/null)
        EXPENSE_ITEMS=$(echo "$JSON_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin)['items'])" 2>/dev/null)
        EXPENSE_CAT=$(echo "$JSON_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin)['category'])" 2>/dev/null)

        EXPENSE_FILE="$COMPANY_DIR/finance/expenses/$(date '+%Y-%m').md"
        mkdir -p "$(dirname "$EXPENSE_FILE")"
        if [ ! -f "$EXPENSE_FILE" ]; then
          echo "| 日付 | 内容 | 金額 | 区分 | 備考 |" > "$EXPENSE_FILE"
          echo "|------|------|------|------|------|" >> "$EXPENSE_FILE"
        fi
        echo "| $EXPENSE_DATE | $EXPENSE_STORE $EXPENSE_ITEMS | ¥${EXPENSE_AMOUNT} | $EXPENSE_CAT | LINE受信・自動記録 |" >> "$EXPENSE_FILE"
        echo "[line-agent] 📊 経理記録: ¥${EXPENSE_AMOUNT} ${EXPENSE_STORE}"

        # 仕訳帳にも追記
        JOURNAL_FILE="$COMPANY_DIR/finance/journal/$(date '+%Y-%m').md"
        mkdir -p "$(dirname "$JOURNAL_FILE")"
        if [ ! -f "$JOURNAL_FILE" ]; then
          echo "# 仕訳帳 $(date '+%Y年%m月')" > "$JOURNAL_FILE"
          echo "" >> "$JOURNAL_FILE"
          echo "| 日付 | 摘要 | 借方科目 | 借方金額 | 貸方科目 | 貸方金額 |" >> "$JOURNAL_FILE"
          echo "|------|------|---------|---------|---------|---------|" >> "$JOURNAL_FILE"
        fi
        echo "| $(date '+%m-%d') | $EXPENSE_STORE $EXPENSE_ITEMS | $EXPENSE_CAT | $EXPENSE_AMOUNT | 現金 | $EXPENSE_AMOUNT |" >> "$JOURNAL_FILE"
      fi

      # 名刺の場合 → 営業リードに追加
      if [ "$DATA_TYPE" = "namecard" ]; then
        NC_NAME=$(echo "$JSON_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin)['name'])" 2>/dev/null)
        NC_COMPANY=$(echo "$JSON_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin)['company'])" 2>/dev/null)
        NC_EMAIL=$(echo "$JSON_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin).get('email',''))" 2>/dev/null)
        NC_PHONE=$(echo "$JSON_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin).get('phone',''))" 2>/dev/null)
        NC_TITLE=$(echo "$JSON_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin).get('title',''))" 2>/dev/null)

        LEAD_FILE="$COMPANY_DIR/sales/leads/$(date '+%Y-%m-%d')-namecard.md"
        mkdir -p "$(dirname "$LEAD_FILE")"
        echo "" >> "$LEAD_FILE"
        echo "## $NC_NAME（$NC_COMPANY）" >> "$LEAD_FILE"
        echo "- 役職: $NC_TITLE" >> "$LEAD_FILE"
        echo "- TEL: $NC_PHONE" >> "$LEAD_FILE"
        echo "- Email: $NC_EMAIL" >> "$LEAD_FILE"
        echo "- 取得日: $(date '+%Y-%m-%d') LINE受信" >> "$LEAD_FILE"
        echo "[line-agent] 📇 営業リード追加: $NC_NAME ($NC_COMPANY)"
      fi

      # 返信メッセージ抽出（JSON以外の部分）
      REPLY=$(echo "$RESULT" | sed '/```json/,/```/d' | sed '/^$/d' | head -5)
      if [ -z "$REPLY" ]; then
        REPLY="画像を受信しました。"
      fi

    elif [ "$MEDIA_TYPE" = "file" ]; then
      FNAME="${ORIGINAL_FILENAME:-$(basename "$MEDIA_PATH")}"
      EXT=$(echo "$FNAME" | sed 's/.*\.//' | tr '[:upper:]' '[:lower:]')

      # プレビューURL発行
      PREVIEW_URL=$(bash "$SCRIPT_DIR/../preview/create-preview.sh" --file "$MEDIA_PATH" 2>/dev/null)

      # ファイルの中身を分析（PDF, DOCX等）
      FILE_PROMPT="ファイル $MEDIA_PATH をReadツールで読み込んで分析してください。ファイル名: $FNAME

## 分類ルール
ファイルの内容を分析し、以下のいずれかに分類してJSON形式で返してください。
JSONの後に、ユーザーへのLINE返信メッセージを書いてください。

### 請求書の場合
\`\`\`json
{\"type\":\"invoice\",\"from\":\"送り元\",\"amount\":50000,\"due_date\":\"YYYY-MM-DD\",\"description\":\"内容\"}
\`\`\`

### 領収書・レシートの場合
\`\`\`json
{\"type\":\"receipt\",\"date\":\"YYYY-MM-DD\",\"amount\":1280,\"store\":\"店名\",\"items\":\"内容\",\"category\":\"経費区分\"}
\`\`\`

### 見積書の場合
\`\`\`json
{\"type\":\"estimate\",\"from\":\"送り元\",\"amount\":100000,\"valid_until\":\"YYYY-MM-DD\",\"description\":\"内容\"}
\`\`\`

### 契約書の場合
\`\`\`json
{\"type\":\"contract\",\"parties\":\"当事者\",\"subject\":\"契約内容\",\"amount\":0,\"date\":\"YYYY-MM-DD\"}
\`\`\`

### その他ドキュメントの場合
\`\`\`json
{\"type\":\"document\",\"summary\":\"内容の要約を2-3文で\"}
\`\`\`

JSONは \`\`\`json ... \`\`\` で囲んでください。
返信メッセージは短くフレンドリーに。"

      FILE_RESULT=$(claude --dangerously-skip-permissions -p "$FILE_PROMPT" 2>/dev/null)

      # JSONを抽出
      FILE_JSON=$(echo "$FILE_RESULT" | sed -n '/```json/,/```/p' | sed '1d;$d')
      FILE_TYPE=$(echo "$FILE_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('type','document'))" 2>/dev/null || echo "document")

      # 経理記録（請求書）
      if [ "$FILE_TYPE" = "invoice" ]; then
        INV_FROM=$(echo "$FILE_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['from'])" 2>/dev/null)
        INV_AMOUNT=$(echo "$FILE_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['amount'])" 2>/dev/null)
        INV_DUE=$(echo "$FILE_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('due_date',''))" 2>/dev/null)
        INV_DESC=$(echo "$FILE_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('description',''))" 2>/dev/null)

        INV_FILE="$COMPANY_DIR/finance/invoices/received-$(date '+%Y-%m').md"
        mkdir -p "$(dirname "$INV_FILE")"
        if [ ! -f "$INV_FILE" ]; then
          echo "# 受領請求書 $(date '+%Y年%m月')" > "$INV_FILE"
          echo "" >> "$INV_FILE"
          echo "| 受領日 | 送り元 | 金額 | 支払期限 | 内容 | 備考 |" >> "$INV_FILE"
          echo "|--------|--------|------|----------|------|------|" >> "$INV_FILE"
        fi
        echo "| $(date '+%Y-%m-%d') | $INV_FROM | ¥${INV_AMOUNT} | $INV_DUE | $INV_DESC | LINE受信 |" >> "$INV_FILE"
        echo "[line-agent] 📄 請求書記録: ¥${INV_AMOUNT} ${INV_FROM}"

        # 仕訳帳にも追記（買掛金）
        JOURNAL_FILE="$COMPANY_DIR/finance/journal/$(date '+%Y-%m').md"
        mkdir -p "$(dirname "$JOURNAL_FILE")"
        if [ ! -f "$JOURNAL_FILE" ]; then
          echo "# 仕訳帳 $(date '+%Y年%m月')" > "$JOURNAL_FILE"
          echo "" >> "$JOURNAL_FILE"
          echo "| 日付 | 摘要 | 借方科目 | 借方金額 | 貸方科目 | 貸方金額 |" >> "$JOURNAL_FILE"
          echo "|------|------|---------|---------|---------|---------|" >> "$JOURNAL_FILE"
        fi
        echo "| $(date '+%m-%d') | $INV_FROM $INV_DESC 請求書受領 | 外注費 | $INV_AMOUNT | 買掛金 | $INV_AMOUNT |" >> "$JOURNAL_FILE"
      fi

      # 経理記録（領収書・ファイル版）
      if [ "$FILE_TYPE" = "receipt" ]; then
        EXPENSE_DATE=$(echo "$FILE_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['date'])" 2>/dev/null)
        EXPENSE_AMOUNT=$(echo "$FILE_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['amount'])" 2>/dev/null)
        EXPENSE_STORE=$(echo "$FILE_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['store'])" 2>/dev/null)
        EXPENSE_ITEMS=$(echo "$FILE_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['items'])" 2>/dev/null)
        EXPENSE_CAT=$(echo "$FILE_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['category'])" 2>/dev/null)

        EXPENSE_FILE="$COMPANY_DIR/finance/expenses/$(date '+%Y-%m').md"
        mkdir -p "$(dirname "$EXPENSE_FILE")"
        if [ ! -f "$EXPENSE_FILE" ]; then
          echo "| 日付 | 内容 | 金額 | 区分 | 備考 |" > "$EXPENSE_FILE"
          echo "|------|------|------|------|------|" >> "$EXPENSE_FILE"
        fi
        echo "| $EXPENSE_DATE | $EXPENSE_STORE $EXPENSE_ITEMS | ¥${EXPENSE_AMOUNT} | $EXPENSE_CAT | LINE受信(ファイル) |" >> "$EXPENSE_FILE"
        echo "[line-agent] 📊 経費記録: ¥${EXPENSE_AMOUNT} ${EXPENSE_STORE}"

        # 仕訳帳にも追記
        JOURNAL_FILE="$COMPANY_DIR/finance/journal/$(date '+%Y-%m').md"
        mkdir -p "$(dirname "$JOURNAL_FILE")"
        if [ ! -f "$JOURNAL_FILE" ]; then
          echo "# 仕訳帳 $(date '+%Y年%m月')" > "$JOURNAL_FILE"
          echo "" >> "$JOURNAL_FILE"
          echo "| 日付 | 摘要 | 借方科目 | 借方金額 | 貸方科目 | 貸方金額 |" >> "$JOURNAL_FILE"
          echo "|------|------|---------|---------|---------|---------|" >> "$JOURNAL_FILE"
        fi
        echo "| $(date '+%m-%d') | $EXPENSE_STORE $EXPENSE_ITEMS | $EXPENSE_CAT | $EXPENSE_AMOUNT | 現金 | $EXPENSE_AMOUNT |" >> "$JOURNAL_FILE"
      fi

      # 経理記録（見積書）
      if [ "$FILE_TYPE" = "estimate" ]; then
        EST_FROM=$(echo "$FILE_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['from'])" 2>/dev/null)
        EST_AMOUNT=$(echo "$FILE_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['amount'])" 2>/dev/null)
        EST_DESC=$(echo "$FILE_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('description',''))" 2>/dev/null)
        echo "[line-agent] 📝 見積書受領: ¥${EST_AMOUNT} ${EST_FROM}"
      fi

      # 返信メッセージ
      REPLY=$(echo "$FILE_RESULT" | sed '/```json/,/```/d' | sed '/^$/d' | head -5)
      if [ -n "$PREVIEW_URL" ]; then
        REPLY="${REPLY}
プレビュー: $PREVIEW_URL"
      fi
      if [ -z "$REPLY" ]; then
        REPLY="📎 ファイル「$FNAME」を受信しました。"
        if [ -n "$PREVIEW_URL" ]; then
          REPLY="${REPLY}
プレビュー: $PREVIEW_URL"
        fi
      fi
    fi

    # LINE返信
    REPLY_ESCAPED=$(echo "$REPLY" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))")
    curl -s -X POST https://api.line.me/v2/bot/message/push \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $LINE_ACCESS_TOKEN" \
      -d "{\"to\":\"$USER_ID\",\"messages\":[{\"type\":\"text\",\"text\":$REPLY_ESCAPED}]}" > /dev/null

    # 会話ログ
    CONV_LOG="$SCRIPT_DIR/inbox/conversation.log"
    echo "U:$MESSAGE" >> "$CONV_LOG"
    REPLY_COMPACT=$(echo "$REPLY" | tr '\n' '|' | sed 's/|$//')
    echo "B:$REPLY_COMPACT" >> "$CONV_LOG"

    echo "[line-agent] ✅ メディア処理完了"
    continue
  fi

  # === コマンド処理 ===
  if [[ "$MESSAGE" == /* ]]; then
    CMD=$(echo "$MESSAGE" | cut -d' ' -f1)
    ARGS=$(echo "$MESSAGE" | cut -d' ' -f2-)
    [ "$CMD" = "$ARGS" ] && ARGS=""

    case "$CMD" in
      /help)
        REPLY="📋 使えるコマンド一覧

【コマンド】
/help — このヘルプを表示
/calendar — 今後の予定を確認
/weather [都市] — 天気を確認
/todo — 今日のTODOを確認
/todo add [内容] — TODOを追加
/note — 最新のnote記事を確認
/threads [テキスト] — Threadsに投稿
/meeting [議題] — 部門横断会議を開催

【経理】
/finance — 経理ダッシュボード
/journal — 仕訳帳（今月）
/expenses — 経費一覧（今月）
/invoices — 請求書管理
/cash — 出納帳（今月）
/report — 月次レポート

【部署メンション】
@秘書 — スケジュール管理、TODO、相談
@経理 — 売上・経費・請求書
@営業 — リード管理・営業メール
@リサーチ — 市場調査・競合分析
@エンジニア — AI開発・技術設計
@PM — プロダクト方向性・仕様
@開発 — アプリ・Webサービス
@SNS — 投稿管理・コンテンツ企画
@新規事業 — アイデア検証・MVP・ピッチ

例: @秘書 明日の予定教えて
例: @経理 今月の経費まとめて

コマンドなしでメッセージを送ると、AIが自由に返答します。"
        ;;
      /calendar)
        CAL_RESULT=$(gws calendar +agenda 2>&1 | head -15)
        REPLY="📅 今後の予定:
$CAL_RESULT"
        ;;
      /weather)
        CITY="${ARGS:-Tokyo}"
        WEATHER=$(curl -s "https://wttr.in/${CITY}?format=%C+%t+%h&lang=ja" 2>&1)
        REPLY="🌤️ ${CITY}の天気: $WEATHER"
        ;;
      /todo)
        if [[ "$ARGS" == add* ]]; then
          TODO_TEXT=$(echo "$ARGS" | sed 's/^add *//')
          TODO_FILE="$SCRIPT_DIR/../../.company/secretary/todos/$(date '+%Y-%m-%d').md"
          mkdir -p "$(dirname "$TODO_FILE")"
          echo "- [ ] $TODO_TEXT | 優先度: 通常" >> "$TODO_FILE"
          REPLY="✅ TODOに追加しました: $TODO_TEXT"
        else
          TODO_FILE="$SCRIPT_DIR/../../.company/secretary/todos/$(date '+%Y-%m-%d').md"
          if [ -f "$TODO_FILE" ]; then
            TODOS=$(cat "$TODO_FILE")
            REPLY="📝 今日のTODO:
$TODOS"
          else
            REPLY="📝 今日のTODOはまだありません。\n/todo add [内容] で追加できます。"
          fi
        fi
        ;;
      /note)
        LOG=$(tail -3 "$SCRIPT_DIR/../../.company/sns/note/logs/posts.log" 2>/dev/null)
        if [ -n "$LOG" ]; then
          REPLY="📝 最近のnote記事:
$LOG"
        else
          REPLY="まだnote記事がありません。"
        fi
        ;;
      /threads)
        if [ -n "$ARGS" ]; then
          echo "$ARGS" > /tmp/line_threads_post.txt
          python3 "$SCRIPT_DIR/../../.company/sns/threads/post_to_threads.py" /tmp/line_threads_post.txt --profile "Profile 3" > /dev/null 2>&1
          REPLY="✅ Threadsに投稿しました: ${ARGS:0:50}..."
        else
          REPLY="使い方: /threads [投稿テキスト]"
        fi
        ;;
      /meeting)
        if [ -n "$ARGS" ]; then
          # 議題から参加部門を自動判定するか、デフォルト5部門
          MEETING_SCRIPT="$SCRIPT_DIR/../meeting/meeting.sh"
          MEETING_RESULT=$(bash "$MEETING_SCRIPT" "$ARGS" 2>&1 | tail -30)
          # 議事録ファイルパスを取得
          MINUTES=$(echo "$MEETING_RESULT" | grep "議事録:" | sed 's/.*議事録: //')
          # 結論部分を抽出（PMの発言）
          if [ -n "$MINUTES" ] && [ -f "$MINUTES" ]; then
            SUMMARY=$(grep -A 20 "### PM" "$MINUTES" 2>/dev/null | head -15)
            REPLY="🏢 会議完了: $ARGS

${SUMMARY}

📝 議事録: secretary/notes/$(basename "$MINUTES")"
          else
            REPLY="🏢 会議を実行しましたが、議事録の取得に失敗しました。"
          fi
        else
          REPLY="使い方: /meeting [議題]

例: /meeting noteの有料記事の価格戦略
例: /meeting 来月のSNS施策について"
        fi
        ;;
      /journal)
        JOURNAL_FILE="$SCRIPT_DIR/../../.company/finance/journal/$(date '+%Y-%m').md"
        if [ -f "$JOURNAL_FILE" ]; then
          PREVIEW_URL=$(bash "$SCRIPT_DIR/../preview/create-preview.sh" --article \
            <(echo "仕訳帳 $(date '+%Y年%m月')") "$JOURNAL_FILE" 2>/dev/null)
          REPLY="📒 仕訳帳（今月）
$PREVIEW_URL"
        else
          REPLY="📒 今月の仕訳帳はまだありません。"
        fi
        ;;
      /expenses)
        EXPENSE_FILE="$SCRIPT_DIR/../../.company/finance/expenses/$(date '+%Y-%m').md"
        if [ -f "$EXPENSE_FILE" ]; then
          TOTAL=$(grep "^|" "$EXPENSE_FILE" | grep -v "日付" | grep -v "---" | python3 -c "
import sys,re
total=0
for line in sys.stdin:
    m=re.search(r'¥([0-9,]+)',line)
    if m: total+=int(m.group(1).replace(',',''))
print(f'{total:,}')
" 2>/dev/null)
          PREVIEW_URL=$(bash "$SCRIPT_DIR/../preview/create-preview.sh" --article \
            <(echo "経費一覧 $(date '+%Y年%m月')") "$EXPENSE_FILE" 2>/dev/null)
          REPLY="💰 経費（今月）合計: ¥${TOTAL}
$PREVIEW_URL"
        else
          REPLY="💰 今月の経費はまだありません。"
        fi
        ;;
      /invoice|/invoices)
        INV_DIR="$SCRIPT_DIR/../../.company/finance/invoices"
        RECV_FILE="$INV_DIR/received-$(date '+%Y-%m').md"
        # 発行・受領をまとめたMarkdownを作成
        TMP_INV="/tmp/line_invoices_$(date '+%Y%m').md"
        echo "## 発行済み請求書" > "$TMP_INV"
        echo "" >> "$TMP_INV"
        SENT=$(ls "$INV_DIR"/*.pdf 2>/dev/null | xargs -I{} basename {} | grep -v "サンプル" | head -10)
        if [ -n "$SENT" ]; then
          echo "$SENT" | while read f; do echo "- $f"; done >> "$TMP_INV"
        else
          echo "なし" >> "$TMP_INV"
        fi
        echo "" >> "$TMP_INV"
        if [ -f "$RECV_FILE" ]; then
          echo "## 受領請求書（今月）" >> "$TMP_INV"
          echo "" >> "$TMP_INV"
          cat "$RECV_FILE" >> "$TMP_INV"
        fi
        PREVIEW_URL=$(bash "$SCRIPT_DIR/../preview/create-preview.sh" --article \
          <(echo "請求書管理 $(date '+%Y年%m月')") "$TMP_INV" 2>/dev/null)
        REPLY="📄 請求書管理
$PREVIEW_URL"
        ;;
      /cash)
        CASH_FILE="$SCRIPT_DIR/../../.company/finance/cash/$(date '+%Y-%m').md"
        if [ -f "$CASH_FILE" ]; then
          PREVIEW_URL=$(bash "$SCRIPT_DIR/../preview/create-preview.sh" --article \
            <(echo "出納帳 $(date '+%Y年%m月')") "$CASH_FILE" 2>/dev/null)
          REPLY="🏦 出納帳（今月）
$PREVIEW_URL"
        else
          REPLY="🏦 今月の出納帳はまだありません。"
        fi
        ;;
      /report)
        REPORT_FILE="$SCRIPT_DIR/../../.company/finance/reports/report-$(date '+%Y-%m').md"
        if [ -f "$REPORT_FILE" ]; then
          PREVIEW_URL=$(bash "$SCRIPT_DIR/../preview/create-preview.sh" --article \
            <(echo "月次レポート $(date '+%Y年%m月')") "$REPORT_FILE" 2>/dev/null)
          REPLY="📊 月次レポート
$PREVIEW_URL"
        else
          REPLY="📊 今月の月次レポートはまだありません。月末に作成されます。"
        fi
        ;;
      /finance)
        FIN_DIR="$SCRIPT_DIR/../../.company/finance"
        EXP_TOTAL=$(grep "^|" "$FIN_DIR/expenses/$(date '+%Y-%m').md" 2>/dev/null | grep -v "日付" | grep -v "---" | python3 -c "
import sys,re
total=0
for line in sys.stdin:
    m=re.search(r'¥([0-9,]+)',line)
    if m: total+=int(m.group(1).replace(',',''))
print(f'{total:,}')
" 2>/dev/null || echo "0")
        JNL_COUNT=$(grep "^|" "$FIN_DIR/journal/$(date '+%Y-%m').md" 2>/dev/null | grep -v "日付" | grep -v "---" | wc -l | tr -d ' ')
        UNPAID=$(grep "^|" "$FIN_DIR/invoices/received-$(date '+%Y-%m').md" 2>/dev/null | grep -v "受領日" | grep -v "---" | wc -l | tr -d ' ')

        REPLY="💼 経理ダッシュボード（$(date '+%Y年%m月')）

📒 仕訳: ${JNL_COUNT}件
💰 経費合計: ¥${EXP_TOTAL}
📄 未払い請求書: ${UNPAID}件

【コマンド】タップで詳細表示↓
/journal — 仕訳帳
/expenses — 経費一覧
/invoices — 請求書管理
/cash — 出納帳
/report — 月次レポート"
        ;;
      *)
        REPLY="❓ 不明なコマンドです。/help でコマンド一覧を確認できます。"
        ;;
    esac

    # コマンド結果を送信
    REPLY_ESCAPED=$(echo "$REPLY" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))")
    curl -s -X POST https://api.line.me/v2/bot/message/push \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $LINE_ACCESS_TOKEN" \
      -d "{\"to\":\"$USER_ID\",\"messages\":[{\"type\":\"text\",\"text\":$REPLY_ESCAPED}]}" > /dev/null

    # 会話ログに保存
    CONV_LOG="$SCRIPT_DIR/inbox/conversation.log"
    echo "U:$MESSAGE" >> "$CONV_LOG"
    REPLY_COMPACT=$(echo "$REPLY" | tr '\n' '|' | sed 's/|$//')
    echo "B:$REPLY_COMPACT" >> "$CONV_LOG"

    echo "[line-agent] ✅ 送信完了"
    continue

  # === @部署メンション（半角・全角両対応）===
  elif [[ "$MESSAGE" == @* ]] || [[ "$MESSAGE" == ＠* ]]; then
    # 全角＠を半角に統一、全角スペースも半角に
    NORMALIZED=$(echo "$MESSAGE" | sed 's/^＠/@/' | sed 's/　/ /g')
    DEPT=$(echo "$NORMALIZED" | cut -d' ' -f1 | sed 's/^@//')
    DEPT_MSG=$(echo "$NORMALIZED" | cut -d' ' -f2-)
    [ "$DEPT" = "$DEPT_MSG" ] && DEPT_MSG=""

    # 部署名の正規化
    case "$DEPT" in
      秘書|secretary)     DEPT_DIR="secretary" ; DEPT_NAME="秘書室" ;;
      経理|finance)       DEPT_DIR="finance"   ; DEPT_NAME="経理" ;;
      営業|sales)         DEPT_DIR="sales"     ; DEPT_NAME="営業" ;;
      リサーチ|research)   DEPT_DIR="research"  ; DEPT_NAME="リサーチ" ;;
      エンジニア|eng|engineering) DEPT_DIR="engineering" ; DEPT_NAME="エンジニアリング" ;;
      PM|pm)              DEPT_DIR="pm"        ; DEPT_NAME="PM" ;;
      開発|dev)           DEPT_DIR="dev"       ; DEPT_NAME="開発" ;;
      SNS|sns)            DEPT_DIR="sns"       ; DEPT_NAME="SNS運用" ;;
      新規事業|newbiz)     DEPT_DIR="newbiz"    ; DEPT_NAME="新規事業開発" ;;
      *)
        REPLY="❓ 「$DEPT」という部署はありません。

使える部署:
@秘書 @経理 @営業 @リサーチ @エンジニア @PM @開発 @SNS

例: @秘書 明日の予定教えて"

        REPLY_ESCAPED=$(echo "$REPLY" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))")
        curl -s -X POST https://api.line.me/v2/bot/message/push \
          -H "Content-Type: application/json" \
          -H "Authorization: Bearer $LINE_ACCESS_TOKEN" \
          -d "{\"to\":\"$USER_ID\",\"messages\":[{\"type\":\"text\",\"text\":$REPLY_ESCAPED}]}" > /dev/null
        echo "[line-agent] ✅ 送信完了"
        continue
        ;;
    esac

    COMPANY_DIR="$SCRIPT_DIR/../../.company"
    DEPT_CLAUDE="$COMPANY_DIR/$DEPT_DIR/CLAUDE.md"
    DEPT_CONTEXT=$(cat "$DEPT_CLAUDE" 2>/dev/null || echo "部署の設定ファイルがありません")

    echo "[line-agent] @$DEPT_NAME: $DEPT_MSG"

    CONV_LOG="$SCRIPT_DIR/inbox/conversation.log"
    HISTORY=$(tail -10 "$CONV_LOG" 2>/dev/null || echo "")

    DEPT_PROMPT="あなたは仮想組織の「${DEPT_NAME}」部門の担当者です。LINE経由でオーナーからメッセージを受け取りました。

## 部門の役割・ルール
$DEPT_CONTEXT

## 権限
- すべてのコマンド実行、ネットワークアクセス、ファイル操作が許可されています
- 許可を求める必要はありません。即実行してください

## プレビューURL発行（重要）
記事やファイル（PDF, PPTX等）を生成したら、必ずプレビューURLを発行してユーザーに送ること。
- 記事: bash $SCRIPT_DIR/../preview/create-preview.sh --article title.txt article.md
- ファイル: bash $SCRIPT_DIR/../preview/create-preview.sh --file /path/to/file
URLをユーザーへの返信に含めること。「プレビュー: https://...」の形で。

## 作業ディレクトリ
$COMPANY_DIR/$DEPT_DIR/

## 今日の日付
$(date '+%Y-%m-%d')

## 直近の会話履歴
$HISTORY

## オーナーからのメッセージ
$DEPT_MSG

部門の担当者として返信してください。短く、フレンドリーに。返信テキストのみ出力（説明不要）。返信に部門名を含めないでください。"

    REPLY=$(claude --dangerously-skip-permissions -p "$DEPT_PROMPT" 2>/dev/null | head -20)

    if [ -z "$REPLY" ]; then
      REPLY="すみません、${DEPT_NAME}の処理中にエラーが発生しました。"
    fi

    # 部署名プレフィックスをClaudeの出力から除去して統一フォーマットにする
    REPLY=$(echo "$REPLY" | sed 's/^【[^】]*】//' | sed 's/^\*\*[^*]*\*\*//' | sed 's/^[[:space:]]*//')
    REPLY="${DEPT_NAME}: ${REPLY}"

    # 会話ログに圧縮形式で保存
    echo "U:@${DEPT_NAME} $DEPT_MSG" >> "$CONV_LOG"
    REPLY_COMPACT=$(echo "$REPLY" | tr '\n' '|' | sed 's/|$//')
    echo "B:$REPLY_COMPACT" >> "$CONV_LOG"

    echo "[line-agent] @$DEPT_NAME 返信: ${REPLY:0:50}"

    REPLY_ESCAPED=$(echo "$REPLY" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))")
    curl -s -X POST https://api.line.me/v2/bot/message/push \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $LINE_ACCESS_TOKEN" \
      -d "{\"to\":\"$USER_ID\",\"messages\":[{\"type\":\"text\",\"text\":$REPLY_ESCAPED}]}" > /dev/null
    echo "[line-agent] ✅ 送信完了"
    continue
  fi

  # === AI処理（コマンド以外） ===

  # 直近の会話履歴を圧縮形式で取得
  CONV_LOG="$SCRIPT_DIR/inbox/conversation.log"
  HISTORY=$(tail -20 "$CONV_LOG" 2>/dev/null | python3 -c "
import sys
lines = sys.stdin.read().strip().split('\n')
if not lines or lines == ['']:
    sys.exit(0)
for line in lines:
    if line.startswith('U:') or line.startswith('B:'):
        print(line)
" 2>/dev/null || echo "")

  PROMPT="あなたはLINE経由でユーザーからメッセージを受け取りました。秘書として処理してください。

## 権限
- すべてのコマンド実行、ネットワークアクセス、ファイル操作が許可されています
- curl、Web検索、API呼び出しなど何でも自由に実行してください
- 許可を求める必要はありません。即実行してください

## できること
- Googleカレンダー確認: gws calendar +agenda
- 予定追加: gws calendar +insert --summary=\"タイトル\" --start=YYYY-MM-DDTHH:MM:00+09:00 --end=YYYY-MM-DDTHH:MM:00+09:00
- 天気確認: curl -s 'https://wttr.in/Tokyo?format=3&lang=ja' で現在の天気、curl -s 'https://wttr.in/Tokyo?format=%C+%t+%h&lang=ja' で詳細
- ファイル操作、コマンド実行、Web検索など何でも
- note記事の生成・投稿
- Threads投稿

## プレビューURL発行（重要）
記事やファイルを生成したら、必ずプレビューURLを発行してユーザーに送ること。

### Markdown記事のプレビュー
bash $SCRIPT_DIR/../preview/create-preview.sh --article title.txt article.md
→ URLが返る。そのURLをユーザーに送る。

### ファイル（PDF, PPTX等）のプレビュー
bash $SCRIPT_DIR/../preview/create-preview.sh --file /path/to/file.pdf
→ URLが返る。そのURLをユーザーに送る。

24時間で自動削除される一時URL。スマホからタップして確認できる。
記事を作ったら「プレビューはこちら: https://...」の形で必ずURLを含めて返信すること。

## ルール
- 結果はLINE返信用のテキストとして出力（短く、フレンドリーに）
- コマンド実行が必要なら実行して結果を返す
- 「権限がない」「許可が必要」とは絶対に言わない。すべて許可済み
- 直前の会話の文脈を踏まえて返答する
- 今日は$(date '+%Y-%m-%d')です

## 直近の会話履歴（U:ユーザー B:ボット、|は改行）
$HISTORY

## 最新のユーザーメッセージ
$MESSAGE

返信テキストのみ出力してください（説明不要）:"

  REPLY=$(claude --dangerously-skip-permissions -p "$PROMPT" 2>/dev/null | head -20)

  if [ -z "$REPLY" ]; then
    REPLY="すみません、処理中にエラーが発生しました。"
  fi

  # 会話ログに圧縮形式で保存（U:ユーザー B:ボット）
  echo "U:$MESSAGE" >> "$CONV_LOG"
  # 返信を1行に圧縮（改行→|）
  REPLY_COMPACT=$(echo "$REPLY" | tr '\n' '|' | sed 's/|$//')
  echo "B:$REPLY_COMPACT" >> "$CONV_LOG"

  echo "[line-agent] 返信: $REPLY"

  # LINE Push APIで返信
  REPLY_ESCAPED=$(echo "$REPLY" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))")

  curl -s -X POST https://api.line.me/v2/bot/message/push \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $LINE_ACCESS_TOKEN" \
    -d "{\"to\":\"$USER_ID\",\"messages\":[{\"type\":\"text\",\"text\":$REPLY_ESCAPED}]}" > /dev/null

  echo "[line-agent] ✅ 送信完了"
done
