"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCompanyStore } from "@/stores/company";
import { useI18n } from "@/lib/i18n";

export default function OnboardingPage() {
  const router = useRouter();
  const createCompany = useCompanyStore((s) => s.create);
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "",
    industry: "",
    mission: "",
    goals: "",
  });

  const steps = t.onboarding.steps;

  const handleFinish = async () => {
    await createCompany(form);
    router.push("/home");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Step Indicator */}
        <div className="flex justify-center gap-2 mb-8">
          {steps.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  i <= step
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-[var(--color-border)] text-[var(--color-subtext)]"
                }`}
              >
                {i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-8 h-0.5 ${i < step ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm p-8">
          {step === 0 && (
            <div className="animate-fade-in">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-[var(--color-text)]">{t.onboarding.step1Title}</h2>
                <p className="text-sm text-[var(--color-subtext)] mt-1">{t.onboarding.step1Subtitle}</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t.onboarding.companyName}</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t.onboarding.companyPlaceholder}
                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t.settings.industry}</label>
                  <input
                    type="text"
                    value={form.industry}
                    onChange={(e) => setForm({ ...form, industry: e.target.value })}
                    placeholder={t.onboarding.industryPlaceholder}
                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="animate-fade-in">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-[var(--color-text)]">{t.onboarding.step2Title}</h2>
                <p className="text-sm text-[var(--color-subtext)] mt-1">{t.onboarding.step2Subtitle}</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t.settings.mission}</label>
                  <textarea
                    value={form.mission}
                    onChange={(e) => setForm({ ...form, mission: e.target.value })}
                    placeholder={t.onboarding.missionPlaceholder}
                    rows={2}
                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t.onboarding.goalsLabel}</label>
                  <textarea
                    value={form.goals}
                    onChange={(e) => setForm({ ...form, goals: e.target.value })}
                    placeholder={t.onboarding.goalsPlaceholder}
                    rows={2}
                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in text-center">
              <div className="w-16 h-16 bg-[var(--color-primary-light)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">{t.onboarding.step3Title}</h2>
              <p className="text-sm text-[var(--color-subtext)] leading-relaxed" style={{ whiteSpace: "pre-line" }}>
                {t.onboarding.step3Subtitle}
              </p>
            </div>
          )}

          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex-1 px-4 py-2 text-sm font-medium text-[var(--color-subtext)] bg-[var(--color-border-light)] rounded-lg hover:bg-[var(--color-border)] transition-colors"
              >
                {t.common.back}
              </button>
            )}
            {step < 2 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 0 && !form.name}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t.common.continue}
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
              >
                {t.onboarding.goToDashboard}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
