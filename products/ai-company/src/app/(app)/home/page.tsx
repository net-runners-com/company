"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useEmployeesStore } from "@/stores/employees";
import { useI18n } from "@/lib/i18n";
import { useSession } from "next-auth/react";
import { EmployeeAvatar } from "@/components/employee-avatar";
import { getStatusConfig } from "@/lib/constants";
import Link from "next/link";
import { SkeletonDashboard } from "@/components/skeleton";

function getGreeting(t: { night: string; morning: string; afternoon: string; evening: string }): string {
  const hour = new Date().getHours();
  if (hour < 6) return t.night;
  if (hour < 12) return t.morning;
  if (hour < 18) return t.afternoon;
  return t.evening;
}

const DEPT_COLORS = ["#8b5cf6", "#ec4899", "#06b6d4", "#f59e0b", "#10b981", "#f97316", "#3b82f6", "#14b8a6", "#a855f7", "#22c55e", "#ef4444", "#64748b"];
const getDeptColor = (dept: string) => DEPT_COLORS[Math.abs([...dept].reduce((a, c) => a + c.charCodeAt(0), 0)) % DEPT_COLORS.length];

export default function HomePage() {
  const { employees, loading, fetch } = useEmployeesStore();
  const { t, locale } = useI18n();
  const { data: session } = useSession();

  useEffect(() => { fetch(); }, [fetch]);

  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "User";
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const activeEmployees = employees.filter((e) => e.status !== "archived");

  // 部署でグループ化
  const deptGroups: { deptId: string; members: typeof activeEmployees }[] = [];
  const seen = new Set<string>();
  for (const emp of activeEmployees) {
    if (!seen.has(emp.department)) {
      seen.add(emp.department);
      deptGroups.push({ deptId: emp.department, members: activeEmployees.filter((e) => e.department === emp.department) });
    }
  }

  if (loading) {
    return <div className="px-8 py-8 animate-fade-in"><SkeletonDashboard /></div>;
  }

  return (
    <div className="px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">
            {t.home.greeting.replace("{name}", userName)}
          </h1>
          <p className="text-sm text-[var(--color-subtext)] mt-0.5">{getGreeting(t.home)}</p>
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
          <p className="text-2xl font-bold text-[var(--color-primary)]">{deptGroups.length}</p>
          <p className="text-xs text-[var(--color-subtext)] mt-0.5">{locale === "ja" ? "稼働部署" : "Departments"}</p>
        </div>
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
          <p className="text-2xl font-bold text-[var(--color-success)]">{activeEmployees.length}</p>
          <p className="text-xs text-[var(--color-subtext)] mt-0.5">{locale === "ja" ? "総メンバー" : "Members"}</p>
        </div>
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
          <p className="text-2xl font-bold text-[var(--color-info)]">{employees.filter((e) => e.status === "active").length}</p>
          <p className="text-xs text-[var(--color-subtext)] mt-0.5">{locale === "ja" ? "稼働中" : "Active"}</p>
        </div>
      </div>

      {/* Department Cards Grid */}
      {deptGroups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {deptGroups.map(({ deptId, members }) => {
            const deptColor = getDeptColor(deptId);
            const deptLabel = deptId;
            const activeCount = members.filter((m) => m.status === "active").length;

            return (
              <div
                key={deptId}
                onClick={() => setExpandedDept(deptId)}
                className="bg-white rounded-xl border border-[var(--color-border)] p-5 cursor-pointer hover:shadow-md hover:border-[var(--color-primary)]/30 transition-all"
              >
                {/* Dept Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: deptColor }} />
                    <h3 className="font-semibold text-sm text-[var(--color-text)]">{deptLabel}</h3>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-600">
                    {locale === "ja" ? "稼働中" : "OPEN"}
                  </span>
                </div>

                {/* Description */}
                <p className="text-[11px] text-[var(--color-subtext)] mb-4 line-clamp-2 leading-relaxed">
                  {members.map((m) => m.role).filter((v, i, a) => a.indexOf(v) === i).join(" / ")}
                </p>

                {/* Avatar row */}
                <div className="flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {members.slice(0, 4).map((m) => {
                      const st = getStatusConfig(m.status, t);
                      return (
                        <div key={m.id} className="relative" title={m.name}>
                          <EmployeeAvatar seed={m.id} size="2rem" className="border-2 border-white rounded-full" config={m.avatarConfig as Record<string, string> | undefined} />
                          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white" style={{ backgroundColor: st.color }} />
                        </div>
                      );
                    })}
                    {members.length > 4 && (
                      <div className="w-8 h-8 rounded-full bg-[var(--color-border-light)] border-2 border-white flex items-center justify-center text-[10px] font-medium text-[var(--color-subtext)]">
                        +{members.length - 4}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-[var(--color-subtext)]">{activeCount}/{members.length}</span>
                </div>
              </div>
            );
          })}

        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-xl border border-[var(--color-border)]">
          <svg className="w-12 h-12 text-[var(--color-subtext)] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          <p className="text-[var(--color-subtext)] mb-4">
            {locale === "ja" ? "まだ社員がいません。最初の社員を追加しましょう。" : "No employees yet. Add your first one."}
          </p>
          <Link
            href="/employee/create"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            {locale === "ja" ? "社員を追加" : "Add Employee"}
          </Link>
        </div>
      )}
      {/* Department Members Modal — portal to body */}
      {expandedDept && typeof document !== "undefined" && createPortal((() => {
        const group = deptGroups.find((g) => g.deptId === expandedDept);
        if (!group) return null;
        const deptColor = getDeptColor(expandedDept);
        const deptLabel = expandedDept;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setExpandedDept(null)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col animate-fade-in" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: deptColor }} />
                  <div>
                    <h3 className="font-semibold text-[var(--color-text)]">{deptLabel}</h3>
                    <p className="text-xs text-[var(--color-subtext)]">{group.members.length} {locale === "ja" ? "名" : "members"}</p>
                  </div>
                </div>
                <button onClick={() => setExpandedDept(null)} className="p-1.5 text-[var(--color-subtext)] hover:text-[var(--color-text)] transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Members */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {group.members.map((m) => {
                  const st = getStatusConfig(m.status, t);
                  return (
                    <Link key={m.id} href={`/employee/${m.id}`} onClick={() => setExpandedDept(null)}
                      className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:shadow-sm transition-all">
                      <EmployeeAvatar seed={m.id} size="2.5rem" className="shrink-0" config={m.avatarConfig as Record<string, string> | undefined} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm text-[var(--color-text)]">{m.name}</span>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                        </div>
                        <p className="text-xs text-[var(--color-subtext)]">{m.role}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {(m.skills || []).slice(0, 2).map((s) => (
                          <span key={s} className="text-[9px] px-1.5 py-0.5 bg-[var(--color-border-light)] text-[var(--color-subtext)] rounded">{s}</span>
                        ))}
                      </div>
                      <svg className="w-4 h-4 text-[var(--color-subtext)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })(), document.body)}
    </div>
  );
}
