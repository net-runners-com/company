"use client";

import { createContext, useContext } from "react";
import en from "./locales/en";
import ja from "./locales/ja";
import type { Translations } from "./locales/en";

export type Locale = "en" | "ja";

const locales: Record<Locale, Translations> = { en, ja };

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
};

export const I18nContext = createContext<I18nContextValue>({
  locale: "ja",
  setLocale: () => {},
  t: ja,
});

export function useI18n() {
  return useContext(I18nContext);
}

export { locales };
export type { Translations };
