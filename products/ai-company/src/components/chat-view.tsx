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
  const { messages, loading, systemLines, fetchMessages, sendMessage, stopStream, reconnectIfActive, registerEmployee, permissionRequest, respondPermission, threads, activeThread, fetchThreads, createThread, deleteThread, setActiveThread } = useChatStore();
  const { t, locale } = useI18n();
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<{ file: File; preview: string }[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; path: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showPromptPicker, setShowPromptPicker] = useState(false);
  const [prompts, setPrompts] = useState<{ _id: string; name: string; content: string; category?: string }[]>([]);
  const [attachedPrompts, setAttachedPrompts] = useState<{ name: string; content: string }[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
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

  // ページ復帰時: バックグラウンドで実行中のrunがあれば再接続
  useEffect(() => {
    reconnectIfActive(employee.id);
  }, [employee.id, reconnectIfActive]);

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

  // プラスメニュー外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) setShowPlusMenu(false);
    };
    if (showPlusMenu) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPlusMenu]);

  // ファイルをローカルにステージ（プレビュー付き）
  const stageFiles = (files: FileList | File[]) => {
    const newStaged = Array.from(files).map((file) => ({
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
    }));
    setStagedFiles((prev) => [...prev, ...newStaged]);
  };

  // ドラッグ&ドロップ
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) stageFiles(e.dataTransfer.files);
  };

  // ステージ済みファイルをアップロード
  const uploadStagedFiles = async (): Promise<{ name: string; path: string }[]> => {
    const uploaded: { name: string; path: string }[] = [];
    for (const { file } of stagedFiles) {
      const formData = new FormData();
      formData.append("employeeId", employee.id);
      formData.append("file", file);
      try {
        const res = await fetch("/api/employee-upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.fullPath) uploaded.push({ name: data.filename, path: data.fullPath });
      } catch {}
    }
    return uploaded;
  };

  // プロンプト一覧取得
  const fetchPrompts = () => {
    fetch("/api/data/prompts?limit=100")
      .then((r) => r.json())
      .then((d) => setPrompts(d.entries || []))
      .catch(() => {});
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) stageFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSend = async () => {
    if (!input.trim() && stagedFiles.length === 0 && attachedFiles.length === 0 && attachedPrompts.length === 0) return;
    let text = input;

    // プロンプトが添付されていたら先頭に追加
    if (attachedPrompts.length > 0) {
      const promptText = attachedPrompts.map((p) => p.content).join("\n\n");
      text = text ? `${promptText}\n\n${text}` : promptText;
      setAttachedPrompts([]);
    }

    // ステージ済みファイルをアップロード
    if (stagedFiles.length > 0) {
      setUploading(true);
      const uploaded = await uploadStagedFiles();
      const allFiles = [...attachedFiles, ...uploaded];
      if (allFiles.length > 0) {
        const fileRefs = allFiles.map((f) => `[添付ファイル: ${f.path}]`).join("\n");
        text = text ? `${text}\n\n${fileRefs}` : fileRefs;
      }
      // プレビューURL解放
      stagedFiles.forEach((s) => { if (s.preview) URL.revokeObjectURL(s.preview); });
      setStagedFiles([]);
      setAttachedFiles([]);
      setUploading(false);
    } else if (attachedFiles.length > 0) {
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
            <div
              key={thread.id}
              className={`group flex items-center rounded-lg transition-colors ${
                currentThreadId === thread.id
                  ? "bg-[var(--color-primary-light)] text-[var(--color-primary)] font-medium"
                  : "text-[var(--color-text)] hover:bg-[var(--color-border-light)]"
              }`}
            >
              <button
                onClick={() => { setActiveThread(employee.id, thread.id); fetchMessages(employee.id, thread.id); }}
                className="flex-1 text-left px-3 py-2 text-sm truncate min-w-0"
              >
                {thread.title}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: thread.id, title: thread.title }); }}
                className="shrink-0 p-1 mr-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-500 transition-all"
                title={locale === "ja" ? "削除" : "Delete"}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-xl shadow-xl p-5 w-80" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold text-[var(--color-text)] mb-1">
              {locale === "ja" ? "チャットを削除" : "Delete chat"}
            </p>
            <p className="text-xs text-[var(--color-subtext)] mb-4">
              {locale === "ja"
                ? `「${deleteConfirm.title}」を削除しますか？この操作は取り消せません。`
                : `Delete "${deleteConfirm.title}"? This cannot be undone.`}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-light)] transition-colors"
              >
                {locale === "ja" ? "キャンセル" : "Cancel"}
              </button>
              <button
                onClick={() => { deleteThread(employee.id, deleteConfirm.id); setDeleteConfirm(null); }}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                {locale === "ja" ? "削除" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
      {/* Messages */}
      <div
        className={`flex-1 overflow-y-auto px-6 py-4 space-y-3 relative ${dragOver ? "bg-[var(--color-primary-light)]" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {dragOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-primary-light)]/80 z-10 pointer-events-none border-2 border-dashed border-[var(--color-primary)] rounded-lg">
            <p className="text-sm font-medium text-[var(--color-primary)]">
              {locale === "ja" ? "ファイルをドロップして添付" : "Drop files to attach"}
            </p>
          </div>
        )}
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
                className={`max-w-[75%] px-3.5 py-2.5 text-sm leading-relaxed overflow-hidden break-words ${
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
                    {(displayed) => {
                      // [choices]...[/choices] ブロックを分離
                      const choicesRegex = /\[choices(?::([^\]]*))?\]\n?([\s\S]*?)\[\/choices\]/g;
                      const parts: { type: "text" | "choices"; content: string; question?: string; options?: string[] }[] = [];
                      let lastIndex = 0;
                      let match;
                      while ((match = choicesRegex.exec(displayed)) !== null) {
                        if (match.index > lastIndex) {
                          parts.push({ type: "text", content: displayed.slice(lastIndex, match.index) });
                        }
                        const question = match[1]?.trim() || "";
                        const options = match[2].trim().split("\n").map(l => l.replace(/^\d+[\.\)]\s*/, "").trim()).filter(Boolean);
                        parts.push({ type: "choices", content: "", question, options });
                        lastIndex = match.index + match[0].length;
                      }
                      if (lastIndex < displayed.length) {
                        parts.push({ type: "text", content: displayed.slice(lastIndex) });
                      }
                      if (parts.length === 0) parts.push({ type: "text", content: displayed });

                      const proseClass = "prose prose-sm max-w-none overflow-hidden break-words prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-table:my-2 prose-pre:my-2 prose-pre:overflow-x-auto prose-code:text-[var(--color-primary)] prose-code:bg-[var(--color-primary-light)] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:break-all prose-pre:bg-[#1a1a2e] prose-pre:text-green-300 prose-pre:text-xs [&_pre_code]:text-inherit [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:rounded-none [&_pre_code]:break-normal prose-a:text-[var(--color-primary)] prose-blockquote:text-gray-400 prose-blockquote:border-gray-200 prose-blockquote:font-normal prose-blockquote:text-xs prose-blockquote:not-italic prose-blockquote:my-1";

                      return (<>
                      {parts.map((part, pi) => part.type === "choices" ? (
                        <div key={pi} className="my-2 rounded-lg border border-[var(--color-border)] overflow-hidden">
                          {part.question && (
                            <div className="px-4 py-2.5 bg-[var(--color-border-light)] text-sm font-medium text-[var(--color-text)]">
                              {part.question}
                            </div>
                          )}
                          {part.options?.map((opt, oi) => (
                            <button
                              key={oi}
                              onClick={() => { sendMessage(employee.id, opt); }}
                              className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-[var(--color-text)] border-t border-[var(--color-border)] hover:bg-[var(--color-primary-light)] transition-colors"
                            >
                              <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--color-border-light)] flex items-center justify-center text-xs font-medium text-[var(--color-subtext)]">{oi + 1}</span>
                              {opt}
                            </button>
                          ))}
                        </div>
                      ) : (
                      <div key={pi} className={proseClass}>
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
                            pre: ({ children, ...props }) => (
                              <pre {...props} className="bg-[#1e1e1e] text-gray-100 text-xs my-2 p-3 rounded-lg overflow-x-auto [&_code]:text-inherit [&_code]:bg-transparent [&_code]:p-0 [&_code]:rounded-none [&_code]:text-xs">
                                {children}
                              </pre>
                            ),
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
                        >{part.content}</ReactMarkdown>
                      </div>
                      ))}
                      {isCurrentlyStreaming && (
                        <span className="inline-block w-0.5 h-4 bg-[var(--color-primary)] ml-0.5 animate-pulse" />
                      )}
                      </>);
                    }}
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
      <div className="bg-white px-6 py-3">
        <div className="max-w-3xl mx-auto border border-[var(--color-border)] rounded-xl bg-[var(--color-bg)] focus-within:ring-2 focus-within:ring-[var(--color-primary)] focus-within:border-transparent transition-shadow">
          {/* Staged files preview */}
          {stagedFiles.length > 0 && (
            <div className="flex gap-2 p-3 pb-0 flex-wrap">
              {stagedFiles.map((s, i) => (
                <div key={i} className="relative">
                  {s.preview ? (
                    <img src={s.preview} alt={s.file.name} className="w-20 h-20 object-cover rounded-lg border border-[var(--color-border)]" />
                  ) : (
                    <div className="w-20 h-20 rounded-lg border border-[var(--color-border)] bg-white flex flex-col items-center justify-center gap-1">
                      <svg className="w-5 h-5 text-[var(--color-subtext)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <span className="text-[9px] text-[var(--color-subtext)] truncate max-w-[70px] px-1">{s.file.name}</span>
                    </div>
                  )}
                  <button
                    onClick={() => { if (s.preview) URL.revokeObjectURL(s.preview); setStagedFiles((prev) => prev.filter((_, j) => j !== i)); }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-[var(--color-border)] text-[var(--color-subtext)] hover:text-[var(--color-danger)] hover:border-[var(--color-danger)] rounded-full flex items-center justify-center shadow-sm transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Text input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && !isComposing && !loading && handleSend()}
            disabled={loading}
            placeholder={loading
              ? (locale === "ja" ? "応答中..." : "Responding...")
              : t.employee.messagePlaceholder.replace("{name}", employee.name)}
            className="w-full px-4 py-3 bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-subtext)] focus:outline-none disabled:opacity-60"
          />
          {/* Bottom bar: + menu, prompt badges, send */}
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
            <div className="relative" ref={plusMenuRef}>
              <button
                onClick={() => setShowPlusMenu(!showPlusMenu)}
                disabled={loading || uploading}
                className="p-2 text-[var(--color-subtext)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] rounded-lg transition-colors disabled:opacity-40"
              >
                {uploading ? (
                  <span className="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin inline-block" />
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                )}
              </button>
              {showPlusMenu && (
                <div className="absolute bottom-full left-0 mb-2 w-52 bg-white rounded-xl border border-[var(--color-border)] shadow-lg py-1 z-50">
                  <button
                    onClick={() => { fileInputRef.current?.click(); setShowPlusMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-border-light)] transition-colors"
                  >
                    <svg className="w-4 h-4 text-[var(--color-subtext)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                    </svg>
                    {locale === "ja" ? "ファイルを追加" : "Add file"}
                  </button>
                  <button
                    onClick={() => { fetchPrompts(); setShowPromptPicker(true); setShowPlusMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-border-light)] transition-colors"
                  >
                    <svg className="w-4 h-4 text-[var(--color-subtext)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    {locale === "ja" ? "プロンプトを追加" : "Add prompt"}
                  </button>
                </div>
              )}
            </div>
            {/* Prompt badges */}
            {attachedPrompts.map((p, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--color-primary-light)] text-[var(--color-primary)] rounded-full text-xs max-w-[150px]">
                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <span className="truncate">{p.name}</span>
                <button onClick={() => setAttachedPrompts((prev) => prev.filter((_, j) => j !== i))} className="shrink-0 hover:text-[var(--color-danger)]">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
            </div>
            {loading ? (
              <button
                onClick={stopStream}
                className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                {locale === "ja" ? "停止" : "Stop"}
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() && stagedFiles.length === 0 && attachedPrompts.length === 0}
                className="p-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                </svg>
              </button>
            )}
          </div>
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
      {/* Prompt Picker Modal */}
      {showPromptPicker && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={() => setShowPromptPicker(false)}>
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg mx-4 max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] shrink-0">
              <h3 className="font-semibold text-[var(--color-text)]">{locale === "ja" ? "プロンプトを選択" : "Select Prompt"}</h3>
              <button onClick={() => setShowPromptPicker(false)} className="p-1 text-[var(--color-subtext)] hover:text-[var(--color-text)]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-3 space-y-2">
              {prompts.length === 0 ? (
                <p className="text-sm text-[var(--color-subtext)] text-center py-8">
                  {locale === "ja" ? "プロンプトがありません。プロンプトページから作成してください。" : "No prompts. Create one from the Prompts page."}
                </p>
              ) : prompts.map((p) => (
                <button
                  key={p._id}
                  onClick={() => {
                    setAttachedPrompts((prev) => [...prev, { name: p.name, content: p.content }]);
                    setShowPromptPicker(false);
                  }}
                  className="w-full text-left p-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-[var(--color-text)]">{p.name}</span>
                    {p.category && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-border-light)] text-[var(--color-subtext)] rounded-full">{p.category}</span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-subtext)] mt-1 line-clamp-2">{p.content}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>{/* /Chat Area */}
    </div>
  );
}
