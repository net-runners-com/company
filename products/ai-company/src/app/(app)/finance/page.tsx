"use client";

import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { EmployeeAvatar } from "@/components/employee-avatar";

type TabKey = "upload" | "journal" | "expenses" | "balance-sheet" | "cashflow";

interface JournalEntry {
  日付: string;
  摘要: string;
  借方科目: string;
  借方金額: number;
  貸方科目: string;
  貸方金額: number;
}

interface ExpenseEntry {
  日付: string;
  内容: string;
  金額: string;
  金額_num: number;
  区分: string;
  備考: string;
}

interface ProcessResult {
  status: string;
  type: string;
  data: Record<string, string | number | null>;
  summary: string;
  error?: string;
}

// --- Helpers ---

export default function FinancePage() {
  const { locale } = useI18n();
  const [activeTab, setActiveTab] = useState<TabKey>("journal");
  const fileRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<ProcessResult[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [journalPage, setJournalPage] = useState(0);
  const [expensePage, setExpensePage] = useState(0);
  const PAGE_SIZE = 10;

  const processFile = async (file: File) => {
    setProcessing(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/accounting/process", { method: "POST", body: form });
      const data = await res.json();
      setResults((prev) => [data, ...prev]);
      if (data.status === "processed") refreshData();
    } catch {
      setResults((prev) => [{ status: "error", type: "error", data: {}, summary: "", error: "通信エラー" }, ...prev]);
    } finally {
      setProcessing(false);
    }
  };

  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    setLoadingData(true);
    Promise.all([
      fetch("/api/accounting/journal").then((r) => r.json()),
      fetch("/api/accounting/expenses").then((r) => r.json()),
    ]).then(([j, e]) => {
      setJournal(j.entries || []);
      setExpenses(e.entries || []);
    }).finally(() => setLoadingData(false));
  }, []);

  // アップロード後にデータ再取得
  const refreshData = () => {
    fetch("/api/accounting/journal").then((r) => r.json()).then((j) => setJournal(j.entries || []));
    fetch("/api/accounting/expenses").then((r) => r.json()).then((e) => setExpenses(e.entries || []));
  };

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; };

  const typeLabel: Record<string, { label: string; color: string; bg: string }> = {
    receipt: { label: "領収書", color: "#10b981", bg: "#ecfdf5" },
    invoice: { label: "請求書", color: "#3b82f6", bg: "#eff6ff" },
    estimate: { label: "見積書", color: "#f59e0b", bg: "#fffbeb" },
    other: { label: "その他", color: "#6b7280", bg: "#f9fafb" },
    error: { label: "エラー", color: "#ef4444", bg: "#fef2f2" },
  };

  const journalTotal = journal.reduce((s, e) => s + (e.借方金額 || 0), 0);
  const expenseTotal = expenses.reduce((s, e) => s + (e.金額_num || 0), 0);

  const tabs: { key: TabKey; label: string; badge?: string }[] = [
    { key: "journal", label: locale === "ja" ? "仕訳帳" : "Journal", badge: journal.length > 0 ? String(journal.length) : undefined },
    { key: "expenses", label: locale === "ja" ? "経費" : "Expenses", badge: expenses.length > 0 ? String(expenses.length) : undefined },
  ];

  return (
    <div className="px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <EmployeeAvatar seed="emp-6" size="3rem" />
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">
            {locale === "ja" ? "財務" : "Finance"}
          </h1>
          <p className="text-sm text-[var(--color-subtext)] mt-0.5">
            {locale === "ja" ? "あおいが自動で仕訳します" : "Aoi handles bookkeeping automatically"}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: locale === "ja" ? "仕訳件数" : "Journal Entries", value: journal.length, suffix: locale === "ja" ? "件" : "", color: "var(--color-primary)" },
          { label: locale === "ja" ? "仕訳合計(借方)" : "Total Debit", value: journalTotal, prefix: "¥", color: "var(--color-info)" },
          { label: locale === "ja" ? "経費件数" : "Expenses", value: expenses.length, suffix: locale === "ja" ? "件" : "", color: "var(--color-warning)" },
          { label: locale === "ja" ? "経費合計" : "Total Expenses", value: expenseTotal, prefix: "¥", color: "var(--color-danger)" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-[var(--color-border)] p-5">
            <p className="text-xs text-[var(--color-subtext)] mb-1">{card.label}</p>
            <p className="text-xl font-bold" style={{ color: card.color }}>
              {card.prefix || ""}{card.value.toLocaleString()}{card.suffix || ""}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-6 border-b border-[var(--color-border)]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-[var(--color-subtext)] hover:text-[var(--color-text)]"
            }`}
          >
            {tab.label}
            {tab.badge && (
              <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 bg-[var(--color-primary)] text-white rounded-full">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Upload / Auto Entry */}
      {activeTab === "upload" && (
        <div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors mb-6 ${
              dragOver
                ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]"
                : "border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
            }`}
          >
            <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" />
            {processing ? (
              <div className="space-y-2">
                <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-[var(--color-primary)] font-medium">
                  {locale === "ja" ? "あおいが解析中..." : "Aoi is analyzing..."}
                </p>
              </div>
            ) : (
              <>
                <svg className="w-10 h-10 text-[var(--color-subtext)] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm font-medium text-[var(--color-text)]">
                  {locale === "ja" ? "レシート・請求書をドロップ" : "Drop receipt or invoice here"}
                </p>
                <p className="text-xs text-[var(--color-subtext)] mt-1">
                  {locale === "ja" ? "画像 (JPG, PNG) または PDF — 自動で仕訳帳に記録されます" : "Images or PDF — auto-recorded to journal"}
                </p>
              </>
            )}
          </div>

          {results.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">
                {locale === "ja" ? "処理結果" : "Results"}
              </h2>
              {results.map((r, i) => {
                const cfg = typeLabel[r.type] || typeLabel.other;
                return (
                  <div key={i} className="bg-white rounded-xl border border-[var(--color-border)] p-5">
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-medium px-2 py-1 rounded-full shrink-0" style={{ backgroundColor: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                      <div className="flex-1 min-w-0">
                        {r.error ? (
                          <p className="text-sm text-red-600">{r.error}</p>
                        ) : (
                          <>
                            {r.data.amount && <p className="text-lg font-bold text-[var(--color-text)]">¥{Number(r.data.amount).toLocaleString()}</p>}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-[var(--color-subtext)]">
                              {r.data.store && <span>{String(r.data.store)}</span>}
                              {r.data.from && <span>{String(r.data.from)}</span>}
                              {r.data.date && <span>{String(r.data.date)}</span>}
                              {r.data.category && <span>{String(r.data.category)}</span>}
                              {r.data.debit && r.data.credit && <span>{String(r.data.debit)} / {String(r.data.credit)}</span>}
                            </div>
                            {r.summary && <p className="text-sm text-[var(--color-subtext)] mt-2">{r.summary}</p>}
                            {r.status === "processed" && (
                              <p className="text-xs text-[var(--color-success)] mt-2 font-medium">
                                {locale === "ja" ? "仕訳帳に自動記録しました" : "Auto-recorded to journal"}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Journal */}
      {activeTab === "journal" && (
        <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
          {loadingData ? (
            <div className="p-8 text-center text-sm text-[var(--color-subtext)]">読み込み中...</div>
          ) : journal.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--color-subtext)]">仕訳データがありません</div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-bg)] border-b border-[var(--color-border)]">
                    <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">日付</th>
                    <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">摘要</th>
                    <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">借方</th>
                    <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">貸方</th>
                    <th className="text-right px-5 py-3 font-medium text-[var(--color-subtext)]">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {journal.slice(journalPage * PAGE_SIZE, (journalPage + 1) * PAGE_SIZE).map((e, i) => (
                    <tr key={i} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-border-light)] transition-colors">
                      <td className="px-5 py-3 text-[var(--color-subtext)] whitespace-nowrap">{e.日付}</td>
                      <td className="px-5 py-3 text-[var(--color-text)]">{e.摘要}</td>
                      <td className="px-5 py-3"><span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">{e.借方科目}</span></td>
                      <td className="px-5 py-3"><span className="px-2 py-0.5 bg-orange-50 text-orange-700 text-xs rounded">{e.貸方科目}</span></td>
                      <td className="px-5 py-3 text-right font-mono text-[var(--color-text)]">¥{(e.借方金額 || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[var(--color-bg)] border-t border-[var(--color-border)]">
                    <td colSpan={4} className="px-5 py-3 font-medium text-[var(--color-text)]">合計</td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-[var(--color-primary)]">¥{journalTotal.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
              {journal.length > PAGE_SIZE && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-border)]">
                  <span className="text-xs text-[var(--color-subtext)]">{journalPage * PAGE_SIZE + 1}-{Math.min((journalPage + 1) * PAGE_SIZE, journal.length)} / {journal.length}</span>
                  <div className="flex gap-1">
                    <button onClick={() => setJournalPage(Math.max(0, journalPage - 1))} disabled={journalPage === 0}
                      className="px-3 py-1 text-xs border border-[var(--color-border)] rounded hover:bg-[var(--color-border-light)] disabled:opacity-30 transition-colors">{locale === "ja" ? "前" : "Prev"}</button>
                    <button onClick={() => setJournalPage(journalPage + 1)} disabled={(journalPage + 1) * PAGE_SIZE >= journal.length}
                      className="px-3 py-1 text-xs border border-[var(--color-border)] rounded hover:bg-[var(--color-border-light)] disabled:opacity-30 transition-colors">{locale === "ja" ? "次" : "Next"}</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Expenses */}
      {activeTab === "expenses" && (
        <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
          {loadingData ? (
            <div className="p-8 text-center text-sm text-[var(--color-subtext)]">読み込み中...</div>
          ) : expenses.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--color-subtext)]">経費データがありません</div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-bg)] border-b border-[var(--color-border)]">
                    <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">日付</th>
                    <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">内容</th>
                    <th className="text-right px-5 py-3 font-medium text-[var(--color-subtext)]">金額</th>
                    <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">区分</th>
                    <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">備考</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.slice(expensePage * PAGE_SIZE, (expensePage + 1) * PAGE_SIZE).map((e, i) => (
                    <tr key={i} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-border-light)] transition-colors">
                      <td className="px-5 py-3 text-[var(--color-subtext)] whitespace-nowrap">{e.日付}</td>
                      <td className="px-5 py-3 text-[var(--color-text)]">{e.内容}</td>
                      <td className="px-5 py-3 text-right font-mono text-[var(--color-text)]">{e.金額}</td>
                      <td className="px-5 py-3"><span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded">{e.区分}</span></td>
                      <td className="px-5 py-3 text-xs text-[var(--color-subtext)]">{e.備考}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[var(--color-bg)] border-t border-[var(--color-border)]">
                    <td colSpan={2} className="px-5 py-3 font-medium text-[var(--color-text)]">合計</td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-[var(--color-primary)]">¥{expenseTotal.toLocaleString()}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
              {expenses.length > PAGE_SIZE && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-border)]">
                  <span className="text-xs text-[var(--color-subtext)]">{expensePage * PAGE_SIZE + 1}-{Math.min((expensePage + 1) * PAGE_SIZE, expenses.length)} / {expenses.length}</span>
                  <div className="flex gap-1">
                    <button onClick={() => setExpensePage(Math.max(0, expensePage - 1))} disabled={expensePage === 0}
                      className="px-3 py-1 text-xs border border-[var(--color-border)] rounded hover:bg-[var(--color-border-light)] disabled:opacity-30 transition-colors">{locale === "ja" ? "前" : "Prev"}</button>
                    <button onClick={() => setExpensePage(expensePage + 1)} disabled={(expensePage + 1) * PAGE_SIZE >= expenses.length}
                      className="px-3 py-1 text-xs border border-[var(--color-border)] rounded hover:bg-[var(--color-border-light)] disabled:opacity-30 transition-colors">{locale === "ja" ? "次" : "Next"}</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

    </div>
  );
}
