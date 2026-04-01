---
name: threads
description: >
  Threads 自動投稿スキル。
  スタイル（ペルソナ）切り替え対応。
  競合分析→投稿文生成→確認→投稿の流れ。
trigger: /threads
---

# threads: Threads 自動投稿システム

## いつ使うか

- `/threads` を実行したとき
- 「Threads投稿」「つぶやいて」「Threadsで」と言われたとき

---

## 関連ファイル

| 種別 | パス |
|------|------|
| 投稿手順書 | `company/front-office/marketing/sns/threads/post_to_threads.md` |
| スタイル定義 | `company/front-office/marketing/sns/threads/references/styles/` |
| 投稿テキスト保存先 | `company/front-office/marketing/sns/threads/output/{style}/` |
| 投稿ログ | `company/front-office/marketing/sns/threads/logs/posts.log` |
| 競合分析 | `company/front-office/marketing/sns/threads/research/` |

## ディレクトリ構成

```
company/front-office/marketing/sns/threads/
├── post_to_threads.md            # 投稿手順書（Playwright MCP）
├── references/
│   └── styles/
│       └── ren.md                # れんのスタイルガイド
├── output/
│   └── {style}/
│       └── YYYY-MM-DD-HHMM.txt  # 投稿テキスト（1投稿1ファイル）
├── logs/
│   └── posts.log                 # 投稿ログ
└── research/
    └── analysis-2026-03-26.md    # 競合分析レポート
```

## ログ・投稿管理

### 投稿前に必ずログを確認する
```bash
cat company/front-office/marketing/sns/threads/logs/posts.log
```

### ログ形式
```
YYYY-MM-DD HH:MM | {style} | {トピック} | {投稿テキスト全文}
```

### 投稿テキストの保存
- `output/{style}/YYYY-MM-DD-HHMM.txt` に投稿テキストを保存
- 投稿後にログを `logs/posts.log` に追記

## 投稿ワークフロー

### 1. 競合分析（初回 or 定期的に）
Playwright MCPでThreadsを検索し、キーワード別に人気投稿を収集→分析レポートを作成。

### 2. 投稿文生成
Claude CLIでスタイルガイド+分析結果に基づいてテキスト生成。

### 3. 確認フェーズ（必須）
**投稿前に必ずユーザーに文章を提示して確認を取る。** 修正があれば反映してから投稿。

### 4. 投稿
Playwright MCPツールで直接ブラウザ操作して投稿。手順は `post_to_threads.md` を参照。

1. `mcp__playwright__browser_navigate` → `https://www.threads.net`
2. 作成ボタン → テキスト入力 → 投稿ボタン
3. 完了後 `mcp__playwright__browser_close`

## スタイル（ペルソナ）

| スタイル名 | ペルソナ | Chrome Profile | Threadsアカウント |
|-----------|---------|---------------|-----------------|
| ren | れん｜ASD/ADHDグレーゾーン | Profile 3 | @ren_adhd_asd |

### れんのスタイル概要
- **200文字以内**（つぶやきスタイル）
- 一人称「僕」、日常の気づき・独り言ベース
- 構成を作り込みすぎない
- たまに知識系（東洋哲学の豆知識等）を軽く
- 絵文字控えめ（0〜1個）

### スタイル追加方法
`references/styles/{name}.md` を作成。先頭に `chrome_profile: Profile X` を記載。

## Threads UI操作の知見

### 投稿フロー（Playwright MCP）
1. **Step 1**: `browser_navigate` → `threads.net`
2. **Step 2**: `browser_snapshot` → 作成ボタンを探して `browser_click`
3. **Step 2.5**: （トピック指定時）トピック入力→サジェスト選択
4. **Step 3**: `browser_evaluate` → `[contenteditable=true]` に `execCommand('insertText')` でテキスト挿入
5. **Step 4**: `browser_snapshot` → 「投稿」ボタンを `browser_click`
6. **Step 5**: `browser_close`（必須）

### トピック（旧ハッシュタグ）の設定方法
- Threadsにはハッシュタグがなく、代わりに**トピック**が1投稿につき1つだけ設定できる
- 投稿ダイアログ上部の「トピックを追加」をクリックすると入力欄が開く
- 入力欄は **Shadow DOM内の `input[type=search][placeholder="トピックを追加"]`**
- `browser_fill_form` でトピック入力するとサジェストが表示される
  - JS の `input.value = 'xxx'` + `dispatchEvent` ではサジェストが出ないことがある
- サジェスト候補はDOM上で `textContent` にトピック名を含む `div`/`span` として出現する
- 候補の選択は**座標クリック**で行う（`role=option` 等の属性はついていない）
- サジェスト候補の区別方法: Y座標でグループ化し、最初のグループ（最もYが小さいもの）が最上位候補

### 投稿ボタンの押し方
- Threadsの「投稿」ボタンはReact内部イベントで制御されており、以下は**すべて効かない**:
  - `element.click()`
  - `dispatchEvent(new MouseEvent(...))`
  - React Fiber の `memoizedProps.onClick` 直接呼び出し
- Playwright MCP の `browser_click` で座標指定クリックが有効
- ページ内に「投稿」ボタンが複数存在する（ホーム画面用 + ダイアログ内）
- **Y座標が最も大きい**ものがダイアログ内のボタン
- まれにY座標が異常値（数百万）を返すことがある → リトライで解決

### 投稿テキストのフォーマット
- リスト・ステップ（①②③、箇条書き等）は**1項目ごとに改行**する。1行にベタ書きしない
- **改行は1行改行のみ。空行（2行以上の改行）を入れない**
- 本文にハッシュタグを含めない（トピックはUIで別途設定）
- 詳細はスタイルガイド `references/styles/ren.md` の「フォーマットルール」を参照

### テキスト入力
- `document.querySelector('[contenteditable=true]')` で投稿エリアを取得
- `execCommand('insertText')` で挿入（React状態と整合させるため）
- base64エンコードでシェルエスケープ問題を回避（note投稿と同じ手法）
- `result: None` が返っても入力は成功している場合が多い

### Playwright MCP注意点
- 完了後は必ず `mcp__playwright__browser_close` でブラウザを閉じる
- エラー発生時も必ずブラウザを閉じる
- browser-use は使用禁止

### noteとのクロスポスト
- noteの記事を要約してThreadsに投稿する運用が有効
- 投稿ログは `company/front-office/marketing/sns/note/logs/posts.log` で確認できる
- note記事のURL形式: `https://note.com/{ユーザー名}/n/{記事ID}`
- れんのnoteアカウント: `@personal_dev` → URL: `note.com/personal_dev`

### クロスポスト時のURL貼り付けルール（重要）
**別の媒体（note等）で投稿済みの内容をThreadsに投稿する場合、必ず元記事のURLを本文に含める。**

例:
```
目覚まし5個セットしても起きれなかった僕が...（要約テキスト）

▶ 詳しくはnoteで
https://note.com/personal_dev/n/xxxxx
```

- URLは投稿テキストの末尾に配置
- 「▶ 詳しくはnoteで」等の導線テキストを1行入れる
- note以外の媒体（ブログ等）でも同様にURLを含める

## トラブルシューティング

| 症状 | 原因 | 対処 |
|-----|------|------|
| 投稿ボタンが反応しない | JSクリックが効かない | 座標クリック（click X Y）を使う |
| Y座標が異常値（数百万） | DOMレイアウト未確定 | リトライで解決 |
| Page loaded: False | ページ読み込み遅延 | wait時間を増やす |
| 「このページを離れる」ダイアログ | 投稿前にcloseが呼ばれた | 投稿完了確認後にclose |
| テキスト入力: result: None | execCommandの返り値がない | 正常。テキストは入力されている |
| 投稿ダイアログが開かない | 作成ボタンのインデックスずれ | JS fallbackで aria-label="作成" を探す |
| トピックのサジェストが出ない | JS valueセットではReactが反応しない | `browser_fill_form` を使う |
| サジェスト候補がクリックできない | role=option等の属性がない | 座標クリックで選択する |

## 依存関係

- **Playwright MCP**: `mcp__playwright__*` ツール（ブラウザ操作）
- **Claude Code CLI**: 投稿文生成用（`claude -p`）
