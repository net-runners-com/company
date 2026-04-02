"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";

type Period = "week" | "month" | "year";

const revenueData: Record<Period, { labels: string[]; values: number[] }> = {
  week: {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    values: [45000, 62000, 38000, 85000, 72000, 28000, 15000],
  },
  month: {
    labels: ["1W", "2W", "3W", "4W"],
    values: [320000, 480000, 390000, 550000],
  },
  year: {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    values: [980000, 1120000, 1350000, 1280000, 1450000, 1600000, 1520000, 1380000, 1650000, 1720000, 1580000, 1900000],
  },
};

const revenueDataJa: Record<Period, { labels: string[] }> = {
  week: { labels: ["月", "火", "水", "木", "金", "土", "日"] },
  month: { labels: ["1週", "2週", "3週", "4週"] },
  year: { labels: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"] },
};

function formatCurrency(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "ja" ? "ja-JP" : "en-US", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function RevenuePage() {
  const [period, setPeriod] = useState<Period>("month");
  const { t, locale } = useI18n();

  const data = revenueData[period];
  const labels = locale === "ja" ? revenueDataJa[period].labels : data.labels;
  const maxVal = Math.max(...data.values);
  const total = data.values.reduce((s, v) => s + v, 0);
  const avg = Math.round(total / data.values.length);
  const current = data.values[data.values.length - 1];
  const prev = data.values[data.values.length - 2] || current;
  const growthPercent = prev > 0 ? Math.round(((current - prev) / prev) * 100) : 0;

  const chartHeight = 200;
  const chartWidth = (data.values.length - 1) * 80;

  return (
    <div className="px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">{t.analytics.revenue}</h1>
          <p className="text-sm text-[var(--color-subtext)] mt-0.5">{t.analytics.revenueSubtitle}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: t.analytics.totalRevenue,
            value: formatCurrency(total, locale),
            color: "var(--color-primary)",
            bg: "var(--color-primary-light)",
          },
          {
            label: t.analytics.monthlyAvg,
            value: formatCurrency(avg, locale),
            color: "var(--color-info)",
            bg: "var(--color-info-light)",
          },
          {
            label: t.analytics.thisMonth,
            value: formatCurrency(current, locale),
            color: "var(--color-success)",
            bg: "var(--color-success-light)",
          },
          {
            label: t.analytics.growth,
            value: `${growthPercent >= 0 ? "+" : ""}${growthPercent}%`,
            color: growthPercent >= 0 ? "var(--color-success)" : "var(--color-danger)",
            bg: growthPercent >= 0 ? "var(--color-success-light)" : "var(--color-danger-light)",
          },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[var(--color-border)] p-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: s.bg }}>
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            </div>
            <p className="text-xl font-bold text-[var(--color-text)]">{s.value}</p>
            <p className="text-xs text-[var(--color-subtext)] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-[var(--color-text)]">{t.analytics.revenue}</h2>
          <div className="flex gap-1">
            {(["week", "month", "year"] as Period[]).map((p) => {
              const periodLabels: Record<Period, string> = {
                week: t.analytics.week,
                month: t.analytics.month,
                year: t.analytics.year,
              };
              return (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    period === p
                      ? "bg-[var(--color-primary)] text-white"
                      : "text-[var(--color-subtext)] hover:bg-[var(--color-border-light)]"
                  }`}
                >
                  {periodLabels[p]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bar + Line Chart */}
        <div className="relative overflow-x-auto">
          <svg viewBox={`0 0 ${Math.max(chartWidth, 400)} ${chartHeight + 40}`} className="w-full" style={{ minWidth: data.values.length > 7 ? "600px" : undefined }}>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
              <line
                key={ratio}
                x1="0"
                y1={chartHeight * ratio + 10}
                x2={Math.max(chartWidth, 400)}
                y2={chartHeight * ratio + 10}
                stroke="var(--color-border-light)"
                strokeWidth="1"
              />
            ))}

            {/* Bars */}
            {data.values.map((v, i) => {
              const barWidth = Math.min(40, (Math.max(chartWidth, 400) / data.values.length) * 0.5);
              const x = (i / (data.values.length - 1 || 1)) * Math.max(chartWidth - barWidth, 350) + barWidth / 2;
              const barHeight = (v / maxVal) * (chartHeight - 20);
              return (
                <g key={i}>
                  <rect
                    x={x - barWidth / 2}
                    y={chartHeight + 10 - barHeight}
                    width={barWidth}
                    height={barHeight}
                    rx={4}
                    fill="var(--color-primary)"
                    opacity={0.15}
                  />
                  <rect
                    x={x - barWidth / 2}
                    y={chartHeight + 10 - barHeight}
                    width={barWidth}
                    height={Math.min(barHeight, 4)}
                    rx={2}
                    fill="var(--color-primary)"
                    opacity={0.4}
                  />
                </g>
              );
            })}

            {/* Line */}
            <polyline
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={data.values.map((v, i) => {
                const barWidth = Math.min(40, (Math.max(chartWidth, 400) / data.values.length) * 0.5);
                const x = (i / (data.values.length - 1 || 1)) * Math.max(chartWidth - barWidth, 350) + barWidth / 2;
                const y = chartHeight + 10 - (v / maxVal) * (chartHeight - 20);
                return `${x},${y}`;
              }).join(" ")}
            />

            {/* Dots */}
            {data.values.map((v, i) => {
              const barWidth = Math.min(40, (Math.max(chartWidth, 400) / data.values.length) * 0.5);
              const x = (i / (data.values.length - 1 || 1)) * Math.max(chartWidth - barWidth, 350) + barWidth / 2;
              const y = chartHeight + 10 - (v / maxVal) * (chartHeight - 20);
              return (
                <circle key={i} cx={x} cy={y} r="3.5" fill="white" stroke="var(--color-primary)" strokeWidth="2" />
              );
            })}

            {/* Labels */}
            {labels.map((label, i) => {
              const barWidth = Math.min(40, (Math.max(chartWidth, 400) / data.values.length) * 0.5);
              const x = (i / (data.values.length - 1 || 1)) * Math.max(chartWidth - barWidth, 350) + barWidth / 2;
              return (
                <text
                  key={i}
                  x={x}
                  y={chartHeight + 35}
                  textAnchor="middle"
                  fill="var(--color-subtext)"
                  fontSize="10"
                >
                  {label}
                </text>
              );
            })}
          </svg>
        </div>

        {/* Data Table */}
        <div className="mt-6 border-t border-[var(--color-border)] pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {labels.map((label, i) => (
              <div key={label} className="flex items-center justify-between px-3 py-2 bg-[var(--color-bg)] rounded-lg">
                <span className="text-xs text-[var(--color-subtext)]">{label}</span>
                <span className="text-xs font-semibold text-[var(--color-text)]">{formatCurrency(data.values[i], locale)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
