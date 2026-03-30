import { Sidebar } from "@/components/sidebar";
import { ActivityToast } from "@/components/activity-toast";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 pb-20 md:pb-0 md:ml-60 bg-[var(--color-bg)]">{children}</main>
      <ActivityToast />
    </div>
  );
}
