#!/usr/bin/env node

/**
 * Claude Agent SDK Wrapper
 * stdin から JSON を受け取り、SDK でストリーミング実行、NDJSON を stdout に出力
 *
 * Input:  {"message":"...","sessionId":"...","systemPrompt":"...","allowedTools":[...],"cwd":"..."}
 * Output: {"type":"text","content":"..."} | {"type":"tool_use",...} | {"type":"result",...} | {"type":"done"}
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function readLine() {
  return new Promise((resolve) => {
    let buf = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      buf += chunk;
      const nl = buf.indexOf("\n");
      if (nl !== -1) {
        const line = buf.slice(0, nl);
        process.stdin.removeAllListeners("data");
        process.stdin.removeAllListeners("end");
        resolve(line);
      }
    });
    process.stdin.on("end", () => {
      // Handle case where input has no trailing newline
      if (buf.trim()) {
        resolve(buf.trim());
      } else {
        resolve(null);
      }
    });
    process.stdin.resume();
  });
}

async function main() {
  const raw = await readLine();
  if (!raw) {
    emit({ type: "error", message: "No input" });
    emit({ type: "done" });
    process.exit(1);
  }

  let input;
  try {
    input = JSON.parse(raw);
  } catch (e) {
    emit({ type: "error", message: `Invalid JSON: ${e.message}` });
    emit({ type: "done" });
    process.exit(1);
  }

  const {
    message,
    sessionId,
    systemPrompt,
    allowedTools = [],
    cwd = process.cwd(),
  } = input;

  try {
    const options = {
      cwd,
      permissionMode: "bypassPermissions",
      includePartialMessages: true,
    };
    // allowedTools が空配列の場合は渡さない（空配列 = 全ツール不許可になるため）
    if (allowedTools && allowedTools.length > 0) {
      options.allowedTools = allowedTools;
    }

    if (sessionId) {
      options.resume = sessionId;
    }
    if (systemPrompt && !sessionId) {
      options.systemPrompt = systemPrompt;
    }

    for await (const event of query({ prompt: message, options })) {
      // ストリーミング delta イベント
      if (event.type === "stream_event") {
        const ev = event.event;
        if (ev.type === "content_block_delta" && ev.delta?.text) {
          emit({ type: "text", content: ev.delta.text });
        }
      }

      // アシスタントメッセージ（テキストは stream_event で送信済み、ツール情報のみ）
      else if (event.type === "assistant") {
        const blocks = event.message?.content ?? [];
        for (const block of blocks) {
          if (block.type === "tool_use") {
            emit({
              type: "tool_use",
              toolName: block.name,
              toolInput: block.input,
              toolUseId: block.id,
            });
          }
          if (block.type === "tool_result") {
            const output = typeof block.content === "string"
              ? block.content
              : JSON.stringify(block.content);
            emit({
              type: "tool_result",
              toolUseId: block.tool_use_id,
              output,
              isError: block.is_error || false,
            });
          }
          // text ブロックは stream_event の delta で既に送信済みなのでスキップ
        }
      }

      // 最終結果
      else if (event.type === "result") {
        emit({
          type: "result",
          sessionId: event.sessionId ?? null,
          text: event.result ?? "",
        });
      }
    }
  } catch (err) {
    const msg = err?.message ?? String(err);
    // セッションが見つからない場合 → セッションなしでリトライ
    if (msg.includes("No conversation found") && sessionId) {
      try {
        const retryOptions = {
          cwd,
          permissionMode: "bypassPermissions",
          includePartialMessages: true,
        };
        if (allowedTools && allowedTools.length > 0) {
          retryOptions.allowedTools = allowedTools;
        }
        if (systemPrompt) {
          retryOptions.systemPrompt = systemPrompt;
        }
        for await (const event of query({ prompt: message, options: retryOptions })) {
          if (event.type === "stream_event") {
            const ev = event.event;
            if (ev.type === "content_block_delta" && ev.delta?.text) {
              emit({ type: "text", content: ev.delta.text });
            }
          } else if (event.type === "assistant") {
            const blocks = event.message?.content ?? [];
            for (const block of blocks) {
              if (block.type === "tool_use") {
                emit({ type: "tool_use", toolName: block.name, toolInput: block.input, toolUseId: block.id });
              }
            }
          } else if (event.type === "result") {
            emit({ type: "result", sessionId: event.sessionId ?? null, text: event.result ?? "" });
          }
        }
      } catch (retryErr) {
        emit({ type: "error", message: retryErr?.message ?? String(retryErr) });
      }
    } else {
      emit({ type: "error", message: msg });
    }
  }
}

main().catch((err) => {
  emit({ type: "error", message: err?.message ?? String(err) });
  emit({ type: "done" });
  process.exit(1);
});
