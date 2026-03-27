"use client";

import Link from "next/link";
import type { Employee } from "@/types";
import { getRoleLabel, getStatusConfig } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import { EmployeeAvatar } from "@/components/employee-avatar";
import { mockDepartments } from "@/data/mock";

interface Props {
  employee: Employee;
  taskCount?: number;
}

export function EmployeeCard({ employee, taskCount = 0 }: Props) {
  const { t, locale } = useI18n();
  const status = getStatusConfig(employee.status, t);
  const role = getRoleLabel(employee.role, t);
  const dept = mockDepartments.find((d) => d.id === employee.department);
  const deptName = dept ? (locale === "ja" ? dept.nameJa : dept.name) : employee.department;

  return (
    <Link href={`/employee/${employee.id}`} className="block group">
      <div className="p-5 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:shadow-md transition-all bg-white">
        {/* Header: Avatar + Name + Status */}
        <div className="flex items-start gap-4 mb-4">
          <EmployeeAvatar seed={employee.id} size="3.5rem" className="shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--color-text)] truncate">{employee.name}</h3>
              <svg className="w-4 h-4 text-[var(--color-subtext)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
            <p className="text-sm text-[var(--color-subtext)]">{role}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: status.bg, color: status.color }}
              >
                {status.label}
              </span>
              {employee.department && (
                <span className="text-[10px] text-[var(--color-subtext)] bg-[var(--color-border-light)] px-2 py-0.5 rounded-full">
                  {deptName}
                </span>
              )}
              {taskCount > 0 && (
                <span className="text-[10px] font-medium px-2 py-0.5 bg-[var(--color-primary-light)] text-[var(--color-primary)] rounded-full">
                  {taskCount} tasks
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Greeting */}
        {employee.greeting && (
          <p className="text-xs text-[var(--color-subtext)] italic leading-relaxed mb-3 line-clamp-2">
            &ldquo;{employee.greeting}&rdquo;
          </p>
        )}

        {/* Skills */}
        {employee.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {employee.skills.slice(0, 3).map((skill) => (
              <span key={skill} className="text-[10px] font-medium px-2 py-0.5 bg-[var(--color-border-light)] text-[var(--color-subtext)] rounded">
                {skill}
              </span>
            ))}
            {employee.skills.length > 3 && (
              <span className="text-[10px] text-[var(--color-subtext)]">
                +{employee.skills.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
