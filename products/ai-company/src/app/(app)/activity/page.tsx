"use client";

import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { ActivityLog, ActivityType } from "@/types";

const typeColors: Record<ActivityType, string> = {
  chat: "var(--color-info)",
  task: "var(--color-primary)",
  sns_post: "var(--color-success)",
  error: "var(--color-danger)",
  system: "var(--color-subtext)",
};

export default function ActivityPage() {
  const { t } = useI18n();
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    api.getActivityLogs().then(setLogs);
  }, []);

  return (
    <div className="px-8 py-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">{t.activity.title}</h1>
        <p className="text-sm text-[var(--color-subtext)] mt-0.5">{t.activity.subtitle}</p>
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-border)]">
        {logs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-[var(--color-subtext)]">{t.common.noData}</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {logs.map((log) => {
              const color = typeColors[log.type] ?? typeColors.system;
              const label = t.activity.types[log.type] ?? t.activity.types.system;
              return (
                <div key={log.id} className="flex items-start gap-4 px-6 py-4">
                  <div className="mt-1.5 shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--color-text)]">{log.summary}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: color + "18", color: color }}
                      >
                        {label}
                      </span>
                      <span className="text-xs text-[var(--color-subtext)]">{timeAgo(log.createdAt, t.time)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
