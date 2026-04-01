"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useEmployeesStore } from "@/stores/employees";
import { useI18n } from "@/lib/i18n";
import { AvatarPicker } from "@/components/avatar-picker";
import type { AvatarFullConfig } from "react-nice-avatar";

const deptLabels: Record<string, { ja: string; en: string }> = {
  "general-affairs": { ja: "総務部", en: "General Affairs" },
  marketing:         { ja: "マーケティング部", en: "Marketing" },
  research:          { ja: "リサーチ部", en: "Research" },
  sales:             { ja: "営業部", en: "Sales" },
  dev:               { ja: "開発部", en: "Development" },
  accounting:        { ja: "経理部", en: "Accounting" },
  pm:                { ja: "PM部", en: "PM" },
  strategy:          { ja: "戦略部", en: "Strategy" },
  hr:                { ja: "人事部", en: "HR" },
  engineering:       { ja: "エンジニアリング部", en: "Engineering" },
  newbiz:            { ja: "新規事業部", en: "New Business" },
  finance:           { ja: "財務部", en: "Finance" },
};

export default function CreateEmployeePage() {
  const router = useRouter();
  const { create, fetch: fetchEmployees, employees } = useEmployeesStore();
  const { t, locale } = useI18n();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "",
    role: "",
    department: "",
    tone: "",
    skills: [] as string[],
  });
  const [skillInput, setSkillInput] = useState("");
  const [avatarConfig, setAvatarConfig] = useState<Partial<AvatarFullConfig> | null>(null);
  const [newDept, setNewDept] = useState(false);
  const [customDeptId, setCustomDeptId] = useState("");
  const [customDeptName, setCustomDeptName] = useState("");

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  // 既存社員から部署を収集 + プリセット部署をマージ（重複排除）
  const presetKeys = new Set(Object.keys(deptLabels));
  const presetLabelsSet = new Set(Object.values(deptLabels).flatMap(v => [v.ja, v.en]));
  const existingDepts = [...new Set(employees.map((e) => e.department).filter(Boolean))]
    .filter(d => !presetLabelsSet.has(d) && !presetKeys.has(d));
  const allDeptIds = [...Object.keys(deptLabels), ...existingDepts];

  const getDeptLabel = (id: string) => {
    const preset = deptLabels[id];
    if (preset) return locale === "ja" ? preset.ja : preset.en;
    return id;
  };

  const addSkill = () => {
    if (skillInput.trim() && !form.skills.includes(skillInput.trim())) {
      setForm({ ...form, skills: [...form.skills, skillInput.trim()] });
      setSkillInput("");
    }
  };

  const handleFinish = async () => {
    const dept = newDept ? customDeptId : form.department;
    await create({
      name: form.name,
      role: form.role,
      department: dept,
      tone: form.tone,
      skills: form.skills,
      greeting: `${form.name}です。よろしくお願いします！`,
      avatarConfig: avatarConfig || undefined,
    } as Record<string, unknown>);
    router.push("/employees");
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
                  <input
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    placeholder={locale === "ja" ? "例: ライター、エンジニア、営業" : "e.g. Writer, Engineer, Sales"}
                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t.employee.department}</label>
                  {!newDept ? (
                    <>
                      <select
                        value={form.department}
                        onChange={(e) => {
                          if (e.target.value === "__new__") {
                            setNewDept(true);
                            setForm({ ...form, department: "" });
                          } else {
                            setForm({ ...form, department: e.target.value });
                          }
                        }}
                        className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                      >
                        <option value="">{locale === "ja" ? "部署を選択" : "Select department"}</option>
                        {allDeptIds.map((id) => {
                          const label = getDeptLabel(id);
                          return <option key={id} value={label}>{label}</option>;
                        })}
                        <option value="__new__">{locale === "ja" ? "＋ 新しい部署を作成" : "+ Create new department"}</option>
                      </select>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <input
                        value={customDeptName}
                        onChange={(e) => {
                          setCustomDeptName(e.target.value);
                          // 自動でID生成（英数ハイフン）
                          setCustomDeptId(e.target.value.toLowerCase().replace(/[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, "-").replace(/-+/g, "-"));
                        }}
                        placeholder={locale === "ja" ? "部署名（例: カスタマーサポート部）" : "Department name"}
                        className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          value={customDeptId}
                          onChange={(e) => setCustomDeptId(e.target.value)}
                          placeholder="ID (例: cs-support)"
                          className="flex-1 px-3 py-2 border border-[var(--color-border)] rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                        />
                        <button
                          onClick={() => { setNewDept(false); setCustomDeptId(""); setCustomDeptName(""); }}
                          className="px-3 py-2 text-xs text-[var(--color-subtext)] hover:text-[var(--color-text)] transition-colors"
                        >
                          {locale === "ja" ? "戻る" : "Back"}
                        </button>
                      </div>
                    </div>
                  )}
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
                      <span key={s} onClick={() => setForm({ ...form, skills: form.skills.filter((x) => x !== s) })}
                        className="px-2.5 py-1 bg-[var(--color-primary-light)] text-[var(--color-primary)] text-xs font-medium rounded-full cursor-pointer hover:bg-[var(--color-danger-light)] hover:text-[var(--color-danger)] transition-colors">
                        {s} &times;
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-[var(--color-text)]">
                  {locale === "ja" ? "アイコンを設定" : "Choose Avatar"}
                </h2>
                <p className="text-sm text-[var(--color-subtext)] mt-1">
                  {locale === "ja" ? "社員のアイコンをカスタマイズできます" : "Customize your employee's avatar"}
                </p>
              </div>
              <AvatarPicker
                seed={form.name || "default"}
                initialConfig={avatarConfig || undefined}
                onSelect={(c) => setAvatarConfig(c)}
              />
            </div>
          )}

          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <button onClick={() => setStep(step - 1)}
                className="flex-1 px-4 py-2 text-sm font-medium text-[var(--color-subtext)] bg-[var(--color-border-light)] rounded-lg hover:bg-[var(--color-border)] transition-colors">
                {t.common.back}
              </button>
            )}
            {step < 2 ? (
              <button onClick={() => setStep(step + 1)}
                disabled={step === 0 && (!form.name || !form.role || (!form.department && !customDeptId))}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {t.common.continue}
              </button>
            ) : (
              <button onClick={handleFinish}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors">
                {t.employee.createEmployee}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
