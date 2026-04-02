"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  status: "pending" | "running" | "done" | "error" | "cancelled";
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

const statusConfig: Record<string, { label: string; labelEn: string; color: string; bg: string; ring: string }> = {
  pending:   { label: "待機",   labelEn: "Pending",   color: "#94a3b8", bg: "rgba(148,163,184,0.08)", ring: "rgba(148,163,184,0.2)" },
  running:   { label: "実行中", labelEn: "Running",   color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  ring: "rgba(245,158,11,0.25)" },
  done:      { label: "完了",   labelEn: "Done",      color: "#10b981", bg: "rgba(16,185,129,0.08)",  ring: "rgba(16,185,129,0.2)" },
  error:     { label: "エラー", labelEn: "Error",     color: "#ef4444", bg: "rgba(239,68,68,0.08)",   ring: "rgba(239,68,68,0.2)" },
  cancelled: { label: "中断",   labelEn: "Cancelled", color: "#8b5cf6", bg: "rgba(139,92,246,0.08)",  ring: "rgba(139,92,246,0.2)" },
};

export default function ProgressPage() {
  const { locale } = useI18n();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [brief, setBrief] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [runningSteps, setRunningSteps] = useState<Set<number>>(new Set());
  const [previewFile, setPreviewFile] = useState<{ empId: string; path: string } | null>(null);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Fetch project list ---
  const fetchProjects = useCallback(() => {
    fetch("/api/projects").then(r => r.json()).then(d => {
      const list = d.projects || [];
      setProjects(list);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // --- Poll selected project status ---
  const pollStatus = useCallback(() => {
    if (!selectedProject) return;
    fetch(`/api/projects?id=${selectedProject.id}`).then(r => r.json()).then(d => {
      if (d.project) {
        setSelectedProject(d.project);
        setRunningSteps(new Set(d.runningSteps || []));
        // Also update project list
        setProjects(prev => prev.map(p => p.id === d.project.id ? d.project : p));
      }
    }).catch(() => {});
  }, [selectedProject?.id]);

  useEffect(() => {
    // Poll every 3 seconds while we have running steps
    const hasRunning = selectedProject?.steps.some(s => s.status === "running");
    if (hasRunning) {
      pollRef.current = setInterval(pollStatus, 3000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedProject?.id, selectedProject?.steps.some(s => s.status === "running"), pollStatus]);

  // --- Create project ---
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

  // --- Execute step (fire-and-forget) ---
  const executeStep = async (projectId: string, stepNum: number) => {
    // Optimistic UI
    setSelectedProject(prev => prev ? {
      ...prev,
      steps: prev.steps.map(s => s.step === stepNum ? { ...s, status: "running" as const } : s),
    } : prev);
    setRunningSteps(prev => new Set(prev).add(stepNum));

    try {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _action: "execute", projectId, step: stepNum }),
      });
      // Start polling
      pollStatus();
    } catch {}
  };

  // --- Execute all (sequential fire-and-forget) ---
  const executeAll = async (project: Project) => {
    for (const step of project.steps) {
      if (step.status === "done") continue;
      await executeStep(project.id, step.step);
      // Wait for this step to finish by polling
      let finished = false;
      while (!finished) {
        await new Promise(r => setTimeout(r, 3000));
        try {
          const res = await fetch(`/api/projects?id=${project.id}`);
          const d = await res.json();
          if (d.project) {
            setSelectedProject(d.project);
            setRunningSteps(new Set(d.runningSteps || []));
            setProjects(prev => prev.map(p => p.id === d.project.id ? d.project : p));
            const s = d.project.steps.find((s: Step) => s.step === step.step);
            if (s && s.status !== "running") {
              finished = true;
              if (s.status === "error" || s.status === "cancelled") return; // stop on error
            }
          }
        } catch { finished = true; }
      }
    }
  };

  // --- Cancel step ---
  const cancelStep = async (projectId: string, stepNum: number) => {
    setCancelling(stepNum);
    try {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _action: "cancel", projectId, step: stepNum }),
      });
      pollStatus();
    } catch {}
    setCancelling(null);
  };

  const doneCount = selectedProject?.steps.filter(s => s.status === "done").length || 0;
  const totalSteps = selectedProject?.steps.length || 0;
  const progress = totalSteps > 0 ? Math.round((doneCount / totalSteps) * 100) : 0;
  const hasAnyRunning = selectedProject?.steps.some(s => s.status === "running") || false;

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch { return iso; }
  };

  return (
    <div className="px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          {locale === "ja" ? "進捗管理" : "Progress"}
        </h1>
        <p className="text-sm text-[var(--color-subtext)] mt-1">
          {locale === "ja" ? "案件のパイプラインを作成・管理します" : "Create and manage project pipelines"}
        </p>
      </div>

      {/* New Project Input */}
      <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5 mb-8 shadow-sm">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-subtext)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <input
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder={locale === "ja" ? "案件概要を入力（例: サンプル会社のHP制作 20万円）" : "Enter project brief..."}
              className="w-full pl-10 pr-4 py-3 border border-[var(--color-border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all"
              disabled={creating}
              onKeyDown={(e) => e.key === "Enter" && createProject()}
            />
          </div>
          <button onClick={createProject} disabled={creating || !brief.trim()}
            className="px-6 py-3 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-xl hover:brightness-110 transition-all disabled:opacity-40 flex items-center gap-2 shrink-0 shadow-sm shadow-[var(--color-primary)]/20">
            {creating && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {locale === "ja" ? "パイプライン作成" : "Create Pipeline"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Project List */}
        <div className="lg:col-span-4 xl:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-[var(--color-subtext)] uppercase tracking-wider">
              {locale === "ja" ? "案件一覧" : "Projects"}
            </h2>
            <span className="text-[10px] text-[var(--color-subtext)] bg-[var(--color-border-light)] px-2 py-0.5 rounded-full">
              {projects.length}
            </span>
          </div>
          <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
            {loading ? (
              <div className="flex flex-col items-center py-12 gap-3">
                <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-[var(--color-subtext)]">{locale === "ja" ? "読み込み中..." : "Loading..."}</span>
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-border-light)] flex items-center justify-center">
                  <svg className="w-6 h-6 text-[var(--color-subtext)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                </div>
                <p className="text-sm text-[var(--color-subtext)]">{locale === "ja" ? "案件がありません" : "No projects"}</p>
              </div>
            ) : (
              projects.map((p) => {
                const done = p.steps.filter(s => s.status === "done").length;
                const errors = p.steps.filter(s => s.status === "error").length;
                const running = p.steps.filter(s => s.status === "running").length;
                const pct = p.steps.length > 0 ? Math.round((done / p.steps.length) * 100) : 0;
                const isSelected = selectedProject?.id === p.id;
                return (
                  <button key={p.id} onClick={() => { setSelectedProject(p); setRunningSteps(new Set()); }}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                      isSelected
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]/[0.04] shadow-sm shadow-[var(--color-primary)]/10"
                        : "border-[var(--color-border)] bg-white hover:border-[var(--color-primary)]/30 hover:shadow-sm"
                    }`}>
                    <p className="text-sm font-medium text-[var(--color-text)] truncate leading-relaxed">{p.brief}</p>
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex-1 h-1.5 bg-[var(--color-border-light)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{
                          width: `${pct}%`,
                          background: pct === 100 ? "#10b981" : "var(--color-primary)",
                        }} />
                      </div>
                      <span className="text-[10px] font-medium text-[var(--color-subtext)] shrink-0 tabular-nums">{pct}%</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2.5">
                      <span className="text-[10px] text-[var(--color-subtext)]">{formatDate(p.createdAt)}</span>
                      <span className="text-[10px] text-[var(--color-subtext)]">|</span>
                      <div className="flex items-center gap-1.5">
                        {done > 0 && <span className="flex items-center gap-0.5 text-[10px] text-emerald-600"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{done}</span>}
                        {running > 0 && <span className="flex items-center gap-0.5 text-[10px] text-amber-600"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />{running}</span>}
                        {errors > 0 && <span className="flex items-center gap-0.5 text-[10px] text-red-500"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />{errors}</span>}
                      </div>
                      <span className="text-[10px] text-[var(--color-subtext)] ml-auto">{done}/{p.steps.length}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Pipeline View */}
        <div className="lg:col-span-8 xl:col-span-9">
          {selectedProject ? (
            <div className="bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-sm">
              {/* Header */}
              <div className="px-6 py-5 border-b border-[var(--color-border)] bg-gradient-to-r from-white to-[var(--color-border-light)]/30">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-lg text-[var(--color-text)] leading-snug">{selectedProject.brief}</h2>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-[var(--color-subtext)]">
                        {totalSteps} {locale === "ja" ? "工程" : "steps"}
                      </span>
                      <span className="text-xs text-[var(--color-subtext)]">|</span>
                      <span className="text-xs font-semibold" style={{ color: progress === 100 ? "#10b981" : "var(--color-primary)" }}>
                        {progress}% {locale === "ja" ? "完了" : "complete"}
                      </span>
                      {hasAnyRunning && (
                        <>
                          <span className="text-xs text-[var(--color-subtext)]">|</span>
                          <span className="text-xs text-amber-600 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            {locale === "ja" ? "実行中" : "Running"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button onClick={() => executeAll(selectedProject)} disabled={hasAnyRunning || progress === 100}
                    className="px-5 py-2.5 bg-[var(--color-primary)] text-white text-xs font-semibold rounded-xl hover:brightness-110 disabled:opacity-40 transition-all flex items-center gap-2 shrink-0 shadow-sm shadow-[var(--color-primary)]/20">
                    {hasAnyRunning ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>
                    )}
                    {locale === "ja" ? "全て実行" : "Run All"}
                  </button>
                </div>
                <div className="h-2 bg-[var(--color-border-light)] rounded-full mt-4 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700 ease-out" style={{
                    width: `${progress}%`,
                    background: progress === 100
                      ? "linear-gradient(90deg, #10b981, #34d399)"
                      : "linear-gradient(90deg, var(--color-primary), var(--color-primary-dark, var(--color-primary)))",
                  }} />
                </div>
              </div>

              {/* Steps */}
              <div className="divide-y divide-[var(--color-border)]/60">
                {selectedProject.steps.map((step, i) => {
                  const st = statusConfig[step.status] || statusConfig.pending;
                  const prevDone = i === 0 || selectedProject.steps[i - 1].status === "done";
                  const canRun = (step.status === "pending" || step.status === "error" || step.status === "cancelled") && prevDone && !hasAnyRunning;
                  const isRunning = step.status === "running";
                  const isCancelling = cancelling === step.step;

                  return (
                    <div key={step.step} className="relative" style={{
                      backgroundColor: step.status === "done" ? "rgba(16,185,129,0.02)" :
                        step.status === "error" ? "rgba(239,68,68,0.02)" :
                        step.status === "cancelled" ? "rgba(139,92,246,0.02)" : "transparent"
                    }}>
                      <div className="px-6 py-5 flex gap-5">
                        {/* Timeline */}
                        <div className="flex flex-col items-center shrink-0 pt-0.5">
                          <div className={`relative w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                            step.status === "done" ? "bg-emerald-100 text-emerald-600" :
                            step.status === "running" ? "bg-amber-100 text-amber-600" :
                            step.status === "error" ? "bg-red-100 text-red-600" :
                            step.status === "cancelled" ? "bg-violet-100 text-violet-600" :
                            "bg-gray-100 text-gray-400"
                          }`}>
                            {isRunning && (
                              <span className="absolute inset-0 rounded-full border-2 border-amber-400 animate-ping opacity-30" />
                            )}
                            {step.status === "done" ? (
                              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                            ) : step.status === "running" ? (
                              <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                            ) : step.status === "error" ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            ) : step.status === "cancelled" ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" /></svg>
                            ) : (
                              <span className="text-xs">{step.step}</span>
                            )}
                          </div>
                          {i < selectedProject.steps.length - 1 && (
                            <div className={`w-0.5 flex-1 mt-2 min-h-[24px] rounded-full transition-colors ${
                              step.status === "done" ? "bg-emerald-300" : "bg-gray-200"
                            }`} />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="font-semibold text-sm text-[var(--color-text)] truncate">{step.title}</span>
                              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0 border" style={{
                                backgroundColor: st.bg, color: st.color, borderColor: st.ring,
                              }}>
                                {locale === "ja" ? st.label : st.labelEn}
                              </span>
                            </div>
                            {step.empId && (
                              <div className="flex items-center gap-2 shrink-0">
                                <EmployeeAvatar seed={step.empId} size="1.75rem" />
                                <span className="text-xs font-medium text-[var(--color-subtext)]">{step.empName}</span>
                              </div>
                            )}
                          </div>

                          <p className="text-xs text-[var(--color-subtext)] mt-1.5 leading-relaxed line-clamp-2">{step.description}</p>

                          {/* Error / cancelled message */}
                          {(step.status === "error" || step.status === "cancelled") && step.result && (
                            <div className={`mt-2.5 px-3 py-2 border rounded-lg ${
                              step.status === "cancelled" ? "bg-violet-50 border-violet-100" : "bg-red-50 border-red-100"
                            }`}>
                              <p className={`text-xs line-clamp-2 ${step.status === "cancelled" ? "text-violet-600" : "text-red-600"}`}>{step.result}</p>
                            </div>
                          )}

                          {/* Done: file links */}
                          {step.status === "done" && (() => {
                            const allText = `${step.description} ${step.result}`;
                            const files = [...new Set(allText.match(/[\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\-_]+\.(?:md|txt|json|csv|pdf|html|xlsx|py|js|ts)/g) || [])];
                            return files.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 mt-3">
                                {files.map((f) => (
                                  <button key={f} onClick={() => setPreviewFile({ empId: step.empId, path: f })}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--color-primary)]/[0.06] text-[var(--color-primary)] text-xs font-medium rounded-lg hover:bg-[var(--color-primary)]/[0.12] transition-colors border border-[var(--color-primary)]/10">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                    </svg>
                                    {f}
                                  </button>
                                ))}
                              </div>
                            ) : null;
                          })()}

                          {/* Actions */}
                          <div className="flex items-center gap-3 mt-3">
                            {canRun && (
                              <button onClick={() => executeStep(selectedProject.id, step.step)}
                                className="px-4 py-1.5 text-xs font-semibold bg-[var(--color-primary)] text-white rounded-lg hover:brightness-110 transition-all flex items-center gap-1.5 shadow-sm shadow-[var(--color-primary)]/20">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>
                                {step.status === "error" || step.status === "cancelled"
                                  ? (locale === "ja" ? "再実行" : "Retry")
                                  : (locale === "ja" ? "実行" : "Run")}
                              </button>
                            )}
                            {isRunning && (
                              <>
                                <span className="text-xs text-amber-600 flex items-center gap-1.5 font-medium">
                                  <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                  {locale === "ja" ? "処理中..." : "Processing..."}
                                </span>
                                <button onClick={() => cancelStep(selectedProject.id, step.step)} disabled={isCancelling}
                                  className="px-3 py-1.5 text-xs font-semibold bg-white text-red-500 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40 transition-all flex items-center gap-1.5">
                                  {isCancelling ? (
                                    <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" /></svg>
                                  )}
                                  {locale === "ja" ? "中断" : "Stop"}
                                </button>
                              </>
                            )}
                            {step.threadId && (
                              <Link href={`/employee/${step.empId}`} className="text-xs text-[var(--color-primary)] hover:underline font-medium flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" /></svg>
                                {locale === "ja" ? "チャット" : "Chat"}
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
            <div className="bg-white rounded-2xl border border-[var(--color-border)] p-16 text-center shadow-sm">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--color-border-light)] flex items-center justify-center">
                <svg className="w-8 h-8 text-[var(--color-subtext)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-[var(--color-text)] mb-1">
                {locale === "ja" ? "案件を選択してください" : "Select a project"}
              </p>
              <p className="text-xs text-[var(--color-subtext)]">
                {locale === "ja" ? "左の一覧から選択、または新しいパイプラインを作成" : "Choose from the list or create a new pipeline"}
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
