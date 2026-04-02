"use client";

import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { EmployeeAvatar } from "@/components/employee-avatar";
import type { Project, ProjectStatus } from "@/types";

type Filter = "all" | ProjectStatus;

const statusColors: Record<string, { color: string; bg: string }> = {
  active: { color: "var(--color-success)", bg: "var(--color-success-light)" },
  completed: { color: "var(--color-primary)", bg: "var(--color-primary-light)" },
  on_hold: { color: "var(--color-warning)", bg: "var(--color-warning-light)" },
  cancelled: { color: "var(--color-danger)", bg: "var(--color-danger-light)" },
};

function formatCurrency(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "ja" ? "ja-JP" : "en-US", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const { t, locale } = useI18n();

  useEffect(() => {
    api.getProjects().then(setProjects);
  }, []);

  const filtered = filter === "all" ? projects : projects.filter((p) => p.status === filter);

  const activeCount = projects.filter((p) => p.status === "active").length;
  const totalBudget = projects.reduce((s, p) => s + p.budget, 0);
  const totalSpent = projects.reduce((s, p) => s + p.spent, 0);

  return (
    <div className="px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">{t.projects.title}</h1>
          <p className="text-sm text-[var(--color-subtext)] mt-0.5">{t.projects.subtitle}</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t.projects.createProject}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: t.projects.active, value: String(activeCount), color: "var(--color-success)", bg: "var(--color-success-light)" },
          { label: t.projects.budget, value: formatCurrency(totalBudget, locale), color: "var(--color-primary)", bg: "var(--color-primary-light)" },
          { label: t.projects.spent, value: formatCurrency(totalSpent, locale), color: "var(--color-warning)", bg: "var(--color-warning-light)" },
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

      {/* Filter */}
      <div className="flex gap-1 mb-4">
        {(["all", "active", "completed", "on_hold"] as Filter[]).map((f) => {
          const labels: Record<string, string> = {
            all: t.projects.all,
            active: t.projects.active,
            completed: t.projects.completed,
            on_hold: t.projects.onHold,
          };
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
              {labels[f]}
            </button>
          );
        })}
      </div>

      {/* Project Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-12 text-center">
          <p className="text-sm text-[var(--color-subtext)]">{t.projects.noProjects}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((project) => {
            const sc = statusColors[project.status] ?? statusColors.active;
            const statusLabel = (t.projects.projectStatus as Record<string, string>)[project.status] ?? project.status;
            const progressPercent = project.budget > 0 ? Math.min(Math.round((project.spent / project.budget) * 100), 100) : 0;

            return (
              <div key={project.id} className="bg-white rounded-xl border border-[var(--color-border)] p-6 hover:border-[var(--color-primary)] hover:shadow-sm transition-all">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-[var(--color-text)] truncate">{project.name}</h3>
                    <p className="text-xs text-[var(--color-subtext)] mt-0.5">{project.clientName}</p>
                  </div>
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ml-3"
                    style={{ backgroundColor: sc.bg, color: sc.color }}
                  >
                    {statusLabel}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-[var(--color-subtext)] leading-relaxed mb-4 line-clamp-2">
                  {project.description}
                </p>

                {/* Budget Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-[var(--color-subtext)]">{t.projects.budget}</span>
                    <span className="font-medium text-[var(--color-text)]">
                      {formatCurrency(project.spent, locale)} / {formatCurrency(project.budget, locale)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-[var(--color-border-light)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${progressPercent}%`,
                        backgroundColor: progressPercent > 90 ? "var(--color-danger)" : progressPercent > 70 ? "var(--color-warning)" : "var(--color-primary)",
                      }}
                    />
                  </div>
                </div>

                {/* Footer: Members + Dates */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[var(--color-subtext)] mr-1">{t.projects.members}:</span>
                    <div className="flex -space-x-2">
                      {project.members.slice(0, 4).map((memberId) => (
                        <EmployeeAvatar key={memberId} seed={memberId} size="1.5rem" className="border-2 border-white rounded-full" />
                      ))}
                      {project.members.length > 4 && (
                        <div className="w-6 h-6 rounded-full bg-[var(--color-border-light)] border-2 border-white flex items-center justify-center text-[8px] font-medium text-[var(--color-subtext)]">
                          +{project.members.length - 4}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-[var(--color-subtext)]">
                    {new Date(project.startDate).toLocaleDateString(locale === "ja" ? "ja-JP" : "en-US", { month: "short", day: "numeric" })}
                    {project.endDate && ` — ${new Date(project.endDate).toLocaleDateString(locale === "ja" ? "ja-JP" : "en-US", { month: "short", day: "numeric" })}`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
