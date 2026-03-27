"use client";

import { useState } from "react";
import { mockCompany } from "@/data/mock";
import { useI18n } from "@/lib/i18n";

export default function SettingsPage() {
  const { t } = useI18n();
  const [form, setForm] = useState({
    name: mockCompany.name,
    industry: mockCompany.industry,
    mission: mockCompany.mission,
    goals: mockCompany.goals,
  });

  return (
    <div className="max-w-4xl px-8 py-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">{t.settings.title}</h1>
        <p className="text-sm text-[var(--color-subtext)] mt-0.5">{t.settings.subtitle}</p>
      </div>

      {/* Company Info */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-6 mb-6">
        <h2 className="font-semibold text-[var(--color-text)] mb-5">{t.settings.companyProfile}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t.settings.companyName}</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-shadow"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t.settings.industry}</label>
            <input
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-shadow"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t.settings.mission}</label>
            <textarea
              value={form.mission}
              onChange={(e) => setForm({ ...form, mission: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 bg-white border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-shadow resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t.settings.goals}</label>
            <textarea
              value={form.goals}
              onChange={(e) => setForm({ ...form, goals: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 bg-white border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-shadow resize-none"
            />
          </div>
          <button className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors">
            {t.common.save}
          </button>
        </div>
      </div>

      {/* Plan */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-6 mb-6">
        <h2 className="font-semibold text-[var(--color-text)] mb-4">{t.settings.plan}</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-[var(--color-primary-light)] text-[var(--color-primary)] text-xs font-semibold rounded-full">
              {t.settings.free}
            </span>
            <span className="text-sm text-[var(--color-subtext)]">{t.settings.upTo.replace("{n}", "2")}</span>
          </div>
          <button className="px-4 py-2 bg-white border border-[var(--color-primary)] text-[var(--color-primary)] text-sm font-medium rounded-lg hover:bg-[var(--color-primary-light)] transition-colors">
            {t.settings.upgrade}
          </button>
        </div>
      </div>

      {/* Data */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
        <h2 className="font-semibold text-[var(--color-text)] mb-4">{t.settings.data}</h2>
        <button className="px-4 py-2 bg-white border border-[var(--color-border)] text-[var(--color-text)] text-sm font-medium rounded-lg hover:bg-[var(--color-border-light)] transition-colors">
          {t.common.export}
        </button>
      </div>
    </div>
  );
}
