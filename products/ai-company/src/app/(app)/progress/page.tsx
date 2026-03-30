"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n";
import { EmployeeAvatar } from "@/components/employee-avatar";
import { FilePreviewModal } from "@/components/file-preview-modal";
import Link from "next/link";

interface Step {
  step: number;
  title: string;
  empId: string;
  empName: string;
  description: string;
  status: "pending" | "running" | "done" | "error";
  result: string;
  threadId?: string;
}

interface Project {
  id: string;
  brief: string;
  steps: Step[];
  status: string;
  createdAt: string;
}

const statusConfig = {
  pending:  { label: "待機", labelEn: "Pending", color: "#9ca3af", bg: "#f9fafb", icon: "○" },
  running:  { label: "実行中", labelEn: "Running", color: "#f59e0b", bg: "#fffbeb", icon: "◎" },
  done:     { label: "完了", labelEn: "Done", color: "#10b981", bg: "#ecfdf5", icon: "●" },
  error:    { label: "エラー", labelEn: "Error", color: "#ef4444", bg: "#fef2f2", icon: "✕" },
};

export default function ProgressPage() {
  const { locale } = useI18n();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [brief, setBrief] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [executing, setExecuting] = useState<number | null>(null);
  const [previewFile, setPreviewFile] = useState<{ empId: string; path: string } | null>(null);

  const fetchProjects = (selectId?: string) => {
    fetch("/api/projects").then(r => r.json()).then(d => {
      const list = d.projects || [];
      setProjects(list);
      const targetId = selectId || selectedProject?.id;
      if (targetId) {
        const updated = list.find((p: Project) => p.id === targetId);
        if (updated) setSelectedProject(updated);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchProjects(); }, []);

  const createProject = async () => {
    if (!brief.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      const data = await res.json();
      if (data.id) {
        setSelectedProject(data);
        setBrief("");
        fetchProjects();
      }
    } catch {}
    setCreating(false);
  };

  const executeStep = async (projectId: string, stepNum: number) => {
    setExecuting(stepNum);
    // 即座にUIを「実行中」に更新
    if (selectedProject) {
      setSelectedProject({
        ...selectedProject,
        steps: selectedProject.steps.map((s) => s.step === stepNum ? { ...s, status: "running" as const } : s),
      });
    }
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _action: "execute", projectId, step: stepNum }),
      });
      const data = await res.json();
      if (data.project) setSelectedProject(data.project);
      fetchProjects();
    } catch {}
    setExecuting(null);
  };

  const executeAll = async (project: Project) => {
    for (const step of project.steps) {
      if (step.status === "done") continue;
      setExecuting(step.step);
      setSelectedProject((prev) => prev ? {
        ...prev,
        steps: prev.steps.map((s) => s.step === step.step ? { ...s, status: "running" as const } : s),
      } : prev);
      try {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ _action: "execute", projectId: project.id, step: step.step }),
        });
        const data = await res.json();
        if (data.project) setSelectedProject(data.project);
        fetchProjects();
        if (data.step?.status === "error") break;
      } catch { break; }
    }
    setExecuting(null);
  };

  const doneCount = selectedProject?.steps.filter(s => s.status === "done").length || 0;
  const totalSteps = selectedProject?.steps.length || 0;
  const progress = totalSteps > 0 ? Math.round((doneCount / totalSteps) * 100) : 0;

  return (
    <div className="px-8 py-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">
            {locale === "ja" ? "進捗管理" : "Progress"}
          </h1>
          <p className="text-sm text-[var(--color-subtext)] mt-0.5">
            {locale === "ja" ? "案件のパイプラインを作成・管理します" : "Create and manage project pipelines"}
          </p>
        </div>
      </div>

      {/* New Project Input */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-5 mb-6">
        <div className="flex gap-3">
          <input
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder={locale === "ja" ? "案件概要（例: サンプル会社からHP制作依頼 10万円）" : "Project brief..."}
            className="flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
            disabled={creating}
            onKeyDown={(e) => e.key === "Enter" && createProject()}
          />
          <button onClick={createProject} disabled={creating || !brief.trim()}
            className="px-5 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0">
            {creating ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
            {locale === "ja" ? "パイプライン作成" : "Create Pipeline"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project List */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--color-subtext)] mb-2">
            {locale === "ja" ? "案件一覧" : "Projects"}
          </h2>
          {loading ? (
            <div className="text-sm text-[var(--color-subtext)] py-4 text-center">{locale === "ja" ? "読み込み中..." : "Loading..."}</div>
          ) : projects.length === 0 ? (
            <div className="text-sm text-[var(--color-subtext)] py-8 text-center">{locale === "ja" ? "案件がありません" : "No projects"}</div>
          ) : (
            projects.map((p) => {
              const done = p.steps.filter(s => s.status === "done").length;
              const pct = p.steps.length > 0 ? Math.round((done / p.steps.length) * 100) : 0;
              return (
                <button key={p.id} onClick={() => setSelectedProject(p)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${selectedProject?.id === p.id ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]" : "border-[var(--color-border)] bg-white hover:border-[var(--color-primary)]/30"}`}>
                  <p className="text-sm font-medium text-[var(--color-text)] truncate">{p.brief}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1.5 bg-[var(--color-border-light)] rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--color-primary)] rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-[var(--color-subtext)] shrink-0">{done}/{p.steps.length}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Pipeline View */}
        <div className="lg:col-span-2">
          {selectedProject ? (
            <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-[var(--color-border)]">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-[var(--color-text)]">{selectedProject.brief}</h2>
                    <p className="text-xs text-[var(--color-subtext)] mt-0.5">{selectedProject.steps.length} {locale === "ja" ? "工程" : "steps"} ・ {progress}%</p>
                  </div>
                  <button onClick={() => executeAll(selectedProject)} disabled={executing !== null || progress === 100}
                    className="px-4 py-2 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-50 transition-colors flex items-center gap-1.5">
                    {executing !== null ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                    {locale === "ja" ? "全て実行" : "Run All"}
                  </button>
                </div>
                {/* Progress bar */}
                <div className="h-2 bg-[var(--color-border-light)] rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>

              {/* Steps */}
              <div className="divide-y divide-[var(--color-border)]">
                {selectedProject.steps.map((step, i) => {
                  const st = statusConfig[step.status];
                  const isRunning = executing === step.step;
                  const prevDone = i === 0 || selectedProject.steps[i - 1].status === "done";
                  return (
                    <div key={step.step} className={`px-6 py-4 ${step.status === "done" ? "bg-green-50/30" : ""}`}>
                      <div className="flex items-start gap-4">
                        {/* Step indicator */}
                        <div className="flex flex-col items-center shrink-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            step.status === "done" ? "bg-green-100 text-green-600" :
                            step.status === "running" ? "bg-yellow-100 text-yellow-600 animate-pulse" :
                            step.status === "error" ? "bg-red-100 text-red-600" :
                            "bg-gray-100 text-gray-400"
                          }`}>
                            {step.status === "done" ? "✓" : step.status === "running" ? "⟳" : step.step}
                          </div>
                          {i < selectedProject.steps.length - 1 && (
                            <div className={`w-0.5 h-6 mt-1 ${step.status === "done" ? "bg-green-300" : "bg-gray-200"}`} />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-[var(--color-text)]">{step.title}</span>
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: st.bg, color: st.color }}>
                                {locale === "ja" ? st.label : st.labelEn}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {step.empId && <EmployeeAvatar seed={step.empId} size="1.5rem" />}
                              <span className="text-xs text-[var(--color-subtext)]">{step.empName}</span>
                            </div>
                          </div>
                          <p className="text-xs text-[var(--color-subtext)] mt-1">{step.description}</p>

                          {step.status === "done" && (() => {
                            // 結果と説明からファイル名を抽出
                            const allText = `${step.description} ${step.result}`;
                            const files = [...new Set(allText.match(/[\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\-_]+\.(?:md|txt|json|csv|pdf|html|xlsx|py|js|ts)/g) || [])];
                            return files.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {files.map((f) => (
                                  <button key={f} onClick={() => setPreviewFile({ empId: step.empId, path: f })}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--color-primary-light)] text-[var(--color-primary)] text-xs rounded hover:bg-[var(--color-primary)]/20 transition-colors cursor-pointer">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                    </svg>
                                    {f}
                                  </button>
                                ))}
                              </div>
                            ) : null;
                          })()}

                          <div className="flex items-center gap-2 mt-2">
                            {step.status === "pending" && prevDone && (
                              <button onClick={() => executeStep(selectedProject.id, step.step)} disabled={isRunning || executing !== null}
                                className="px-3 py-1 text-xs font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-50 transition-colors flex items-center gap-1">
                                {isRunning ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                                {locale === "ja" ? "実行" : "Run"}
                              </button>
                            )}
                            {step.status === "running" && (
                              <span className="text-xs text-yellow-600 flex items-center gap-1">
                                <div className="w-3 h-3 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin" />
                                {locale === "ja" ? "処理中..." : "Processing..."}
                              </span>
                            )}
                            {step.threadId && (
                              <Link href={`/employee/${step.empId}`} className="text-xs text-[var(--color-primary)] hover:underline">
                                {locale === "ja" ? "チャットを見る" : "View chat"}
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[var(--color-border)] p-12 text-center">
              <p className="text-sm text-[var(--color-subtext)]">
                {locale === "ja" ? "案件を選択、または新しいパイプラインを作成してください" : "Select a project or create a new pipeline"}
              </p>
            </div>
          )}
        </div>
      </div>
      {/* File Preview Modal */}
      {previewFile && typeof document !== "undefined" && createPortal(
        <FilePreviewModal
          employeeId={previewFile.empId}
          filePath={previewFile.path}
          onClose={() => setPreviewFile(null)}
        />,
        document.body
      )}
    </div>
  );
}
