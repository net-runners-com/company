# Claude Code CLI → Anthropic API + Agent SDK 移行計画

## 現状の問題

| 問題 | 影響 |
|---|---|
| OAuth認証がコンテナ再起動で消える | エージェント全停止、手動再認証が必要 |
| `claude` CLIプロセスを毎回起動 | レスポンス遅延、リソース消費 |
| Proプラン依存 | SaaS提供時のライセンス問題 |

## 移行先

```
現在: claude --dangerously-skip-permissions -p "..." --system-prompt "..."
        ↓
移行: Anthropic Python SDK (anthropic) + ツール定義
       → API Key認証（環境変数、永続、再起動影響なし）
```

## 影響範囲

### main.py 内の CLI 呼び出し（15箇所）

| 箇所 | 用途 | 行 | 移行方法 |
|---|---|---|---|
| `/chat` | 汎用チャット | 323 | `_call_claude()` |
| `/chat/stream` | ブラウザ自動化チャット | 527 | `_call_claude_stream()` |
| `_update_user_profile` | プロファイル抽出 | 1008 | `_call_claude()` |
| `/employee/{id}/chat/stream` | 社員チャット（SDK wrapper） | 1205 | `_call_claude_stream()` + tools |
| `/line/route` | LINEルーティング | 1355 | `_call_claude()` |
| `/employee/{id}/chat/sync` | LINE返信 | 1420 | `_call_claude()` |
| `/directive` | 指示分解 | 1551 | `_call_claude()` |
| `/directive` | 指示実行 | 1594 | `_call_claude()` + tools |
| `/projects` | パイプライン生成 | 1655 | `_call_claude()` |
| `/projects/{id}/execute/{step}` | ステップ実行 | 1800 | `_call_claude()` + tools |
| `/pages/generate` | ページ生成 | 2471 | `_call_claude()` |
| `_run_scheduled_task` | 定期実行 | 2881 | `_call_claude()` + tools |
| `_fetch_news` | ニュース取得 | 3046 | `_call_claude()` + tools |

### claude-agent.mjs（Node.js SDK wrapper）

- 現在: `@anthropic-ai/claude-agent-sdk` の `query()` を使用
- 移行: Python SDK に統一。Node.js wrapper 廃止

## 移行パターン

### パターンA: シンプル呼び出し（JSON生成、ルーティング等）

```python
# 現在
proc = await asyncio.create_subprocess_exec(
    "claude", "--dangerously-skip-permissions", "-p", prompt, "--max-turns", "1",
    stdout=PIPE, stderr=PIPE
)
stdout, _ = await proc.communicate()
result = stdout.decode().strip()

# 移行後
result = await _call_claude(prompt, system_prompt=None, max_tokens=2000)
```

### パターンB: ツール実行あり（ファイル操作、Bash実行等）

```python
# 現在
proc = await asyncio.create_subprocess_exec(
    "claude", "--dangerously-skip-permissions", "-p", task_msg,
    "--system-prompt", system_prompt, "--max-turns", "15",
    stdout=PIPE, stderr=PIPE, cwd=workdir
)

# 移行後
result = await _call_claude_with_tools(
    message=task_msg,
    system_prompt=system_prompt,
    tools=AGENT_TOOLS,  # Bash, Read, Write, Edit
    max_turns=15,
    cwd=workdir
)
```

### パターンC: ストリーミング（チャット）

```python
# 現在: claude-agent.mjs (Node.js) 経由
proc = await asyncio.create_subprocess_exec(
    "node", "/app/app/claude-agent.mjs", ...
)

# 移行後: Python SDK で直接ストリーミング
async def generate():
    async for chunk in _call_claude_stream(message, system_prompt, tools):
        yield f"data: {json.dumps(chunk)}\n\n"
```

## 実装する共通関数

```python
# worker/app/llm.py（新規ファイル）

import anthropic

client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

# ツール定義
AGENT_TOOLS = [
    {
        "name": "bash",
        "description": "Execute a bash command",
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "The command to run"}
            },
            "required": ["command"]
        }
    },
    {
        "name": "read_file",
        "description": "Read a file",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"}
            },
            "required": ["path"]
        }
    },
    {
        "name": "write_file",
        "description": "Write content to a file",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "content": {"type": "string"}
            },
            "required": ["path", "content"]
        }
    }
]

# ツール実行ハンドラ
async def execute_tool(name, input, cwd=None):
    if name == "bash":
        proc = await asyncio.create_subprocess_exec(
            "bash", "-c", input["command"],
            stdout=PIPE, stderr=PIPE, cwd=cwd
        )
        stdout, stderr = await proc.communicate()
        return stdout.decode() + stderr.decode()
    elif name == "read_file":
        return Path(input["path"]).read_text()
    elif name == "write_file":
        Path(input["path"]).parent.mkdir(parents=True, exist_ok=True)
        Path(input["path"]).write_text(input["content"])
        return "OK"


# パターンA: シンプル呼び出し
async def call_claude(prompt, system=None, max_tokens=4000):
    resp = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=max_tokens,
        system=system or "",
        messages=[{"role": "user", "content": prompt}]
    )
    return resp.content[0].text


# パターンB: ツール実行ループ
async def call_claude_with_tools(message, system, tools, max_turns=15, cwd=None):
    messages = [{"role": "user", "content": message}]
    for _ in range(max_turns):
        resp = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=8000,
            system=system,
            messages=messages,
            tools=tools
        )
        # テキスト応答
        if resp.stop_reason == "end_turn":
            return "".join(b.text for b in resp.content if b.type == "text")
        # ツール呼び出し
        messages.append({"role": "assistant", "content": resp.content})
        tool_results = []
        for block in resp.content:
            if block.type == "tool_use":
                result = await execute_tool(block.name, block.input, cwd)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result[:5000]
                })
        messages.append({"role": "user", "content": tool_results})
    return "Max turns reached"


# パターンC: ストリーミング
async def call_claude_stream(message, system, tools=None):
    # SSE チャンクを yield
    ...
```

## 移行ステップ

### Phase 1: 準備（破壊的変更なし）

```
1. .env に ANTHROPIC_API_KEY 追加
2. requirements.txt に anthropic 追加
3. worker/app/llm.py 作成（共通関数）
4. テスト: call_claude() が動くか確認
```

### Phase 2: シンプル呼び出しの置換（影響小）

```
5. /line/route → call_claude()
6. /pages/generate → call_claude()
7. /projects（計画生成）→ call_claude()
8. /directive（計画分解）→ call_claude()
9. _update_user_profile → call_claude()
10. _fetch_news → call_claude_with_tools()
```

### Phase 3: ツール実行ありの置換（影響中）

```
11. /employee/{id}/chat/sync → call_claude_with_tools()
12. /projects/{id}/execute/{step} → call_claude_with_tools()
13. /directive（タスク実行）→ call_claude_with_tools()
14. _run_scheduled_task → call_claude_with_tools()
```

### Phase 4: ストリーミングチャット（影響大）

```
15. /employee/{id}/chat/stream → call_claude_stream()
    - claude-agent.mjs を廃止
    - Python SDK で直接ストリーミング
    - ツール実行 + テキスト出力の SSE 変換
16. /chat/stream → call_claude_stream()
```

### Phase 5: クリーンアップ

```
17. claude-agent.mjs 削除
18. @anthropic-ai/claude-agent-sdk 削除（package.json）
19. Dockerfile から claude-code CLI インストール削除
20. OAuth 関連の設定削除
21. テスト: 全機能動作確認
```

## 環境変数の変更

```
# 追加
ANTHROPIC_API_KEY=sk-ant-...

# 削除可能（Phase 5完了後）
IS_SANDBOX=1  ← Claude CLI 用、不要に
```

## リスク

| リスク | 対策 |
|---|---|
| API従量課金 | モデルをsonnetにして節約。max_tokens制限 |
| ツール実行の再現性 | CLIと同等のBash/Read/Write定義。テストで確認 |
| MCP非対応 | Nango proxy等は curl で代替（既に実装済み） |
| Playwright | Bash経由で引き続き利用可能 |

## コスト見積もり

```
Sonnet 4: $3/1M input, $15/1M output

1ユーザー1日の推定:
  チャット10回 × 平均2000 token = 20K token
  バックグラウンド(ニュース,プロファイル) = 5K token
  合計: 25K token/日 = $0.10/日

100ユーザー: $10/日 = $300/月
```

## タイムライン

```
Phase 1: 30分（準備）
Phase 2: 1時間（シンプル置換10箇所）
Phase 3: 1.5時間（ツール実行4箇所）
Phase 4: 2時間（ストリーミング2箇所）
Phase 5: 30分（クリーンアップ）

合計: 約5-6時間
```
