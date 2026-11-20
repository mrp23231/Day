export const locales = ["ru", "en", "it"] as const;
export type Locale = typeof locales[number];
export type Messages = Record<string, { en: string; it: string }>;
export type MessageValues = Record<string, string | number>;
export type Translator = (message: string, values?: MessageValues) => string;
export const intlLocales: Record<Locale, string> = { ru: "ru-RU", en: "en-GB", it: "it-IT" };
