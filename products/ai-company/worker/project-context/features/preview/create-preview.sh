#!/bin/bash
# プレビューURL発行（Markdown記事 or ファイル）
#
# Markdown記事:
#   bash create-preview.sh --article <title.txt> <article.md>
#
# ファイル（PDF, PPTX, 画像等）:
#   bash create-preview.sh --file <filepath>
#
# 出力: プレビューURL

set -e

WORKER_URL="${PREVIEW_WORKER_URL:-https://article-preview.hirotodev-line-crm.workers.dev}"

MODE="$1"

case "$MODE" in
  --article)
    TITLE_FILE="$2"
    ARTICLE_FILE="$3"
    if [ -z "$TITLE_FILE" ] || [ -z "$ARTICLE_FILE" ]; then
      echo "Usage: bash create-preview.sh --article <title.txt> <article.md>"
      exit 1
    fi
    TITLE=$(cat "$TITLE_FILE")
    MARKDOWN=$(cat "$ARTICLE_FILE")
    JSON=$(jq -n --arg title "$TITLE" --arg markdown "$MARKDOWN" '{title: $title, markdown: $markdown}')
    RESPONSE=$(curl -s -X POST "$WORKER_URL/preview" \
      -H "Content-Type: application/json" \
      -d "$JSON")
    URL=$(echo "$RESPONSE" | jq -r '.url // empty')
    ;;

  --file)
    FILEPATH="$2"
    if [ -z "$FILEPATH" ] || [ ! -f "$FILEPATH" ]; then
      echo "Usage: bash create-preview.sh --file <filepath>"
      exit 1
    fi
    RESPONSE=$(curl -s -X POST "$WORKER_URL/upload" \
      -F "file=@$FILEPATH")
    URL=$(echo "$RESPONSE" | jq -r '.url // empty')
    ;;

  *)
    # 引数2つならarticle、1つならfile（後方互換）
    if [ -n "$2" ]; then
      exec "$0" --article "$1" "$2"
    elif [ -f "$1" ]; then
      exec "$0" --file "$1"
    else
      echo "Usage:"
      echo "  bash create-preview.sh --article <title.txt> <article.md>"
      echo "  bash create-preview.sh --file <filepath>"
      exit 1
    fi
    ;;
esac

if [ -z "$URL" ]; then
  echo "❌ プレビューURL発行失敗" >&2
  echo "$RESPONSE" >&2
  exit 1
fi

echo "$URL"
