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
  abortController: AbortController | null;

  fetchThreads: (employeeId: string) => Promise<void>;
  createThread: (employeeId: string) => Promise<void>;
  setActiveThread: (employeeId: string, threadId: string) => void;
  fetchMessages: (employeeId: string, threadId?: string) => Promise<void>;
  sendMessage: (employeeId: string, content: string) => Promise<void>;
  stopStream: () => void;
  respondPermission: (employeeId: string, action: "allow" | "allowPermanent" | "deny") => Promise<void>;
  registerEmployee: (employee: {
    id: string; name: string; role: string; department: string; tone: string; skills: string[]; systemPrompt?: string;
  }) => Promise<void>;
}

function msgKey(empId: string, threadId: string) {
  return `${empId}:${threadId}`;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: {},
  threads: {},
  activeThread: {},
  loading: false,
  systemLines: [],
  permissionRequest: null,
  abortController: null,

  stopStream: () => {
    const controller = get().abortController;
    if (controller) { controller.abort(); set({ abortController: null }); }
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

      // activeThread がなければ最初のスレッドをアクティブに
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

  setActiveThread: (employeeId, threadId) => {
    set({ activeThread: { ...get().activeThread, [employeeId]: threadId } });
    // メッセージがまだロードされていなければfetch
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

  sendMessage: async (employeeId, content) => {
    const threadId = get().activeThread[employeeId] || "default";
    const key = msgKey(employeeId, threadId);

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: "user", content, createdAt: new Date().toISOString(),
    };
    const controller = new AbortController();
    const current = get().messages[key] ?? [];
    set({
      messages: { ...get().messages, [key]: [...current, userMsg] },
      loading: true, systemLines: [], abortController: controller,
    });

    const replyId = `msg-${Date.now()}-reply`;
    const replyMsg: ChatMessage = { id: replyId, role: "assistant", content: "", createdAt: new Date().toISOString() };
    set({ messages: { ...get().messages, [key]: [...(get().messages[key] ?? []), replyMsg] } });

    try {
      const res = await fetch("/api/employee-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, message: content, threadId }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        const msgs = get().messages[key] ?? [];
        set({ messages: { ...get().messages, [key]: msgs.map((m) => m.id === replyId ? { ...m, content: `Error: ${data.error || res.statusText}` } : m) }, loading: false });
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) {
        const msgs = get().messages[key] ?? [];
        set({ messages: { ...get().messages, [key]: msgs.map((m) => m.id === replyId ? { ...m, content: "Error: No stream" } : m) }, loading: false });
        return;
      }

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.type === "permission_request") {
              set({
                permissionRequest: {
                  employeeId, toolName: parsed.toolName || "unknown",
                  toolInput: parsed.toolInput, toolUseId: parsed.toolUseId, patterns: parsed.patterns || [],
                },
              });
            } else if (parsed.type === "tool_use") {
              const toolLabel = parsed.toolName === "Bash"
                ? `$ ${(parsed.toolInput?.command || "").toString().slice(0, 60)}`
                : `${parsed.toolName}: ${JSON.stringify(parsed.toolInput || {}).slice(0, 60)}`;
              set({ systemLines: [...get().systemLines.slice(-1), toolLabel] });
            } else if (parsed.text) {
              const msgs = get().messages[key] ?? [];
              set({ messages: { ...get().messages, [key]: msgs.map((m) => m.id === replyId ? { ...m, content: m.content + parsed.text } : m) } });
            } else if (parsed.error) {
              const msgs = get().messages[key] ?? [];
              set({ messages: { ...get().messages, [key]: msgs.map((m) => m.id === replyId ? { ...m, content: m.content + `\nError: ${parsed.error}` } : m) } });
            }
          } catch {}
        }
      }
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      if (!isAbort) {
        const msgs = get().messages[key] ?? [];
        set({ messages: { ...get().messages, [key]: msgs.map((m) => m.id === replyId ? { ...m, content: `Error: ${err}` } : m) } });
      }
    } finally {
      const wasAborted = !get().abortController;
      set({ abortController: null, systemLines: [] });
      if (wasAborted) {
        const finalMsgs = get().messages[key] ?? [];
        set({
          messages: { ...get().messages, [key]: finalMsgs.map((m) => {
            if (m.id !== replyId) return m;
            const text = m.content.trim();
            return { ...m, content: text ? text + "\n\n*--- 中断されました ---*" : "*--- 中断されました ---*" };
          }) },
        });
      }
      set({ loading: false });
    }
  },
}));
