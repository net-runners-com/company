"use client";

import { useEffect, useRef, useState } from "react";
import { useChatStore } from "@/stores/chat";
import { useI18n } from "@/lib/i18n";
import { EmployeeAvatar } from "@/components/employee-avatar";
import type { Employee } from "@/types";

export function ChatView({ employee }: { employee: Employee }) {
  const { messages, loading, fetchMessages, sendMessage } = useChatStore();
  const { t } = useI18n();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatMessages = messages[employee.id] ?? [];

  useEffect(() => {
    fetchMessages(employee.id);
  }, [employee.id, fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input;
    setInput("");
    await sendMessage(employee.id, text);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {chatMessages.length === 0 && (
          <div className="text-center text-[var(--color-subtext)] text-sm py-12">
            <EmployeeAvatar seed={employee.id} size="3rem" className="mx-auto mb-3" />
            <p>{t.employee.startConversation.replace("{name}", employee.name)}</p>
          </div>
        )}
        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-end gap-2 animate-fade-in ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {msg.role === "assistant" && (
              <EmployeeAvatar seed={employee.id} size="1.75rem" className="shrink-0" />
            )}
            <div
              className={`max-w-[75%] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-[var(--color-primary)] text-white rounded-2xl rounded-br-sm"
                  : "bg-white border border-[var(--color-border)] text-[var(--color-text)] rounded-2xl rounded-bl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-end gap-2">
            <div className="w-7 h-7 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center text-xs font-semibold text-[var(--color-primary)]">
              {employee.name.charAt(0)}
            </div>
            <div className="bg-white border border-[var(--color-border)] rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
              <span className="w-1.5 h-1.5 bg-[var(--color-subtext)] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-[var(--color-subtext)] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-[var(--color-subtext)] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[var(--color-border)] bg-white px-6 py-3">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={t.employee.messagePlaceholder.replace("{name}", employee.name)}
            className="flex-1 px-3.5 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-subtext)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-shadow"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-4 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t.common.send}
          </button>
        </div>
      </div>
    </div>
  );
}
