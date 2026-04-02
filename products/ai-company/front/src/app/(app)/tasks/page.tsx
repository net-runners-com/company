"use client";

import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { EmployeeAvatar } from "@/components/employee-avatar";
import { mockEmployees } from "@/data/mock";
import type { Task, TaskStatus } from "@/types";

type Filter = "all" | TaskStatus;

const statusColors: Record<string, { color: string; bg: string }> = {
  pending: { color: "var(--color-subtext)", bg: "var(--color-border-light)" },
  in_progress: { color: "var(--color-warning)", bg: "var(--color-warning-light)" },
  done: { color: "var(--color-success)", bg: "var(--color-success-light)" },
  cancelled: { color: "var(--color-danger)", bg: "var(--color-danger-light)" },
};

const priorityColors: Record<string, { color: string; bg: string }> = {
  high: { color: "var(--color-danger)", bg: "var(--color-danger-light)" },
  normal: { color: "var(--color-info)", bg: "var(--color-info-light)" },
  low: { color: "var(--color-subtext)", bg: "var(--color-border-light)" },
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const { t, locale } = useI18n();

  useEffect(() => {
    api.getTasks().then(setTasks);
  }, []);

  const filtered = filter === "all" ? tasks : tasks.filter((tk) => tk.status === filter);
  const pending = tasks.filter((tk) => tk.status === "pending").length;
  const inProgress = tasks.filter((tk) => tk.status === "in_progress").length;
  const done = tasks.filter((tk) => tk.status === "done").length;

  const getEmployee = (id: string) => mockEmployees.find((e) => e.id === id);

  return (
    <div className="px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">{t.tasks.title}</h1>
          <p className="text-sm text-[var(--color-subtext)] mt-0.5">{t.tasks.subtitle}</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t.tasks.createTask}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: t.tasks.pending, value: pending, color: "var(--color-subtext)", bg: "var(--color-border-light)" },
          { label: t.tasks.inProgress, value: inProgress, color: "var(--color-warning)", bg: "var(--color-warning-light)" },
          { label: t.tasks.done, value: done, color: "var(--color-success)", bg: "var(--color-success-light)" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[var(--color-border)] p-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: s.bg }}>
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            </div>
            <p className="text-2xl font-bold text-[var(--color-text)]">{s.value}</p>
            <p className="text-xs text-[var(--color-subtext)] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-1 mb-4">
        {(["all", "pending", "in_progress", "done"] as Filter[]).map((f) => {
          const labels: Record<string, string> = {
            all: t.tasks.all,
            pending: t.tasks.pending,
            in_progress: t.tasks.inProgress,
            done: t.tasks.done,
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

      {/* Task List */}
      <div className="bg-white rounded-xl border border-[var(--color-border)]">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-[var(--color-subtext)]">{t.tasks.noTasks}</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {filtered.map((task) => {
              const sc = statusColors[task.status] ?? statusColors.pending;
              const pc = priorityColors[task.priority] ?? priorityColors.normal;
              const emp = getEmployee(task.employeeId);
              const statusLabel = (t.employee.taskStatus as Record<string, string>)[task.status] ?? task.status;
              const priorityLabel = (t.tasks.priorityLabel as Record<string, string>)[task.priority] ?? task.priority;

              return (
                <div key={task.id} className="flex items-center gap-4 px-6 py-4 hover:bg-[var(--color-border-light)] transition-colors">
                  {/* Status dot */}
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sc.color }} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text)]">{task.title}</p>
                    {task.description && (
                      <p className="text-xs text-[var(--color-subtext)] mt-0.5 truncate">{task.description}</p>
                    )}
                  </div>

                  {/* Priority */}
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 hidden sm:inline-flex"
                    style={{ backgroundColor: pc.bg, color: pc.color }}
                  >
                    {priorityLabel}
                  </span>

                  {/* Status */}
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: sc.bg, color: sc.color }}
                  >
                    {statusLabel}
                  </span>

                  {/* Due date */}
                  {task.dueDate && (
                    <span className="text-[10px] text-[var(--color-subtext)] shrink-0 hidden md:block w-16 text-right">
                      {new Date(task.dueDate).toLocaleDateString(locale === "ja" ? "ja-JP" : "en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}

                  {/* Assignee */}
                  {emp && (
                    <EmployeeAvatar seed={emp.id} size="1.5rem" className="shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
