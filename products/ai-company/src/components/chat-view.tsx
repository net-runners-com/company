"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChatStore } from "@/stores/chat";
import { useI18n } from "@/lib/i18n";
import { EmployeeAvatar } from "@/components/employee-avatar";
import { PermissionPanel } from "@/components/permission-panel";
import { StreamingText } from "@/components/streaming-text";
import { FilePreviewModal } from "@/components/file-preview-modal";
import type { Employee } from "@/types";

export function ChatView({ employee }: { employee: Employee }) {
  const { messages, loading, systemLines, fetchMessages, sendMessage, stopStream, registerEmployee, permissionRequest, respondPermission, threads, activeThread, fetchThreads, createThread, setActiveThread } = useChatStore();
  const { t, locale } = useI18n();
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; path: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showThreads, setShowThreads] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const empThreads = threads[employee.id] || [];
  const currentThreadId = activeThread[employee.id] || "default";
  const chatMessages = messages[`${employee.id}:${currentThreadId}`] ?? [];
  const [showReloadBanner, setShowReloadBanner] = useState(false);
  const prevLoadingRef = useRef(loading);

  useEffect(() => {
    fetchThreads(employee.id);
    fetchMessages(employee.id);
    registerEmployee({
      id: employee.id,
      name: employee.name,
      role: employee.role,
      department: employee.department,
      tone: employee.tone,
      skills: employee.skills,
    });
  }, [employee, fetchMessages, registerEmployee]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ストリーム完了時にカスタムページの作成/削除/修正を検知
  useEffect(() => {
    if (prevLoadingRef.current && !loading && chatMessages.length > 0) {
      const last = chatMessages[chatMessages.length - 1];
      if (last?.role === "assistant" && /ページ.*作成|ページ.*生成|ページ.*削除|ページ.*修正|ページ.*更新|page.*creat|page.*delet|page.*updat/i.test(last.content)) {
        setShowReloadBanner(true);
      }
    }
    prevLoadingRef.current = loading;
  }, [loading, chatMessages]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("employeeId", employee.id);
      formData.append("file", file);
      try {
        const res = await fetch("/api/employee-upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.fullPath) {
          setAttachedFiles((prev) => [...prev, { name: data.filename, path: data.fullPath }]);
        }
      } catch {}
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSend = async () => {
    if (!input.trim() && attachedFiles.length === 0) return;
    // ファイルが添付されてたらメッセージに追加
    let text = input;
    if (attachedFiles.length > 0) {
      const fileRefs = attachedFiles.map((f) => `[添付ファイル: ${f.path}]`).join("\n");
      text = text ? `${text}\n\n${fileRefs}` : fileRefs;
      setAttachedFiles([]);
    }
    setInput("");
    await sendMessage(employee.id, text);
  };

  return (
    <div className="flex h-full">
      {/* Thread Sidebar */}
      <div className="w-56 shrink-0 border-r border-[var(--color-border)] bg-white flex flex-col">
        <div className="p-3">
          <button
            onClick={() => createThread(employee.id)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-border-light)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {locale === "ja" ? "新規チャット" : "New Chat"}
          </button>
        </div>
        <div className="px-3 mb-1">
          <p className="text-[10px] font-medium text-[var(--color-subtext)] uppercase tracking-wider">
            {locale === "ja" ? "チャット履歴" : "History"}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {empThreads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => { setActiveThread(employee.id, thread.id); fetchMessages(employee.id, thread.id); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${
                currentThreadId === thread.id
                  ? "bg-[var(--color-primary-light)] text-[var(--color-primary)] font-medium"
                  : "text-[var(--color-text)] hover:bg-[var(--color-border-light)]"
              }`}
            >
              {thread.title}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {chatMessages.length === 0 && (
          <div className="text-center text-[var(--color-subtext)] text-sm py-12">
            <EmployeeAvatar seed={employee.id} size="3rem" className="mx-auto mb-3" config={employee.avatarConfig as Record<string, string> | undefined} />
            <p>{t.employee.startConversation.replace("{name}", employee.name)}</p>
          </div>
        )}
        {chatMessages.filter((msg) => msg.content || msg.role === "user").map((msg, _i, filtered) => {
          const isLastAssistant = msg.role === "assistant" && msg === filtered[filtered.length - 1];
          const isCurrentlyStreaming = isLastAssistant && loading;

          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2 animate-fade-in ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <EmployeeAvatar seed={employee.id} size="1.75rem" className="shrink-0" config={employee.avatarConfig as Record<string, string> | undefined} />
              )}
              <div
                className={`max-w-[75%] px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[var(--color-primary)] text-white rounded-2xl rounded-br-sm"
                    : "bg-white border border-[var(--color-border)] text-[var(--color-text)] rounded-2xl rounded-bl-sm"
                }`}
              >
                {/* Render attached files inline */}
                {(() => {
                  const attachRegex = /\[添付ファイル: ([^\]]+)\]/g;
                  const matches = [...msg.content.matchAll(attachRegex)];
                  if (matches.length > 0) {
                    const textWithout = msg.content.replace(attachRegex, "").trim();
                    const isImage = (p: string) => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(p);
                    // Extract relative path from fullPath for API
                    const toRelPath = (fullPath: string) => {
                      const m = fullPath.match(/uploads\/.+$/);
                      return m ? m[0] : fullPath;
                    };
                    return (
                      <div>
                        {textWithout && <p className="whitespace-pre-wrap mb-2">{textWithout}</p>}
                        <div className="space-y-2">
                          {matches.map((m, i) => {
                            const fullPath = m[1];
                            const fileName = fullPath.split("/").pop() || "file";
                            const relPath = toRelPath(fullPath);
                            if (isImage(fullPath)) {
                              return (
                                <img
                                  key={i}
                                  src={`/api/employee-files?employeeId=${employee.id}&action=serve&path=${encodeURIComponent(relPath)}`}
                                  alt={fileName}
                                  className="rounded-lg max-h-48 cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => setPreviewFile(fullPath)}
                                />
                              );
                            }
                            return (
                              <button
                                key={i}
                                onClick={() => setPreviewFile(fullPath)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                                  msg.role === "user"
                                    ? "bg-white/20 hover:bg-white/30"
                                    : "bg-[var(--color-bg)] hover:bg-[var(--color-border-light)]"
                                } transition-colors`}
                              >
                                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                                </svg>
                                <span className="truncate max-w-[200px]">{fileName.replace(/^\d{14}_/, "")}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
                {/* Normal text rendering */}
                {!msg.content.includes("[添付ファイル:") && msg.role === "user" && (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                )}
                {!msg.content.includes("[添付ファイル:") && msg.role === "assistant" ? (
                  <StreamingText content={msg.content} isStreaming={isCurrentlyStreaming}>
                    {(displayed) => (
                      <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-table:my-2 prose-pre:my-2 prose-code:text-[var(--color-primary)] prose-code:bg-[var(--color-primary-light)] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-[#1a1a2e] prose-pre:text-green-300 prose-pre:text-xs prose-a:text-[var(--color-primary)] prose-blockquote:text-gray-400 prose-blockquote:border-gray-200 prose-blockquote:font-normal prose-blockquote:text-xs prose-blockquote:not-italic prose-blockquote:my-1">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            // テキスト内の /workspace/... パスをクリッカブルに
                            p: ({ children, ...props }) => {
                              const processChildren = (child: React.ReactNode): React.ReactNode => {
                                if (typeof child !== "string") return child;
                                // /workspace/パス OR ファイル名.拡張子 を検出
                                const parts = child.split(/(\/workspace\/[^\s,。、）\)]+|(?:^|\s)([\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\-_]+\.(?:md|txt|json|csv|py|js|ts|html|pdf|xlsx|yaml|yml)))/g);
                                if (parts.length === 1) return child;
                                return parts.filter(Boolean).map((part, i) => {
                                  const trimmed = part.trim();
                                  if (trimmed.startsWith("/workspace/") || /^[\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\-_]+\.\w+$/.test(trimmed)) {
                                    return (
                                      <button
                                        key={i}
                                        onClick={() => setPreviewFile(trimmed)}
                                        className="text-[var(--color-primary)] hover:underline cursor-pointer font-mono text-xs bg-[var(--color-primary-light)] px-1 py-0.5 rounded mx-0.5"
                                      >
                                        {trimmed.split("/").pop()}
                                      </button>
                                    );
                                  }
                                  return part;
                                });
                              };
                              return (
                                <p {...props}>
                                  {Array.isArray(children)
                                    ? children.map((c, i) => <span key={i}>{processChildren(c)}</span>)
                                    : processChildren(children)}
                                </p>
                              );
                            },
                            code: ({ children, className, ...props }) => {
                              const text = String(children).trim();
                              const isFilePath = text.startsWith("/workspace/") || /^[\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\-_]+\.\w{1,5}$/.test(text);
                              if (isFilePath && !className) {
                                return (
                                  <button
                                    onClick={() => setPreviewFile(text)}
                                    className="text-[var(--color-primary)] hover:underline cursor-pointer font-mono text-xs bg-[var(--color-primary-light)] px-1 py-0.5 rounded"
                                  >
                                    {text.split("/").pop()}
                                  </button>
                                );
                              }
                              return <code className={className} {...props}>{children}</code>;
                            },
                          }}
                        >{displayed}</ReactMarkdown>
                        {isCurrentlyStreaming && (
                          <span className="inline-block w-0.5 h-4 bg-[var(--color-primary)] ml-0.5 animate-pulse" />
                        )}
                      </div>
                    )}
                  </StreamingText>
                ) : null}
              </div>
            </div>
          );
        })}
        {loading && (chatMessages.length === 0 || chatMessages[chatMessages.length - 1]?.content === "") && (
          <div className="flex items-end gap-2">
            <EmployeeAvatar seed={employee.id} size="1.75rem" className="shrink-0" config={employee.avatarConfig as Record<string, string> | undefined} />
            <div className="bg-white border border-[var(--color-border)] rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
              <span className="w-1.5 h-1.5 bg-[var(--color-subtext)] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-[var(--color-subtext)] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-[var(--color-subtext)] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* System Lines (ツール実行状況) */}
      {systemLines.length > 0 && loading && (
        <div className="px-6 py-1.5 bg-[var(--color-bg)] border-t border-[var(--color-border)]">
          {systemLines.map((line, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-400 py-0.5">
              <span className="w-1 h-1 rounded-full bg-gray-300 animate-pulse shrink-0" />
              <span className="truncate font-mono">{line}</span>
            </div>
          ))}
        </div>
      )}

      {/* Permission Panel */}
      {permissionRequest && permissionRequest.employeeId === employee.id && (
        <div className="px-6 py-2">
          <PermissionPanel
            toolName={permissionRequest.toolName}
            toolInput={permissionRequest.toolInput}
            onAllow={() => respondPermission(employee.id, "allow")}
            onAllowPermanent={() => respondPermission(employee.id, "allowPermanent")}
            onDeny={() => respondPermission(employee.id, "deny")}
          />
        </div>
      )}

      {/* Reload Banner */}
      {showReloadBanner && (
        <div className="px-6 py-2 bg-[var(--color-primary-light)] border-t border-[var(--color-primary)] flex items-center justify-between">
          <span className="text-sm text-[var(--color-primary)] font-medium">
            {locale === "ja" ? "新しいページが作成されました。リロードするとサイドバーに表示されます。" : "A new page was created. Reload to see it in the sidebar."}
          </span>
          <button
            onClick={() => { window.location.reload(); }}
            className="px-3 py-1 text-xs font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            {locale === "ja" ? "リロード" : "Reload"}
          </button>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-[var(--color-border)] bg-white px-6 py-3">
        {/* Attached files preview */}
        {attachedFiles.length > 0 && (
          <div className="flex gap-2 mb-2 max-w-3xl mx-auto flex-wrap">
            {attachedFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--color-primary-light)] text-[var(--color-primary)] rounded-full text-xs">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
                <span className="max-w-[120px] truncate">{f.name}</span>
                <button onClick={() => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))} className="hover:text-red-500">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 max-w-3xl mx-auto">
          {/* File upload button */}
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || uploading}
            className="p-2.5 text-[var(--color-subtext)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] rounded-lg transition-colors disabled:opacity-40"
            title={locale === "ja" ? "ファイルを添付" : "Attach file"}
          >
            {uploading ? (
              <span className="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin inline-block" />
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            )}
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && !loading && handleSend()}
            disabled={loading}
            placeholder={loading
              ? (locale === "ja" ? "応答中..." : "Responding...")
              : t.employee.messagePlaceholder.replace("{name}", employee.name)}
            className="flex-1 px-3.5 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-subtext)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-shadow disabled:opacity-60"
          />
          {loading ? (
            <button
              onClick={stopStream}
              className="px-4 py-2.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              {locale === "ja" ? "停止" : "Stop"}
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="px-4 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t.common.send}
            </button>
          )}
        </div>
      </div>

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          employeeId={employee.id}
          filePath={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
      </div>{/* /Chat Area */}
    </div>
  );
}
