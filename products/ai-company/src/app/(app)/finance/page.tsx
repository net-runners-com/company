"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";

type TabKey = "journal" | "balance-sheet" | "cashflow";

// --- Mock Financial Data ---

const journalEntries = [
  { id: "j-1", date: "2026-03-01", description: "売上（コンサルティング）", debit: "売掛金", credit: "売上高", amount: 220000 },
  { id: "j-2", date: "2026-03-01", description: "サーバー費用", debit: "通信費", credit: "普通預金", amount: 15000 },
  { id: "j-3", date: "2026-03-05", description: "外注費（デザイン）", debit: "外注費", credit: "普通預金", amount: 80000 },
  { id: "j-4", date: "2026-03-10", description: "売上入金（合同会社テスト）", debit: "普通預金", credit: "売掛金", amount: 220000 },
  { id: "j-5", date: "2026-03-12", description: "広告費（SNS広告）", debit: "広告宣伝費", credit: "普通預金", amount: 50000 },
  { id: "j-6", date: "2026-03-15", description: "売上（Webサイト制作・中間）", debit: "売掛金", credit: "売上高", amount: 350000 },
  { id: "j-7", date: "2026-03-18", description: "交通費", debit: "旅費交通費", credit: "現金", amount: 3200 },
  { id: "j-8", date: "2026-03-20", description: "オフィス用品", debit: "消耗品費", credit: "普通預金", amount: 12800 },
  { id: "j-9", date: "2026-03-22", description: "ドメイン更新", debit: "通信費", credit: "普通預金", amount: 5500 },
  { id: "j-10", date: "2026-03-25", description: "売上入金（株式会社サンプル）", debit: "普通預金", credit: "売掛金", amount: 350000 },
  { id: "j-11", date: "2026-03-27", description: "ツール利用料（Claude API）", debit: "通信費", credit: "普通預金", amount: 8000 },
  { id: "j-12", date: "2026-03-27", description: "売上（ロゴデザイン・前払い）", debit: "普通預金", credit: "前受金", amount: 60000 },
];

const balanceSheet = {
  assets: {
    current: [
      { name: "現金", amount: 120000 },
      { name: "普通預金", amount: 2850000 },
      { name: "売掛金", amount: 715000 },
      { name: "前払費用", amount: 35000 },
    ],
    fixed: [
      { name: "工具器具備品", amount: 180000 },
      { name: "減価償却累計額", amount: -45000 },
    ],
  },
  liabilities: {
    current: [
      { name: "買掛金", amount: 120000 },
      { name: "前受金", amount: 60000 },
      { name: "未払金", amount: 85000 },
      { name: "未払法人税等", amount: 150000 },
    ],
  },
  equity: [
    { name: "資本金", amount: 1000000 },
    { name: "繰越利益剰余金", amount: 2440000 },
  ],
};

const cashflowData = {
  operating: [
    { name: "売上入金", amount: 570000 },
    { name: "コンサル収入", amount: 220000 },
    { name: "外注費支払", amount: -80000 },
    { name: "広告費支払", amount: -50000 },
    { name: "通信費支払", amount: -28500 },
    { name: "消耗品費支払", amount: -12800 },
    { name: "交通費支払", amount: -3200 },
  ],
  investing: [
    { name: "設備購入", amount: 0 },
  ],
  financing: [
    { name: "借入金返済", amount: 0 },
  ],
  openingBalance: 2285500,
};

function formatAmount(amount: number, locale: string): string {
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat(locale === "ja" ? "ja-JP" : "en-US", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(abs);
  return amount < 0 ? `(${formatted})` : formatted;
}

function sumItems(items: { amount: number }[]): number {
  return items.reduce((s, i) => s + i.amount, 0);
}

export default function FinancePage() {
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<TabKey>("journal");

  const tabs: { key: TabKey; label: string }[] = [
    { key: "journal", label: locale === "ja" ? "仕訳帳" : "Journal" },
    { key: "balance-sheet", label: locale === "ja" ? "貸借対照表" : "Balance Sheet" },
    { key: "cashflow", label: locale === "ja" ? "キャッシュフロー" : "Cash Flow" },
  ];

  const totalAssets =
    sumItems(balanceSheet.assets.current) + sumItems(balanceSheet.assets.fixed);
  const totalLiabilities = sumItems(balanceSheet.liabilities.current);
  const totalEquity = sumItems(balanceSheet.equity);

  const operatingTotal = sumItems(cashflowData.operating);
  const investingTotal = sumItems(cashflowData.investing);
  const financingTotal = sumItems(cashflowData.financing);
  const netCashChange = operatingTotal + investingTotal + financingTotal;
  const closingBalance = cashflowData.openingBalance + netCashChange;

  return (
    <div className="px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          {locale === "ja" ? "財務" : "Finance"}
        </h1>
        <p className="text-sm text-[var(--color-subtext)] mt-0.5">
          {locale === "ja" ? "2026年3月度" : "March 2026"}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: locale === "ja" ? "総資産" : "Total Assets", value: totalAssets, color: "var(--color-primary)" },
          { label: locale === "ja" ? "負債" : "Liabilities", value: totalLiabilities, color: "var(--color-warning)" },
          { label: locale === "ja" ? "純資産" : "Equity", value: totalEquity, color: "var(--color-success)" },
          { label: locale === "ja" ? "営業CF" : "Operating CF", value: operatingTotal, color: "var(--color-info)" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-[var(--color-border)] p-5">
            <p className="text-xs text-[var(--color-subtext)] mb-1">{card.label}</p>
            <p className="text-xl font-bold" style={{ color: card.color }}>
              {formatAmount(card.value, locale)}
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
          </button>
        ))}
      </div>

      {/* Journal */}
      {activeTab === "journal" && (
        <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-bg)] border-b border-[var(--color-border)]">
                <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">
                  {locale === "ja" ? "日付" : "Date"}
                </th>
                <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">
                  {locale === "ja" ? "摘要" : "Description"}
                </th>
                <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">
                  {locale === "ja" ? "借方" : "Debit"}
                </th>
                <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">
                  {locale === "ja" ? "貸方" : "Credit"}
                </th>
                <th className="text-right px-5 py-3 font-medium text-[var(--color-subtext)]">
                  {locale === "ja" ? "金額" : "Amount"}
                </th>
              </tr>
            </thead>
            <tbody>
              {journalEntries.map((entry) => (
                <tr key={entry.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-border-light)] transition-colors">
                  <td className="px-5 py-3 text-[var(--color-subtext)] whitespace-nowrap">{entry.date}</td>
                  <td className="px-5 py-3 text-[var(--color-text)]">{entry.description}</td>
                  <td className="px-5 py-3 text-[var(--color-text)]">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">{entry.debit}</span>
                  </td>
                  <td className="px-5 py-3 text-[var(--color-text)]">
                    <span className="px-2 py-0.5 bg-orange-50 text-orange-700 text-xs rounded">{entry.credit}</span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-[var(--color-text)]">
                    {formatAmount(entry.amount, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--color-bg)] border-t border-[var(--color-border)]">
                <td colSpan={4} className="px-5 py-3 font-medium text-[var(--color-text)]">
                  {locale === "ja" ? "合計" : "Total"}
                </td>
                <td className="px-5 py-3 text-right font-mono font-bold text-[var(--color-primary)]">
                  {formatAmount(sumItems(journalEntries), locale)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Balance Sheet */}
      {activeTab === "balance-sheet" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assets */}
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
            <h2 className="font-semibold text-[var(--color-text)] mb-4">
              {locale === "ja" ? "資産の部" : "Assets"}
            </h2>

            <h3 className="text-xs font-medium text-[var(--color-subtext)] uppercase tracking-wider mb-2">
              {locale === "ja" ? "流動資産" : "Current Assets"}
            </h3>
            <div className="space-y-2 mb-4">
              {balanceSheet.assets.current.map((item) => (
                <div key={item.name} className="flex justify-between items-center">
                  <span className="text-sm text-[var(--color-text)]">{item.name}</span>
                  <span className="text-sm font-mono text-[var(--color-text)]">{formatAmount(item.amount, locale)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border)]">
                <span className="text-sm font-medium text-[var(--color-text)]">
                  {locale === "ja" ? "流動資産計" : "Total Current"}
                </span>
                <span className="text-sm font-mono font-medium text-[var(--color-primary)]">
                  {formatAmount(sumItems(balanceSheet.assets.current), locale)}
                </span>
              </div>
            </div>

            <h3 className="text-xs font-medium text-[var(--color-subtext)] uppercase tracking-wider mb-2">
              {locale === "ja" ? "固定資産" : "Fixed Assets"}
            </h3>
            <div className="space-y-2 mb-4">
              {balanceSheet.assets.fixed.map((item) => (
                <div key={item.name} className="flex justify-between items-center">
                  <span className="text-sm text-[var(--color-text)]">{item.name}</span>
                  <span className="text-sm font-mono text-[var(--color-text)]">{formatAmount(item.amount, locale)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border)]">
                <span className="text-sm font-medium text-[var(--color-text)]">
                  {locale === "ja" ? "固定資産計" : "Total Fixed"}
                </span>
                <span className="text-sm font-mono font-medium text-[var(--color-primary)]">
                  {formatAmount(sumItems(balanceSheet.assets.fixed), locale)}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center p-3 bg-[var(--color-primary-light)] rounded-lg">
              <span className="font-semibold text-[var(--color-text)]">
                {locale === "ja" ? "資産合計" : "Total Assets"}
              </span>
              <span className="font-mono font-bold text-[var(--color-primary)]">
                {formatAmount(totalAssets, locale)}
              </span>
            </div>
          </div>

          {/* Liabilities + Equity */}
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
            <h2 className="font-semibold text-[var(--color-text)] mb-4">
              {locale === "ja" ? "負債・純資産の部" : "Liabilities & Equity"}
            </h2>

            <h3 className="text-xs font-medium text-[var(--color-subtext)] uppercase tracking-wider mb-2">
              {locale === "ja" ? "流動負債" : "Current Liabilities"}
            </h3>
            <div className="space-y-2 mb-4">
              {balanceSheet.liabilities.current.map((item) => (
                <div key={item.name} className="flex justify-between items-center">
                  <span className="text-sm text-[var(--color-text)]">{item.name}</span>
                  <span className="text-sm font-mono text-[var(--color-text)]">{formatAmount(item.amount, locale)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border)]">
                <span className="text-sm font-medium text-[var(--color-text)]">
                  {locale === "ja" ? "負債合計" : "Total Liabilities"}
                </span>
                <span className="text-sm font-mono font-medium text-[var(--color-warning)]">
                  {formatAmount(totalLiabilities, locale)}
                </span>
              </div>
            </div>

            <h3 className="text-xs font-medium text-[var(--color-subtext)] uppercase tracking-wider mb-2">
              {locale === "ja" ? "純資産" : "Equity"}
            </h3>
            <div className="space-y-2 mb-4">
              {balanceSheet.equity.map((item) => (
                <div key={item.name} className="flex justify-between items-center">
                  <span className="text-sm text-[var(--color-text)]">{item.name}</span>
                  <span className="text-sm font-mono text-[var(--color-text)]">{formatAmount(item.amount, locale)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border)]">
                <span className="text-sm font-medium text-[var(--color-text)]">
                  {locale === "ja" ? "純資産合計" : "Total Equity"}
                </span>
                <span className="text-sm font-mono font-medium text-[var(--color-success)]">
                  {formatAmount(totalEquity, locale)}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center p-3 bg-[var(--color-primary-light)] rounded-lg">
              <span className="font-semibold text-[var(--color-text)]">
                {locale === "ja" ? "負債・純資産合計" : "Total L + E"}
              </span>
              <span className="font-mono font-bold text-[var(--color-primary)]">
                {formatAmount(totalLiabilities + totalEquity, locale)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Cash Flow */}
      {activeTab === "cashflow" && (
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
          {/* Operating */}
          <div className="mb-6">
            <h2 className="font-semibold text-[var(--color-text)] mb-3">
              {locale === "ja" ? "営業活動によるキャッシュフロー" : "Operating Activities"}
            </h2>
            <div className="space-y-2">
              {cashflowData.operating.map((item) => (
                <div key={item.name} className="flex justify-between items-center">
                  <span className="text-sm text-[var(--color-text)]">{item.name}</span>
                  <span className={`text-sm font-mono ${item.amount >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                    {item.amount >= 0 ? "+" : ""}{formatAmount(item.amount, locale)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border)]">
                <span className="text-sm font-medium">{locale === "ja" ? "営業CF計" : "Operating Total"}</span>
                <span className={`text-sm font-mono font-bold ${operatingTotal >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                  {operatingTotal >= 0 ? "+" : ""}{formatAmount(operatingTotal, locale)}
                </span>
              </div>
            </div>
          </div>

          {/* Investing */}
          <div className="mb-6">
            <h2 className="font-semibold text-[var(--color-text)] mb-3">
              {locale === "ja" ? "投資活動によるキャッシュフロー" : "Investing Activities"}
            </h2>
            <div className="space-y-2">
              {cashflowData.investing.map((item) => (
                <div key={item.name} className="flex justify-between items-center">
                  <span className="text-sm text-[var(--color-text)]">{item.name}</span>
                  <span className="text-sm font-mono text-[var(--color-subtext)]">{formatAmount(item.amount, locale)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border)]">
                <span className="text-sm font-medium">{locale === "ja" ? "投資CF計" : "Investing Total"}</span>
                <span className="text-sm font-mono font-bold text-[var(--color-subtext)]">{formatAmount(investingTotal, locale)}</span>
              </div>
            </div>
          </div>

          {/* Financing */}
          <div className="mb-6">
            <h2 className="font-semibold text-[var(--color-text)] mb-3">
              {locale === "ja" ? "財務活動によるキャッシュフロー" : "Financing Activities"}
            </h2>
            <div className="space-y-2">
              {cashflowData.financing.map((item) => (
                <div key={item.name} className="flex justify-between items-center">
                  <span className="text-sm text-[var(--color-text)]">{item.name}</span>
                  <span className="text-sm font-mono text-[var(--color-subtext)]">{formatAmount(item.amount, locale)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border)]">
                <span className="text-sm font-medium">{locale === "ja" ? "財務CF計" : "Financing Total"}</span>
                <span className="text-sm font-mono font-bold text-[var(--color-subtext)]">{formatAmount(financingTotal, locale)}</span>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="border-t-2 border-[var(--color-border)] pt-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--color-text)]">{locale === "ja" ? "期首キャッシュ残高" : "Opening Balance"}</span>
              <span className="text-sm font-mono text-[var(--color-text)]">{formatAmount(cashflowData.openingBalance, locale)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--color-text)]">{locale === "ja" ? "キャッシュ増減" : "Net Change"}</span>
              <span className={`text-sm font-mono ${netCashChange >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                {netCashChange >= 0 ? "+" : ""}{formatAmount(netCashChange, locale)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-[var(--color-primary-light)] rounded-lg">
              <span className="font-semibold text-[var(--color-text)]">{locale === "ja" ? "期末キャッシュ残高" : "Closing Balance"}</span>
              <span className="font-mono font-bold text-[var(--color-primary)]">{formatAmount(closingBalance, locale)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
