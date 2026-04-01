"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n";

interface Product {
  _id: string;
  title: string;
  type: string;
  url: string;
  description?: string;
  employeeName?: string;
  createdAt?: string;
  thumbnail?: string;
}

const TYPE_CONFIG: Record<string, { label: string; labelEn: string; color: string; bg: string }> = {
  homepage: { label: "ホームページ", labelEn: "Homepage", color: "#3b82f6", bg: "#eff6ff" },
  lp: { label: "LP", labelEn: "Landing Page", color: "#8b5cf6", bg: "#f5f3ff" },
  ec: { label: "EC", labelEn: "E-Commerce", color: "#f59e0b", bg: "#fffbeb" },
  other: { label: "その他", labelEn: "Other", color: "#64748b", bg: "#f8fafc" },
};

function getTimeLabel(dateStr: string, locale: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffD = Math.floor(diffMs / 86400000);
  if (diffD === 0) return locale === "ja" ? "今日" : "Today";
  if (diffD === 1) return locale === "ja" ? "昨日" : "Yesterday";
  if (diffD < 30) return locale === "ja" ? `${diffD}日前` : `${diffD}d ago`;
  return d.toLocaleDateString(locale === "ja" ? "ja-JP" : "en-US");
}

export default function ProductsPage() {
  const { locale } = useI18n();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/data/products");
        const data = await res.json();
        const items = (data.items || []).map((item: { id: string; data: Record<string, unknown>; created_at?: string }) => ({
          _id: item.id,
          ...item.data,
          createdAt: item.data.createdAt || item.created_at,
        }));
        setProducts(items);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const handleDelete = async (id: string) => {
    await fetch(`/api/data/products/${id}`, { method: "DELETE" });
    setProducts((prev) => prev.filter((p) => p._id !== id));
    setSelected(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[var(--color-text)]">
          {locale === "ja" ? "プロダクト" : "Products"}
        </h1>
        <p className="text-sm text-[var(--color-subtext)] mt-1">
          {locale === "ja" ? "制作したWebサイト・LP・ECサイトなどの一覧" : "Websites, landing pages, and other web products"}
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden animate-pulse">
              <div className="h-40 bg-[var(--color-border-light)]" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-32 bg-[var(--color-border-light)] rounded" />
                <div className="h-3 w-full bg-[var(--color-border-light)] rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && products.length === 0 && (
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-16 text-center">
          <svg className="w-12 h-12 mx-auto text-[var(--color-border)] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
          </svg>
          <p className="text-[var(--color-subtext)] text-sm">
            {locale === "ja" ? "プロダクトがありません" : "No products yet"}
          </p>
          <p className="text-[var(--color-subtext)] text-xs mt-1">
            {locale === "ja" ? "社員にチャットで制作を依頼すると、ここに表示されます" : "Products created by employees will appear here"}
          </p>
        </div>
      )}

      {/* Card Grid */}
      {!loading && products.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => {
            const typeConf = TYPE_CONFIG[product.type] || TYPE_CONFIG.other;
            return (
              <div
                key={product._id}
                onClick={() => setSelected(product)}
                className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden hover:border-[var(--color-primary)] hover:shadow-md transition-all cursor-pointer group"
              >
                {/* Thumbnail / Preview */}
                <div className="h-40 bg-[var(--color-border-light)] relative overflow-hidden">
                  {product.url ? (
                    <iframe
                      src={product.url}
                      className="w-[200%] h-[200%] origin-top-left scale-50 pointer-events-none"
                      tabIndex={-1}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <svg className="w-10 h-10 text-[var(--color-border)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3" />
                      </svg>
                    </div>
                  )}
                </div>
                {/* Info */}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: typeConf.bg, color: typeConf.color }}
                    >
                      {locale === "ja" ? typeConf.label : typeConf.labelEn}
                    </span>
                    {product.createdAt && (
                      <span className="text-[10px] text-[var(--color-subtext)]">
                        {getTimeLabel(product.createdAt, locale)}
                      </span>
                    )}
                  </div>
                  <h3 className="font-medium text-sm text-[var(--color-text)] truncate">{product.title}</h3>
                  {product.description && (
                    <p className="text-xs text-[var(--color-subtext)] mt-1 line-clamp-2">{product.description}</p>
                  )}
                  {product.employeeName && (
                    <p className="text-[10px] text-[var(--color-subtext)] mt-2">
                      {locale === "ja" ? `担当: ${product.employeeName}` : `By: ${product.employeeName}`}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      {selected && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-[var(--color-text)]">{selected.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                  {(() => { const tc = TYPE_CONFIG[selected.type] || TYPE_CONFIG.other; return (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: tc.bg, color: tc.color }}>
                      {locale === "ja" ? tc.label : tc.labelEn}
                    </span>
                  ); })()}
                  {selected.employeeName && <span className="text-xs text-[var(--color-subtext)]">{selected.employeeName}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                {selected.url && (
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-light)] transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {locale === "ja" ? "新しいタブで開く" : "Open in new tab"}
                  </a>
                )}
                <button
                  onClick={() => handleDelete(selected._id)}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  {locale === "ja" ? "削除" : "Delete"}
                </button>
                <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-[var(--color-border-light)] rounded-lg transition-colors">
                  <svg className="w-5 h-5 text-[var(--color-subtext)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            {/* iframe Preview */}
            <div className="flex-1 overflow-hidden">
              {selected.url ? (
                <iframe src={selected.url} className="w-full h-[70vh] border-0" />
              ) : (
                <div className="flex items-center justify-center h-64 text-sm text-[var(--color-subtext)]">
                  {locale === "ja" ? "プレビューURLが設定されていません" : "No preview URL set"}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
