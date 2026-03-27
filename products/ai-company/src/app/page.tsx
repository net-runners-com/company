"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export default function LandingPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
      <div className="animate-fade-in text-center max-w-lg">
        <div className="w-16 h-16 bg-[var(--color-primary)] rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-[var(--color-text)] mb-2">
          AI Company
        </h1>
        <p className="text-base text-[var(--color-subtext)] mb-10 leading-relaxed">
          {t.landing.tagline}
          <br />
          {t.landing.description}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/onboarding"
            className="inline-flex items-center justify-center px-8 py-3 text-sm font-semibold text-white bg-[var(--color-primary)] rounded-lg shadow-sm hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            {t.landing.getStarted}
          </Link>
          <Link
            href="/home"
            className="inline-flex items-center justify-center px-8 py-3 text-sm font-semibold text-[var(--color-text)] bg-white border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-light)] transition-colors"
          >
            {t.landing.signIn}
          </Link>
        </div>
      </div>
    </div>
  );
}
