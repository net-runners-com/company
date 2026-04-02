"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n";

type TabKey = "leads" | "clients" | "proposals" | "email";
type LeadStatus = "new" | "contacted" | "meeting" | "proposal" | "negotiation" | "won" | "lost";
type ProposalStatus = "draft" | "sent" | "accepted" | "rejected";

interface Lead {
  id: string;
  company: string;
  contact: string;
  status: LeadStatus;
  source: string;
  value: number;
  nextAction: string;
  nextDate: string;
  createdAt: string;
}

interface Client {
  id: string;
  company: string;
  contact: string;
  industry: string;
  monthlyRevenue: number;
  contractStart: string;
  status: "active" | "churned";
  projects: number;
}

interface Proposal {
  id: string;
  title: string;
  client: string;
  amount: number;
  status: ProposalStatus;
  sentAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

const mockLeads: Lead[] = [
  { id: "lead-1", company: "テック株式会社", contact: "佐藤 太郎", status: "meeting", source: "紹介", value: 500000, nextAction: "ヒアリング", nextDate: "2026-03-29", createdAt: "2026-03-15" },
  { id: "lead-2", company: "グリーン合同会社", contact: "鈴木 花子", status: "proposal", source: "Web問い合わせ", value: 300000, nextAction: "提案書送付", nextDate: "2026-03-28", createdAt: "2026-03-10" },
  { id: "lead-3", company: "スカイ株式会社", contact: "田中 一郎", status: "new", source: "SNS", value: 200000, nextAction: "初回連絡", nextDate: "2026-03-30", createdAt: "2026-03-27" },
  { id: "lead-4", company: "ブルーオーシャン", contact: "山田 美咲", status: "contacted", source: "イベント", value: 800000, nextAction: "資料送付", nextDate: "2026-03-29", createdAt: "2026-03-20" },
  { id: "lead-5", company: "ノヴァ・デザイン", contact: "伊藤 健太", status: "negotiation", source: "紹介", value: 1200000, nextAction: "条件交渉", nextDate: "2026-04-01", createdAt: "2026-03-01" },
  { id: "lead-6", company: "フラワーショップ彩", contact: "中村 あゆみ", status: "won", source: "Web問い合わせ", value: 150000, nextAction: "契約締結済", nextDate: "2026-03-25", createdAt: "2026-02-28" },
  { id: "lead-7", company: "モバイルテック", contact: "小林 大輔", status: "lost", source: "テレアポ", value: 400000, nextAction: "—", nextDate: "—", createdAt: "2026-03-05" },
];

const mockClients: Client[] = [
  { id: "cl-1", company: "株式会社サンプル", contact: "高橋 誠", industry: "IT", monthlyRevenue: 250000, contractStart: "2025-10-01", status: "active", projects: 2 },
  { id: "cl-2", company: "合同会社テスト", contact: "渡辺 真理", industry: "コンサル", monthlyRevenue: 150000, contractStart: "2026-01-01", status: "active", projects: 1 },
  { id: "cl-3", company: "個人事業主 田中", contact: "田中 直樹", industry: "デザイン", monthlyRevenue: 0, contractStart: "2026-03-15", status: "active", projects: 1 },
  { id: "cl-4", company: "フラワーショップ彩", contact: "中村 あゆみ", industry: "小売", monthlyRevenue: 50000, contractStart: "2026-03-25", status: "active", projects: 0 },
];

const mockProposals: Proposal[] = [
  { id: "prop-1", title: "ECサイト構築プラン", client: "テック株式会社", amount: 500000, status: "draft", sentAt: null, expiresAt: null, createdAt: "2026-03-27" },
  { id: "prop-2", title: "SNSマーケティング支援", client: "グリーン合同会社", amount: 300000, status: "sent", sentAt: "2026-03-26", expiresAt: "2026-04-09", createdAt: "2026-03-24" },
  { id: "prop-3", title: "ブランディング＆Web制作", client: "ノヴァ・デザイン", amount: 1200000, status: "sent", sentAt: "2026-03-20", expiresAt: "2026-04-03", createdAt: "2026-03-18" },
  { id: "prop-4", title: "月額保守プラン", client: "フラワーショップ彩", amount: 50000, status: "accepted", sentAt: "2026-03-22", expiresAt: null, createdAt: "2026-03-20" },
  { id: "prop-5", title: "アプリ開発見積もり", client: "モバイルテック", amount: 400000, status: "rejected", sentAt: "2026-03-08", expiresAt: "2026-03-22", createdAt: "2026-03-06" },
];

const leadStatusConfig: Record<LeadStatus, { label: string; labelEn: string; color: string; bg: string }> = {
  new: { label: "新規", labelEn: "New", color: "#6366f1", bg: "#eef2ff" },
  contacted: { label: "連絡済", labelEn: "Contacted", color: "#8b5cf6", bg: "#f5f3ff" },
  meeting: { label: "商談中", labelEn: "Meeting", color: "#0ea5e9", bg: "#f0f9ff" },
  proposal: { label: "提案中", labelEn: "Proposal", color: "#f59e0b", bg: "#fffbeb" },
  negotiation: { label: "交渉中", labelEn: "Negotiation", color: "#ef4444", bg: "#fef2f2" },
  won: { label: "成約", labelEn: "Won", color: "#10b981", bg: "#ecfdf5" },
  lost: { label: "失注", labelEn: "Lost", color: "#6b7280", bg: "#f3f4f6" },
};

const proposalStatusConfig: Record<ProposalStatus, { label: string; labelEn: string; color: string; bg: string }> = {
  draft: { label: "下書き", labelEn: "Draft", color: "#6b7280", bg: "#f3f4f6" },
  sent: { label: "送付済", labelEn: "Sent", color: "#0ea5e9", bg: "#f0f9ff" },
  accepted: { label: "承認", labelEn: "Accepted", color: "#10b981", bg: "#ecfdf5" },
  rejected: { label: "却下", labelEn: "Rejected", color: "#ef4444", bg: "#fef2f2" },
};

function formatCurrency(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "ja" ? "ja-JP" : "en-US", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function SalesPage() {
  const { locale } = useI18n();
  const [activeTab, setActiveTab] = useState<TabKey>("leads");
  const [leadFilter, setLeadFilter] = useState<LeadStatus | "all">("all");

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "leads", label: locale === "ja" ? "リード" : "Leads", count: mockLeads.filter((l) => !["won", "lost"].includes(l.status)).length },
    { key: "clients", label: locale === "ja" ? "クライアント" : "Clients", count: mockClients.filter((c) => c.status === "active").length },
    { key: "proposals", label: locale === "ja" ? "提案書" : "Proposals", count: mockProposals.filter((p) => ["draft", "sent"].includes(p.status)).length },
    { key: "email", label: locale === "ja" ? "メール" : "Email", count: 0 },
  ];

  interface Email { _id?: string; to: string; subject: string; body: string; status: string; sentAt?: string; _created_at?: string }
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);

  useEffect(() => {
    fetch("/api/data/emails").then(r => r.json()).then(d => setEmails(d.entries || [])).catch(() => {});
  }, []);

  const filteredLeads = leadFilter === "all" ? mockLeads : mockLeads.filter((l) => l.status === leadFilter);

  const pipelineValue = mockLeads.filter((l) => !["won", "lost"].includes(l.status)).reduce((s, l) => s + l.value, 0);
  const wonValue = mockLeads.filter((l) => l.status === "won").reduce((s, l) => s + l.value, 0);
  const monthlyRecurring = mockClients.reduce((s, c) => s + c.monthlyRevenue, 0);
  const proposalPending = mockProposals.filter((p) => p.status === "sent").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          {locale === "ja" ? "営業" : "Sales"}
        </h1>
        <p className="text-sm text-[var(--color-subtext)] mt-0.5">
          {locale === "ja" ? "リード管理・顧客・提案書" : "Lead management, clients & proposals"}
        </p>
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
            <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 bg-[var(--color-border-light)] text-[var(--color-subtext)] rounded-full">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Leads Tab */}
      {activeTab === "leads" && (
        <>
          {/* Lead Status Filter */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {(["all", "new", "contacted", "meeting", "proposal", "negotiation", "won", "lost"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setLeadFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  leadFilter === s
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-[var(--color-border-light)] text-[var(--color-subtext)] hover:bg-[var(--color-border)]"
                }`}
              >
                {s === "all"
                  ? (locale === "ja" ? "すべて" : "All")
                  : (locale === "ja" ? leadStatusConfig[s].label : leadStatusConfig[s].labelEn)}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-bg)] border-b border-[var(--color-border)]">
                  <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">{locale === "ja" ? "企業名" : "Company"}</th>
                  <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">{locale === "ja" ? "担当者" : "Contact"}</th>
                  <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">{locale === "ja" ? "ステータス" : "Status"}</th>
                  <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">{locale === "ja" ? "流入元" : "Source"}</th>
                  <th className="text-right px-5 py-3 font-medium text-[var(--color-subtext)]">{locale === "ja" ? "見込み額" : "Value"}</th>
                  <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">{locale === "ja" ? "次アクション" : "Next Action"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => {
                  const sc = leadStatusConfig[lead.status];
                  return (
                    <tr key={lead.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-border-light)] transition-colors">
                      <td className="px-5 py-3 font-medium text-[var(--color-text)]">{lead.company}</td>
                      <td className="px-5 py-3 text-[var(--color-subtext)]">{lead.contact}</td>
                      <td className="px-5 py-3">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: sc.bg, color: sc.color }}>
                          {locale === "ja" ? sc.label : sc.labelEn}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[var(--color-subtext)]">{lead.source}</td>
                      <td className="px-5 py-3 text-right font-mono text-[var(--color-text)]">{formatCurrency(lead.value, locale)}</td>
                      <td className="px-5 py-3">
                        <div className="text-[var(--color-text)]">{lead.nextAction}</div>
                        {lead.nextDate !== "—" && (
                          <div className="text-[10px] text-[var(--color-subtext)] mt-0.5">{lead.nextDate}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Clients Tab */}
      {activeTab === "clients" && (
        <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-bg)] border-b border-[var(--color-border)]">
                <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">{locale === "ja" ? "企業名" : "Company"}</th>
                <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">{locale === "ja" ? "担当者" : "Contact"}</th>
                <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">{locale === "ja" ? "業種" : "Industry"}</th>
                <th className="text-right px-5 py-3 font-medium text-[var(--color-subtext)]">{locale === "ja" ? "月額売上" : "Monthly Rev"}</th>
                <th className="text-center px-5 py-3 font-medium text-[var(--color-subtext)]">{locale === "ja" ? "案件数" : "Projects"}</th>
                <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">{locale === "ja" ? "契約開始" : "Since"}</th>
              </tr>
            </thead>
            <tbody>
              {mockClients.map((client) => (
                <tr key={client.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-border-light)] transition-colors">
                  <td className="px-5 py-3 font-medium text-[var(--color-text)]">{client.company}</td>
                  <td className="px-5 py-3 text-[var(--color-subtext)]">{client.contact}</td>
                  <td className="px-5 py-3">
                    <span className="text-[10px] font-medium px-2 py-0.5 bg-[var(--color-border-light)] text-[var(--color-subtext)] rounded">
                      {client.industry}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-[var(--color-text)]">
                    {client.monthlyRevenue > 0 ? formatCurrency(client.monthlyRevenue, locale) : "—"}
                  </td>
                  <td className="px-5 py-3 text-center text-[var(--color-text)]">{client.projects}</td>
                  <td className="px-5 py-3 text-[var(--color-subtext)]">{client.contractStart}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Proposals Tab */}
      {activeTab === "proposals" && (
        <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-bg)] border-b border-[var(--color-border)]">
                <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">{locale === "ja" ? "タイトル" : "Title"}</th>
                <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">{locale === "ja" ? "クライアント" : "Client"}</th>
                <th className="text-right px-5 py-3 font-medium text-[var(--color-subtext)]">{locale === "ja" ? "金額" : "Amount"}</th>
                <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">{locale === "ja" ? "ステータス" : "Status"}</th>
                <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">{locale === "ja" ? "送付日" : "Sent"}</th>
                <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">{locale === "ja" ? "有効期限" : "Expires"}</th>
              </tr>
            </thead>
            <tbody>
              {mockProposals.map((prop) => {
                const ps = proposalStatusConfig[prop.status];
                return (
                  <tr key={prop.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-border-light)] transition-colors">
                    <td className="px-5 py-3 font-medium text-[var(--color-text)]">{prop.title}</td>
                    <td className="px-5 py-3 text-[var(--color-subtext)]">{prop.client}</td>
                    <td className="px-5 py-3 text-right font-mono text-[var(--color-text)]">{formatCurrency(prop.amount, locale)}</td>
                    <td className="px-5 py-3">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: ps.bg, color: ps.color }}>
                        {locale === "ja" ? ps.label : ps.labelEn}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[var(--color-subtext)]">{prop.sentAt ?? "—"}</td>
                    <td className="px-5 py-3 text-[var(--color-subtext)]">{prop.expiresAt ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Email */}
      {activeTab === "email" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-[var(--color-subtext)]">
              {locale === "ja" ? "営業エージェントにチャットで下書き・送信を依頼できます" : "Ask the sales agent to draft or send emails"}
            </p>
            <button onClick={() => { setShowCompose(true); setEmailTo(""); setEmailSubject(""); setEmailBody(""); }}
              className="px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              {locale === "ja" ? "新規作成" : "Compose"}
            </button>
          </div>

          {emails.length === 0 ? (
            <div className="bg-white rounded-xl border border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-subtext)]">
              {locale === "ja" ? "メールがありません。営業エージェントに「メール下書きして」と依頼してみてください。" : "No emails. Ask the sales agent to draft one."}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-bg)] border-b border-[var(--color-border)]">
                    <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">{locale === "ja" ? "ステータス" : "Status"}</th>
                    <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">{locale === "ja" ? "宛先" : "To"}</th>
                    <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">{locale === "ja" ? "件名" : "Subject"}</th>
                    <th className="text-left px-5 py-3 font-medium text-[var(--color-subtext)]">{locale === "ja" ? "日時" : "Date"}</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.map((em, i) => (
                    <tr key={i} onClick={() => setSelectedEmail(em)}
                      className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-border-light)] cursor-pointer transition-colors">
                      <td className="px-5 py-3">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${em.status === "sent" ? "bg-green-50 text-green-600" : em.status === "draft" ? "bg-yellow-50 text-yellow-600" : "bg-gray-100 text-gray-500"}`}>
                          {em.status === "sent" ? (locale === "ja" ? "送信済" : "Sent") : em.status === "draft" ? (locale === "ja" ? "下書き" : "Draft") : em.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[var(--color-text)]">{em.to}</td>
                      <td className="px-5 py-3 text-[var(--color-text)]">{em.subject}</td>
                      <td className="px-5 py-3 text-[var(--color-subtext)] text-xs">{em._created_at || em.sentAt || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Email Detail Modal */}
      {selectedEmail && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedEmail(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
              <div>
                <h3 className="font-semibold text-[var(--color-text)]">{selectedEmail.subject}</h3>
                <p className="text-xs text-[var(--color-subtext)] mt-0.5">{locale === "ja" ? "宛先" : "To"}: {selectedEmail.to}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${selectedEmail.status === "sent" ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}`}>
                  {selectedEmail.status === "sent" ? (locale === "ja" ? "送信済" : "Sent") : (locale === "ja" ? "下書き" : "Draft")}
                </span>
                <button onClick={() => setSelectedEmail(null)} className="p-1 text-[var(--color-subtext)] hover:text-[var(--color-text)]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <pre className="text-sm text-[var(--color-text)] whitespace-pre-wrap font-sans">{selectedEmail.body}</pre>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Compose Modal */}
      {showCompose && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowCompose(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
              <h3 className="font-semibold text-[var(--color-text)]">{locale === "ja" ? "メール作成" : "Compose"}</h3>
              <button onClick={() => setShowCompose(false)} className="p-1 text-[var(--color-subtext)] hover:text-[var(--color-text)]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder={locale === "ja" ? "宛先" : "To"}
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder={locale === "ja" ? "件名" : "Subject"}
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={8} placeholder={locale === "ja" ? "本文" : "Body"}
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none" />
              <div className="flex gap-2">
                <button onClick={async () => {
                  if (!emailTo || !emailSubject) return;
                  setEmailSaving(true);
                  await fetch("/api/data/emails", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: emailTo, subject: emailSubject, body: emailBody, status: "draft" }) });
                  const r = await fetch("/api/data/emails"); const d = await r.json(); setEmails(d.entries || []);
                  setEmailSaving(false); setShowCompose(false);
                }} disabled={emailSaving || !emailTo || !emailSubject}
                  className="px-4 py-2 border border-[var(--color-border)] text-sm font-medium rounded-lg hover:bg-[var(--color-border-light)] disabled:opacity-50 transition-colors">
                  {locale === "ja" ? "下書き保存" : "Save Draft"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
