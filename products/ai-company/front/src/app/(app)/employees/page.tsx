"use client";

import { useEffect, useState } from "react";
import { useEmployeesStore } from "@/stores/employees";
import { useI18n } from "@/lib/i18n";
import { getRoleLabel, getStatusConfig } from "@/lib/constants";
import { EmployeeAvatar } from "@/components/employee-avatar";
import Link from "next/link";
import { SkeletonEmployeeGrid } from "@/components/skeleton";

const DEPT_COLORS = ["#8b5cf6", "#ec4899", "#06b6d4", "#f59e0b", "#10b981", "#f97316", "#3b82f6", "#14b8a6", "#a855f7", "#22c55e", "#ef4444", "#64748b"];
const getDeptColor = (dept: string) => DEPT_COLORS[Math.abs([...dept].reduce((a, c) => a + c.charCodeAt(0), 0)) % DEPT_COLORS.length];

export default function EmployeesPage() {
  const { employees, loading, fetch } = useEmployeesStore();
  const { t, locale } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => { fetch(); }, [fetch]);

  const filtered = employees.filter((emp) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const deptLabel = emp.department || "other";
    return (
      emp.name.toLowerCase().includes(q) ||
      emp.role.toLowerCase().includes(q) ||
      deptLabel.toLowerCase().includes(q)
    );
  });

  // 部署でグループ化
  const deptGroups: { deptId: string; members: typeof filtered }[] = [];
  const seen = new Set<string>();
  for (const emp of filtered) {
    const dept = emp.department || "other";
    if (!seen.has(dept)) {
      seen.add(dept);
      deptGroups.push({ deptId: dept, members: filtered.filter((e) => (e.department || "other") === dept) });
    }
  }

  if (loading) {
    return <div className="px-8 py-8 animate-fade-in"><SkeletonEmployeeGrid /></div>;
  }

  return (
    <div className="px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">{t.nav.employees}</h1>
          <p className="text-sm text-[var(--color-subtext)] mt-0.5">
            {employees.length} {locale === "ja" ? "人の社員" : "employees"} ・ {deptGroups.length} {locale === "ja" ? "部署" : "departments"}
          </p>
        </div>
        <Link
          href="/employee/create"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {locale === "ja" ? "社員を追加" : "Add Employee"}
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-6">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-subtext)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={locale === "ja" ? "名前・役割・部署で検索..." : "Search..."}
          className="w-full pl-9 pr-4 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
        />
      </div>

      {/* Department Cards */}
      <div className="space-y-6">
        {deptGroups.map(({ deptId, members }) => {
          const deptLabel = deptId;
          const deptColor = getDeptColor(deptId);

          return (
            <div key={deptId} className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
              {/* Department Header */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: deptColor }} />
                <h2 className="text-sm font-semibold text-[var(--color-text)]">{deptLabel}</h2>
                <span className="text-[10px] font-medium px-1.5 py-0.5 bg-[var(--color-border-light)] text-[var(--color-subtext)] rounded-full">
                  {members.length}
                </span>
              </div>

              {/* Employee Cards */}
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {members.map((emp) => {
                  const status = getStatusConfig(emp.status, t);
                  const role = getRoleLabel(emp.role, t);

                  return (
                    <Link
                      key={emp.id}
                      href={`/employee/${emp.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:shadow-sm transition-all group"
                    >
                      <EmployeeAvatar seed={emp.id} size="2.5rem" className="shrink-0" config={emp.avatarConfig as Record<string, string> | undefined} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm text-[var(--color-text)] truncate">{emp.name}</span>
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: status.color }}
                            title={status.label}
                          />
                        </div>
                        <p className="text-xs text-[var(--color-subtext)] truncate">{role}</p>
                        <div className="flex gap-1 mt-1">
                          {(emp.skills || []).slice(0, 2).map((skill) => (
                            <span key={skill} className="text-[9px] px-1.5 py-0.5 bg-[var(--color-border-light)] text-[var(--color-subtext)] rounded">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-[var(--color-subtext)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {deptGroups.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[var(--color-subtext)] mb-4">
              {locale === "ja" ? "まだ社員がいません" : "No employees yet"}
            </p>
            <Link
              href="/employee/create"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
            >
              {locale === "ja" ? "最初の社員を追加" : "Add your first employee"}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
