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

  echo "[line-agent] $(date '+%H:%M:%S') 受信: $MESSAGE (from $USER_ID)"

  # ローディング表示
  curl -s -X POST https://api.line.me/v2/bot/chat/loading/start \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $LINE_ACCESS_TOKEN" \
    -d "{\"chatId\":\"$USER_ID\",\"loadingSeconds\":60}" > /dev/null

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
      *)
        REPLY="❓ 不明なコマンドです。/help でコマンド一覧を確認できます。"
        ;;
    esac

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
