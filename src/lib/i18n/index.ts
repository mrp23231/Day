import { coreMessages } from "./core";
import { planningMessages } from "./planning";
import { featureMessages } from "./features";
import { profileMessages } from "./profile";
import { serverMessages } from "./server";
import { calendarHomeMessages } from "./calendar-home";
import { calendarPhotoMessages } from "./calendar-photos";
import { calendarPlannerMessages } from "./calendar-planner";
import { calendarProgressMessages } from "./calendar-progress";
import { cloudSyncMessages } from "./cloud-sync";
import { cloudPhotoMessages } from "./cloud-photos";
import { nutritionAiMessages } from "./nutrition-ai";
import { nutritionPortionMessages } from "./nutrition-portions";
import { nutritionScreenMessages } from "./nutrition-screen";
import { authMessages } from "./auth";
import { intlLocales, locales, type Locale, type Messages, type Translator } from "./types";
export type { Locale, Messages, Translator } from "./types";
export { intlLocales, locales } from "./types";

export const messages: Messages = { ...coreMessages, ...planningMessages, ...featureMessages, ...profileMessages, ...serverMessages, ...calendarHomeMessages, ...calendarPhotoMessages, ...calendarPlannerMessages, ...calendarProgressMessages, ...cloudSyncMessages, ...cloudPhotoMessages, ...nutritionAiMessages, ...nutritionPortionMessages, ...nutritionScreenMessages, ...authMessages };
export function resolveLocale(value: unknown): Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value) ? value as Locale : "ru";
}
export function getTranslator(locale: Locale): Translator {
  return (source, values) => {
    const template = locale === "ru" ? source : messages[source]?.[locale] ?? source;
    return template.replace(/\{(\w+)\}/g, (match, key: string) => values?.[key] === undefined ? match : String(values[key]));
  };
}
export function formatLocaleDate(locale: Locale, date: Date | string, options?: Intl.DateTimeFormatOptions) {
  const value = typeof date === "string" ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00` : date) : date;
  return Number.isNaN(value.getTime()) ? "—" : new Intl.DateTimeFormat(intlLocales[locale], options ?? { day: "numeric", month: "long" }).format(value);
}
export function formatLocaleNumber(locale: Locale, number: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(intlLocales[locale], options).format(number);
}
