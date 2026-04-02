"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { EmployeeAvatar } from "@/components/employee-avatar";

interface Schedule {
  _id: string;
  name: string;
  cron: string;
  empId: string;
  task: string;
  nextRun: string | null;
  _created_at?: string;
}

const cronToLabel = (cron: string, locale: string): string => {
  const parts = cron.split(" ");
  if (parts.length < 5) return cron;
  const [min, hour, , , dow] = parts;

  const dowMap: Record<string, string> = locale === "ja"
    ? { "*": "毎日", "1-5": "平日", "0": "日", "1": "月", "2": "火", "3": "水", "4": "木", "5": "金", "6": "土", "0,6": "土日" }
    : { "*": "Daily", "1-5": "Weekdays", "0": "Sun", "1": "Mon", "2": "Tue", "3": "Wed", "4": "Thu", "5": "Fri", "6": "Sat", "0,6": "Weekends" };

  const dayLabel = dowMap[dow] || dow;
  return `${dayLabel} ${hour}:${min.padStart(2, "0")}`;
};

export default function SchedulesPage() {
  const { locale } = useI18n();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedules = () => {
    fetch("/api/schedules")
      .then((r) => r.json())
      .then((d) => setSchedules(d.schedules || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSchedules(); }, []);

  const deleteSchedule = async (id: string) => {
    await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _action: "delete", id }),
    });
    fetchSchedules();
  };

  return (
    <div className="px-8 py-8 animate-fade-in max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          {locale === "ja" ? "定期実行" : "Schedules"}
        </h1>
        <p className="text-sm text-[var(--color-subtext)] mt-0.5">
          {locale === "ja" ? "エージェントに「毎朝9時に〇〇して」と頼むと登録されます" : "Ask an agent to schedule recurring tasks"}
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-[var(--color-border-light)] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-12 text-center">
          <svg className="w-10 h-10 text-[var(--color-subtext)] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-[var(--color-subtext)]">
            {locale === "ja" ? "定期実行はまだありません" : "No schedules yet"}
          </p>
          <p className="text-xs text-[var(--color-subtext)] mt-1">
            {locale === "ja" ? "秘書に「毎週月曜9時に週次レポート作って」と頼んでみてください" : "Ask your secretary to create a recurring task"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map((s) => (
            <div key={s._id} className="bg-white rounded-xl border border-[var(--color-border)] p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <EmployeeAvatar seed={s.empId} size="2.5rem" className="shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-sm text-[var(--color-text)]">{s.name || s.task.slice(0, 30)}</h3>
                    <p className="text-xs text-[var(--color-subtext)] mt-0.5 line-clamp-2">{s.task}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary-light)] px-2 py-0.5 rounded-full">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {cronToLabel(s.cron, locale)}
                      </span>
                      <span className="text-[10px] text-[var(--color-subtext)] font-mono">{s.cron}</span>
                      {s.nextRun && (
                        <span className="text-[10px] text-[var(--color-subtext)]">
                          {locale === "ja" ? "次回:" : "Next:"} {s.nextRun.slice(0, 16)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteSchedule(s._id)}
                  className="p-1.5 text-[var(--color-subtext)] hover:text-[var(--color-danger)] transition-colors shrink-0"
                  title={locale === "ja" ? "削除" : "Delete"}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
