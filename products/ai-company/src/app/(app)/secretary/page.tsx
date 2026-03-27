"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { mockTasks, mockScheduleEvents, mockActivityLogs, mockEmployees } from "@/data/mock";
import { EmployeeAvatar } from "@/components/employee-avatar";
import Link from "next/link";

type TabKey = "today" | "todos" | "notes" | "inbox";

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

interface InboxItem {
  id: string;
  from: string;
  subject: string;
  preview: string;
  read: boolean;
  createdAt: string;
}

const mockNotes: Note[] = [
  { id: "note-1", title: "クライアントミーティングメモ", content: "株式会社サンプルとの打ち合わせ。デザイン案Bで合意。4月中旬に初回納品。追加でSEO対策の見積もりを依頼された。", createdAt: "2026-03-27T11:30:00Z" },
  { id: "note-2", title: "来月のSNS方針", content: "note: 週2本ペース維持。Threads: 毎日1投稿。テーマは「春の新生活」シリーズ。たくみに伝達済み。", createdAt: "2026-03-27T09:00:00Z" },
  { id: "note-3", title: "採用候補リスト", content: "デザイナー枠: 3名面談済み。エンジニア枠: 来週2名。ゆうき（人事）と連携して進める。", createdAt: "2026-03-26T16:00:00Z" },
  { id: "note-4", title: "経費締め切りリマインド", content: "3月分の経費精算は3/31まで。あおい（経理）に提出リマインドを送ること。", createdAt: "2026-03-26T10:00:00Z" },
];

const mockInbox: InboxItem[] = [
  { id: "inbox-1", from: "株式会社サンプル", subject: "デザイン修正依頼", preview: "先日お送りいただいたデザイン案について、一点修正をお願いしたく...", read: false, createdAt: "2026-03-27T14:30:00Z" },
  { id: "inbox-2", from: "合同会社テスト", subject: "4月のコンサルスケジュール", preview: "来月のコンサルティング日程を確認させてください。第2週の火曜...", read: false, createdAt: "2026-03-27T11:00:00Z" },
  { id: "inbox-3", from: "Google Workspace", subject: "ストレージ使用量通知", preview: "ストレージの75%を使用しています。アップグレードをご検討...", read: true, createdAt: "2026-03-27T08:00:00Z" },
  { id: "inbox-4", from: "ノヴァ・デザイン", subject: "Re: ブランディング提案書", preview: "ご提案ありがとうございます。社内で検討の上、来週ご連絡...", read: true, createdAt: "2026-03-26T17:00:00Z" },
  { id: "inbox-5", from: "LINE Notify", subject: "新着メッセージ (3件)", preview: "LINEに3件の未読メッセージがあります。", read: true, createdAt: "2026-03-26T15:00:00Z" },
];

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
  const [activeTab, setActiveTab] = useState<TabKey>("today");

  const today = new Date().toISOString().split("T")[0];
  const todayEvents = mockScheduleEvents.filter((e) => e.date === today);
  const pendingTasks = mockTasks.filter((tk) => tk.status !== "done" && tk.status !== "cancelled");
  const unreadInbox = mockInbox.filter((i) => !i.read).length;

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: "today", label: locale === "ja" ? "今日の概要" : "Today" },
    { key: "todos", label: locale === "ja" ? "TODO" : "TODOs", badge: pendingTasks.length },
    { key: "notes", label: locale === "ja" ? "メモ" : "Notes" },
    { key: "inbox", label: locale === "ja" ? "受信箱" : "Inbox", badge: unreadInbox > 0 ? unreadInbox : undefined },
  ];

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
          { label: locale === "ja" ? "今日の予定" : "Today's Events", value: todayEvents.length, color: "var(--color-primary)" },
          { label: locale === "ja" ? "未完了タスク" : "Pending Tasks", value: pendingTasks.length, color: "var(--color-warning)" },
          { label: locale === "ja" ? "未読メール" : "Unread", value: unreadInbox, color: "var(--color-danger)" },
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

      {/* Today */}
      {activeTab === "today" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Schedule */}
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
            <h2 className="font-semibold text-[var(--color-text)] mb-4">
              {locale === "ja" ? "今日のスケジュール" : "Today's Schedule"}
            </h2>
            {todayEvents.length === 0 ? (
              <p className="text-sm text-[var(--color-subtext)] py-4 text-center">
                {locale === "ja" ? "今日の予定はありません" : "No events today"}
              </p>
            ) : (
              <div className="space-y-3">
                {todayEvents.map((evt) => (
                  <div key={evt.id} className="flex gap-3 items-start">
                    <div className="text-xs font-mono text-[var(--color-primary)] font-medium pt-0.5 w-12 shrink-0">
                      {evt.startTime}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--color-text)]">{evt.title}</p>
                      <p className="text-xs text-[var(--color-subtext)] mt-0.5">{evt.description}</p>
                      <div className="flex items-center gap-1 mt-1.5">
                        {evt.employeeIds.slice(0, 4).map((eid) => (
                          <EmployeeAvatar key={eid} seed={eid} size="1.25rem" />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-[var(--color-text)]">
                {locale === "ja" ? "最近のアクティビティ" : "Recent Activity"}
              </h2>
              <Link href="/activity" className="text-xs text-[var(--color-primary)] hover:underline">
                {t.common.viewAll}
              </Link>
            </div>
            <div className="space-y-3">
              {mockActivityLogs.slice(0, 5).map((log) => {
                const emp = log.employeeId ? mockEmployees.find((e) => e.id === log.employeeId) : null;
                return (
                  <div key={log.id} className="flex items-start gap-3">
                    {emp ? (
                      <EmployeeAvatar seed={emp.id} size="1.75rem" className="shrink-0 mt-0.5" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-[var(--color-border-light)] flex items-center justify-center shrink-0 mt-0.5">
                        <div className="w-2 h-2 rounded-full bg-[var(--color-subtext)]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--color-text)] leading-snug">{log.summary}</p>
                      <p className="text-[10px] text-[var(--color-subtext)] mt-0.5">
                        {getTimeLabel(log.createdAt, locale)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Urgent Tasks */}
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-6 lg:col-span-2">
            <h2 className="font-semibold text-[var(--color-text)] mb-4">
              {locale === "ja" ? "注目タスク" : "Priority Tasks"}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingTasks.filter((tk) => tk.priority === "high" || tk.status === "in_progress").slice(0, 6).map((task) => {
                const emp = mockEmployees.find((e) => e.id === task.employeeId);
                return (
                  <div key={task.id} className="border border-[var(--color-border)] rounded-lg p-4 hover:border-[var(--color-primary)] transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      {task.priority === "high" && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 bg-red-50 text-red-600 rounded">
                          {locale === "ja" ? "高" : "High"}
                        </span>
                      )}
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        task.status === "in_progress"
                          ? "bg-[var(--color-warning-light)] text-[var(--color-warning)]"
                          : "bg-[var(--color-border-light)] text-[var(--color-subtext)]"
                      }`}>
                        {task.status === "in_progress"
                          ? (locale === "ja" ? "進行中" : "In Progress")
                          : (locale === "ja" ? "未着手" : "Pending")}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[var(--color-text)] mb-1">{task.title}</p>
                    {emp && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <EmployeeAvatar seed={emp.id} size="1.25rem" />
                        <span className="text-xs text-[var(--color-subtext)]">{emp.name}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TODOs */}
      {activeTab === "todos" && (
        <div className="bg-white rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
          {pendingTasks.map((task) => {
            const emp = mockEmployees.find((e) => e.id === task.employeeId);
            return (
              <div key={task.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--color-border-light)] transition-colors">
                <div className={`w-5 h-5 rounded border-2 shrink-0 ${
                  task.status === "in_progress"
                    ? "border-[var(--color-warning)] bg-[var(--color-warning-light)]"
                    : "border-[var(--color-border)]"
                }`}>
                  {task.status === "in_progress" && (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-[var(--color-warning)]" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--color-text)]">{task.title}</span>
                    {task.priority === "high" && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 bg-red-50 text-red-600 rounded">
                        {locale === "ja" ? "高" : "High"}
                      </span>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-xs text-[var(--color-subtext)] mt-0.5 truncate">{task.description}</p>
                  )}
                </div>
                {emp && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <EmployeeAvatar seed={emp.id} size="1.5rem" />
                    <span className="text-xs text-[var(--color-subtext)]">{emp.name}</span>
                  </div>
                )}
                {task.dueDate && (
                  <span className="text-xs text-[var(--color-subtext)] shrink-0">
                    {new Date(task.dueDate).toLocaleDateString(locale === "ja" ? "ja-JP" : "en-US", { month: "short", day: "numeric" })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

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
      {activeTab === "inbox" && (
        <div className="bg-white rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
          {mockInbox.map((item) => (
            <div key={item.id} className={`flex items-start gap-4 px-5 py-4 hover:bg-[var(--color-border-light)] transition-colors cursor-pointer ${!item.read ? "bg-blue-50/30" : ""}`}>
              <div className="mt-1.5 shrink-0">
                {!item.read ? (
                  <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)]" />
                ) : (
                  <div className="w-2.5 h-2.5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-sm ${!item.read ? "font-semibold text-[var(--color-text)]" : "font-medium text-[var(--color-text)]"}`}>
                    {item.from}
                  </span>
                  <span className="text-[10px] text-[var(--color-subtext)]">
                    {getTimeLabel(item.createdAt, locale)}
                  </span>
                </div>
                <p className={`text-sm ${!item.read ? "font-medium text-[var(--color-text)]" : "text-[var(--color-subtext)]"}`}>
                  {item.subject}
                </p>
                <p className="text-xs text-[var(--color-subtext)] mt-0.5 truncate">{item.preview}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
