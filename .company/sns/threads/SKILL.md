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

## ディレクトリ構成

```
.company/sns/threads/
├── SKILL.md                      # このファイル
├── post_to_threads.py            # 投稿スクリプト（browser-use CLI）
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
cat .company/sns/threads/logs/posts.log
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
browser-useでThreadsを検索し、キーワード別に人気投稿を収集→分析レポートを作成。

### 2. 投稿文生成
Claude CLIでスタイルガイド+分析結果に基づいてテキスト生成。

### 3. 確認フェーズ（必須）
**投稿前に必ずユーザーに文章を提示して確認を取る。** 修正があれば反映してから投稿。

### 4. 投稿
`post_to_threads.py` で自動投稿。

## コマンド

```bash
# テキスト直接指定
python3 post_to_threads.py "つぶやきテキスト" --profile "Profile 3"

# ファイルから
python3 post_to_threads.py /path/to/text.txt --profile "Profile 3"

# トピック付き
python3 post_to_threads.py "テキスト" --profile "Profile 3" --topic "ASD"
```

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

### 投稿フロー（post_to_threads.py の処理順）
1. **Step 1**: `threads.net` を開く
2. **Step 2**: 「新規スレッド作成」ボタンをクリック → 投稿ダイアログが開く
3. **Step 2.5**: （トピック指定時）トピック入力→サジェスト選択
4. **Step 3**: `[contenteditable=true]` に `execCommand('insertText')` でテキスト挿入
5. **Step 4**: 「投稿」ボタンを**座標クリック**で押す

### トピック（旧ハッシュタグ）の設定方法
- Threadsにはハッシュタグがなく、代わりに**トピック**が1投稿につき1つだけ設定できる
- 投稿ダイアログ上部の「トピックを追加」をクリックすると入力欄が開く
- 入力欄は **Shadow DOM内の `input[type=search][placeholder="トピックを追加"]`**
- browser-useの `input` コマンド（stateインデックス指定）で入力するとサジェストが表示される
  - JS の `input.value = 'xxx'` + `dispatchEvent` ではサジェストが出ないことがある
- サジェスト候補はDOM上で `textContent` にトピック名を含む `div`/`span` として出現する
- 候補の選択は**座標クリック**で行う（`role=option` 等の属性はついていない）
- サジェスト候補の区別方法: Y座標でグループ化し、最初のグループ（最もYが小さいもの）が最上位候補

### 投稿ボタンの押し方
- Threadsの「投稿」ボタンはReact内部イベントで制御されており、以下は**すべて効かない**:
  - `element.click()`
  - `dispatchEvent(new MouseEvent(...))`
  - React Fiber の `memoizedProps.onClick` 直接呼び出し
- **座標クリック**（`browser-use click X Y`）が唯一の有効な方法
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

### browser-use注意点
- **投稿前に対象プロファイルのChromeウィンドウをすべて閉じる**。同じプロファイルでChromeが開いていると、browser-useのセッションが競合し、Y座標が異常値（8388734等）になって投稿ボタンが押せない。これがY座標異常値問題の主因
- `run("close")` はbrowser-useセッションのみ閉じる（Chrome自体は閉じない）
- **`killall "Google Chrome"` は絶対にしない**（ユーザーの他のタブが閉じてしまう）
- Profile 3はviewport 0x0問題が発生することがあるが、座標クリックが有効なら投稿可能

### noteとのクロスポスト
- noteの記事を要約してThreadsに投稿する運用が有効
- 投稿ログは `.company/sns/note/logs/posts.log` で確認できる
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
| トピックのサジェストが出ない | JS valueセットではReactが反応しない | browser-useの `input` コマンド（インデックス指定）を使う |
| サジェスト候補がクリックできない | role=option等の属性がない | 座標クリックで選択する |

## 依存関係

- **browser-use CLI**: `~/.browser-use-env/bin/browser-use`
- **Google Chrome**: Profile 3（ren_adhd_asd）にログイン済み
- **Claude Code CLI**: 投稿文生成用（`claude -p`）
