"use client";
import {useEffect,useState} from "react";
import {getTranslator,resolveLocale,type Locale} from "@/lib/i18n";

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  const [locale,setLocale]=useState<Locale>("ru");
  useEffect(()=>{try{setLocale(resolveLocale(localStorage.getItem("day-language")));}catch{}},[]);
  const t=getTranslator(locale);
  return <html lang={locale}><head><title>{t("Day — попробуем ещё раз")}</title></head><body style={{ margin: 0, background: "#111", color: "#f5f5f5", fontFamily: "system-ui, sans-serif" }}>
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, boxSizing: "border-box" }}>
      <section style={{ maxWidth: 420 }}>
        <p style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.06em" }}>Day.</p>
        <h1 style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.04em" }}>{t("Нужна небольшая пауза")}</h1>
        <p style={{ color: "#aaa", lineHeight: 1.7 }}>{t("Не удалось загрузить ваше пространство. Попробуйте снова или обновите страницу. Для повторной попытки не нужно очищать данные браузера.")}</p>
        <button onClick={retry} style={{ border: 0, borderRadius: 12, padding: "14px 20px", background: "#f5f5f5", color: "#111", font: "inherit", cursor: "pointer" }}>{t("Попробовать снова")}</button>
      </section>
    </main>
  </body></html>;
}
