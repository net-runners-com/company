"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEmployeesStore } from "@/stores/employees";
import { useI18n } from "@/lib/i18n";

export default function CreateEmployeePage() {
  const router = useRouter();
  const create = useEmployeesStore((s) => s.create);
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "",
    role: "",
    department: "",
    tone: "",
    skills: [] as string[],
  });
  const [skillInput, setSkillInput] = useState("");

  const addSkill = () => {
    if (skillInput.trim() && !form.skills.includes(skillInput.trim())) {
      setForm({ ...form, skills: [...form.skills, skillInput.trim()] });
      setSkillInput("");
    }
  };

  const handleFinish = async () => {
    await create({
      name: form.name,
      role: form.role,
      department: form.department,
      tone: form.tone,
      skills: form.skills,
      greeting: `Hi, I'm ${form.name}. Looking forward to working with you!`,
    });
    router.push("/home");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm p-8">
          {step === 0 && (
            <div className="animate-fade-in">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-[var(--color-text)]">{t.employee.createTitle}</h2>
                <p className="text-sm text-[var(--color-subtext)] mt-1">{t.employee.createSubtitle}</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t.employee.name}</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t.employee.namePlaceholder}
                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t.employee.role}</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                  >
                    <option value="">{t.employee.selectRole}</option>
                    {Object.entries(t.employee.roles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t.employee.department}</label>
                  <input
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    placeholder={t.employee.departmentPlaceholder}
                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="animate-fade-in">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-[var(--color-text)]">{t.employee.personalityTitle}</h2>
                <p className="text-sm text-[var(--color-subtext)] mt-1">{t.employee.personalitySubtitle}</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t.employee.commStyle}</label>
                  <select
                    value={form.tone}
                    onChange={(e) => setForm({ ...form, tone: e.target.value })}
                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                  >
                    <option value="">{t.employee.selectStyle}</option>
                    {t.employee.tones.map((tone) => <option key={tone} value={tone}>{tone}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t.employee.skills}</label>
                  <div className="flex gap-2">
                    <input
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                      placeholder={t.employee.skillsPlaceholder}
                      className="flex-1 px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                    />
                    <button onClick={addSkill} className="px-3 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors">
                      {t.common.add}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.skills.map((s) => (
                      <span
                        key={s}
                        onClick={() => setForm({ ...form, skills: form.skills.filter((x) => x !== s) })}
                        className="px-2.5 py-1 bg-[var(--color-primary-light)] text-[var(--color-primary)] text-xs font-medium rounded-full cursor-pointer hover:bg-[var(--color-danger-light)] hover:text-[var(--color-danger)] transition-colors"
                      >
                        {s} &times;
                      </span>
                    ))}
                  </div>
                </div>
              </div>
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
            {step < 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!form.name || !form.role}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t.common.continue}
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
              >
                {t.employee.createEmployee}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
