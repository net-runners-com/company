"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { EmployeeAvatar } from "@/components/employee-avatar";
import { ChatView } from "@/components/chat-view";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";

type TabKey = "chat" | "profile" | "notes" | "inbox" | "news";

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

const mockNotes: Note[] = [
  { id: "note-1", title: "クライアントミーティングメモ", content: "株式会社サンプルとの打ち合わせ。デザイン案Bで合意。4月中旬に初回納品。追加でSEO対策の見積もりを依頼された。", createdAt: "2026-03-27T11:30:00Z" },
  { id: "note-2", title: "来月のSNS方針", content: "note: 週2本ペース維持。Threads: 毎日1投稿。テーマは「春の新生活」シリーズ。たくみに伝達済み。", createdAt: "2026-03-27T09:00:00Z" },
  { id: "note-3", title: "採用候補リスト", content: "デザイナー枠: 3名面談済み。エンジニア枠: 来週2名。ゆうき（人事）と連携して進める。", createdAt: "2026-03-26T16:00:00Z" },
  { id: "note-4", title: "経費締め切りリマインド", content: "3月分の経費精算は3/31まで。あおい（経理）に提出リマインドを送ること。", createdAt: "2026-03-26T10:00:00Z" },
];


interface NewsItem {
  id: string;
  title: string;
  source: string;
  category: "industry" | "tech" | "business" | "market";
  summary: string;
  url: string;
  publishedAt: string;
}

const mockNews: NewsItem[] = [
  { id: "news-1", title: "生成AI市場、2026年に10兆円規模へ — 国内企業の導入率が50%突破", source: "日経新聞", category: "tech", summary: "IDC Japanの最新調査によると、国内の生成AI市場規模は前年比65%増の1兆2000億円に達する見込み。中小企業での導入加速が寄与。", url: "#", publishedAt: "2026-03-28T06:00:00Z" },
  { id: "news-2", title: "EC業界：サブスク型モデルへの移行が加速、月額課金売上が前年比40%増", source: "ECzine", category: "industry", summary: "定期購入やメンバーシップ型ECの売上が急増。消費者の購買行動がサブスク寄りにシフトしている傾向が鮮明に。", url: "#", publishedAt: "2026-03-28T05:00:00Z" },
  { id: "news-3", title: "Claude 4.6リリース — 1Mコンテキスト対応、コーディング精度が大幅向上", source: "TechCrunch", category: "tech", summary: "Anthropicが最新モデルClaude 4.6を発表。100万トークンのコンテキストウィンドウと高精度なコード生成で開発者ワークフローを変革。", url: "#", publishedAt: "2026-03-27T22:00:00Z" },
  { id: "news-4", title: "中小企業のDX支援、政府が補助金上限を500万円に引き上げ", source: "経済産業省", category: "business", summary: "2026年度のIT導入補助金の上限額が350万円から500万円に拡大。AIツール導入も対象に含まれる。", url: "#", publishedAt: "2026-03-27T18:00:00Z" },
  { id: "news-5", title: "SNSマーケティング最新トレンド: ショート動画よりテキスト回帰の兆し", source: "MarkeZine", category: "market", summary: "Threads、Blueskyなどテキスト主体SNSの利用者が増加。長文投稿のエンゲージメント率が短尺動画を上回るケースも。", url: "#", publishedAt: "2026-03-27T14:00:00Z" },
  { id: "news-6", title: "フリーランス保護新法が4月施行 — 発注企業に契約書面の交付義務", source: "日経新聞", category: "business", summary: "フリーランスへの業務委託に書面交付を義務付ける新法が来月施行。違反企業には罰則も。外注先との契約書確認が必要。", url: "#", publishedAt: "2026-03-27T10:00:00Z" },
];

const newsCategoryConfig: Record<string, { label: string; labelEn: string; color: string; bg: string }> = {
  industry: { label: "業界", labelEn: "Industry", color: "#0ea5e9", bg: "#f0f9ff" },
  tech: { label: "テック", labelEn: "Tech", color: "#8b5cf6", bg: "#f5f3ff" },
  business: { label: "ビジネス", labelEn: "Business", color: "#f59e0b", bg: "#fffbeb" },
  market: { label: "マーケット", labelEn: "Market", color: "#10b981", bg: "#ecfdf5" },
};

function getTimeLabel(dateStr: string, locale: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return locale === "ja" ? `${diffMin}分前` : `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return locale === "ja" ? `${diffH}時間前` : `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return locale === "ja" ? `${diffD}日前` : `${diffD}d ago`;
}

export default function SecretaryPage() {
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<TabKey>("chat");

  const [secretary, setSecretary] = useState<{ id: string; name: string; role: string; department?: string; tone?: string; skills?: string[]; avatarConfig?: Record<string, string> }>({ id: "emp-1", name: "さくら", role: "秘書", department: "総務部", tone: "polite", skills: [] });
  const [profileContent, setProfileContent] = useState<string | null>(null);
  const [news, setNews] = useState<{ title: string; source: string; category: string; summary: string; url?: string; publishedAt: string }[]>([]);
  const [newsUpdating, setNewsUpdating] = useState(false);
  const [expandedNews, setExpandedNews] = useState<number | null>(null);
  const [recentActivity, setRecentActivity] = useState<{ empId: string; empName: string; role: string; threadTitle: string; lastMessage: string; lastRole: string; timestamp: string }[]>([]);

  useEffect(() => {
    fetch("/api/employees").then(r => r.json()).then(d => { const s = d["emp-1"]; if (s) setSecretary({ ...s, id: "emp-1" }); }).catch(() => {});
    fetch(`/api/employee-files?employeeId=emp-1&action=read&path=${encodeURIComponent("自己紹介.md")}`)
      .then(r => r.json())
      .then(d => { if (d.content) setProfileContent(d.content); })
      .catch(() => {});
    fetch("/api/news").then(r => r.json()).then(d => { if (d.news) setNews(d.news); }).catch(() => {});
    // 最近のアクティビティ取得
    (async () => {
      try {
        const empRes = await fetch("/api/employees");
        const empData = await empRes.json();
        const employees = Object.values(empData) as { id: string; name: string; role: string }[];
        const entries: typeof recentActivity = [];
        for (const emp of employees) {
          const threadRes = await fetch("/api/employee-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ _action: "threads", employeeId: emp.id }) });
          const { threads = [] } = await threadRes.json();
          for (const thread of threads.slice(0, 3)) {
            const histRes = await fetch("/api/employee-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ _action: "history", employeeId: emp.id, threadId: thread.id }) });
            const hist = await histRes.json();
            if (Array.isArray(hist) && hist.length > 0) {
              const last = hist[hist.length - 1];
              entries.push({ empId: emp.id, empName: emp.name, role: emp.role, threadTitle: thread.title, lastMessage: last.content?.slice(0, 100) || "", lastRole: last.role, timestamp: last.timestamp });
            }
          }
        }
        entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        setRecentActivity(entries.slice(0, 10));
      } catch {}
    })();
  }, []);

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: "chat", label: locale === "ja" ? "チャット" : "Chat" },
    { key: "profile", label: locale === "ja" ? "プロフィール" : "Profile" },
    { key: "notes", label: locale === "ja" ? "メモ" : "Notes" },
    { key: "inbox", label: locale === "ja" ? "受信箱" : "Inbox" },
    { key: "news", label: locale === "ja" ? "ニュース" : "News", badge: news.length > 0 ? news.length : undefined },
  ];

  if (activeTab === "profile" || activeTab === "chat") {
    const isProfile = activeTab === "profile";
    if (isProfile) {
      return (
        <div className="flex flex-col h-screen animate-fade-in">
          <div className="bg-white border-b border-[var(--color-border)] px-6 py-4">
            <div className="flex items-center gap-4 max-w-5xl mx-auto">
              <EmployeeAvatar seed="emp-1" size="3rem" />
              <div className="flex-1">
                <h1 className="font-semibold text-lg text-[var(--color-text)]">
                  {locale === "ja" ? "秘書室" : "Secretary"}
                </h1>
                <p className="text-sm text-[var(--color-subtext)] mt-0.5">
                  {locale === "ja" ? "さくらがお手伝いします" : "Sakura is here to help"}
                </p>
              </div>
            </div>
            <div className="flex gap-0 mt-4 max-w-5xl mx-auto border-b border-transparent -mb-[1px]">
              {tabs.map((tab) => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-[var(--color-primary)] text-[var(--color-primary)]" : "border-transparent text-[var(--color-subtext)] hover:text-[var(--color-text)]"}`}>
                  {tab.label}
                  {tab.badge !== undefined && <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 bg-[var(--color-primary)] text-white rounded-full">{tab.badge}</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-8">
              <div className="flex items-center gap-5 mb-8">
                <EmployeeAvatar seed="emp-1" size="5rem" />
                <div>
                  <h2 className="text-2xl font-bold text-[var(--color-text)]">さくら</h2>
                  <p className="text-sm text-[var(--color-subtext)] mt-1">ひしょ ・ 総務部</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(secretary?.skills || []).map((s) => (
                      <span key={s} className="px-2 py-0.5 text-xs bg-[var(--color-primary-light)] text-[var(--color-primary)] rounded-full">{s}</span>
                    ))}
                  </div>
                </div>
              </div>
              {profileContent ? (
                <article className="prose prose-sm max-w-none prose-headings:text-[var(--color-text)] prose-p:text-[var(--color-text)] prose-a:text-[var(--color-primary)] prose-strong:text-[var(--color-text)] prose-code:text-[var(--color-primary)] prose-code:bg-[var(--color-primary-light)] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-table:text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{profileContent}</ReactMarkdown>
                </article>
              ) : (
                <div className="text-center py-12">
                  <p className="text-sm text-[var(--color-subtext)]">
                    {locale === "ja" ? "チャットで「自己紹介を作成して」と頼んでみましょう" : "Ask in chat to create a profile"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
  }

  if (activeTab === "chat") {
    return (
      <div className="flex flex-col h-screen animate-fade-in">
        {/* Header */}
        <div className="bg-white border-b border-[var(--color-border)] px-6 py-4">
          <div className="flex items-center gap-4 max-w-5xl mx-auto">
            <EmployeeAvatar seed="emp-1" size="3rem" />
            <div className="flex-1">
              <h1 className="font-semibold text-lg text-[var(--color-text)]">
                {locale === "ja" ? "秘書室" : "Secretary"}
              </h1>
              <p className="text-sm text-[var(--color-subtext)] mt-0.5">
                {locale === "ja" ? "さくらがお手伝いします" : "Sakura is here to help"}
              </p>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-0 mt-4 max-w-5xl mx-auto border-b border-transparent -mb-[1px]">
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
                {tab.badge !== undefined && (
                  <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 bg-[var(--color-primary)] text-white rounded-full">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        {/* Chat */}
        <div className="flex-1 overflow-hidden">
          <ChatView employee={secretary as any} />
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <EmployeeAvatar seed="emp-1" size="3rem" />
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">
            {locale === "ja" ? "秘書室" : "Secretary"}
          </h1>
          <p className="text-sm text-[var(--color-subtext)] mt-0.5">
            {locale === "ja" ? "さくらがお手伝いします" : "Sakura is here to help"}
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: locale === "ja" ? "最近の会話" : "Recent Chats", value: recentActivity.length, color: "var(--color-primary)" },
          { label: locale === "ja" ? "メモ" : "Notes", value: mockNotes.length, color: "var(--color-info)" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-[var(--color-border)] p-5">
            <p className="text-xs text-[var(--color-subtext)] mb-1">{card.label}</p>
            <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
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
            {tab.badge !== undefined && (
              <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 bg-[var(--color-primary)] text-white rounded-full">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>



      {/* Notes */}
      {activeTab === "notes" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {mockNotes.map((note) => (
            <div key={note.id} className="bg-white rounded-xl border border-[var(--color-border)] p-5 hover:border-[var(--color-primary)] transition-colors cursor-pointer">
              <h3 className="font-medium text-[var(--color-text)] mb-2">{note.title}</h3>
              <p className="text-sm text-[var(--color-subtext)] leading-relaxed line-clamp-3">{note.content}</p>
              <p className="text-[10px] text-[var(--color-subtext)] mt-3">
                {getTimeLabel(note.createdAt, locale)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Inbox */}
      {activeTab === "inbox" && <InboxTab locale={locale} />}

      {/* News */}
      {activeTab === "news" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-[var(--color-subtext)]">
              {locale === "ja" ? "毎朝7時に自動更新" : "Auto-updated daily at 7am"}
            </p>
            <button
              onClick={async () => {
                setNewsUpdating(true);
                try {
                  await fetch("/api/news", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ _action: "update" }) });
                  // 少し待ってから再取得
                  setTimeout(async () => {
                    const res = await fetch("/api/news");
                    const d = await res.json();
                    if (d.news) setNews(d.news);
                    setNewsUpdating(false);
                  }, 10000);
                } catch { setNewsUpdating(false); }
              }}
              disabled={newsUpdating}
              className="px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-light)] disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {newsUpdating ? <div className="w-3 h-3 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" /> : null}
              {locale === "ja" ? "今すぐ更新" : "Update Now"}
            </button>
          </div>
          <div className="space-y-4">
            {news.length === 0 && !newsUpdating && (
              <p className="text-sm text-[var(--color-subtext)] text-center py-8">
                {locale === "ja" ? "ニュースがありません。「今すぐ更新」を押してください。" : "No news. Click 'Update Now'."}
              </p>
            )}
            {news.map((item, i) => {
              const cat = newsCategoryConfig[item.category] || newsCategoryConfig.business;
              const isExpanded = expandedNews === i;
              return (
                <div key={i}
                  onClick={() => setExpandedNews(isExpanded ? null : i)}
                  className={`bg-white rounded-xl border p-5 cursor-pointer transition-all ${isExpanded ? "border-[var(--color-primary)] shadow-md" : "border-[var(--color-border)] hover:border-[var(--color-primary)]"}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: cat.bg, color: cat.color }}>
                      {locale === "ja" ? cat.label : cat.labelEn}
                    </span>
                    <span className="text-[10px] text-[var(--color-subtext)]">{item.source}</span>
                    <svg className={`w-3 h-3 text-[var(--color-subtext)] ml-auto transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <h3 className="font-medium text-[var(--color-text)] leading-snug">{item.title}</h3>
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                      <p className="text-sm text-[var(--color-text)] leading-relaxed">{item.summary}</p>
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-primary)] hover:underline">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                          {locale === "ja" ? "記事を読む" : "Read article"}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function InboxTab({ locale }: { locale: string }) {
  const [emails, setEmails] = useState<{ id: string; from: string; subject: string; snippet: string; date: string; unread: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const WORKER = "http://localhost:8000";
        const res = await fetch(`${WORKER}/nango/proxy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            method: "GET",
            endpoint: "/gmail/v1/users/me/messages?maxResults=15&labelIds=INBOX",
            connectionId: "__auto__",
            provider: "google-mail",
          }),
        });
        if (!res.ok) throw new Error("Gmail API failed");
        const data = await res.json();
        const messages = data.messages || [];
        const items: typeof emails = [];
        for (const msg of messages.slice(0, 15)) {
          const detailRes = await fetch(`${WORKER}/nango/proxy`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              method: "GET",
              endpoint: `/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
              connectionId: "__auto__",
              provider: "google-mail",
            }),
          });
          const detail = await detailRes.json();
          const headers = detail.payload?.headers || [];
          const from = headers.find((h: { name: string }) => h.name === "From")?.value || "";
          const subject = headers.find((h: { name: string }) => h.name === "Subject")?.value || "(no subject)";
          const unread = (detail.labelIds || []).includes("UNREAD");
          items.push({
            id: msg.id,
            from: from.replace(/<.*>/, "").trim(),
            subject,
            snippet: detail.snippet || "",
            date: new Date(Number(detail.internalDate)).toISOString(),
            unread,
          });
        }
        setEmails(items);
      } catch (e) {
        setError(locale === "ja" ? "Gmailに接続できませんでした。設定からGoogleアカウントを連携してください。" : "Could not connect to Gmail. Please link your Google account in settings.");
      }
      setLoading(false);
    })();
  }, [locale]);

  if (loading) return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="bg-white rounded-xl border border-[var(--color-border)] p-4 animate-pulse">
          <div className="h-4 w-40 bg-[var(--color-border-light)] rounded mb-2" />
          <div className="h-3 w-full bg-[var(--color-border-light)] rounded" />
        </div>
      ))}
    </div>
  );

  if (error) return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-8 text-center">
      <p className="text-sm text-[var(--color-subtext)]">{error}</p>
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
      {emails.length === 0 ? (
        <div className="p-8 text-center text-sm text-[var(--color-subtext)]">
          {locale === "ja" ? "メールがありません" : "No emails"}
        </div>
      ) : emails.map(item => (
        <div key={item.id} className={`flex items-start gap-4 px-5 py-4 hover:bg-[var(--color-border-light)] transition-colors cursor-pointer ${item.unread ? "bg-blue-50/30" : ""}`}>
          <div className="mt-1.5 shrink-0">
            {item.unread ? <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)]" /> : <div className="w-2.5 h-2.5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-sm ${item.unread ? "font-semibold text-[var(--color-text)]" : "font-medium text-[var(--color-text)]"}`}>{item.from}</span>
              <span className="text-[10px] text-[var(--color-subtext)]">{getTimeLabel(item.date, locale)}</span>
            </div>
            <p className={`text-sm ${item.unread ? "font-medium text-[var(--color-text)]" : "text-[var(--color-subtext)]"}`}>{item.subject}</p>
            <p className="text-xs text-[var(--color-subtext)] mt-0.5 truncate">{item.snippet}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
