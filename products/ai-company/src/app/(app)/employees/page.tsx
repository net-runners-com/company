"use client";

import { useEffect, useState } from "react";
import { useEmployeesStore } from "@/stores/employees";
import { mockTasks, mockDepartments } from "@/data/mock";
import { useI18n } from "@/lib/i18n";
import { getRoleLabel, getStatusConfig } from "@/lib/constants";
import { EmployeeAvatar } from "@/components/employee-avatar";
import Link from "next/link";
import type { DepartmentCategory } from "@/types";

const categoryOrder: DepartmentCategory[] = ["front-office", "back-office", "management"];

export default function EmployeesPage() {
  const { employees, loading, fetch } = useEmployeesStore();
  const { t, locale } = useI18n();
  const [filterCategory, setFilterCategory] = useState<DepartmentCategory | "all">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch();
  }, [fetch]);

  const getDeptName = (deptId: string) => {
    const dept = mockDepartments.find((d) => d.id === deptId);
    if (!dept) return deptId;
    return locale === "ja" ? dept.nameJa : dept.name;
  };

  const getCatName = (cat: string) =>
    (t.departments?.categories as Record<string, string>)?.[cat] ?? cat;

  const filtered = employees.filter((emp) => {
    if (filterStatus !== "all" && emp.status !== filterStatus) return false;
    if (filterCategory !== "all") {
      const dept = mockDepartments.find((d) => d.id === emp.department);
      if (!dept || dept.category !== filterCategory) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const role = getRoleLabel(emp.role, t);
      return (
        emp.name.toLowerCase().includes(q) ||
        role.toLowerCase().includes(q) ||
        getDeptName(emp.department).toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Group filtered employees by category → department
  const grouped = categoryOrder.map((cat) => {
    const depts = mockDepartments.filter((d) => d.category === cat);
    const deptGroups = depts
      .map((dept) => ({
        dept,
        members: filtered.filter((e) => e.department === dept.id),
      }))
      .filter((g) => g.members.length > 0);
    return { category: cat, deptGroups };
  }).filter((g) => g.deptGroups.length > 0);

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">{t.nav.employees}</h1>
          <p className="text-sm text-[var(--color-subtext)] mt-0.5">
            {employees.length} {locale === "ja" ? "人の社員" : "employees"} ・ {employees.filter((e) => e.status === "active").length} {t.common.active}
          </p>
        </div>
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-subtext)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={locale === "ja" ? "名前・役割・部署で検索..." : "Search by name, role, department..."}
            className="w-full pl-9 pr-4 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
          />
        </div>

        {/* Category filter */}
        <div className="flex gap-1.5">
          {(["all", ...categoryOrder] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filterCategory === cat
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-border-light)] text-[var(--color-subtext)] hover:bg-[var(--color-border)]"
              }`}
            >
              {cat === "all" ? (locale === "ja" ? "すべて" : "All") : getCatName(cat)}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1.5">
          {["all", "active", "paused"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filterStatus === s
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-border-light)] text-[var(--color-subtext)] hover:bg-[var(--color-border)]"
              }`}
            >
              {s === "all"
                ? locale === "ja" ? "全ステータス" : "All Status"
                : (t.employee.status as Record<string, string>)[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Employee List grouped by category/department */}
      <div className="space-y-8">
        {grouped.map(({ category, deptGroups }) => (
          <div key={category}>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm font-semibold text-[var(--color-subtext)] uppercase tracking-wider">
                {getCatName(category)}
              </h2>
              <div className="flex-1 h-px bg-[var(--color-border)]" />
              <span className="text-xs text-[var(--color-subtext)]">
                {deptGroups.reduce((sum, g) => sum + g.members.length, 0)} {locale === "ja" ? "人" : "members"}
              </span>
            </div>

            {deptGroups.map(({ dept, members }) => (
              <div key={dept.id} className="mb-4">
                <div className="flex items-center gap-2 mb-2 ml-1">
                  <h3 className="text-sm font-medium text-[var(--color-text)]">{getDeptName(dept.id)}</h3>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 bg-[var(--color-border-light)] text-[var(--color-subtext)] rounded-full">
                    {members.length}
                  </span>
                </div>

                <div className="bg-white rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                  {members.map((emp) => {
                    const status = getStatusConfig(emp.status, t);
                    const role = getRoleLabel(emp.role, t);
                    const taskCount = mockTasks.filter(
                      (tk) => tk.employeeId === emp.id && tk.status !== "done"
                    ).length;

                    return (
                      <Link
                        key={emp.id}
                        href={`/employee/${emp.id}`}
                        className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--color-border-light)] transition-colors group"
                      >
                        <EmployeeAvatar seed={emp.id} size="2.75rem" className="shrink-0" />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[var(--color-text)]">{emp.name}</span>
                            <span
                              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: status.bg, color: status.color }}
                            >
                              {status.label}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--color-subtext)] mt-0.5">{role}</p>
                        </div>

                        <div className="hidden sm:flex items-center gap-2 shrink-0">
                          {emp.skills.slice(0, 2).map((skill) => (
                            <span key={skill} className="text-[10px] font-medium px-2 py-0.5 bg-[var(--color-border-light)] text-[var(--color-subtext)] rounded">
                              {skill}
                            </span>
                          ))}
                        </div>

                        {taskCount > 0 && (
                          <span className="text-[10px] font-medium px-2 py-0.5 bg-[var(--color-primary-light)] text-[var(--color-primary)] rounded-full shrink-0">
                            {taskCount} tasks
                          </span>
                        )}

                        <svg className="w-4 h-4 text-[var(--color-subtext)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}

        {grouped.length === 0 && (
          <div className="text-center py-12 text-[var(--color-subtext)]">
            {locale === "ja" ? "該当する社員がいません" : "No employees found"}
          </div>
        )}
      </div>
    </div>
  );
}
