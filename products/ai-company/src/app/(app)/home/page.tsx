"use client";

import { useEffect } from "react";
import { useEmployeesStore } from "@/stores/employees";
import { EmployeeCard } from "@/components/employee-card";
import { mockTasks, mockActivityLogs, mockDepartments } from "@/data/mock";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";
function getGreeting(t: { night: string; morning: string; afternoon: string; evening: string }): string {
  const hour = new Date().getHours();
  if (hour < 6) return t.night;
  if (hour < 12) return t.morning;
  if (hour < 18) return t.afternoon;
  return t.evening;
}

const categoryOrder = ["front-office", "back-office", "management"] as const;

const categoryIcons: Record<string, React.ReactNode> = {
  "front-office": (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  "back-office": (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.58-3.22A1.5 1.5 0 015 10.62V6.5a2 2 0 012-2h10a2 2 0 012 2v4.12a1.5 1.5 0 01-.84 1.33l-5.58 3.22a1.5 1.5 0 01-1.16 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.17V21" />
    </svg>
  ),
  "management": (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
};

export default function HomePage() {
  const { employees, loading, fetch } = useEmployeesStore();
  const { t, locale } = useI18n();

  useEffect(() => {
    fetch();
  }, [fetch]);

  const activeEmployees = employees.filter((e) => e.status !== "archived");
  const tasksDone = mockTasks.filter((t) => t.status === "done").length;
  const tasksInProgress = mockTasks.filter((t) => t.status === "in_progress").length;
  const totalTasks = mockTasks.length;

  // Group employees by category → department
  const groupedByCategory = categoryOrder.map((cat) => {
    const depts = mockDepartments.filter((d) => d.category === cat);
    const deptGroups = depts
      .map((dept) => {
        const members = activeEmployees.filter((e) => e.department === dept.id);
        return { dept, members };
      })
      .filter((g) => g.members.length > 0);
    return { category: cat, deptGroups };
  }).filter((g) => g.deptGroups.length > 0);

  const getDeptName = (dept: { name: string; nameJa: string }) =>
    locale === "ja" ? dept.nameJa : dept.name;

  const getCatName = (cat: string) =>
    (t.departments?.categories as Record<string, string>)?.[cat] ?? cat;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">{t.home.greeting.replace("{name}", "Hiroto")}</h1>
          <p className="text-sm text-[var(--color-subtext)] mt-0.5">{getGreeting(t.home)}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/employees"
            className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--color-border)] text-sm font-medium rounded-lg hover:bg-[var(--color-border-light)] transition-colors text-[var(--color-text)]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            {t.nav.employees}
          </Link>
          <Link
            href="/employee/create"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {t.home.addEmployee}
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: t.home.totalEmployees,
            value: activeEmployees.length,
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            ),
            color: "var(--color-primary)",
            bg: "var(--color-primary-light)",
          },
          {
            label: t.home.tasksDone,
            value: tasksDone,
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
            color: "var(--color-success)",
            bg: "var(--color-success-light)",
          },
          {
            label: t.home.inProgress,
            value: tasksInProgress,
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
            ),
            color: "var(--color-warning)",
            bg: "var(--color-warning-light)",
          },
          {
            label: t.home.totalTasks,
            value: totalTasks,
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
            ),
            color: "var(--color-info)",
            bg: "var(--color-info-light)",
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-[var(--color-border)] p-5">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: stat.bg, color: stat.color }}
              >
                {stat.icon}
              </div>
            </div>
            <p className="text-2xl font-bold text-[var(--color-text)]">{stat.value}</p>
            <p className="text-xs text-[var(--color-subtext)] mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Organization by Category */}
        <div className="lg:col-span-2 space-y-6">
          {groupedByCategory.map(({ category, deptGroups }) => (
            <div key={category}>
              {/* Category Header */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded flex items-center justify-center text-[var(--color-primary)]">
                  {categoryIcons[category]}
                </div>
                <h2 className="text-sm font-semibold text-[var(--color-subtext)] uppercase tracking-wider">
                  {getCatName(category)}
                </h2>
                <span className="text-[10px] font-medium px-2 py-0.5 bg-[var(--color-border-light)] text-[var(--color-subtext)] rounded-full">
                  {deptGroups.reduce((sum, g) => sum + g.members.length, 0)}
                </span>
              </div>

              {/* Departments in this category */}
              <div className="space-y-3">
                {deptGroups.map(({ dept, members }) => (
                  <div key={dept.id} className="bg-white rounded-xl border border-[var(--color-border)] p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-[var(--color-text)]">{getDeptName(dept)}</h3>
                        <span className="text-[10px] font-medium px-2 py-0.5 bg-[var(--color-border-light)] text-[var(--color-subtext)] rounded-full">
                          {members.length}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {members.map((employee) => {
                        const taskCount = mockTasks.filter(
                          (tk) => tk.employeeId === employee.id && tk.status !== "done"
                        ).length;
                        return (
                          <EmployeeCard
                            key={employee.id}
                            employee={employee}
                            taskCount={taskCount}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-6 h-fit">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-[var(--color-text)]">{t.home.recentActivity}</h2>
            <Link href="/activity" className="text-xs text-[var(--color-primary)] hover:underline">
              {t.common.viewAll}
            </Link>
          </div>
          <div className="space-y-4">
            {mockActivityLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--color-text)] leading-snug">{log.summary}</p>
                  <p className="text-xs text-[var(--color-subtext)] mt-1">
                    {new Date(log.createdAt).toLocaleDateString(locale === "ja" ? "ja-JP" : "en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
