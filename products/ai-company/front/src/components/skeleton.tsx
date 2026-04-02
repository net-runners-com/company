"use client";

/** 汎用スケルトンブロック */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-[var(--color-border-light)] rounded-lg ${className}`} />
  );
}

/** カード型スケルトン */
export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-5 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}

/** テーブル行スケルトン */
export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 py-3 px-4 border-b border-[var(--color-border)]">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === 0 ? "w-1/4" : i === cols - 1 ? "w-16" : "w-1/5"}`}
        />
      ))}
    </div>
  );
}

/** チャットスケルトン */
export function SkeletonChat() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 px-6 py-4 space-y-4">
        {/* 相手メッセージ */}
        <div className="flex items-end gap-2">
          <Skeleton className="w-7 h-7 rounded-full shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-10 w-48 rounded-2xl" />
          </div>
        </div>
        {/* 自分メッセージ */}
        <div className="flex justify-end">
          <Skeleton className="h-8 w-32 rounded-2xl" />
        </div>
        {/* 相手メッセージ */}
        <div className="flex items-end gap-2">
          <Skeleton className="w-7 h-7 rounded-full shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-16 w-64 rounded-2xl" />
          </div>
        </div>
        {/* 自分メッセージ */}
        <div className="flex justify-end">
          <Skeleton className="h-8 w-44 rounded-2xl" />
        </div>
        <div className="flex items-end gap-2">
          <Skeleton className="w-7 h-7 rounded-full shrink-0" />
          <Skeleton className="h-24 w-72 rounded-2xl" />
        </div>
      </div>
      {/* 入力欄 */}
      <div className="border-t border-[var(--color-border)] px-6 py-3">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <Skeleton className="flex-1 h-10 rounded-lg" />
          <Skeleton className="w-16 h-10 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** 社員一覧スケルトン */
export function SkeletonEmployeeGrid() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

/** ダッシュボードスケルトン */
export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-[var(--color-border)] p-5 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-5 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-40 w-full" />
        </div>
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-5 space-y-3">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 設定ページスケルトン */
export function SkeletonSettings() {
  return (
    <div className="max-w-4xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex gap-4 border-b border-[var(--color-border)] pb-0">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-6 space-y-4">
        <Skeleton className="h-5 w-24" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
    </div>
  );
}
