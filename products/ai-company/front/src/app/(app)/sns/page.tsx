"use client";

import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { SNSAccount, SNSPlatform } from "@/types";

const platformConfig: Record<SNSPlatform, { name: string; color: string; bg: string }> = {
  note: { name: "note.com", color: "var(--color-success)", bg: "var(--color-success-light)" },
  threads: { name: "Threads", color: "var(--color-text)", bg: "var(--color-border-light)" },
  line: { name: "LINE", color: "var(--color-success)", bg: "var(--color-success-light)" },
  x: { name: "X", color: "var(--color-text)", bg: "var(--color-border-light)" },
  instagram: { name: "Instagram", color: "var(--color-danger)", bg: "var(--color-danger-light)" },
};

export default function SNSPage() {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<SNSAccount[]>([]);

  useEffect(() => {
    api.getSNSAccounts().then(setAccounts);
  }, []);

  return (
    <div className="px-8 py-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">{t.sns.title}</h1>
          <p className="text-sm text-[var(--color-subtext)] mt-0.5">{t.sns.subtitle}</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t.sns.connectAccount}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-border)]">
        {accounts.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-[var(--color-subtext)]">{t.sns.noAccounts}</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {accounts.map((acc) => {
              const config = platformConfig[acc.platform];
              return (
                <div key={acc.id} className="flex items-center gap-4 px-6 py-4">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
                    style={{ backgroundColor: config.bg, color: config.color }}
                  >
                    {config.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--color-text)]">{config.name}</p>
                    <p className="text-xs text-[var(--color-subtext)]">{acc.accountName}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    acc.sessionValid
                      ? "bg-[var(--color-success-light)] text-[var(--color-success)]"
                      : "bg-[var(--color-danger-light)] text-[var(--color-danger)]"
                  }`}>
                    {acc.sessionValid ? t.sns.connected : t.sns.reconnect}
                  </span>
                  <button className="text-[var(--color-subtext)] hover:text-[var(--color-text)] transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
