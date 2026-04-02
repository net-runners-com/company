"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { EmployeeAvatar } from "@/components/employee-avatar";
import Link from "next/link";

interface ActivityEntry {
  empId: string;
  empName: string;
  role: string;
  threadTitle: string;
  lastMessage: string;
  lastRole: string;
  timestamp: string;
}

export default function ActivityPage() {
  const { locale } = useI18n();
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // 全社員取得
        const empRes = await fetch("/api/employees");
        const empData = await empRes.json();
        const employees = Object.values(empData) as { id: string; name: string; role: string }[];

        const entries: ActivityEntry[] = [];
        for (const emp of employees) {
          // スレッド取得
          const threadRes = await fetch("/api/employee-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ _action: "threads", employeeId: emp.id }),
          });
          const threadData = await threadRes.json();
          const threads = threadData.threads || [];

          for (const thread of threads) {
            // 最新メッセージ取得
            const histRes = await fetch("/api/employee-chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ _action: "history", employeeId: emp.id, threadId: thread.id }),
            });
            const hist = await histRes.json();
            if (Array.isArray(hist) && hist.length > 0) {
              const last = hist[hist.length - 1];
              entries.push({
                empId: emp.id,
                empName: emp.name,
                role: emp.role,
                threadTitle: thread.title,
                lastMessage: last.content?.slice(0, 100) || "",
                lastRole: last.role,
                timestamp: last.timestamp,
              });
            }
          }
        }

        // 時系列でソート（新しい順）
        entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        setActivities(entries);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return locale === "ja" ? "たった今" : "just now";
    if (min < 60) return locale === "ja" ? `${min}分前` : `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return locale === "ja" ? `${hr}時間前` : `${hr}h ago`;
    const day = Math.floor(hr / 24);
    return locale === "ja" ? `${day}日前` : `${day}d ago`;
  };

  return (
    <div className="px-8 py-8 animate-fade-in max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          {locale === "ja" ? "アクティビティ" : "Activity"}
        </h1>
        <p className="text-sm text-[var(--color-subtext)] mt-0.5">
          {locale === "ja" ? "全社員の最近の会話" : "Recent conversations across all employees"}
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-[var(--color-border)] p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--color-border-light)]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-[var(--color-border-light)] rounded" />
                  <div className="h-3 w-full bg-[var(--color-border-light)] rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-subtext)]">
          {locale === "ja" ? "まだアクティビティがありません" : "No activity yet"}
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map((a, i) => (
            <Link
              key={`${a.empId}-${a.timestamp}-${i}`}
              href={`/employee/${a.empId}`}
              className="block bg-white rounded-xl border border-[var(--color-border)] p-4 hover:border-[var(--color-primary)] hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <EmployeeAvatar seed={a.empId} size="2.5rem" className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-[var(--color-text)]">{a.empName}</span>
                      <span className="text-[10px] text-[var(--color-subtext)]">{a.role}</span>
                    </div>
                    <span className="text-[10px] text-[var(--color-subtext)] shrink-0">{timeAgo(a.timestamp)}</span>
                  </div>
                  <p className="text-xs text-[var(--color-primary)] mt-0.5">{a.threadTitle}</p>
                  <p className="text-sm text-[var(--color-subtext)] mt-1 truncate">
                    {a.lastRole === "user" ? "You: " : `${a.empName}: `}
                    {a.lastMessage}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
