"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import * as api from "@/lib/api";
import { ChatView } from "@/components/chat-view";
import { getRoleLabel, getStatusConfig } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import { EmployeeAvatar } from "@/components/employee-avatar";
import { SkeletonChat, Skeleton } from "@/components/skeleton";
import { SkillEditor } from "@/components/skill-editor";
import { FileBrowser } from "@/components/file-browser";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { Employee, Task } from "@/types";

type TabKey = "profile" | "chat" | "tasks" | "schedules" | "skills" | "files" | "settings";

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useI18n();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("chat");
  const [tasks, setTasks] = useState<Task[]>([]);

  const [profileContent, setProfileContent] = useState<string | null>(null);
  const [claudeMd, setClaudeMd] = useState<string>("");
  const [claudeMdLoaded, setClaudeMdLoaded] = useState(false);
  const [claudeMdSaving, setClaudeMdSaving] = useState(false);
  const [claudeMdSaved, setClaudeMdSaved] = useState(false);
  const [empSchedules, setEmpSchedules] = useState<{ _id: string; name: string; cron: string; task: string; nextRun: string | null }[]>([]);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "chat", label: t.employee.chat },
    { key: "profile", label: locale === "ja" ? "プロフィール" : "Profile" },
    { key: "tasks", label: t.employee.tasks },
    { key: "schedules", label: locale === "ja" ? "定期実行" : "Schedules" },
    { key: "skills", label: locale === "ja" ? "スキル" : "Skills" },
    { key: "files", label: locale === "ja" ? "フォルダ" : "Files" },
    { key: "settings", label: t.settings.title },
  ];

  const taskStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: (t.employee.taskStatus as Record<string, string>).pending ?? "Pending", color: "var(--color-subtext)", bg: "var(--color-border-light)" },
    in_progress: { label: (t.employee.taskStatus as Record<string, string>).in_progress ?? "In Progress", color: "var(--color-warning)", bg: "var(--color-warning-light)" },
    done: { label: (t.employee.taskStatus as Record<string, string>).done ?? "Done", color: "var(--color-success)", bg: "var(--color-success-light)" },
    cancelled: { label: (t.employee.taskStatus as Record<string, string>).cancelled ?? "Cancelled", color: "var(--color-danger)", bg: "var(--color-danger-light)" },
  };

  const [browserActive, setBrowserActive] = useState(false);

  useEffect(() => {
    // 自己紹介.md を取得
    fetch(`/api/employee-files?employeeId=${id}&action=read&path=${encodeURIComponent("自己紹介.md")}`)
      .then(r => r.json())
      .then(d => { if (d.content) setProfileContent(d.content); })
      .catch(() => {});
    // CLAUDE.md を取得
    fetch(`/api/employee-files?employeeId=${id}&action=read&path=${encodeURIComponent("CLAUDE.md")}`)
      .then(r => r.json())
      .then(d => { if (d.content) { setClaudeMd(d.content); setClaudeMdLoaded(true); } })
      .catch(() => {});
    api.getEmployee(id).then(setEmployee);
    api.getTasks(id).then(setTasks);
    // この社員のスケジュール取得
    fetch("/api/schedules").then(r => r.json()).then(d => {
      setEmpSchedules((d.schedules || []).filter((s: { empId: string }) => s.empId === id));
    }).catch(() => {});
  }, [id]);

  // ブラウザプロセスをポーリングで監視
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/browser-status");
        const data = await res.json();
        setBrowserActive(data.active);
      } catch {
        setBrowserActive(false);
      }
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!employee) {
    return (
      <div className="flex flex-col h-screen animate-fade-in">
        <div className="flex items-center gap-4 px-6 py-4 border-b border-[var(--color-border)]">
          <Skeleton className="w-12 h-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <SkeletonChat />
      </div>
    );
  }

  const status = getStatusConfig(employee.status, t);
  const role = getRoleLabel(employee.role, t);

  return (
    <div className="flex flex-col h-screen animate-fade-in">
      {/* VNC Overlay when browser is active */}
      {browserActive && (
        <div className="fixed inset-0 z-40 flex flex-col bg-black/90 animate-fade-in">
          <div className="flex items-center justify-between px-4 py-2 bg-black/50">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white text-xs font-medium">
                  {locale === "ja" ? "ブラウザ操作中" : "Browser Active"}
                </span>
              </div>
              <span className="text-white/50 text-xs">{employee.name}</span>
            </div>
            <button
              onClick={() => setBrowserActive(false)}
              className="px-3 py-1 text-white/70 hover:text-white text-xs border border-white/20 rounded-lg hover:bg-white/10 transition-colors"
            >
              {locale === "ja" ? "閉じる" : "Close"}
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <iframe
              src="http://localhost:6080/vnc.html?autoconnect=true&resize=scale&quality=6&compression=2"
              className="w-full h-full border-0"
              allow="clipboard-read; clipboard-write"
            />
          </div>
        </div>
      )}

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
      <div className={`flex-1 ${activeTab === "files" ? "overflow-y-auto" : "overflow-hidden"}`}>
        {activeTab === "profile" && (
          <div className="max-w-3xl mx-auto px-6 py-8 overflow-y-auto h-full">
            <div className="flex items-center gap-5 mb-8">
              <EmployeeAvatar seed={employee.id} size="5rem" />
              <div>
                <h2 className="text-2xl font-bold text-[var(--color-text)]">{employee.name}</h2>
                <p className="text-sm text-[var(--color-subtext)] mt-1">{role} ・ {employee.department}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {employee.skills.map((s) => (
                    <span key={s} className="px-2 py-0.5 text-xs bg-[var(--color-primary-light)] text-[var(--color-primary)] rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            </div>
            {profileContent ? (
              <article className="prose prose-sm max-w-none prose-headings:text-[var(--color-text)] prose-p:text-[var(--color-text)] prose-a:text-[var(--color-primary)] prose-strong:text-[var(--color-text)] prose-code:text-[var(--color-primary)] prose-code:bg-[var(--color-primary-light)] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-[#1e1e2e] prose-pre:text-[#cdd6f4] prose-table:text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{profileContent}</ReactMarkdown>
              </article>
            ) : (
              <div className="text-center py-12">
                <p className="text-sm text-[var(--color-subtext)] mb-3">
                  {locale === "ja" ? "自己紹介がまだありません" : "No profile yet"}
                </p>
                <p className="text-xs text-[var(--color-subtext)]">
                  {locale === "ja" ? "チャットで「自己紹介を作成して」と頼んでみましょう" : "Ask in chat to create a profile"}
                </p>
              </div>
            )}
          </div>
        )}

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

        {activeTab === "schedules" && (
          <div className="max-w-5xl mx-auto px-6 py-6 overflow-y-auto h-full">
            {empSchedules.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-[var(--color-subtext)]">
                  {locale === "ja" ? "定期実行はありません。チャットで「毎朝9時に〇〇して」と頼んでみてください。" : "No schedules. Ask in chat to create one."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {empSchedules.map((s) => (
                  <div key={s._id} className="bg-white border border-[var(--color-border)] rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-sm text-[var(--color-text)]">{s.name || s.task.slice(0, 30)}</h3>
                      <span className="text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary-light)] px-2 py-0.5 rounded-full">
                        {s.cron}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-subtext)] mt-1">{s.task}</p>
                    {s.nextRun && (
                      <p className="text-[10px] text-[var(--color-subtext)] mt-2">
                        {locale === "ja" ? "次回実行:" : "Next:"} {s.nextRun.slice(0, 16)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "skills" && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <SkillEditor employeeId={employee.id} />
          </div>
        )}

        {activeTab === "files" && (
          <div className="flex-1 overflow-y-auto">
            <FileBrowser employeeId={employee.id} />
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

            {/* CLAUDE.md Editor */}
            <div className="bg-white border border-[var(--color-border)] rounded-lg p-6 mt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-[var(--color-text)] text-sm">
                    {locale === "ja" ? "個人ルール（CLAUDE.md）" : "Personal Rules (CLAUDE.md)"}
                  </h3>
                  <p className="text-xs text-[var(--color-subtext)] mt-0.5">
                    {locale === "ja" ? "この社員の行動ルール・性格・知識を自由に編集できます" : "Customize this employee's behavior, personality, and knowledge"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {claudeMdSaved && (
                    <span className="text-xs text-green-600">{locale === "ja" ? "保存しました" : "Saved"}</span>
                  )}
                  <button
                    onClick={async () => {
                      setClaudeMdSaving(true);
                      setClaudeMdSaved(false);
                      try {
                        await fetch("/api/employee-files", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ employeeId: employee.id, _action: "writeFile", path: "CLAUDE.md", content: claudeMd }),
                        });
                        setClaudeMdSaved(true);
                        setTimeout(() => setClaudeMdSaved(false), 2000);
                      } catch {}
                      setClaudeMdSaving(false);
                    }}
                    disabled={claudeMdSaving}
                    className="px-4 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-50 transition-colors"
                  >
                    {claudeMdSaving ? (locale === "ja" ? "保存中..." : "Saving...") : (locale === "ja" ? "保存" : "Save")}
                  </button>
                </div>
              </div>
              <textarea
                value={claudeMd}
                onChange={(e) => setClaudeMd(e.target.value)}
                rows={15}
                className="w-full px-4 py-3 font-mono text-sm text-[var(--color-text)] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent resize-y"
                placeholder={locale === "ja" ? "# 個人ルール\n\n## 性格\n- 丁寧で親しみやすい\n\n## 知識\n- ...\n\n## やってはいけないこと\n- ..." : "# Personal Rules\n\n## Personality\n..."}
                spellCheck={false}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
