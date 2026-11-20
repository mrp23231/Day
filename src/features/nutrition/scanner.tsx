"use client";
import { useI18n } from "@/components/i18n-provider";

import { useLayoutEffect, useRef, useState } from "react";
import { Camera, Upload } from "lucide-react";
import Image from "next/image";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useDay } from "@/components/day-provider";

const ingredientsSchema = z.object({
  ingredients: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    grams: z.number().min(1).max(10000),
    confidence: z.enum(["низкая", "средняя", "высокая"]),
  })).min(1).max(20),
});
type Ingredient = z.infer<typeof ingredientsSchema>["ingredients"][number];

export function Scanner() {
  const { user, resetVersion } = useDay();
  return <ScopedScanner key={`${user?.id || "guest"}:${resetVersion}`} />;
}

function ScopedScanner() {const { t, locale } = useI18n();
  const { openModal, date } = useDay();
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const reader = useRef<FileReader | null>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);

  useLayoutEffect(() => () => {
    generation.current++;
    reader.current?.abort();
    request.current?.abort();
  }, []);

  function selectPhoto(file?: File) {
    if (!file) return;
    const token = ++generation.current;
    reader.current?.abort();
    reader.current = null;
    request.current?.abort();
    request.current = null;
    setBusy(false);
    setIngredients([]);
    if (file.size > 5 * 1024 * 1024) {
      setError(t("Выберите изображение до 5 МБ."));
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError(t("Поддерживаются JPG, PNG и WebP."));
      return;
    }
    setError("");
    setPreview("");
    const nextReader = new FileReader();
    reader.current = nextReader;
    const isCurrent = () => generation.current === token && reader.current === nextReader;
    nextReader.onload = () => {
      if (!isCurrent()) return;
      reader.current = null;
      if (typeof nextReader.result !== "string") {
        setError(t("Не удалось открыть фотографию. Выберите файл заново."));
        return;
      }
      setPreview(nextReader.result);
    };
    nextReader.onerror = () => {
      if (!isCurrent()) return;
      reader.current = null;
      setError(t("Не удалось открыть фотографию. Выберите файл заново."));
    };
    try { nextReader.readAsDataURL(file); }
    catch {
      if (isCurrent()) {
        reader.current = null;
        setError(t("Не удалось открыть фотографию. Выберите файл заново."));
      }
    }
  }

  async function analyze() {
    if (!preview || request.current) return;
    const token = generation.current;
    const controller = new AbortController();
    request.current = controller;
    const isCurrent = () => generation.current === token && request.current === controller && !controller.signal.aborted;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai/food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: preview, locale }),
        signal: controller.signal,
      });
      const result: unknown = await response.json();
      if (!isCurrent()) return;
      if (!response.ok) {
        const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string" ? t(result.error) : t("Не удалось распознать фотографию.");
        throw new Error(message);
      }
      const parsed = ingredientsSchema.safeParse(result);
      if (!parsed.success) throw new Error(t("Не удалось уверенно распознать еду. Попробуйте другое фото или добавьте запись вручную."));
      setIngredients(parsed.data.ingredients);
    } catch (e) {
      if (isCurrent()) setError(e instanceof Error ? e.message : t("Сервис недоступен. Добавьте еду вручную."));
    } finally {
      if (isCurrent()) {
        request.current = null;
        setBusy(false);
      }
    }
  }

  return <div className="form-stack">
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" aria-label={t("Фотография еды")} onChange={e => {
      const file = e.target.files?.[0];
      e.target.value = "";
      selectPhoto(file);
    }} />
    {preview ? <>
      <Image unoptimized width={440} height={240} className="scanner-preview" src={preview} alt={t("Выбранная фотография еды")} />
      <Button variant="ghost" onClick={() => input.current?.click()}>{t("Выбрать другую фотографию")}</Button>
    </> : <div className="scanner-upload">
      <Camera size={35} strokeWidth={1.4} />
      <h3>{t("Что сегодня на тарелке?")}</h3>
      <p>{t("Сфотографируйте блюдо при хорошем свете.")}<br />{t("JPG, PNG или WebP · до 5 МБ")}</p>
      <Button variant="secondary" onClick={() => input.current?.click()}><Upload size={14} />{t("Выбрать фото")}</Button>
    </div>}
    {error && <div className="form-error" role="alert">{error}</div>}
    {ingredients.length > 0 && <div>
      <p className="field-hint" style={{ marginBottom: 15 }}>{t("Распознанные продукты и примерные порции. Фото не позволяет точно измерить вес и пищевую ценность. Проверьте каждый пункт.")}</p>
      {ingredients.map((item, i) => <div className="ingredient-row" key={i}>
        <span>{item.name}<br /><small className="field-hint">{t("Уверенность:")} {t(item.confidence)}</small></span>
        <label className="field"><input aria-label={t("Порция: {name}", {name: item.name})} type="number" min="1" max="10000" value={item.grams} onChange={e => setIngredients(v => v.map((x, j) => j === i ? { ...x, grams: Number(e.target.value) } : x))} /><span className="field-hint">{t("граммов")}</span></label>
      </div>)}
      <p className="form-notice">{t("Справочник пищевой ценности не подключён. Добавьте подтверждённые значения вручную — Day не будет придумывать калории.")}</p>
    </div>}
    {preview && !ingredients.length && <Button onClick={analyze} disabled={busy}><Camera size={14} />{busy ? t("Распознаём…") : t("Распознать блюдо")}</Button>}
    <Button variant="outline" onClick={() => openModal(ingredients.length ? { type: "food", item: { id: "", name: ingredients.map(i => i.name).join(", ").slice(0, 180), date, meal: "lunch", grams: Math.max(1, ingredients.reduce((a, i) => a + i.grams, 0)), calories: 0, protein: 0, fat: 0, carbs: 0, favorite: false } } : { type: "food" })}>{ingredients.length ? t("Проверить и заполнить пищевую ценность") : t("Добавить еду вручную")}</Button>
    <p className="field-hint">{t("Фотография отправляется AI-сервису только после нажатия «Распознать» и не сохраняется в Day.")}</p>
  </div>;
}
