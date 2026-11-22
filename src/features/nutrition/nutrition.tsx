"use client";

import { ArrowUpRight, Calculator, Camera, Coffee, CookingPot, Moon, Pencil, Plus, ScanLine, Star, Utensils } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useDay } from "@/components/day-provider";
import { DatePicker, Enter, PageFooter, PageHeading } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { foodTotals, meals, type Food } from "@/lib/domain";
import { ActivityChart } from "@/features/progress/activity-chart";
import styles from "./nutrition.module.css";

const icons = { breakfast: Coffee, lunch: CookingPot, dinner: Moon, snack: Utensils };
export function Nutrition() {
  const { t, formatNumber, formatDate } = useI18n();
  const { data, date, openModal, update, setPreferences } = useDay();
  const advanced = data.preferences.nutritionMode === "advanced";
  const number = (value: number) => formatNumber(value, { maximumFractionDigits: 0 });
  const entries = data.foods.filter(food => food.date === date);
  const totals = foodTotals(entries, date);
  const remaining = data.preferences.calorieGoal - totals.calories;
  const favorites = Array.from(new Map(data.foods.filter(food => food.favorite).map(food => [food.name, food])).values());

  return <>
    <PageHeading title={t("Питание")} subtitle={t("Ваш день в приёмах пищи. Без лишних сложностей.")} />
    <div className={styles.toolbar}>
      <DatePicker />
      <div className="segmented" role="group" aria-label={t("Режим питания")}>{(["simple", "advanced"] as const).map(mode => <button key={mode} className={data.preferences.nutritionMode === mode ? "active" : ""} aria-pressed={data.preferences.nutritionMode === mode} onClick={() => setPreferences({ nutritionMode: mode })}>{mode === "simple" ? t("Простой") : t("Продвинутый")}</button>)}</div>
    </div>

    <div className={styles.topGrid}>
      <Enter><section className={styles.balance} aria-labelledby="nutrition-balance-title">
        <div className={styles.cardHeading}><div><p className={styles.eyebrow}>{formatDate(date, { day: "numeric", month: "long" })}</p><h2 id="nutrition-balance-title">{t("Баланс за день")}</h2></div><button className="icon-button" aria-label={t("Настроить ориентиры питания")} onClick={() => openModal({ type: "calculator" })}><Calculator size={17} /></button></div>
        <div className={styles.energy}><div><strong>{number(totals.calories)}</strong><span>{t("ккал за день")}</span></div><div className={styles.remaining}><strong>{number(Math.abs(remaining))}</strong><span>{remaining < 0 ? t("выше ориентира") : t("до дневной цели")}</span></div></div>
        <div className={styles.calorieTrack} role="progressbar" aria-label={t("Питание: {calories} из {goal} килокалорий", { calories: number(totals.calories), goal: number(data.preferences.calorieGoal) })} aria-valuemin={0} aria-valuemax={Math.max(data.preferences.calorieGoal, totals.calories)} aria-valuenow={totals.calories}><span style={{ width: `${Math.min(100, totals.calories / data.preferences.calorieGoal * 100)}%` }} /></div>
        <div className={styles.goalCaption}><span>{t("Цель:")} {number(data.preferences.calorieGoal)} {t("ккал")}</span><span>{data.preferences.calorieGoalSet ? t("Настроен под вас") : t("Общий ориентир")}</span></div>
        <div className={styles.macroSummary}>{([
          { key: "protein", label: "Белки", goal: data.preferences.proteinGoal },
          { key: "fat", label: "Жиры", goal: data.preferences.fatGoal },
          { key: "carbs", label: "Углеводы", goal: data.preferences.carbsGoal },
        ] as const).map(macro => <div key={macro.key}><span>{t(macro.label)}</span><strong>{number(totals[macro.key])}<small> {t("г")}</small></strong>{advanced && <><div className={styles.macroTrack}><span style={{ width: `${macro.goal ? Math.min(100, totals[macro.key] / macro.goal * 100) : 0}%` }} /></div><small>{t("из")} {number(macro.goal)} {t("г")}</small></>}</div>)}</div>
      </section></Enter>
      <Enter><section className={styles.capture} aria-labelledby="nutrition-capture-title">
        <div className={styles.captureTop}><span className={styles.captureIcon}><ScanLine size={24} strokeWidth={1.3} /></span><span className={styles.beta}>AI · BETA</span></div>
        <div><h2 id="nutrition-capture-title">{t("Запишите еду за минуту")}</h2><p>{t("Фото поможет оценить блюдо и порцию. Или добавьте запись сами — даже если под рукой нет весов.")}</p></div>
        <div className={styles.captureActions}><Button onClick={() => openModal({ type: "scanner" })}><Camera size={15} />{t("Сканировать еду")}<ArrowUpRight size={14} /></Button><button className={styles.manualAction} onClick={() => openModal({ type: "food" })}><Plus size={15} />{t("Записать вручную")}</button></div>
        <small>{t("Оценку AI всегда можно исправить перед сохранением.")}</small>
      </section></Enter>
    </div>

    <div className={styles.journalLayout}>
      <div>
        <div className={styles.sectionHeading}><h2>{t("Дневник питания")}</h2><span>{t("Записей: {count}", { count: number(entries.length) })}</span></div>
        <div className={styles.meals}>{(Object.entries(meals) as [Food["meal"], string][]).map(([key, label]) => {
          const foods = entries.filter(food => food.meal === key);
          const Icon = icons[key];
          return <Enter key={key}><section className={styles.meal} aria-labelledby={`meal-${key}`}>
            <div className={styles.mealHeading}><span className={styles.mealIcon}><Icon size={17} strokeWidth={1.5} /></span><div><h3 id={`meal-${key}`}>{t(label)}</h3><span>{number(foods.reduce((sum, food) => sum + food.calories, 0))} {t("ккал")}</span></div><button className="icon-button" onClick={() => openModal({ type: "food", meal: key })} aria-label={t("Добавить: {meal}", { meal: t(label) })}><Plus size={17} /></button></div>
            {foods.length ? <div className={styles.foodList}>{foods.map(food => <div className={styles.foodRow} key={food.id}>
              <button className={styles.foodDetail} aria-label={t("Изменить блюдо: {name}", { name: food.name })} onClick={() => openModal({ type: "food", item: food })}><strong>{food.name}</strong><small>{food.estimated && <span>{t("Примерно")} · </span>}{number(food.grams)} {t("г")}{advanced && ` · ${t("Б {protein} · Ж {fat} · У {carbs}", { protein: number(food.protein), fat: number(food.fat), carbs: number(food.carbs) })}`}</small></button>
              <span className={styles.foodCalories}>{food.estimated && "≈ "}{number(food.calories)}<small>{t("ккал")}</small></span>
              <button className={`icon-button ${styles.favorite}`} aria-pressed={food.favorite} aria-label={t(food.favorite ? "Убрать из избранного: {name}" : "Добавить в избранное: {name}", { name: food.name })} onClick={() => update(value => ({ ...value, foods: value.foods.map(item => item.id === food.id ? { ...item, favorite: !item.favorite } : item) }))}><Star size={14} fill={food.favorite ? "currentColor" : "none"} /></button>
            </div>)}</div> : <button className={styles.emptyMeal} onClick={() => openModal({ type: "food", meal: key })}><Plus size={14} /><span>{t("Добавить приём пищи")}</span></button>}
          </section></Enter>;
        })}</div>
      </div>
      <aside className={styles.aside}>
        <section className={styles.favorites} aria-labelledby="nutrition-favorites-title"><div className={styles.sectionHeading}><h2 id="nutrition-favorites-title">{t("Любимые блюда")}</h2><Star size={14} /></div>{favorites.length ? favorites.map(food => <div key={food.id} className={styles.reuseRow}><div><strong>{food.name}</strong><small>{number(food.grams)} {t("г")} · {number(food.calories)} {t("ккал")}</small></div><button className="icon-button" aria-label={t("Повторить блюдо: {name}", { name: food.name })} onClick={() => openModal({ type: "food", item: { ...food, id: "", date } })}><Plus size={16} /></button></div>) : <div className={styles.emptyFavorites}><Star size={21} strokeWidth={1.2} /><p>{t("Любимое — под рукой")}</p><small>{t("Отмечайте блюда звёздочкой, чтобы быстро добавлять их снова.")}</small></div>}</section>
        <div className={styles.portionTip}><Pencil size={16} /><div><strong>{t("Без весов — тоже можно")}</strong><p>{t("В записи выберите ложки, стакан или примерную порцию. Day поможет перевести их в граммы.")}</p></div></div>
        {advanced && <section className="panel"><h2>{t("Питание за неделю")}</h2><ActivityChart metric="calories" days={7} /></section>}
      </aside>
    </div>
    <PageFooter />
  </>;
}
