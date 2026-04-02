"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n";

interface Prompt {
  _id: string;
  _created_at?: string;
  name: string;
  content: string;
  category?: string;
}

export default function PromptsPage() {
  const { locale } = useI18n();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // 編集/新規モーダル
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", content: "", category: "" });
  const [saving, setSaving] = useState(false);

  // 詳細モーダル
  const [viewing, setViewing] = useState<Prompt | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchPrompts = () => {
    setLoading(true);
    fetch(`/api/data/prompts?limit=200${search ? `&q=${encodeURIComponent(search)}` : ""}`)
      .then((r) => r.json())
      .then((d) => setPrompts(d.entries || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPrompts(); }, [search]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", content: "", category: "" });
    setShowForm(true);
  };

  const openEdit = (p: Prompt) => {
    setEditing(p);
    setForm({ name: p.name, content: p.content, category: p.category || "" });
    setShowForm(true);
    setViewing(null);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await fetch(`/api/data/prompts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editing._id, ...form }),
        });
      } else {
        await fetch(`/api/data/prompts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      setShowForm(false);
      fetchPrompts();
    } catch {}
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/data/prompts/${id}`, { method: "DELETE" });
    setViewing(null);
    fetchPrompts();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const categories = [...new Set(prompts.map((p) => p.category).filter(Boolean))];

  return (
    <div className="px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">
            {locale === "ja" ? "プロンプト" : "Prompts"}
          </h1>
          <p className="text-sm text-[var(--color-subtext)] mt-0.5">
            {locale === "ja" ? "よく使うプロンプトを保存・管理" : "Save and manage prompt templates"}
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {locale === "ja" ? "新規作成" : "New"}
        </button>
      </div>

      {/* Search + Categories */}
      <div className="flex gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={locale === "ja" ? "検索..." : "Search..."}
          className="flex-1 px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
        />
      </div>

      {/* Category Tabs */}
      {categories.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setSearch("")}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${!search ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-border-light)] text-[var(--color-subtext)] hover:bg-[var(--color-border)]"}`}
          >
            {locale === "ja" ? "すべて" : "All"}
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSearch(cat!)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${search === cat ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-border-light)] text-[var(--color-subtext)] hover:bg-[var(--color-border)]"}`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Prompt List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-[var(--color-border-light)] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : prompts.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-12 h-12 text-[var(--color-subtext)] mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <p className="text-sm text-[var(--color-subtext)]">
            {locale === "ja" ? "プロンプトがまだありません" : "No prompts yet"}
          </p>
          <button onClick={openNew} className="mt-3 text-sm text-[var(--color-primary)] hover:underline">
            {locale === "ja" ? "最初のプロンプトを作成" : "Create your first prompt"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {prompts.map((p) => (
            <div
              key={p._id}
              onClick={() => setViewing(p)}
              className="bg-white rounded-xl border border-[var(--color-border)] p-4 hover:border-[var(--color-primary)] hover:shadow-sm transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium text-sm text-[var(--color-text)] line-clamp-1">{p.name}</h3>
                {p.category && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-primary-light)] text-[var(--color-primary)] rounded-full shrink-0">
                    {p.category}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--color-subtext)] mt-2 line-clamp-3 whitespace-pre-wrap">{p.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* View Modal */}
      {viewing && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={() => setViewing(null)}>
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-[var(--color-text)]">{viewing.name}</h3>
                {viewing.category && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-primary-light)] text-[var(--color-primary)] rounded-full">
                    {viewing.category}
                  </span>
                )}
              </div>
              <button onClick={() => setViewing(null)} className="p-1 text-[var(--color-subtext)] hover:text-[var(--color-text)]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto flex-1">
              <pre className="text-sm text-[var(--color-text)] whitespace-pre-wrap font-sans leading-relaxed bg-[var(--color-bg)] rounded-lg p-4">{viewing.content}</pre>
            </div>
            <div className="flex items-center gap-2 px-5 py-3 border-t border-[var(--color-border)] shrink-0">
              <button
                onClick={() => copyToClipboard(viewing.content)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                </svg>
                {copied ? (locale === "ja" ? "コピー済み" : "Copied!") : (locale === "ja" ? "コピー" : "Copy")}
              </button>
              <button
                onClick={() => openEdit(viewing)}
                className="px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-light)] transition-colors"
              >
                {locale === "ja" ? "編集" : "Edit"}
              </button>
              <button
                onClick={() => handleDelete(viewing._id)}
                className="px-3 py-1.5 text-xs font-medium text-[var(--color-danger)] border border-[var(--color-danger)] rounded-lg hover:bg-red-50 transition-colors ml-auto"
              >
                {locale === "ja" ? "削除" : "Delete"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Create/Edit Modal */}
      {showForm && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] shrink-0">
              <h3 className="font-semibold text-[var(--color-text)]">
                {editing ? (locale === "ja" ? "プロンプトを編集" : "Edit Prompt") : (locale === "ja" ? "新規プロンプト" : "New Prompt")}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1 text-[var(--color-subtext)] hover:text-[var(--color-text)]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                  {locale === "ja" ? "名前" : "Name"}
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={locale === "ja" ? "プロンプト名" : "Prompt name"}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                  {locale === "ja" ? "カテゴリ" : "Category"}
                </label>
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder={locale === "ja" ? "例: 営業, マーケティング, 開発" : "e.g. Sales, Marketing, Dev"}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                  {locale === "ja" ? "内容" : "Content"}
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder={locale === "ja" ? "プロンプトの内容を入力..." : "Enter prompt content..."}
                  rows={12}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent resize-y"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--color-border)] shrink-0">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-medium text-[var(--color-subtext)] bg-[var(--color-border-light)] rounded-lg hover:bg-[var(--color-border)] transition-colors"
              >
                {locale === "ja" ? "キャンセル" : "Cancel"}
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || !form.content.trim() || saving}
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-40"
              >
                {saving ? "..." : (locale === "ja" ? "保存" : "Save")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
