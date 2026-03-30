"use client";

import { useState, useEffect, useCallback } from "react";
import { Skeleton } from "@/components/skeleton";

interface SkillItem {
  name: string;
  title: string;
  filename: string;
  size: number;
}

export function SkillEditor({ employeeId }: { employeeId: string }) {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ name: string; content: string; isNew: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/employee-files?employeeId=${employeeId}&action=skills`);
      const data = await res.json();
      setSkills(Array.isArray(data) ? data : []);
    } catch {
      setSkills([]);
    }
    setLoading(false);
  }, [employeeId]);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  const openSkill = async (name: string) => {
    try {
      const res = await fetch("/api/employee-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, _action: "getSkill", name }),
      });
      const data = await res.json();
      if (!data.error) {
        setEditing({ name: data.name, content: data.content, isNew: false });
      }
    } catch {}
  };

  const saveSkill = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await fetch("/api/employee-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, _action: "saveSkill", name: editing.name, content: editing.content }),
      });
      setEditing(null);
      await fetchSkills();
    } catch {}
    setSaving(false);
  };

  const deleteSkill = async (name: string) => {
    try {
      await fetch("/api/employee-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, _action: "deleteSkill", name }),
      });
      await fetchSkills();
    } catch {}
  };

  // Editing mode
  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setEditing(null)} className="text-sm text-[var(--color-primary)] hover:underline">
            &larr; Back to skills
          </button>
          <button
            onClick={saveSkill}
            disabled={saving || !editing.name.trim()}
            className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Skill"}
          </button>
        </div>
        {editing.isNew && (
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Skill Name</label>
            <input
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="e.g. market-research"
              className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
            Content (Markdown)
          </label>
          <textarea
            value={editing.content}
            onChange={(e) => setEditing({ ...editing, content: e.target.value })}
            rows={16}
            placeholder={"# Skill Title\n\nDescribe what this skill does...\n\n## Steps\n1. ...\n2. ..."}
            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
            spellCheck={false}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-[var(--color-text)] text-sm">Skills</h3>
        <button
          onClick={() => setEditing({ name: "", content: "# New Skill\n\n", isNew: true })}
          className="px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          + New Skill
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : skills.length === 0 ? (
        <div className="text-center py-8 text-sm text-[var(--color-subtext)]">
          No skills defined yet. Create one to give this employee specialized capabilities.
        </div>
      ) : (
        <div className="space-y-2">
          {skills.map((skill) => (
            <div
              key={skill.name}
              className="flex items-center justify-between p-3 bg-white border border-[var(--color-border)] rounded-lg hover:shadow-sm transition-shadow"
            >
              <button onClick={() => openSkill(skill.name)} className="flex-1 text-left">
                <p className="text-sm font-medium text-[var(--color-text)]">{skill.title}</p>
                <p className="text-xs text-[var(--color-subtext)] mt-0.5">{skill.filename} · {skill.size < 1024 ? `${skill.size}B` : `${(skill.size / 1024).toFixed(1)}KB`}</p>
              </button>
              <button
                onClick={() => deleteSkill(skill.name)}
                className="p-1.5 text-[var(--color-subtext)] hover:text-red-500 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
