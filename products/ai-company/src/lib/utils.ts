import type { Translations } from "@/lib/i18n";

export function timeAgo(date: string, time: Translations["time"]): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return time.mAgo.replace("{n}", String(mins));
  const hours = Math.floor(mins / 60);
  if (hours < 24) return time.hAgo.replace("{n}", String(hours));
  return time.dAgo.replace("{n}", String(Math.floor(hours / 24)));
}
