"use client";

import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Skeleton } from "@/components/skeleton";

interface FileItem {
  name: string;
  path: string;
  isDir: boolean;
  size: number | null;
}

function OfficePreview({ employeeId, path }: { employeeId: string; path: string }) {
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/employee-files?employeeId=${employeeId}&action=presign&path=${encodeURIComponent(path)}`)
      .then(r => r.json())
      .then(d => { if (d.url) setViewUrl(`https://docs.google.com/gview?url=${encodeURIComponent(d.url)}&embedded=true`); })
      .catch(() => {});
  }, [employeeId, path]);
  if (!viewUrl) return <div className="p-8 text-center text-sm text-[var(--color-subtext)]">読み込み中...</div>;
  return <iframe src={viewUrl} className="w-full flex-1 min-h-[70vh] border-0" />;
}

export function FileBrowser({ employeeId }: { employeeId: string }) {
  const [currentPath, setCurrentPath] = useState("");
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFile, setEditingFile] = useState<{ path: string; name: string; content: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const fetchFiles = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/employee-files?employeeId=${employeeId}&action=list&path=${encodeURIComponent(path)}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }, [employeeId]);

  useEffect(() => {
    fetchFiles(currentPath);
  }, [currentPath, fetchFiles]);

  const openFile = async (path: string) => {
    const ext = path.split(".").pop()?.toLowerCase() || "";
    const isBinary = ["pdf", "png", "jpg", "jpeg", "gif", "webp", "svg", "pptx", "docx", "xlsx", "zip"].includes(ext);

    if (isBinary) {
      // PDF/画像はプレビューモードで開く
      const name = path.split("/").pop() || "file";
      setEditingFile({ path, name, content: "__binary__" });
      setEditMode(false);
      return;
    }

    try {
      const res = await fetch(`/api/employee-files?employeeId=${employeeId}&action=read&path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (data.error) return;
      setEditingFile({ path, name: data.name, content: data.content });
      setEditMode(false);
    } catch {}
  };

  const saveFile = async () => {
    if (!editingFile) return;
    setSaving(true);
    try {
      await fetch("/api/employee-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, _action: "writeFile", path: editingFile.path, content: editingFile.content }),
      });
    } catch {}
    setSaving(false);
  };

  const breadcrumbs = currentPath ? currentPath.split("/").filter(Boolean) : [];
  const isMarkdown = editingFile?.name.endsWith(".md") || editingFile?.name.endsWith(".mdx");
  const fileExt = editingFile?.name.split(".").pop()?.toLowerCase() || "";
  const isPdf = fileExt === "pdf";
  const isImage = ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(fileExt);
  const isOffice = ["pptx", "docx", "xlsx"].includes(fileExt);
  const isBinaryFile = editingFile?.content === "__binary__";
  const serveUrl = editingFile ? `/api/employee-files?employeeId=${employeeId}&action=serve&path=${encodeURIComponent(editingFile.path)}` : "";

  // File viewing/editing mode
  if (editingFile) {
    return (
      <div className="flex flex-col min-h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)] bg-white shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <button onClick={() => { setEditingFile(null); setEditMode(false); }} className="text-[var(--color-primary)] hover:underline">
              &larr; Back
            </button>
            <span className="text-[var(--color-subtext)]">/</span>
            <span className="font-medium text-[var(--color-text)]">{editingFile.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {isBinaryFile && (
              <a href={serveUrl} target="_blank" rel="noopener noreferrer"
                className="px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-light)] transition-colors">
                {isPdf ? "新しいタブで開く" : "ダウンロード"}
              </a>
            )}
            {!isBinaryFile && isMarkdown && (
              <button
                onClick={() => setEditMode(!editMode)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  editMode
                    ? "bg-[var(--color-border-light)] text-[var(--color-text)]"
                    : "bg-[var(--color-primary-light)] text-[var(--color-primary)]"
                }`}
              >
                {editMode ? "Preview" : "Edit"}
              </button>
            )}
            {!isBinaryFile && editMode && (
              <button
                onClick={saveFile}
                disabled={saving}
                className="px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {/* PDF */}
        {isBinaryFile && isPdf ? (
          <iframe src={serveUrl} className="w-full flex-1 min-h-[70vh] border-0" />
        ) : isBinaryFile && isOffice ? (
          <OfficePreview employeeId={employeeId} path={editingFile.path} />
        ) : isBinaryFile && isImage ? (
          <div className="p-6 flex items-center justify-center">
            <img src={serveUrl} alt={editingFile.name} className="max-w-full max-h-[65vh] rounded-lg" />
          </div>
        ) : isBinaryFile ? (
          <div className="p-12 text-center text-sm text-[var(--color-subtext)]">
            このファイル形式はプレビューできません。ダウンロードしてください。
          </div>
        ) : editMode || !isMarkdown ? (
          <pre className="w-full px-6 py-4 font-mono text-sm text-[var(--color-text)] bg-[var(--color-bg)] whitespace-pre-wrap break-words min-h-[60vh]">
            {editMode ? (
              <textarea
                value={editingFile.content}
                onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })}
                className="w-full h-full min-h-[60vh] font-mono text-sm text-[var(--color-text)] bg-transparent border-0 focus:outline-none resize-none"
                spellCheck={false}
              />
            ) : (
              editingFile.content
            )}
          </pre>
        ) : (
          <div className="px-6 py-4">
            <article className="prose prose-sm max-w-none prose-headings:text-[var(--color-text)] prose-p:text-[var(--color-text)] prose-a:text-[var(--color-primary)] prose-strong:text-[var(--color-text)] prose-code:text-[var(--color-primary)] prose-code:bg-[var(--color-primary-light)] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-[#f8f9fa] prose-pre:text-[var(--color-text)] prose-pre:border prose-pre:border-[var(--color-border)]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {editingFile.content}
              </ReactMarkdown>
            </article>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 px-4 py-2.5 border-b border-[var(--color-border)] bg-white text-xs shrink-0">
        <button onClick={() => setCurrentPath("")} className="text-[var(--color-primary)] hover:underline font-medium">
          root
        </button>
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="text-[var(--color-subtext)]">/</span>
            <button
              onClick={() => setCurrentPath(breadcrumbs.slice(0, i + 1).join("/"))}
              className="text-[var(--color-primary)] hover:underline"
            >
              {crumb}
            </button>
          </span>
        ))}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-[var(--color-subtext)]">
            No files
          </div>
        ) : (
          <div>
            {currentPath && (
              <button
                onClick={() => setCurrentPath(currentPath.split("/").slice(0, -1).join("/"))}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-subtext)] hover:bg-[var(--color-bg)] transition-colors border-b border-[var(--color-border)]"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                </svg>
                ..
              </button>
            )}
            {items.map((item) => (
              <button
                key={item.path}
                onClick={() => item.isDir ? setCurrentPath(item.path) : openFile(item.path)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-[var(--color-bg)] transition-colors border-b border-[var(--color-border)]"
              >
                {item.isDir ? (
                  <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-[var(--color-subtext)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                )}
                <span className={`flex-1 ${item.isDir ? "font-medium text-[var(--color-text)]" : "text-[var(--color-text)]"}`}>
                  {item.name}
                </span>
                {item.size !== null && (
                  <span className="text-xs text-[var(--color-subtext)]">
                    {item.size < 1024 ? `${item.size}B` : `${(item.size / 1024).toFixed(1)}KB`}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
