---
name: note-article
description: >
  note.com 記事の自動生成・投稿スキル。
  スタイル（ペルソナ）を切り替えて複数アカウント運用可能。
  記事生成→下書き保存→有料設定→公開まで一気通貫。
trigger: /note-article
---

# note-article: note.com 記事自動生成・投稿システム

## いつ使うか

- `/note-article` を実行したとき
- 「note記事」「note投稿」「記事書いて」「下書き」「有料記事」と言われたとき
- note.comへの投稿・記事生成に関する依頼全般

---

## 概要

note.comへの記事作成から投稿までを自動化するシステム。
Claude Code CLIで記事を生成し、browser-use CLIでブラウザ操作して投稿する。

## 関連ファイル

| 種別 | パス |
|------|------|
| スクリプト（記事生成） | `company/front-office/marketing/sns/note/scripts/generate_article.py` |
| スクリプト（記事投稿） | `company/front-office/marketing/sns/note/scripts/post_to_note.py` |
| スクリプト（画像生成） | `company/front-office/marketing/sns/note/scripts/generate_image.py` |
| cron用スクリプト | `company/front-office/marketing/sns/note/daily_post.sh` |
| スタイル定義 | `company/front-office/marketing/sns/note/references/styles/` |
| 記事出力先 | `company/front-office/marketing/sns/note/output/{style}/{timestamp}/` |
| 投稿ログ | `company/front-office/marketing/sns/note/logs/posts.log` |
| 競合分析・調査 | `company/front-office/marketing/sns/note/research/` |
| 環境変数 | `.env`（プロジェクトルート） |

## ディレクトリ構成

```
company/front-office/marketing/sns/note/
├── daily_post.sh             # cron用オーケストレーション（※スタイル未対応、要更新）
├── scripts/
│   ├── generate_article.py   # 記事生成（Claude Code CLI）
│   ├── post_to_note.py       # 記事投稿（browser-use CLI）
│   └── generate_image.py     # サムネイル画像生成（Gemini API）
├── references/
│   └── styles/               # スタイル（ペルソナ）定義
│       ├── ren.md            # れん｜自己開発（啓発）
│       ├── ren_topics.md     # れんのトピック一覧
│       └── {name}_used.txt   # 使用済みトピック（自動生成）
├── output/
│   └── {style}/{timestamp}/  # 生成記事の出力先
│       ├── title.txt
│       └── article.md
├── logs/
│   └── posts.log             # 投稿ログ
└── research/                 # 競合分析・トレンド調査
```

## コマンド一覧

### 記事生成

```bash
# デフォルトスタイル（ren）でランダムトピック
python3 scripts/generate_article.py

# スタイル指定
python3 scripts/generate_article.py --style ren

# トピック指定
python3 scripts/generate_article.py --style ren "ADHDと先延ばし"

# スタイル一覧
python3 scripts/generate_article.py --list
```

出力: `output/{style}/{YYYY-MM-DD-HHMM}/title.txt` と `article.md`

### 記事投稿

```bash
# 下書き保存（デフォルト: Profile 1）
python3 scripts/post_to_note.py "タイトル" article.md

# Chromeプロファイル指定
python3 scripts/post_to_note.py "タイトル" article.md --profile "Profile 3"

# 有料記事（¥300）で下書き保存
python3 scripts/post_to_note.py "タイトル" article.md --price 300 --profile "Profile 3"

# 有料記事で即公開
python3 scripts/post_to_note.py "タイトル" article.md --price 300 --publish --profile "Profile 3"

# サムネイル付き
python3 scripts/post_to_note.py "タイトル" article.md thumbnail.png --profile "Profile 3"
```

### 画像生成

```bash
python3 scripts/generate_image.py "プロンプト" output/thumbnail.png
```

Gemini API使用。GEMINI_API_KEYが必要。1280x670pxにリサイズ。

## スタイル（ペルソナ）の追加方法

1. `references/styles/{name}.md` にスタイルガイドを作成
2. `references/styles/{name}_topics.md` にトピック一覧を作成
3. スタイルファイルの先頭に `chrome_profile: Profile X` を記載

### スタイルファイルの構造

```markdown
# note記事スタイルガイド — {名前}

chrome_profile: Profile X

## 著者プロフィール
（ペルソナ設定）

## トーン・文体
（文体ルール）

## 構成テンプレート
（記事の型）

## ハッシュタグ
（使用するタグ）
```

### 現在のスタイル

| スタイル名 | ペルソナ | Chrome Profile | noteアカウント |
|-----------|---------|---------------|---------------|
| ren | れん｜自己開発（啓発）ASD/ADHDグレーゾーン | Profile 3 | @personal_dev |

## 記事ファイルのルール

### title.txt と article.md は完全に分離する

- `title.txt`: タイトルのみ（1行）
- `article.md`: **本文のみ**。`# タイトル` 行を含めない
- 投稿スクリプトはタイトルを `title.txt` から読み、本文を `article.md` から読む
- article.md に `# タイトル` が入っていると、noteエディタ上でタイトルが2重表示される

### article.md に含めないもの

- `# タイトル`（h1見出し） → title.txt に分離済み
- `---`（水平線 / セパレーター） → noteエディタでは不要。余計な空白になる

### 正しい article.md の例

```markdown
僕は朝が、本当に無理だった。

目覚ましを5個セットしても起きれない。（本文が続く…）

## 「早く寝ろ」が通用しない脳

ADHDグレーの脳は、夜になると覚醒する。（本文が続く…）
```

## 投稿前の確認事項

### 投稿ログを必ず確認する

投稿前に `logs/posts.log` を読んで、同じ記事が既に投稿されていないか確認する。

```bash
cat company/front-office/marketing/sns/note/logs/posts.log
```

ログ形式: `日時 | スタイル | タイトル | 概要`

### 投稿後はログを更新する

```
YYYY-MM-DD HH:MM | {style} | {タイトル} | {1行概要}
```

## 投稿フロー（post_to_note.py の処理順）

1. **Step 1: エディタを開く** — `editor.note.com/new` をChromeプロファイルで開く
2. **Step 2: タイトル入力** — stateからtextareaを探してinput、見つからなければJS fallback
3. **Step 3: 目次挿入** — `document.getElementById('toc-setting').click()` で目次ブロックを挿入
4. **Step 4: 本文入力** — MarkdownをHTMLに変換し `execCommand('insertHTML')` で挿入
5. **Step 5: サムネイル** — （オプション）画像アップロード
6. **Step 5.5: 有料設定** — （price > 0の場合）公開ページに遷移して価格設定
7. **Step 6: 保存/公開** — 下書き保存 or 公開

## note.com UI操作の知見

### エディタページ (`editor.note.com/new`)

- **エディタ種別**: ProseMirror ベースのリッチテキストエディタ
- **タイトル**: `textarea[placeholder]` で入力。Shadow DOM内の場合あり → JS fallbackでShadow DOM横断
- **本文**: `[contenteditable=true][role=textbox]` に `document.execCommand('insertHTML')` で挿入
  - `insertHTML` を使うことで見出し(`<h3>`)・太字(`<b>`)・引用(`<blockquote>`)・リスト(`<ul>`)が反映される
  - `insertText` だとプレーンテキストになり装飾が失われる
  - Reactの状態管理と整合させるため `execCommand` が必須。`.innerHTML` 直接書き換えは不可
  - 日本語テキストはbase64エンコードしてJS内でデコード（シェルエスケープ問題の回避）
- **目次**: `document.getElementById('toc-setting').click()` でエディタ先頭に目次ブロックが挿入される
  - 目次は見出し(`<h3>` 等)を自動検出してリンクを生成する
  - **本文より先に挿入すること**（後から挿入するとカーソル位置に依存して先頭に入らない）
  - stateのインデックスクリックでは正しく動作しない場合がある → JS直接クリックが確実
- **下書き保存ボタン**: `button` の `textContent` に「下書き保存」を含む
- **「公開に進む」ボタン**: クリックすると `/notes/{id}/publish/` ページへ遷移

### Markdown → HTML変換（`markdown_to_html()` 関数）

| Markdown | HTML | note上の表示 |
|----------|------|------------|
| `# タイトル` | **スキップ** | title.txtと重複するため除去 |
| `## 見出し` | `<h3>見出し</h3>` | 見出し（目次にも反映） |
| `### 小見出し` | `<h4>小見出し</h4>` | 小見出し |
| `**太字**` | `<b>太字</b>` | **太字** |
| `*斜体*` | `<i>斜体</i>` | *斜体* |
| `> 引用` | `<blockquote>引用</blockquote>` | 引用ブロック |
| `- リスト` | `<ul><li>リスト</li></ul>` | 箇条書き |
| `` ```コード``` `` | `<pre><code>コード</code></pre>` | コードブロック |
| `---` | **スキップ** | noteでは不要。noteでは反映されない |
| 空行 | `<br>` | 段落区切り |
| 通常テキスト | `<p>テキスト</p>` | 段落 |

### 公開ページ (`/notes/{id}/publish/`)

- 有料設定: 「有料」ラジオボタン → 価格入力欄（input[type=number]）
- 公開ボタン: 「投稿する」「公開する」「公開」のいずれか
- **下書き保存ボタンは存在しない** → 「キャンセル」でエディタに戻ってから下書き保存する
- 公開設定（ハッシュタグ、有料設定、マガジン追加等）はこのページでのみ可能

### 有料記事のフロー

1. エディタでコンテンツ作成（Step 1-5）
2. `navigate_to_publish()`: 「公開に進む」で公開ページへ遷移
3. 「有料」ラジオボタンをクリック
4. 価格入力欄に金額を入力
5. 下書きの場合: 「キャンセル」→ エディタに戻る → 「下書き保存」
6. 公開の場合: `publish_article()` で「投稿する」ボタンをクリック

### browser-use CLI の注意点

- **投稿前に対象プロファイルのChromeウィンドウをすべて閉じる**。同じプロファイルでChromeが開いていると、browser-useのセッションが競合し、座標がおかしくなったりUIが正しく操作できない
- `state` コマンド: ボタンのテキストが要素行と別行に表示される場合がある
  - `find_index()` で前後行も含めてインデックスを検索する実装で対応
- `--profile` オプション: Chromeのプロファイルディレクトリ名（"Profile 1"等）またはプロファイル表示名（"kgj"等）を指定
- **viewport問題**: 新しいChromeプロファイルや初回起動時にウィンドウが極小（48x8px等）で起動することがある
  - 原因: Chromeプロファイルにウィンドウサイズが未保存 or メール認証未完了でエディタが正しくレンダリングされない
  - 対処: 事前に手動でChromeを開いてウィンドウサイズを確定させる
  - `window.resizeTo()` は効かない場合がある
- **メール認証**: noteアカウント作成後、メール認証を完了しないとエディタのDOM要素が0個になる
- **JS fallbackパターン**: `state` でインデックスが取れない場合、`eval` でDOMを直接操作する二段構えが安定
- **stateインデックス vs DOMインデックス**: browser-useのstate `[N]` とDOM上の要素順は一致しないことがある。確実に操作するにはJS `eval` で `getElementById` や `querySelector` を使う

### 新しいChromeプロファイルのセットアップ手順

1. `open -na "Google Chrome" --args --profile-directory="Profile X"` でChromeを開く
2. ウィンドウを画面いっぱいに広げて閉じる（viewport問題の回避）
3. note.comにログインする
4. **メール認証を完了する**（未完了だとエディタのDOM要素が0個になる）
5. `browser-use profile list` でプロファイル名を確認

## トラブルシューティング

| 症状 | 原因 | 対処 |
|-----|------|------|
| viewport 48x8 / 0x0 | Chromeプロファイルの初期状態 | 手動でChromeを開いてウィンドウを広げて閉じる |
| ボタンが0個 / DOM要素が空 | メール認証未完了 | noteアカウントのメール認証を完了する |
| Page title check: False | ログイン切れ or ページ未ロード | プロファイルでnote.comにログインし直す |
| 下書き保存ボタンが見つからない | stateのパース失敗 | JS fallback（`includes('下書き保存')`）で対応済み |
| 公開ページで下書き保存できない | ボタンが存在しない | キャンセル → エディタに戻って保存 |
| 有料設定が反映されない | エディタページで設定しようとした | 公開ページ（/publish/）でのみ設定可能 |
| タイトル入力できない | Shadow DOM内のtextarea | JS fallbackでShadow DOMを横断して操作 |
| 目次が先頭に入らない | 本文の後に目次を挿入した | 目次は本文より先に挿入する（Step 3 → Step 4の順） |
| タイトルが2重表示 | article.md に `# タイトル` が残っている | article.md には本文のみ。タイトルは title.txt に分離 |
| `---` が空白として表示 | 水平線がnoteで不要な空白になる | article.md に `---` を含めない。markdown_to_html() でスキップ |
| 同じ記事を2回投稿した | 投稿ログを確認せず投稿した | 投稿前に必ず logs/posts.log を確認する |
| `**太字**` がそのまま表示される | `insertText` を使っている | `insertHTML` + `markdown_to_html()` を使う |
| stateクリックで意図しない要素が反応 | stateインデックスのズレ | JS `eval` で `getElementById` を直接使う |

## 重要ルール

### ディレクトリは `company/front-office/marketing/sns/note/` 配下に統一する

- 記事の出力先は必ず `company/front-office/marketing/sns/note/output/{style}/{timestamp}/` に保存する
- **`.company/sns/note-article/` のような別ディレクトリを作らないこと**
- このSKILL.md（`.claude/skills/note-article/`）はスキル定義であり、データの保存先ではない
- スクリプト・ログ・リファレンス・出力は全て `company/front-office/marketing/sns/note/` 以下に集約する

## 依存関係

- **browser-use CLI**: `~/.browser-use-env/bin/browser-use`（ブラウザ自動操作）
- **Claude Code CLI**: `claude -p`（記事生成）
- **Google Chrome**: ログイン済みプロファイルが必要
- **Gemini API**: サムネイル画像生成（オプション、GEMINI_API_KEY必要）
- **Python 3**: スクリプト実行環境
