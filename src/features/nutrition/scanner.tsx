"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, Camera, Check, Loader2, RotateCcw, ScanLine, Upload } from "lucide-react";
import Image from "next/image";
import { z } from "zod";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { useDay } from "@/components/day-provider";
import styles from "./nutrition.module.css";

const nutrientSchema = z.number().finite().min(0).max(50000).optional();
const ingredientsSchema = z.object({
  ingredients: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    grams: z.number().finite().min(1).max(10000),
    confidence: z.enum(["низкая", "средняя", "высокая"]),
    calories: nutrientSchema,
    protein: nutrientSchema,
    fat: nutrientSchema,
    carbs: nutrientSchema,
  })).min(1).max(20),
});
type Ingredient = z.infer<typeof ingredientsSchema>["ingredients"][number];
type IngredientDraft = Ingredient & { portion: string };
const nutrientKeys = ["calories", "protein", "fat", "carbs"] as const;

export function Scanner() {
  const { user, resetVersion } = useDay();
  return <ScopedScanner key={`${user?.id || "guest"}:${resetVersion}`} />;
}

function ScopedScanner() {
  const { t, locale, formatNumber } = useI18n();
  const { openModal, date } = useDay();
  const [preview, setPreview] = useState("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const reader = useRef<FileReader | null>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const number = (value: number) => formatNumber(value, { maximumFractionDigits: 1 });
  const missingNutrition = nutrientKeys.filter(key => !ingredients.every(item => typeof item[key] === "number"));
  const hasNutrition = ingredients.length > 0 && missingNutrition.length === 0;
  const grams = ingredients.reduce((sum, item) => sum + Number(item.portion), 0);
  const validPortions = ingredients.every(item => item.portion.trim() !== "" && Number.isFinite(Number(item.portion)) && Number(item.portion) >= 1 && Number(item.portion) <= 10000) && grams <= 10000;
  const totals = nutrientKeys.reduce((sum, key) => ({ ...sum, [key]: missingNutrition.includes(key) ? 0 : Math.round(ingredients.reduce((value, item) => value + (item[key] ?? 0) * Number(item.portion) / item.grams, 0) * 10) / 10 }), { calories: 0, protein: 0, fat: 0, carbs: 0 });
  const validTotals = nutrientKeys.every(key => Number.isFinite(totals[key]) && totals[key] <= 50000);
  const canContinue = validPortions && validTotals;

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
    setNeedsLogin(false);
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
    setNeedsLogin(false);
    try {
      const response = await fetch("/api/ai/food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: preview, locale, ...(hint.trim() ? { hint: hint.trim() } : {}) }),
        signal: controller.signal,
      });
      const result: unknown = await response.json();
      if (!isCurrent()) return;
      if (!response.ok) {
        setNeedsLogin(response.status === 401);
        const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string" ? t(result.error) : t("Не удалось распознать фотографию.");
        throw new Error(message);
      }
      const parsed = ingredientsSchema.safeParse(result);
      if (!parsed.success) throw new Error(t("Не удалось уверенно распознать еду. Попробуйте другое фото или добавьте запись вручную."));
      setIngredients(parsed.data.ingredients.map(item => ({ ...item, portion: String(item.grams) })));
    } catch (e) {
      if (isCurrent()) setError(e instanceof Error ? e.message : t("Сервис недоступен. Добавьте еду вручную."));
    } finally {
      if (isCurrent()) {
        request.current = null;
        setBusy(false);
      }
    }
  }

  function continueToForm() {
    if (!ingredients.length) { openModal({ type: "food" }); return; }
    if (!canContinue) return;
    openModal({ type: "food", ...(missingNutrition.length ? { missingNutrition } : {}), item: {
      id: "", name: ingredients.map(item => item.name).join(", ").slice(0, 180), date, meal: "lunch",
      grams, ...totals, favorite: false, estimated: true,
    } });
  }

  return <div className={`form-stack ${styles.scanner}`}>
    <ol className={styles.scanSteps} aria-label={t("Этапы распознавания")}>
      {[["1", "Фото"], ["2", "Распознавание"], ["3", "Проверка"]].map(([step, label], index) => <li key={step} aria-current={(ingredients.length ? index === 2 : busy ? index === 1 : index === 0) ? "step" : undefined}><span>{Number(step) < (ingredients.length ? 3 : busy ? 2 : 1) ? <Check size={11} /> : step}</span>{t(label)}</li>)}
    </ol>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" aria-label={t("Фотография еды")} onChange={e => {
      const file = e.target.files?.[0];
      e.target.value = "";
      selectPhoto(file);
    }} />
    {preview ? <div className={styles.previewWrap}>
      <Image unoptimized width={440} height={260} className={styles.preview} src={preview} alt={t("Выбранная фотография еды")} />
      <Button className={styles.retake} variant="outline" size="sm" onClick={() => input.current?.click()}><RotateCcw size={13} />{t("Выбрать другую фотографию")}</Button>
    </div> : <div className={styles.upload}>
      <div className={styles.uploadIcon}><ScanLine size={32} strokeWidth={1.3} /></div>
      <h3>{t("Что сегодня на тарелке?")}</h3>
      <p>{t("Одно фото — начало записи. Порцию и состав вы проверите перед сохранением.")}</p>
      <Button onClick={() => input.current?.click()}><Upload size={14} />{t("Выбрать фото")}</Button>
      <small>{t("JPG, PNG или WebP · до 5 МБ")}</small>
    </div>}
    {preview && !ingredients.length && <label className="field"><span>{t("Подсказка о порции")} <small className="field-hint">{t("необязательно")}</small></span><textarea maxLength={500} rows={2} value={hint} disabled={busy} onChange={e => setHint(e.target.value)} placeholder={t("Например: половина порции, тарелка 20 см, соус отдельно")} /></label>}
    {busy && <div className={styles.analyzing} role="status"><Loader2 className={styles.spinner} size={18} /><span><strong>{t("Распознаём…")}</strong><small>{t("Оцениваем состав и порцию. Это может занять несколько секунд.")}</small></span></div>}
    {error && <div className="form-error" role="alert">{error}</div>}
    {needsLogin && <Button variant="secondary" onClick={() => openModal({ type: "auth" })}>{t("Войти в аккаунт")}</Button>}
    {ingredients.length > 0 && <div className={styles.review}>
      <div className={styles.reviewHeading}><h3>{t("Проверьте порцию")}</h3><span className={styles.estimateBadge}>{t("Примерная оценка AI")}</span></div>
      <p className="field-hint">{t("По фото нельзя точно узнать вес, масло и состав. Исправьте порции; значения пересчитаются.")}</p>
      <div className={styles.ingredientList}>{ingredients.map((item, i) => <div className={styles.ingredient} key={i}>
        <div><strong>{item.name}</strong><small>{t("Уверенность:")} {t(item.confidence)}</small></div>
        <label className={styles.portion}><input aria-label={t("Порция: {name}", { name: item.name })} inputMode="decimal" type="number" min="1" max="10000" step="1" value={item.portion} onChange={e => setIngredients(values => values.map((value, index) => index === i ? { ...value, portion: e.target.value } : value))} /><span>{t("г")}</span></label>
      </div>)}</div>
      {!canContinue && <p className="form-error" role="alert">{t("Проверьте порции: укажите от 1 до 10 000 г на блюдо, а общую пищевую ценность — до 50 000 на показатель.")}</p>}
      {hasNutrition && canContinue ? <div className={styles.scanTotals} aria-label={t("Оценка всей порции")}>
        <strong>≈ {number(totals.calories)} <span>{t("ккал")}</span></strong>
        <p>{t("Б {protein} · Ж {fat} · У {carbs}", { protein: number(totals.protein), fat: number(totals.fat), carbs: number(totals.carbs) })}</p>
      </div> : !hasNutrition ? <p className="form-notice">{t("Известные значения перенесём в запись. Недостающие калории или БЖУ нужно заполнить вручную.")}</p> : null}
    </div>}
    {preview && !ingredients.length && !needsLogin && <Button onClick={analyze} disabled={busy}><Camera size={14} />{busy ? t("Распознаём…") : t("Распознать блюдо")}</Button>}
    <Button variant={ingredients.length ? "default" : "outline"} onClick={continueToForm} disabled={ingredients.length > 0 && !canContinue}>{ingredients.length ? hasNutrition ? t("Проверить и добавить") : t("Проверить и заполнить пищевую ценность") : t("Добавить еду вручную")}{ingredients.length > 0 && <ArrowRight size={14} />}</Button>
    <p className={styles.privacy}>{t("По нажатию «Распознать блюдо» фото и подсказка отправятся AI-провайдеру для анализа. Используется доступный лимит сервиса; фото не сохраняется в Day. Результат нужно проверить.")}</p>
    <p className={styles.privacy}>{t("На бесплатных тарифах AI-провайдер может использовать фото и запрос для улучшения моделей, в том числе с проверкой людьми.")} <a href="https://aistudio.google.com/docs/terms#data-use-unpaid" target="_blank" rel="noopener noreferrer">{t("Условия обработки Gemini")}</a></p>
  </div>;
}
