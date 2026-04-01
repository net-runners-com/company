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
      {/* VNC Overlay removed — VNC is shown inline in chat area */}

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

        {activeTab === "chat" && (
          <>
            <ChatView employee={employee} />
            {browserActive && <VncFloating onClose={() => setBrowserActive(false)} locale={locale} />}
          </>
        )}

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

// --- VNC Floating Window ---
function VncFloating({ onClose, locale }: { onClose: () => void; locale: string }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 480, h: 320 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    // 初期位置: 右上
    setPos({ x: window.innerWidth - 800, y: 20 });
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - pos.x, y: e.clientY - pos.y });
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => setPos({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging, dragStart]);

  return (
    <div
      className="fixed z-50 rounded-xl overflow-hidden shadow-2xl border border-gray-700 animate-fade-in"
      style={{ left: pos.x, top: pos.y, width: minimized ? 200 : size.w, height: minimized ? 36 : size.h }}
    >
      {/* Title bar */}
      <div
        onMouseDown={onMouseDown}
        className="flex items-center justify-between px-3 py-1.5 bg-gray-900 cursor-move select-none"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white text-[10px] font-medium">
            {locale === "ja" ? "ブラウザ操作中" : "Browser"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Size buttons */}
          <button onClick={() => setSize({ w: 320, h: 240 })} className="text-white/40 hover:text-white text-[9px] px-1">S</button>
          <button onClick={() => setSize({ w: 480, h: 320 })} className="text-white/40 hover:text-white text-[9px] px-1">M</button>
          <button onClick={() => setSize({ w: 720, h: 480 })} className="text-white/40 hover:text-white text-[9px] px-1">L</button>
          {/* Minimize */}
          <button onClick={() => setMinimized(!minimized)} className="text-white/40 hover:text-white px-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={minimized ? "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" : "M19 13H5v-2h14v2z"} />
            </svg>
          </button>
          {/* Close */}
          <button onClick={onClose} className="text-white/40 hover:text-white px-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      {/* Screen stream */}
      {!minimized && (
        <img
          src="http://localhost:8000/browser/stream"
          alt="Browser"
          className="w-full bg-black object-contain"
          style={{ height: size.h - 36 }}
        />
      )}
    </div>
  );
}
