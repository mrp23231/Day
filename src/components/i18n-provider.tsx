"use client";
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { formatLocaleDate, formatLocaleNumber, getTranslator, resolveLocale, type Locale } from "@/lib/i18n";

function createLocaleContext(locale: Locale) {
  return { locale, language: locale, t: getTranslator(locale), formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => formatLocaleDate(locale, date, options), formatNumber: (number: number, options?: Intl.NumberFormatOptions) => formatLocaleNumber(locale, number, options) };
}
const Context = createContext(createLocaleContext("ru"));
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const pathname=usePathname();
  const language = resolveLocale(locale);
  const value = useMemo(() => createLocaleContext(language), [language]);
  useEffect(() => {
    document.documentElement.lang = language;
    try{localStorage.setItem("day-language",language);}catch{}
    const source:Record<string,string>={"/planner":"Планировщик","/nutrition":"Питание","/water":"Вода","/habits":"Привычки","/progress":"Мой прогресс","/assistant":"Day AI","/settings":"Настройки"};
    document.title=pathname==="/"?value.t("Day — планы, питание, привычки"):`${value.t(source[pathname||""]||"Day")} · Day`;
  }, [language,pathname,value]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useI18n() { return useContext(Context); }
