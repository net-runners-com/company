"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { EmployeeAvatar } from "@/components/employee-avatar";

interface Toast {
  id: string;
  empId: string;
  empName: string;
  threadTitle: string;
  message: string;
  role: string;
  timestamp: string;
}

export function ActivityToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastCheck = useRef<string>("");
  const seenIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    const poll = async () => {
      try {
        const empRes = await fetch("/api/employees");
        const empData = await empRes.json();
        const employees = Object.values(empData) as { id: string; name: string; role: string }[];

        const newToasts: Toast[] = [];
        for (const emp of employees) {
          const threadRes = await fetch("/api/employee-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ _action: "threads", employeeId: emp.id }),
          });
          const threadData = await threadRes.json();
          for (const thread of (threadData.threads || []).slice(0, 3)) {
            const histRes = await fetch("/api/employee-chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ _action: "history", employeeId: emp.id, threadId: thread.id }),
            });
            const hist = await histRes.json();
            if (Array.isArray(hist) && hist.length > 0) {
              const last = hist[hist.length - 1];
              const toastId = `${emp.id}-${thread.id}-${last.timestamp}`;

              if (!seenIds.current.has(toastId) && initialized.current && last.role === "assistant") {
                if (!lastCheck.current || last.timestamp > lastCheck.current) {
                  newToasts.push({
                    id: toastId,
                    empId: emp.id,
                    empName: emp.name,
                    threadTitle: thread.title,
                    message: last.content?.slice(0, 80) || "",
                    role: last.role,
                    timestamp: last.timestamp,
                  });
                }
              }
              seenIds.current.add(toastId);
            }
          }
        }

        if (!initialized.current) {
          initialized.current = true;
          lastCheck.current = new Date().toISOString().replace("Z", "");
          return;
        }

        if (newToasts.length > 0) {
          lastCheck.current = new Date().toISOString().replace("Z", "");
          setToasts((prev) => [...newToasts.slice(0, 3), ...prev].slice(0, 5));
          // 3秒後に自動で閉じる
          for (const t of newToasts) {
            setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3000);
          }
        }
      } catch {}
    };

    poll();
    const interval = setInterval(poll, 15000); // 15秒ごと
    return () => clearInterval(interval);
  }, []);

  const router = useRouter();

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => { router.push(`/employee/${toast.empId}`); dismiss(toast.id); }}
          className="bg-white rounded-xl border border-[var(--color-border)] shadow-lg p-4 animate-fade-in cursor-pointer hover:border-[var(--color-primary)] transition-colors"
        >
          <div className="flex items-start gap-3">
            <EmployeeAvatar seed={toast.empId} size="2rem" className="shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-medium text-xs text-[var(--color-text)]">{toast.empName}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); dismiss(toast.id); }}
                  className="p-0.5 text-[var(--color-subtext)] hover:text-[var(--color-text)] transition-colors shrink-0 ml-2"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-[10px] text-[var(--color-primary)] mt-0.5">{toast.threadTitle}</p>
              <p className="text-xs text-[var(--color-subtext)] mt-1 line-clamp-2">{toast.message}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
