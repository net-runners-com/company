# Threads 投稿手順（Playwright MCP）

エージェントがPlaywright MCPツールを使って Threads に投稿する手順書。

## 前提

- Playwright MCPツール（mcp__playwright__*）を使用
- Threads にログイン済みのセッションが必要

## 手順

### Step 1: Threadsを開く

```
mcp__playwright__browser_navigate → https://www.threads.net
```

5秒待ってスナップショット確認。

### Step 2: 新規投稿ダイアログを開く

「新規スレッド」「作成」ボタンを探してクリック:

```
mcp__playwright__browser_snapshot
mcp__playwright__browser_click → 作成ボタン
```

### Step 3: トピック設定（オプション）

1. 「トピックを追加」をクリック
2. トピック名を入力
3. サジェスト候補から選択

### Step 4: テキスト入力

`[contenteditable=true]` にテキストを入力:

```
mcp__playwright__browser_evaluate →
  const el = document.querySelector('[contenteditable=true]');
  el.focus();
  document.execCommand('insertText', false, '投稿テキスト');
```

### Step 5: 投稿

「投稿」ボタンをクリック。Threadsの投稿ボタンはReact内部イベントで制御されているため、通常のclickが効かない場合がある:

```
mcp__playwright__browser_snapshot → 投稿ボタンを探す
mcp__playwright__browser_click → 投稿ボタン
```

### Step 6: 投稿確認

プロフィールページに移動して最新投稿を確認:

```
mcp__playwright__browser_navigate → https://www.threads.net/@アカウント名
mcp__playwright__browser_snapshot → 最新投稿を確認
```

### Step 7: 完了

```
mcp__playwright__browser_close
```

## フォーマットルール

- 200文字以内
- リスト・ステップは1項目ごとに改行
- 改行は1行のみ（空行を入れない）
- 本文にハッシュタグを含めない（トピックはUI設定）

## 注意事項

- 完了後は必ず `mcp__playwright__browser_close` でブラウザを閉じる
- エラー時も必ずブラウザを閉じる
- browser-use は使用禁止
