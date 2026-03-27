"use client";

import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { ActivityLog } from "@/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof api.getDashboardStats>> | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    api.getDashboardStats().then(setStats);
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Mock chart data points
  const chartData = [20, 35, 28, 45, 52, 48, 60, 55, 72, 68, 75, 80];
  const maxVal = Math.max(...chartData);
  const chartHeight = 160;

  return (
    <div className="px-8 py-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">{t.analytics.title}</h1>
          <p className="text-sm text-[var(--color-subtext)] mt-0.5">{t.analytics.subtitle}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: t.analytics.employees, value: stats.totalEmployees, change: "+1", up: true },
          { label: t.analytics.tasksDone, value: stats.tasksDone, change: "+2", up: true },
          { label: t.analytics.inProgress, value: stats.tasksInProgress, change: "0", up: false },
          { label: t.analytics.snsPosts, value: stats.snsPostsToday, change: "+3", up: true },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[var(--color-border)] p-5">
            <p className="text-xs text-[var(--color-subtext)] mb-1">{s.label}</p>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-bold text-[var(--color-text)]">{s.value}</p>
              <span className={`text-xs font-medium mb-1 ${s.up ? "text-[var(--color-success)]" : "text-[var(--color-subtext)]"}`}>
                {s.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[var(--color-border)] p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-[var(--color-text)]">{t.analytics.activityOverview}</h2>
            <div className="flex gap-1">
              {([
                { key: "Week", label: t.analytics.week },
                { key: "Month", label: t.analytics.month },
                { key: "Year", label: t.analytics.year },
              ] as const).map((period) => (
                <button
                  key={period.key}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    period.key === "Month"
                      ? "bg-[var(--color-primary)] text-white"
                      : "text-[var(--color-subtext)] hover:bg-[var(--color-border-light)]"
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>

          {/* SVG Line Chart */}
          <div className="relative">
            <svg viewBox={`0 0 ${(chartData.length - 1) * 60} ${chartHeight}`} className="w-full h-40">
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
                <line
                  key={ratio}
                  x1="0"
                  y1={chartHeight * ratio}
                  x2={(chartData.length - 1) * 60}
                  y2={chartHeight * ratio}
                  stroke="var(--color-border-light)"
                  strokeWidth="1"
                />
              ))}
              {/* Line */}
              <polyline
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={chartData
                  .map((v, i) => `${i * 60},${chartHeight - (v / maxVal) * (chartHeight - 20)}`)
                  .join(" ")}
              />
              {/* Area fill */}
              <polygon
                fill="var(--color-primary)"
                opacity="0.08"
                points={`0,${chartHeight} ${chartData
                  .map((v, i) => `${i * 60},${chartHeight - (v / maxVal) * (chartHeight - 20)}`)
                  .join(" ")} ${(chartData.length - 1) * 60},${chartHeight}`}
              />
              {/* Dots */}
              {chartData.map((v, i) => (
                <circle
                  key={i}
                  cx={i * 60}
                  cy={chartHeight - (v / maxVal) * (chartHeight - 20)}
                  r="3"
                  fill="white"
                  stroke="var(--color-primary)"
                  strokeWidth="2"
                />
              ))}
            </svg>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
          <h2 className="font-semibold text-[var(--color-text)] mb-5">{t.analytics.recentEvents}</h2>
          <div className="space-y-4">
            {stats.recentActivity.map((log: ActivityLog) => (
              <div key={log.id} className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  log.type === "sns_post" ? "bg-[var(--color-success)]" :
                  log.type === "task" ? "bg-[var(--color-primary)]" :
                  log.type === "chat" ? "bg-[var(--color-info)]" :
                  log.type === "error" ? "bg-[var(--color-danger)]" :
                  "bg-[var(--color-subtext)]"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--color-text)] leading-snug">{log.summary}</p>
                  <p className="text-xs text-[var(--color-subtext)] mt-0.5">{timeAgo(log.createdAt, t.time)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
