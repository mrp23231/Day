import { describe, expect, it } from "vitest";
import { appDataSchema, emptyData } from "@/lib/domain";
import { formatLocaleDate, getTranslator, messages, resolveLocale } from ".";
describe("three app languages", () => {
  it("keeps existing Russian spaces compatible without losing entries", () => {
    const old = emptyData();
    const preferences:Record<string,unknown> = {...old.preferences};
    delete preferences.language;
    expect(appDataSchema.parse({ ...old, preferences }).preferences.language).toBe("ru");
  });
  it("uses a supported locale or falls back to Russian", () => {
    expect(resolveLocale("en")).toBe("en"); expect(resolveLocale("it")).toBe("it");
    expect(resolveLocale("<script>")).toBe("ru");
  });
  it("translates full messages while preserving interpolated user content", () => {
    expect(getTranslator("en")("Выполнить: {title}", { title: "Мой проект" })).toBe("Complete: Мой проект");
    expect(getTranslator("it")("Настройки")).toBe("Impostazioni");
    expect(getTranslator("ru")("Вода")).toBe("Вода");
  });
  it("formats date-only keys without UTC date shifts", () => {
    expect(formatLocaleDate("en", "2026-11-14", { weekday: "long" })).toBe("Saturday");
    expect(formatLocaleDate("it", "2026-11-14", { month: "long" })).toBe("novembre");
  });
  it("provides English and Italian for every registered source message", () => {
    for (const [key, value] of Object.entries(messages)) {
      expect(value.en.trim(), key).not.toBe(""); expect(value.it.trim(), key).not.toBe("");
      // A language's own name remains an autonym in the language picker.
      if(key!=="Русский"){expect(value.en, key).not.toMatch(/[А-Яа-яЁё]/); expect(value.it, key).not.toMatch(/[А-Яа-яЁё]/);}
      const tokens = (text:string) => [...text.matchAll(/\{(\w+)\}/g)].map(match=>match[1]).sort();
      // Languages may express a grammatical helper directly rather than interpolate
      // a Russian inflection, but must not invent an unknown placeholder.
      for(const token of [...tokens(value.en),...tokens(value.it)])expect(tokens(key),key).toContain(token);
      for(const token of tokens(key).filter(token=>/count|total|amount|value|title|name|date|seconds|completed/.test(token))){expect(tokens(value.en),key).toContain(token);expect(tokens(value.it),key).toContain(token);}
    }
  });
});
