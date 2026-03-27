"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import * as api from "@/lib/api";
import { ChatView } from "@/components/chat-view";
import { getRoleLabel, getStatusConfig } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import { EmployeeAvatar } from "@/components/employee-avatar";
import type { Employee, Task } from "@/types";

type TabKey = "chat" | "tasks" | "settings";

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("chat");
  const [tasks, setTasks] = useState<Task[]>([]);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "chat", label: t.employee.chat },
    { key: "tasks", label: t.employee.tasks },
    { key: "settings", label: t.settings.title },
  ];

  const taskStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: (t.employee.taskStatus as Record<string, string>).pending ?? "Pending", color: "var(--color-subtext)", bg: "var(--color-border-light)" },
    in_progress: { label: (t.employee.taskStatus as Record<string, string>).in_progress ?? "In Progress", color: "var(--color-warning)", bg: "var(--color-warning-light)" },
    done: { label: (t.employee.taskStatus as Record<string, string>).done ?? "Done", color: "var(--color-success)", bg: "var(--color-success-light)" },
    cancelled: { label: (t.employee.taskStatus as Record<string, string>).cancelled ?? "Cancelled", color: "var(--color-danger)", bg: "var(--color-danger-light)" },
  };

  useEffect(() => {
    api.getEmployee(id).then(setEmployee);
    api.getTasks(id).then(setTasks);
  }, [id]);

  if (!employee) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const status = getStatusConfig(employee.status, t);
  const role = getRoleLabel(employee.role, t);

  return (
    <div className="flex flex-col h-screen animate-fade-in">
      {/* Header */}
      <div className="bg-white border-b border-[var(--color-border)] px-6 py-4">
        <div className="flex items-center gap-4 max-w-5xl mx-auto">
          <EmployeeAvatar seed={employee.id} size="3rem" />
          <div className="flex-1">
            <h1 className="font-semibold text-lg text-[var(--color-text)]">{employee.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-[var(--color-subtext)]">{role}</span>
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: status.bg, color: status.color }}
              >
                {status.label}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mt-4 max-w-5xl mx-auto border-b border-transparent -mb-[1px]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                  : "border-transparent text-[var(--color-subtext)] hover:text-[var(--color-text)]"
              }`}
            >
              {tab.label}
              {tab.key === "tasks" && tasks.filter((tk) => tk.status !== "done").length > 0 && (
                <span className="ml-1.5 w-5 h-5 bg-[var(--color-primary)] text-white text-xs rounded-full inline-flex items-center justify-center">
                  {tasks.filter((tk) => tk.status !== "done").length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "chat" && <ChatView employee={employee} />}

        {activeTab === "tasks" && (
          <div className="max-w-5xl mx-auto px-6 py-6 space-y-3 overflow-y-auto h-full">
            {tasks.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-[var(--color-subtext)]">{t.employee.noTasks}</p>
              </div>
            ) : (
              tasks.map((task) => {
                const ts = taskStatusConfig[task.status];
                return (
                  <div key={task.id} className="bg-white border border-[var(--color-border)] rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text)]">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-[var(--color-subtext)] mt-1">{task.description}</p>
                        )}
                      </div>
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ml-3"
                        style={{ backgroundColor: ts.bg, color: ts.color }}
                      >
                        {ts.label}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="max-w-5xl mx-auto px-6 py-6 overflow-y-auto h-full">
            <div className="bg-white border border-[var(--color-border)] rounded-lg p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t.employee.name}</label>
                <input
                  defaultValue={employee.name}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t.employee.role}</label>
                <input
                  defaultValue={employee.role}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t.employee.commStyle}</label>
                <input
                  defaultValue={employee.tone}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t.employee.skills}</label>
                <div className="flex flex-wrap gap-2">
                  {employee.skills.map((skill) => (
                    <span key={skill} className="px-2.5 py-1 bg-[var(--color-primary-light)] text-[var(--color-primary)] text-xs font-medium rounded-full">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
              <button className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors">
                {t.common.save}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
