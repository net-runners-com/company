import { create } from "zustand";
import type { ChatMessage } from "@/types";
import * as api from "@/lib/api";

interface ChatStore {
  messages: Record<string, ChatMessage[]>;
  loading: boolean;
  fetchMessages: (employeeId: string) => Promise<void>;
  sendMessage: (employeeId: string, content: string) => Promise<void>;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: {},
  loading: false,
  fetchMessages: async (employeeId) => {
    set({ loading: true });
    const msgs = await api.getChatMessages(employeeId);
    set({
      messages: { ...get().messages, [employeeId]: msgs },
      loading: false,
    });
  },
  sendMessage: async (employeeId, content) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    const current = get().messages[employeeId] ?? [];
    set({ messages: { ...get().messages, [employeeId]: [...current, userMsg] } });

    const reply = await api.sendChatMessage(employeeId, content);
    const updated = get().messages[employeeId] ?? [];
    set({ messages: { ...get().messages, [employeeId]: [...updated, reply] } });
  },
}));
