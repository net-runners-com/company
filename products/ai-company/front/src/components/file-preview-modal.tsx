"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface FilePreviewModalProps {
  employeeId: string;
  filePath: string;
  onClose: () => void;
}

export function FilePreviewModal({ employeeId, filePath, onClose }: FilePreviewModalProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const relativePath = (() => {
    const uploadsMatch = filePath.match(/uploads\/.+$/);
    if (uploadsMatch) return uploadsMatch[0];
    const wsMatch = filePath.match(/\/workspace\/company\/(?:[^/]+\/){2,}(.+)$/);
    if (wsMatch) return wsMatch[1];
    return filePath.replace(/^\/+/, "");
  })();

  const fileName = filePath.split("/").pop() || "file";
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const isPdf = ext === "pdf";
  const isImage = ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext);
  const isMarkdown = ext === "md" || ext === "mdx";
  const isOffice = ["pptx", "docx", "xlsx"].includes(ext);

  const serveUrl = `/api/employee-files?employeeId=${employeeId}&action=serve&path=${encodeURIComponent(relativePath)}`;

  const [officeViewUrl, setOfficeViewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOffice) {
      // presigned URL を取得して Google Docs Viewer で表示
      fetch(`/api/employee-files?employeeId=${employeeId}&action=presign&path=${encodeURIComponent(relativePath)}`)
        .then(r => r.json())
        .then(d => {
          if (d.url) setOfficeViewUrl(`https://docs.google.com/gview?url=${encodeURIComponent(d.url)}&embedded=true`);
          else setError("Presigned URL failed");
        })
        .catch(() => setError("Failed to get preview URL"))
        .finally(() => setLoading(false));
      return;
    }
    if (isPdf || isImage) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/employee-files?employeeId=${employeeId}&action=read&path=${encodeURIComponent(relativePath)}`
        );
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          setContent(data.content);
        }
      } catch {
        setError("Failed to load file");
      }
      setLoading(false);
    })();
  }, [employeeId, relativePath, isPdf, isImage]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className={`relative bg-white rounded-2xl shadow-2xl w-full flex flex-col animate-fade-in ${
          isPdf || isOffice ? "max-w-4xl max-h-[90vh]" : "max-w-2xl max-h-[80vh]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <svg className="w-4 h-4 text-[var(--color-subtext)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <span className="text-sm font-medium text-[var(--color-text)] truncate">{fileName}</span>
          </div>
          <div className="flex items-center gap-2">
            {(isPdf || isImage || isOffice) && (
              <a href={serveUrl} target="_blank" rel="noopener noreferrer"
                className="px-2.5 py-1 text-xs text-[var(--color-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-light)] transition-colors">
                {isOffice ? "ダウンロード" : isPdf ? "新しいタブで開く" : "原寸表示"}
              </a>
            )}
            <button onClick={onClose} className="p-1 text-[var(--color-subtext)] hover:text-[var(--color-text)] transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading && (
            <div className="p-6 space-y-2 animate-pulse">
              <div className="h-4 w-3/4 bg-[var(--color-border-light)] rounded" />
              <div className="h-4 w-full bg-[var(--color-border-light)] rounded" />
              <div className="h-4 w-5/6 bg-[var(--color-border-light)] rounded" />
            </div>
          )}
          {error && (
            <p className="text-sm text-red-500 p-6">{error}</p>
          )}

          {/* PDF */}
          {isPdf && !loading && (
            <iframe src={serveUrl} className="w-full h-full min-h-[70vh] border-0" />
          )}

          {/* Office (pptx, docx, xlsx) */}
          {isOffice && !loading && officeViewUrl && (
            <iframe src={officeViewUrl} className="w-full h-full min-h-[70vh] border-0" />
          )}

          {/* Image */}
          {isImage && !loading && (
            <div className="p-6 flex items-center justify-center">
              <img src={serveUrl} alt={fileName} className="max-w-full max-h-[65vh] rounded-lg" />
            </div>
          )}

          {/* Text / Markdown */}
          {!isPdf && !isImage && content !== null && !loading && (
            <div className="overflow-y-auto px-6 py-4 max-h-[70vh]">
              {isMarkdown ? (
                <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-headings:my-3 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-code:text-[var(--color-primary)] prose-code:bg-[var(--color-primary-light)] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-a:text-[var(--color-primary)] prose-pre:bg-[#f8f9fa] prose-pre:text-[var(--color-text)] prose-pre:border prose-pre:border-[var(--color-border)]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                </div>
              ) : (
                <pre className="text-sm font-mono text-[var(--color-text)] whitespace-pre-wrap">{content}</pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
