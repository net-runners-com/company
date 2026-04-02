"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";

interface PageDef {
  slug: string;
  title: string;
  description?: string;
  mode?: string;
  html?: string;
}

// --- HTML Iframe Page ---
function HtmlPage({ pageDef }: { pageDef: PageDef }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const contentHeight = useRef<number>(0);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!iframeRef.current) return;
      if (e.data?.type === "resize") {
        contentHeight.current = e.data.height + 20;
        iframeRef.current.style.height = `${contentHeight.current}px`;
      }
      // モーダル表示時: iframeをビューポート高さに固定（fixedが効くように）
      if (e.data?.type === "modal-open") {
        iframeRef.current.style.height = "calc(100vh - 80px)";
      }
      // モーダル非表示時: コンテンツ高さに戻す
      if (e.data?.type === "modal-close") {
        iframeRef.current.style.height = `${contentHeight.current}px`;
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  return (
    <div className="animate-fade-in h-full">
      <iframe
        ref={iframeRef}
        srcDoc={pageDef.html}
        className="w-full border-0"
        style={{ minHeight: "calc(100vh - 80px)" }}
        sandbox="allow-scripts allow-same-origin allow-popups"
        title={pageDef.title}
      />
    </div>
  );
}

// --- Page ---
export default function CustomPage() {
  const { slug } = useParams<{ slug: string }>();
  const { locale } = useI18n();
  const [pageDef, setPageDef] = useState<PageDef | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/data/dashboards?q=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        const found = (d.entries || []).find((e: PageDef) => e.slug === slug);
        if (found) setPageDef(found);
        else setError(locale === "ja" ? "ページが見つかりません" : "Page not found");
      })
      .catch(() => setError("Error"))
      .finally(() => setLoading(false));
  }, [slug, locale]);

  if (loading) return <div className="px-8 py-8"><div className="h-8 w-48 bg-[var(--color-border-light)] rounded animate-pulse mb-4" /><div className="h-24 bg-[var(--color-border-light)] rounded-xl animate-pulse" /></div>;
  if (error || !pageDef) return <div className="px-8 py-20 text-center text-[var(--color-subtext)]">{error}</div>;

  if (pageDef.html) {
    return <HtmlPage pageDef={pageDef} />;
  }

  return <div className="px-8 py-20 text-center text-[var(--color-subtext)]">{locale === "ja" ? "ページデータが不正です" : "Invalid page data"}</div>;
}
