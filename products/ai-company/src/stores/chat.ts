import { create } from "zustand";
import type { ChatMessage } from "@/types";

interface Thread {
  id: string;
  title: string;
  createdAt: string;
}

interface PermissionRequest {
  employeeId: string;
  toolName: string;
  toolInput?: Record<string, unknown>;
  toolUseId?: string;
  patterns: string[];
}

interface ChatStore {
  messages: Record<string, ChatMessage[]>; // key = "empId:threadId"
  threads: Record<string, Thread[]>;       // key = empId
  activeThread: Record<string, string>;    // key = empId → threadId
  loading: boolean;
  systemLines: string[];
  permissionRequest: PermissionRequest | null;
  activeRunId: string | null;              // 現在のrun ID

  fetchThreads: (employeeId: string) => Promise<void>;
  createThread: (employeeId: string) => Promise<void>;
  deleteThread: (employeeId: string, threadId: string) => Promise<void>;
  setActiveThread: (employeeId: string, threadId: string) => void;
  fetchMessages: (employeeId: string, threadId?: string) => Promise<void>;
  sendMessage: (employeeId: string, content: string) => Promise<void>;
  stopStream: () => void;
  reconnectIfActive: (employeeId: string) => Promise<void>;
  respondPermission: (employeeId: string, action: "allow" | "allowPermanent" | "deny") => Promise<void>;
  registerEmployee: (employee: {
    id: string; name: string; role: string; department: string; tone: string; skills: string[]; systemPrompt?: string;
  }) => Promise<void>;
}

function msgKey(empId: string, threadId: string) {
  return `${empId}:${threadId}`;
}

// SSEストリームを読んでメッセージを更新する共通関数
async function consumeSSE(
  res: Response,
  get: () => ChatStore,
  set: (partial: Partial<ChatStore>) => void,
  employeeId: string,
  replyId: string,
  key: string,
  abortSignal?: AbortSignal,
) {
  const reader = res.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (abortSignal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith(": keepalive")) continue;
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6);
        if (payload === "[DONE]") return;
        try {
          const parsed = JSON.parse(payload);

          if (parsed.type === "run_started" && parsed.runId) {
            set({ activeRunId: parsed.runId });
          } else if (parsed.type === "status") {
            // run完了
          } else if (parsed.type === "permission_request") {
            set({
              permissionRequest: {
                employeeId,
                toolName: parsed.toolName || "unknown",
                toolInput: parsed.toolInput,
                toolUseId: parsed.toolUseId,
                patterns: parsed.patterns || [],
              },
            });
          } else if (parsed.type === "tool_use") {
            const toolLabel = parsed.toolName === "Bash"
              ? `$ ${(parsed.toolInput?.command || "").toString().slice(0, 60)}`
              : `${parsed.toolName}: ${JSON.stringify(parsed.toolInput || {}).slice(0, 60)}`;
            set({ systemLines: [...get().systemLines.slice(-1), toolLabel] });
          } else if (parsed.text) {
            const msgs = get().messages[key] ?? [];
            set({
              messages: {
                ...get().messages,
                [key]: msgs.map((m) =>
                  m.id === replyId ? { ...m, content: m.content + parsed.text } : m
                ),
              },
            });
          } else if (parsed.error) {
            const msgs = get().messages[key] ?? [];
            set({
              messages: {
                ...get().messages,
                [key]: msgs.map((m) =>
                  m.id === replyId ? { ...m, content: m.content + `\nError: ${parsed.error}` } : m
                ),
              },
            });
          }
        } catch {}
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    // 接続切断 — エージェントはバックグラウンドで継続中
  }
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: {},
  threads: {},
  activeThread: {},
  loading: false,
  systemLines: [],
  permissionRequest: null,
  activeRunId: null,
  activeEmployeeId: null as string | null,

  stopStream: () => {
    const runId = get().activeRunId;
    const empId = get().activeEmployeeId;
    if (!runId || !empId) return;

    fetch("/api/employee-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _action: "stop_run", employeeId: empId, runId }),
    }).catch(() => {});

    set({ loading: false, activeRunId: null, activeEmployeeId: null, systemLines: [] });
  },

  fetchThreads: async (employeeId) => {
    try {
      const res = await fetch(`/api/employee-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _action: "threads", employeeId }),
      });
      const data = await res.json();
      const threadList: Thread[] = data.threads || [];
      set({ threads: { ...get().threads, [employeeId]: threadList } });

      if (!get().activeThread[employeeId] && threadList.length > 0) {
        set({ activeThread: { ...get().activeThread, [employeeId]: threadList[0].id } });
      }
    } catch {}
  },

  createThread: async (employeeId) => {
    try {
      const res = await fetch(`/api/employee-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _action: "create_thread", employeeId }),
      });
      const thread = await res.json();
      if (thread.id) {
        const current = get().threads[employeeId] || [];
        set({
          threads: { ...get().threads, [employeeId]: [thread, ...current] },
          activeThread: { ...get().activeThread, [employeeId]: thread.id },
          messages: { ...get().messages, [msgKey(employeeId, thread.id)]: [] },
        });
      }
    } catch {}
  },

  deleteThread: async (employeeId, threadId) => {
    try {
      await fetch(`/api/employee-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _action: "delete_thread", employeeId, threadId }),
      });
      const current = get().threads[employeeId] || [];
      const remaining = current.filter((t) => t.id !== threadId);
      const newMessages = { ...get().messages };
      delete newMessages[msgKey(employeeId, threadId)];

      const wasActive = get().activeThread[employeeId] === threadId;
      const newActive = wasActive && remaining.length > 0 ? remaining[0].id : wasActive ? "" : get().activeThread[employeeId];

      set({
        threads: { ...get().threads, [employeeId]: remaining },
        messages: newMessages,
        activeThread: { ...get().activeThread, [employeeId]: newActive },
      });

      if (wasActive && remaining.length > 0) {
        get().fetchMessages(employeeId, remaining[0].id);
      } else if (remaining.length === 0) {
        await get().createThread(employeeId);
      }
    } catch {}
  },

  setActiveThread: (employeeId, threadId) => {
    set({ activeThread: { ...get().activeThread, [employeeId]: threadId } });
    const key = msgKey(employeeId, threadId);
    if (!get().messages[key]) {
      get().fetchMessages(employeeId, threadId);
    }
  },

  fetchMessages: async (employeeId, threadId) => {
    const tid = threadId || get().activeThread[employeeId] || "default";
    try {
      const res = await fetch("/api/employee-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _action: "history", employeeId, threadId: tid }),
      });
      if (res.ok) {
        const history = await res.json();
        if (Array.isArray(history)) {
          const msgs: ChatMessage[] = history.map((h: { timestamp: string; role: string; content: string }, i: number) => ({
            id: `hist-${i}-${h.timestamp}`,
            role: h.role as "user" | "assistant",
            content: h.content,
            createdAt: h.timestamp,
          }));
          set({ messages: { ...get().messages, [msgKey(employeeId, tid)]: msgs } });
        }
      }
    } catch {}
  },

  registerEmployee: async (employee) => {
    try {
      await fetch("/api/employee-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _action: "register", employeeId: employee.id, ...employee }),
      });
    } catch {}
  },

  respondPermission: async (employeeId, action) => {
    const perm = get().permissionRequest;
    if (!perm || perm.employeeId !== employeeId) return;
    const patterns = action === "deny" ? [] : perm.patterns.length > 0 ? perm.patterns : [`${perm.toolName}(*)`];
    try {
      await fetch("/api/employee-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _action: "permission", employeeId, action: action === "deny" ? "deny" : "allow", patterns }),
      });
    } catch {}
    set({ permissionRequest: null });
  },

  reconnectIfActive: async (employeeId) => {
    const threadId = get().activeThread[employeeId] || "default";
    try {
      const res = await fetch("/api/employee-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _action: "check_active", employeeId, threadId }),
      });
      const data = await res.json();
      if (!data.active || !data.runId) return;

      // アクティブなrunがある — まず履歴を取得してからreplyを追加
      await get().fetchMessages(employeeId, threadId);

      const key = msgKey(employeeId, threadId);
      const replyId = `msg-${Date.now()}-reconnect`;
      const replyMsg: ChatMessage = {
        id: replyId, role: "assistant", content: "", createdAt: new Date().toISOString(),
      };

      // 既存メッセージの最後が空のassistantなら再利用、なければ追加
      const existing = get().messages[key] ?? [];
      const lastMsg = existing[existing.length - 1];
      let actualReplyId = replyId;
      if (lastMsg?.role === "assistant" && !lastMsg.content) {
        actualReplyId = lastMsg.id;
      } else {
        set({ messages: { ...get().messages, [key]: [...existing, replyMsg] } });
      }

      set({ loading: true, activeRunId: data.runId, activeEmployeeId: employeeId, systemLines: [] });

      // SSEに再接続（cursor=0から全チャンクを受信）
      const sseRes = await fetch("/api/employee-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _action: "stream_run", employeeId, runId: data.runId }),
      });

      if (sseRes.ok && sseRes.body) {
        await consumeSSE(sseRes, get, set, employeeId, actualReplyId, key);
      }
    } catch {}

    set({ loading: false, activeRunId: null, activeEmployeeId: null, systemLines: [] });
    // 最新履歴をリフレッシュ
    get().fetchMessages(employeeId);
  },

  sendMessage: async (employeeId, content) => {
    const threadId = get().activeThread[employeeId] || "default";
    const key = msgKey(employeeId, threadId);

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: "user", content, createdAt: new Date().toISOString(),
    };
    const current = get().messages[key] ?? [];
    set({
      messages: { ...get().messages, [key]: [...current, userMsg] },
      loading: true, systemLines: [], activeRunId: null, activeEmployeeId: employeeId,
    });

    const replyId = `msg-${Date.now()}-reply`;
    const replyMsg: ChatMessage = { id: replyId, role: "assistant", content: "", createdAt: new Date().toISOString() };
    set({ messages: { ...get().messages, [key]: [...(get().messages[key] ?? []), replyMsg] } });

    try {
      const res = await fetch("/api/employee-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, message: content, threadId }),
      });

      if (!res.ok) {
        const data = await res.json();
        const msgs = get().messages[key] ?? [];
        set({
          messages: {
            ...get().messages,
            [key]: msgs.map((m) =>
              m.id === replyId ? { ...m, content: `Error: ${data.error || res.statusText}` } : m
            ),
          },
          loading: false,
        });
        return;
      }

      if (!res.body) {
        const msgs = get().messages[key] ?? [];
        set({
          messages: {
            ...get().messages,
            [key]: msgs.map((m) =>
              m.id === replyId ? { ...m, content: "Error: No stream" } : m
            ),
          },
          loading: false,
        });
        return;
      }

      await consumeSSE(res, get, set, employeeId, replyId, key);

    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      if (!isAbort) {
        const msgs = get().messages[key] ?? [];
        set({
          messages: {
            ...get().messages,
            [key]: msgs.map((m) =>
              m.id === replyId ? { ...m, content: `Error: ${err}` } : m
            ),
          },
        });
      }
    } finally {
      set({ loading: false, activeRunId: null, activeEmployeeId: null, systemLines: [] });
      // 完了後に履歴をリフレッシュ（DBに保存された正確なデータを取得）
      get().fetchMessages(employeeId);
    }
  },
}));
