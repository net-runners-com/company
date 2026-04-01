# note.com 記事投稿手順（Playwright MCP）

エージェントがPlaywright MCPツールを使って note.com に記事を投稿する手順書。

## 前提

- Playwright MCPツール（mcp__playwright__*）を使用
- note.com にログイン済みのセッションが必要（初回は手動ログイン）

## 手順

### Step 1: エディタを開く

```
mcp__playwright__browser_navigate → https://editor.note.com/new
```

8秒待ってからスナップショットで確認:

```
mcp__playwright__browser_snapshot
```

### Step 2: タイトル入力

「記事タイトル」または「タイトル」のテキストエリアを探してクリック → 入力:

```
mcp__playwright__browser_click → テキストエリア
mcp__playwright__browser_fill_form → タイトルテキスト
```

### Step 3: 本文入力

`[contenteditable=true][role=textbox]` に本文を入力。
MarkdownをHTML変換してから貼り付ける:

```
mcp__playwright__browser_click → 本文エディタ
mcp__playwright__browser_evaluate → document.execCommand('insertText', false, '本文テキスト')
```

長文の場合はHTML形式で挿入:

```javascript
const el = document.querySelector('[contenteditable=true][role=textbox]');
el.focus();
el.innerHTML = '<p>段落1</p><h2>見出し</h2><p>段落2</p>';
el.dispatchEvent(new Event('input', {bubbles: true}));
```

### Step 4: 下書き保存

「下書き保存」ボタンをクリック:

```
mcp__playwright__browser_snapshot → 「下書き保存」ボタンを探す
mcp__playwright__browser_click → 下書き保存ボタン
```

### Step 5: 有料記事設定（オプション）

1. 「公開に進む」ボタンをクリック
2. 「有料」ラジオボタンをクリック
3. 価格入力欄に金額を入力
4. 「有料エリア指定」は本文中で先に挿入しておく

### Step 6: 公開（オプション）

1. 「公開に進む」ボタンをクリック
2. 「投稿する」or「公開する」ボタンをクリック

### Step 7: 完了

```
mcp__playwright__browser_close
```

## Markdown → HTML 変換ルール

| Markdown | HTML |
|----------|------|
| `# 見出し` | `<h2>見出し</h2>` |
| `## 見出し` | `<h3>見出し</h3>` |
| `### 見出し` | `<h4>見出し</h4>` |
| `> 引用` | `<blockquote>引用</blockquote>` |
| `- リスト` | `<ul><li>リスト</li></ul>` |
| `**太字**` | `<b>太字</b>` |
| `` `コード` `` | `<pre><code>コード</code></pre>` |
| 空行 | `<br>` |
| 通常テキスト | `<p>テキスト</p>` |

## 注意事項

- 完了後は必ず `mcp__playwright__browser_close` でブラウザを閉じる
- エラー時も必ずブラウザを閉じる
- browser-use は使用禁止
