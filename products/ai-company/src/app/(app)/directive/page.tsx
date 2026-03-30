"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { EmployeeAvatar } from "@/components/employee-avatar";
import Link from "next/link";

interface TaskResult {
  empId: string;
  empName?: string;
  task: string;
  status: string;
  reply?: string;
  error?: string;
  threadId?: string;
}

interface DirectiveResult {
  directive: string;
  plan: { empId: string; task: string }[];
  results: TaskResult[];
  error?: string;
}

export default function DirectivePage() {
  const { locale } = useI18n();
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [phase, setPhase] = useState<"idle" | "planning" | "executing" | "done">("idle");
  const [result, setResult] = useState<DirectiveResult | null>(null);
  const [history, setHistory] = useState<DirectiveResult[]>([]);

  const execute = async () => {
    if (!input.trim()) return;
    setProcessing(true);
    setPhase("planning");
    setResult(null);

    try {
      const res = await fetch("/api/directive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directive: input }),
      });
      setPhase("executing");
      const data = await res.json();
      setResult(data);
      if (!data.error) {
        setHistory((prev) => [data, ...prev]);
      }
      setPhase("done");
    } catch {
      setResult({ directive: input, plan: [], results: [], error: "通信エラー" });
      setPhase("done");
    }
    setProcessing(false);
  };

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    done: { label: "完了", color: "#10b981", bg: "#ecfdf5" },
    error: { label: "エラー", color: "#ef4444", bg: "#fef2f2" },
    skipped: { label: "スキップ", color: "#6b7280", bg: "#f9fafb" },
  };

  return (
    <div className="px-8 py-8 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          {locale === "ja" ? "指示" : "Directive"}
        </h1>
        <p className="text-sm text-[var(--color-subtext)] mt-0.5">
          {locale === "ja"
            ? "全体に指示を出すと、秘書が計画を分解し各エージェントに自動で振り分けます"
            : "Issue a directive and the secretary will break it down and assign to each agent"}
        </p>
      </div>

      {/* Input */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-6 mb-6">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={locale === "ja"
            ? "例: この会社が来年に年商100億達成する計画を立ててください"
            : "e.g. Create a plan to achieve 10B revenue next year"}
          rows={3}
          className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent resize-none"
          disabled={processing}
        />
        <div className="flex items-center justify-between mt-4">
          <div className="text-xs text-[var(--color-subtext)]">
            {phase === "planning" && (locale === "ja" ? "計画を分解中..." : "Breaking down plan...")}
            {phase === "executing" && (locale === "ja" ? "各エージェントが作業中..." : "Agents working...")}
            {phase === "done" && (locale === "ja" ? "完了" : "Done")}
          </div>
          <button
            onClick={execute}
            disabled={processing || !input.trim()}
            className="px-6 py-2.5 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {processing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {locale === "ja" ? "実行中..." : "Running..."}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
                {locale === "ja" ? "指示を出す" : "Execute"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Processing Animation */}
      {processing && (
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-8 mb-6 text-center">
          <div className="flex justify-center gap-3 mb-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-3 h-3 rounded-full bg-[var(--color-primary)] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <p className="text-sm text-[var(--color-subtext)]">
            {phase === "planning"
              ? (locale === "ja" ? "秘書が指示を分析して計画を立てています..." : "Secretary is analyzing and planning...")
              : (locale === "ja" ? "各エージェントがタスクを実行しています..." : "Agents are executing tasks...")}
          </p>
        </div>
      )}

      {/* Result */}
      {result && !result.error && (
        <div className="space-y-4 mb-8">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">
            {locale === "ja" ? "実行結果" : "Results"} — {result.results.length} {locale === "ja" ? "タスク" : "tasks"}
          </h2>

          {result.results.map((r, i) => {
            const st = statusConfig[r.status] || statusConfig.skipped;
            return (
              <div key={i} className="bg-white rounded-xl border border-[var(--color-border)] p-5">
                <div className="flex items-start gap-3">
                  <EmployeeAvatar seed={r.empId} size="2.5rem" className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-[var(--color-text)]">{r.empName || r.empId}</span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: st.bg, color: st.color }}>
                          {st.label}
                        </span>
                      </div>
                      {r.threadId && (
                        <Link href={`/employee/${r.empId}`} className="text-xs text-[var(--color-primary)] hover:underline">
                          {locale === "ja" ? "チャットを見る" : "View chat"}
                        </Link>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-primary)] mt-1">{r.task}</p>
                    {r.reply && (
                      <p className="text-sm text-[var(--color-subtext)] mt-2 line-clamp-3">{r.reply}</p>
                    )}
                    {r.error && (
                      <p className="text-sm text-red-500 mt-2">{r.error}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {result?.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-red-600">{result.error}</p>
          {result.error === "Could not parse plan" && (
            <pre className="text-xs text-red-400 mt-2 whitespace-pre-wrap">{(result as unknown as { raw?: string }).raw}</pre>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text)] mb-3">
            {locale === "ja" ? "過去の指示" : "Past Directives"}
          </h2>
          <div className="space-y-2">
            {history.slice(1).map((h, i) => (
              <div key={i} className="bg-white rounded-lg border border-[var(--color-border)] px-4 py-3 text-sm">
                <p className="text-[var(--color-text)] truncate">{h.directive}</p>
                <p className="text-xs text-[var(--color-subtext)] mt-1">
                  {h.results.length} {locale === "ja" ? "タスク実行" : "tasks"} ・ {h.results.filter((r) => r.status === "done").length} {locale === "ja" ? "完了" : "done"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
