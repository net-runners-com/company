"use client";

import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { Document, DocumentType } from "@/types";

type Filter = "all" | DocumentType;

const statusColors: Record<string, { color: string; bg: string }> = {
  draft: { color: "var(--color-subtext)", bg: "var(--color-border-light)" },
  sent: { color: "var(--color-info)", bg: "var(--color-info-light)" },
  paid: { color: "var(--color-success)", bg: "var(--color-success-light)" },
  overdue: { color: "var(--color-danger)", bg: "var(--color-danger-light)" },
  cancelled: { color: "var(--color-subtext)", bg: "var(--color-border-light)" },
};

function formatCurrency(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "ja" ? "ja-JP" : "en-US", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const { t, locale } = useI18n();

  useEffect(() => {
    api.getDocuments().then(setDocuments);
  }, []);

  const filtered = filter === "all" ? documents : documents.filter((d) => d.type === filter);

  const totalEstimates = documents.filter((d) => d.type === "estimate").length;
  const totalInvoices = documents.filter((d) => d.type === "invoice").length;
  const totalUnpaid = documents
    .filter((d) => d.type === "invoice" && (d.status === "sent" || d.status === "overdue"))
    .reduce((sum, d) => sum + d.total, 0);
  const totalPaid = documents
    .filter((d) => d.status === "paid")
    .reduce((sum, d) => sum + d.total, 0);

  return (
    <div className="px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">{t.documents.title}</h1>
          <p className="text-sm text-[var(--color-subtext)] mt-0.5">{t.documents.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[var(--color-border)] text-[var(--color-text)] text-sm font-medium rounded-lg hover:bg-[var(--color-border-light)] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {t.documents.createEstimate}
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {t.documents.createInvoice}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: t.documents.estimates, value: String(totalEstimates), color: "var(--color-info)", bg: "var(--color-info-light)" },
          { label: t.documents.invoices, value: String(totalInvoices), color: "var(--color-primary)", bg: "var(--color-primary-light)" },
          {
            label: locale === "ja" ? "入金済" : "Paid",
            value: formatCurrency(totalPaid, locale),
            color: "var(--color-success)",
            bg: "var(--color-success-light)",
          },
          {
            label: locale === "ja" ? "未入金" : "Unpaid",
            value: formatCurrency(totalUnpaid, locale),
            color: "var(--color-danger)",
            bg: "var(--color-danger-light)",
          },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[var(--color-border)] p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.bg }}>
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              </div>
            </div>
            <p className="text-xl font-bold text-[var(--color-text)]">{s.value}</p>
            <p className="text-xs text-[var(--color-subtext)] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-4">
        {(["all", "estimate", "invoice"] as Filter[]).map((f) => {
          const label = f === "all" ? t.documents.all : f === "estimate" ? t.documents.estimates : t.documents.invoices;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === f
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-subtext)] hover:bg-[var(--color-border-light)]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-[var(--color-subtext)]">{t.documents.noDocuments}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
                <th className="text-left text-xs font-medium text-[var(--color-subtext)] px-6 py-3 uppercase tracking-wider">
                  #
                </th>
                <th className="text-left text-xs font-medium text-[var(--color-subtext)] px-6 py-3 uppercase tracking-wider">
                  {t.documents.client}
                </th>
                <th className="text-left text-xs font-medium text-[var(--color-subtext)] px-6 py-3 uppercase tracking-wider hidden md:table-cell">
                  {t.documents.subject}
                </th>
                <th className="text-right text-xs font-medium text-[var(--color-subtext)] px-6 py-3 uppercase tracking-wider">
                  {t.documents.amount}
                </th>
                <th className="text-left text-xs font-medium text-[var(--color-subtext)] px-6 py-3 uppercase tracking-wider">
                  {t.documents.status}
                </th>
                <th className="text-left text-xs font-medium text-[var(--color-subtext)] px-6 py-3 uppercase tracking-wider hidden lg:table-cell">
                  {t.documents.issueDate}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filtered.map((doc) => {
                const sc = statusColors[doc.status] ?? statusColors.draft;
                const docTypeLabel = (t.documents.docType as Record<string, string>)[doc.type] ?? doc.type;
                const docStatusLabel = (t.documents.docStatus as Record<string, string>)[doc.status] ?? doc.status;
                return (
                  <tr key={doc.id} className="hover:bg-[var(--color-border-light)] transition-colors cursor-pointer">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text)]">{doc.number}</p>
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: doc.type === "estimate" ? "var(--color-info-light)" : "var(--color-primary-light)", color: doc.type === "estimate" ? "var(--color-info)" : "var(--color-primary)" }}
                        >
                          {docTypeLabel}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-[var(--color-text)]">{doc.clientName}</p>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <p className="text-sm text-[var(--color-subtext)] truncate max-w-[200px]">{doc.subject}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-semibold text-[var(--color-text)]">{formatCurrency(doc.total, locale)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: sc.bg, color: sc.color }}
                      >
                        {docStatusLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <p className="text-sm text-[var(--color-subtext)]">
                        {new Date(doc.issueDate).toLocaleDateString(locale === "ja" ? "ja-JP" : "en-US")}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
