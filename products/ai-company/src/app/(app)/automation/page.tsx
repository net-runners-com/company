"use client";

import { useState, useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
}

export default function AutomationPage() {
  const { locale } = useI18n();
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendMessage = async () => {
    if (!chatInput.trim() || loading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { id: `${Date.now()}`, role: "user", content: userMsg, timestamp: new Date() }]);
    setLoading(true);

    const replyId = `${Date.now()}-r`;
    // Add empty agent message that we'll stream into
    setChatMessages((prev) => [...prev, { id: replyId, role: "agent", content: "", timestamp: new Date() }]);

    try {
      const res = await fetch("/api/playwright", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "chat-stream", message: userMsg }),
      });

      if (!res.ok) {
        const data = await res.json();
        setChatMessages((prev) =>
          prev.map((m) => (m.id === replyId ? { ...m, content: `Error: ${data.error || res.statusText}` } : m))
        );
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        setChatMessages((prev) =>
          prev.map((m) => (m.id === replyId ? { ...m, content: "Error: No stream" } : m))
        );
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
            if (parsed.error) {
              setChatMessages((prev) =>
                prev.map((m) => (m.id === replyId ? { ...m, content: m.content + `\nError: ${parsed.error}` } : m))
              );
            } else if (parsed.text) {
              setChatMessages((prev) =>
                prev.map((m) => (m.id === replyId ? { ...m, content: m.content + parsed.text } : m))
              );
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    } catch (err) {
      setChatMessages((prev) =>
        prev.map((m) => (m.id === replyId ? { ...m, content: `Error: ${err}` } : m))
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-8 py-8 animate-fade-in h-[calc(100vh-2rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">
            {locale === "ja" ? "自動化" : "Automation"}
          </h1>
          <p className="text-sm text-[var(--color-subtext)] mt-0.5">
            {locale === "ja"
              ? "自然言語でブラウザを操作 — リアルタイムプレビュー"
              : "Control the browser with natural language — live preview"}
          </p>
        </div>
        <a
          href="http://localhost:6080/vnc.html?autoconnect=true&resize=scale"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-2 border border-[var(--color-border)] text-[var(--color-subtext)] text-xs rounded-lg hover:bg-[var(--color-border-light)] transition-colors flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
          {locale === "ja" ? "VNC別窓" : "VNC Window"}
        </a>
      </div>

      {/* Two-column layout: VNC left, Chat right */}
      <div className="flex gap-4" style={{ height: "calc(100vh - 140px)" }}>
        {/* VNC Viewer */}
        <div className="flex-1 rounded-xl overflow-hidden border border-[var(--color-border)] bg-black min-w-0">
          <iframe
            src="http://localhost:6080/vnc.html?autoconnect=true&resize=scale&quality=6&compression=2"
            className="w-full h-full border-0"
            allow="clipboard-read; clipboard-write"
          />
        </div>

        {/* Chat Panel */}
        <div className="w-[380px] shrink-0 flex flex-col min-h-0">
          {/* Chat Messages */}
          <div className="flex-1 bg-white rounded-xl border border-[var(--color-border)] p-4 overflow-y-auto mb-3 min-h-0">
            {chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center mb-2">
                  <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                </div>
                <p className="text-xs text-[var(--color-subtext)]">
                  {locale === "ja"
                    ? "自然言語でブラウザ操作を指示"
                    : "Give browser instructions in natural language"}
                </p>
                <p className="text-[10px] text-[var(--color-subtext)] mt-1 opacity-50">
                  {locale === "ja"
                    ? '例: 「このページのフォームにテストと入力して」'
                    : 'e.g. "Fill in the form with test data"'}
                </p>
              </div>
            )}
            <div className="space-y-3">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[90%] rounded-xl px-3 py-2 ${
                    msg.role === "user"
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-bg-secondary)] text-[var(--color-text)] border border-[var(--color-border)]"
                  }`}>
                    <pre className="whitespace-pre-wrap text-xs font-sans break-words leading-relaxed">{msg.content}</pre>
                    <p className={`text-[9px] mt-0.5 ${msg.role === "user" ? "text-white/50" : "text-[var(--color-subtext)]"}`}>
                      {msg.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {loading && chatMessages[chatMessages.length - 1]?.content === "" && (
                <div className="flex justify-start">
                  <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl px-3 py-2">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-2.5">
            <div className="flex items-end gap-2">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={locale === "ja" ? "指示を入力..." : "Type instructions..."}
                rows={1}
                className="flex-1 px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                style={{ maxHeight: "80px" }}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !chatInput.trim()}
                className="p-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50 shrink-0"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
