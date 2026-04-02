"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useI18n } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

// dept: null = 常に表示, string | string[] = その部署の社員がいる時のみ表示
interface NavItem {
  href: string;
  key: string;
  dept: string | string[] | null;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    href: "/home", key: "dashboard", dept: null,
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>,
  },
  {
    href: "/secretary", key: "secretary", dept: ["general-affairs", "総務部"],
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>,
  },
  {
    href: "/progress", key: "directive", dept: null,
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>,
  },
  {
    href: "/employees", key: "employees", dept: null,
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
  },
  {
    href: "/sales", key: "sales", dept: ["sales", "営業部"],
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" /></svg>,
  },
  {
    href: "/finance", key: "finance", dept: ["accounting", "finance", "経理部", "財務部"],
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>,
  },
  {
    href: "/products", key: "products", dept: ["dev", "開発部", "development", "engineering"],
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>,
  },
  {
    href: "/schedules", key: "schedules", dept: null,
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>,
  },
  {
    href: "/schedule", key: "schedule", dept: null,
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>,
  },
  {
    href: "/activity", key: "activity", dept: null,
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  {
    href: "/prompts", key: "prompts", dept: null,
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
  },
  {
    href: "/settings", key: "settings", dept: null,
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
];

// i18n nav labels (key → label)
const navLabels: Record<string, Record<string, string>> = {
  ja: {
    dashboard: "ホーム", secretary: "秘書室", directive: "指示", employees: "社員",
    sales: "営業", finance: "財務", products: "プロダクト", schedules: "定期実行", schedule: "カレンダー", activity: "アクティビティ", prompts: "プロンプト", settings: "設定",
  },
  en: {
    dashboard: "Home", secretary: "Secretary", directive: "Directive", employees: "Employees",
    sales: "Sales", finance: "Finance", products: "Products", schedules: "Schedules", schedule: "Calendar", activity: "Activity", prompts: "Prompts", settings: "Settings",
  },
};

export function Sidebar() {
  const pathname = usePathname();
  const { locale, setLocale } = useI18n();
  const { data: session } = useSession();
  const [depts, setDepts] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [customPages, setCustomPages] = useState<{ slug: string; title: string }[]>([]);

  useEffect(() => {
    fetch("/api/pages").then(r => r.json()).then(d => setCustomPages(d.pages || [])).catch(() => {});
    fetch("/api/employees")
      .then((r) => r.json())
      .then((data) => {
        // Worker returns { "emp-1": {..., department: "..."}, ... }
        const departments = new Set<string>();
        if (data && typeof data === "object") {
          for (const emp of Object.values(data) as { department?: string }[]) {
            if (emp.department) departments.add(emp.department);
          }
        }
        setDepts(departments);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const visibleItems = loaded
    ? navItems.filter((item) => {
        if (item.dept === null) return true;
        if (Array.isArray(item.dept)) return item.dept.some((d) => depts.has(d));
        return depts.has(item.dept);
      })
    : navItems.filter((item) => item.dept === null); // ロード中は固定ページのみ

  const labels = navLabels[locale] || navLabels.en;
  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "User";

  const renderLink = (item: NavItem, isMobile = false) => {
    const active = pathname === item.href || pathname.startsWith(item.href + "/");
    if (isMobile) {
      return (
        <Link key={item.href} href={item.href}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 text-xs transition-colors ${active ? "text-[var(--color-primary)]" : "text-[var(--color-subtext)]"}`}>
          {item.icon}
          <span className="text-[10px]">{labels[item.key] || item.key}</span>
        </Link>
      );
    }
    return (
      <Link key={item.href} href={item.href}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          active ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]" : "text-[var(--color-subtext)] hover:bg-[var(--color-border-light)] hover:text-[var(--color-text)]"
        }`}>
        {item.icon}
        {labels[item.key] || item.key}
      </Link>
    );
  };

  return (
    <>
      {/* PC Sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-[var(--color-border)] h-screen fixed top-0 left-0 overflow-y-auto z-40">
        <div className="px-6 py-5 border-b border-[var(--color-border)]">
          <Link href="/home" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[var(--color-primary)] rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
            <span className="font-semibold text-base text-[var(--color-text)]">AI Company</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4">
          <div className="mb-2 px-3">
            <span className="text-xs font-medium text-[var(--color-subtext)] uppercase tracking-wider">Menu</span>
          </div>
          <div className="space-y-0.5">
            {visibleItems.map((item) => renderLink(item))}
            {customPages.map((p, idx) => {
              const active = pathname === `/pages/${p.slug}`;
              return (
                <Link key={`page-${p.slug}-${idx}`} href={`/pages/${p.slug}`}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]" : "text-[var(--color-subtext)] hover:bg-[var(--color-border-light)] hover:text-[var(--color-text)]"
                  }`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25z" />
                  </svg>
                  {p.title}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="px-4 py-4 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center text-sm font-semibold text-[var(--color-primary)]">
              {userName[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-text)] truncate">{userName}</p>
              <button onClick={() => signOut({ callbackUrl: "/" })} className="text-xs text-[var(--color-subtext)] hover:text-[var(--color-danger)] transition-colors">
                {locale === "ja" ? "ログアウト" : "Sign Out"}
              </button>
            </div>
          </div>
          <div className="flex gap-1.5 mt-3">
            {(["en", "ja"] as Locale[]).map((l) => (
              <button key={l} onClick={() => setLocale(l)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${locale === l ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-border-light)] text-[var(--color-subtext)]"}`}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[var(--color-border)] flex justify-around py-2 px-1">
        {visibleItems.slice(0, 5).map((item) => renderLink(item, true))}
      </nav>
    </>
  );
}
