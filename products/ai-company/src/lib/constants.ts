import type { Translations } from "@/lib/i18n";

export function getRoleLabel(role: string, t: Translations): string {
  return t.employee.roleLabel[role] ?? role;
}

export function getStatusConfig(status: string, t: Translations) {
  const colorMap: Record<string, { color: string; bg: string }> = {
    active: { color: "var(--color-success)", bg: "var(--color-success-light)" },
    paused: { color: "var(--color-warning)", bg: "var(--color-warning-light)" },
    archived: { color: "var(--color-subtext)", bg: "var(--color-border-light)" },
  };
  const labels = t.employee.status as Record<string, string>;
  const colors = colorMap[status] ?? colorMap.archived;
  return {
    label: labels[status] ?? status,
    ...colors,
  };
}
