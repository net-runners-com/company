"use client";

import { useI18n } from "@/lib/i18n";

interface PermissionPanelProps {
  toolName: string;
  toolInput?: Record<string, unknown>;
  onAllow: () => void;
  onAllowPermanent: () => void;
  onDeny: () => void;
}

export function PermissionPanel({
  toolName,
  toolInput,
  onAllow,
  onAllowPermanent,
  onDeny,
}: PermissionPanelProps) {
  const { locale } = useI18n();

  const commandPreview = toolInput
    ? toolName === "Bash"
      ? String(toolInput.command || "")
      : toolName === "Edit" || toolName === "Write"
        ? String(toolInput.file_path || "")
        : JSON.stringify(toolInput).slice(0, 100)
    : "";

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-900">
            {locale === "ja"
              ? `${toolName} の実行許可が必要です`
              : `Permission required: ${toolName}`}
          </p>
          {commandPreview && (
            <code className="block mt-1.5 px-2 py-1 bg-amber-100/50 rounded text-xs font-mono text-amber-800 truncate">
              {commandPreview}
            </code>
          )}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={onAllow}
              className="px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-lg hover:bg-blue-600 transition-colors"
            >
              {locale === "ja" ? "許可" : "Yes"}
            </button>
            <button
              onClick={onAllowPermanent}
              className="px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 transition-colors"
            >
              {locale === "ja" ? "常に許可" : "Always allow"}
            </button>
            <button
              onClick={onDeny}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-300 transition-colors"
            >
              {locale === "ja" ? "拒否" : "No"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
