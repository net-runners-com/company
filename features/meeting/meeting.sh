#!/bin/bash
# 部門横断会議スクリプト
# Usage: bash meeting.sh "議題"
# Usage: bash meeting.sh "議題" "秘書,SNS,営業,経理"

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPANY_DIR="$SCRIPT_DIR/../../.company"
MEETING_DIR="$COMPANY_DIR/secretary/notes"
mkdir -p "$MEETING_DIR"

TOPIC="$1"
MEMBERS="${2:-秘書,SNS,営業,経理,PM}"
DATE=$(date '+%Y-%m-%d')
TIME=$(date '+%H%M')
MINUTES_FILE="$MEETING_DIR/${DATE}-meeting-${TIME}.md"

if [ -z "$TOPIC" ]; then
  echo "Usage: bash meeting.sh \"議題\" [\"秘書,SNS,営業,経理\"]"
  exit 1
fi

# 部署名→ディレクトリ・表示名マッピング
get_dept_info() {
  case "$1" in
    秘書)       echo "secretary|秘書室" ;;
    経理)       echo "finance|経理" ;;
    営業)       echo "sales|営業" ;;
    リサーチ)    echo "research|リサーチ" ;;
    エンジニア)  echo "engineering|エンジニアリング" ;;
    PM)         echo "pm|PM" ;;
    開発)       echo "dev|開発" ;;
    SNS)        echo "sns|SNS運用" ;;
    *)          echo "" ;;
  esac
}

# 議事録ヘッダー
cat > "$MINUTES_FILE" << EOF
# 部門横断会議 — $DATE

**議題**: $TOPIC
**参加部門**: $MEMBERS
**開始**: $(date '+%H:%M')

---

EOF

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  部門横断会議"
echo "  議題: $TOPIC"
echo "  参加: $MEMBERS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TRANSCRIPT=""

# メンバーをループ
IFS=',' read -ra DEPT_LIST <<< "$MEMBERS"

for i in "${!DEPT_LIST[@]}"; do
  DEPT=$(echo "${DEPT_LIST[$i]}" | tr -d ' ')
  INFO=$(get_dept_info "$DEPT")

  if [ -z "$INFO" ]; then
    echo "⚠ 不明な部署: $DEPT（スキップ）"
    continue
  fi

  DEPT_DIR=$(echo "$INFO" | cut -d'|' -f1)
  DEPT_NAME=$(echo "$INFO" | cut -d'|' -f2)
  DEPT_CLAUDE="$COMPANY_DIR/$DEPT_DIR/CLAUDE.md"
  DEPT_CONTEXT=$(cat "$DEPT_CLAUDE" 2>/dev/null || echo "設定なし")

  # 最初の部署は司会
  if [ "$i" -eq 0 ]; then
    ROLE="あなたは司会です。議題を簡潔に提示し、各部門に意見を求めてください。"
  elif [ "$i" -eq $((${#DEPT_LIST[@]} - 1)) ]; then
    ROLE="あなたは最後の発言者です。これまでの議論を踏まえて意見を述べ、最後に結論・ネクストアクションをまとめてください。"
  else
    ROLE="あなたは議論の途中で発言します。前の発言を踏まえて、自分の部門の視点から意見を述べてください。"
  fi

  PROMPT="あなたは仮想組織の「${DEPT_NAME}」部門の担当者です。部門横断会議に参加しています。

## あなたの部門の役割
${DEPT_CONTEXT}

## 会議情報
- 議題: ${TOPIC}
- 参加部門: ${MEMBERS}
- あなたの役割: ${ROLE}

## これまでの発言
${TRANSCRIPT:-（まだ発言なし）}

## ルール
- 自分の部門の専門性・視点から発言する
- 短く要点を絞る（3-5文）
- 他部門の発言に対してコメント・補足があればする
- 発言のみ出力（部門名や装飾は不要）"

  echo "💬 ${DEPT_NAME}..."

  REPLY=$(claude --dangerously-skip-permissions -p "$PROMPT" 2>/dev/null | head -15)

  if [ -z "$REPLY" ]; then
    REPLY="（応答なし）"
  fi

  echo ""
  echo "【${DEPT_NAME}】"
  echo "$REPLY"
  echo ""

  # 議事録に追記
  echo "### ${DEPT_NAME}" >> "$MINUTES_FILE"
  echo "" >> "$MINUTES_FILE"
  echo "$REPLY" >> "$MINUTES_FILE"
  echo "" >> "$MINUTES_FILE"

  # トランスクリプトに追加（次の発言者に渡す）
  # 圧縮: 改行→スペース
  REPLY_COMPACT=$(echo "$REPLY" | tr '\n' ' ')
  TRANSCRIPT="${TRANSCRIPT}
${DEPT_NAME}: ${REPLY_COMPACT}"
done

# フッター
cat >> "$MINUTES_FILE" << EOF

---

**終了**: $(date '+%H:%M')
EOF

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  会議終了"
echo "  議事録: $MINUTES_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
