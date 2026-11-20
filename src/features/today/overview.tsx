"use client";

import { useI18n } from "@/components/i18n-provider";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, CalendarDays, Check, CheckCheck, ChevronDown, Clock3, Droplets, Plus, Utensils } from "lucide-react";
import { useDay } from "@/components/day-provider";
import { HabitIcon, PageFooter, Ring, TaskRow, WeekStrip } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { NeonCheckbox } from "@/components/ui/animated-check-box";
import { QuickTaskForm } from "@/features/planner/quick-task-form";
import { dayKey, foodTotals, habitOnDate, waterTotal, type TodayCard } from "@/lib/domain";
import { TodayLayoutEditor } from "./today-layout-editor";
import { DailyReview } from "@/features/review/daily-review";
import { nextTimedTask, selectDayTasks } from "./today-model";

export function Overview() {
  const { t, formatDate, formatNumber } = useI18n();
  const { data, date, setDate, ready, update, notify, openModal, addWater, toggleHabit } = useDay();
  const [now, setNow] = useState<Date | null>(null);
  const [importantOnly, setImportantOnly] = useState(false);
  const planHeading = useRef<HTMLHeadingElement>(null);
  const completedSummary = useRef<HTMLElement>(null);
  function focusAfterToggle(checked: boolean) {
    window.requestAnimationFrame(() => {
      const target = checked ? completedSummary.current : planHeading.current;
      (target || planHeading.current)?.focus({ preventScroll: true });
    });
  }
  useEffect(() => {
    const refresh = () => setNow(new Date());
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, []);

  const today = now ? dayKey(now) : date;
  const isToday = date === today;
  const { scheduled, active, important, completed, overdue } = selectDayTasks(data.tasks, date, today);
  const regular = active.filter(task => task.priority !== "high");
  const next = now ? nextTimedTask(data.tasks, date, now) : undefined;
  const progress = scheduled.length ? Math.round(completed.length / scheduled.length * 100) : 0;
  const habits = data.habits.filter(habit => habitOnDate(habit, date));
  const habitsDone = habits.filter(habit => habit.completions.includes(date)).length;
  const water = waterTotal(data.water, date);
  const food = foodTotals(data.foods, date);
  const foodsCount = data.foods.filter(item => item.date === date).length;
  const hour = now?.getHours() ?? 12;
  const greeting = hour < 5 || hour >= 23 ? t("Доброй ночи") : hour < 12 ? t("Доброе утро") : hour < 18 ? t("Добрый день") : t("Добрый вечер");
  const welcome = `${greeting}${data.preferences.name ? `, ${data.preferences.name}` : ""}.`;

  const cards: Record<TodayCard, ReactNode> = {
    next: (<section className={`today-next ${next ? "has-next" : ""}`}>
          <span className="today-next-kicker"><Clock3 size={14}/>{t("Дальше по плану")}</span>
          {next ? <><p className="today-next-time">{next.time}</p><button className="today-next-title" onClick={() => openModal({type:"task",item:next})}>{next.title}<ArrowRight size={17}/></button><p className="today-next-note">{next.category}{next.priority === "high" ? ` ${t("· Важное")}` : ""}</p></> : <><h2>{active.length ? t("В своём темпе.") : completed.length ? t("Хорошая работа.") : t("Место для ваших планов.")}</h2><p className="today-next-note">{active.length ? t("Ближайших дел со временем нет. Остальное — в вашем плане.") : completed.length ? t("Все задачи на этот день завершены.") : t("Одно небольшое дело — уже начало.")}</p></>}
          <button className="today-next-action" onClick={() => openModal({type:"task"})}><Plus size={15}/>{t("Добавить дело")}</button>
        </section>),
    plan: (<section className="today-card today-plan" aria-labelledby="today-plan-title">
          <div className="today-section-head"><div className="today-section-title"><h2 id="today-plan-title" ref={planHeading} tabIndex={-1}>{t("План на день")}</h2><span className="today-count">{ready ? scheduled.length : "—"}</span></div><Link href="/planner" className="today-subtle-link">{t("Календарь")}<ArrowRight size={14}/></Link></div>
          {ready ? <WeekStrip/> : <div className="today-week-placeholder" aria-hidden="true"/>}
          <div className="today-plan-toolbar"><div className="today-filters" aria-label={t("Фильтр задач")}><button aria-pressed={!importantOnly} onClick={() => setImportantOnly(false)}>{t("Все")}</button><button aria-pressed={importantOnly} onClick={() => setImportantOnly(true)}>{t("Важные")} <span>{important.length}</span></button></div><span className="today-active-count">{active.length} {t("в плане")}</span></div>
          <QuickTaskForm date={date} onAdd={task => { update(d => ({ ...d, tasks:[...d.tasks,task] })); setImportantOnly(false); notify(t("Задача добавлена в план")); }}/>
          {!ready ? <div className="today-empty"><p>{t("Загружаем ваши планы…")}</p></div> : <>
            {important.length > 0 && <div className="today-task-group"><p className="today-list-label">{t("Важное")}</p>{important.map(task => <TaskRow key={task.id} task={task} onToggle={focusAfterToggle}/>)}</div>}
            {!importantOnly && regular.length > 0 && <div className="today-task-group"><p className="today-list-label">{important.length ? t("Остальные дела") : t("В течение дня")}</p>{regular.map(task => <TaskRow key={task.id} task={task} onToggle={focusAfterToggle}/>)}</div>}
            {(importantOnly ? !important.length : !active.length) && <div className="today-empty"><span className="today-empty-icon">{completed.length && !active.length ? <CheckCheck size={23} strokeWidth={1.5}/> : <CalendarDays size={23} strokeWidth={1.4}/>}</span><h3>{importantOnly ? t("Важное не потеряется") : completed.length ? t("Всё запланированное завершено") : t("День открыт для ваших планов")}</h3><p>{importantOnly ? t("Задайте высокий приоритет в настройках задачи.") : completed.length ? t("Можно выдохнуть — или добавить новое дело.") : t("Добавьте дело в строке выше. Детали можно уточнить позже.")}</p>{importantOnly ? <button className="text-button" onClick={() => setImportantOnly(false)}>{t("Показать все задачи")}<ArrowRight size={14}/></button> : <button className="text-button" onClick={() => openModal({type:"task"})}><Plus size={14}/>{t("Задача с деталями")}</button>}</div>}
            {completed.length > 0 && <details className="today-completed"><summary ref={completedSummary}><span><Check size={15}/><span>{t("Завершено")}</span><span className="today-count">{completed.length}</span></span><ChevronDown size={15}/></summary>{completed.map(task => <TaskRow key={task.id} task={task} onToggle={focusAfterToggle}/>)}</details>}
          </>}
          <div className="today-plan-foot"><span>{t("Ваш темп. Ваш порядок.")}</span><button aria-label={t("Новая задача")} onClick={() => openModal({type:"task"})}><Plus size={14}/>{t("С деталями")}</button></div>
        </section>),
    habits: (<section className="today-card today-habits" aria-labelledby="today-habits-title">
          <div className="today-section-head"><div className="today-section-title"><h2 id="today-habits-title">{t("Маленькие привычки")}</h2>{habits.length > 0 && <span className="today-count">{habitsDone}/{habits.length}</span>}</div><Link href="/habits" className="today-subtle-link" aria-label={t("Все привычки")}><ArrowRight size={15}/></Link></div>
          {habits.length ? habits.map(habit => <div className="today-habit-row" key={habit.id}><HabitIcon habit={habit}/><button className="today-habit-name" onClick={() => openModal({type:"habit",item:habit})}><strong>{habit.name}</strong><small>{habit.completions.includes(date) ? t("Готово на этот день") : t("Время для себя")}</small></button><NeonCheckbox checked={habit.completions.includes(date)} disabled={date > today} aria-label={t("Отметить привычку: {name}", {name:habit.name})} onChange={() => toggleHabit(habit.id)}/></div>) : <div className="today-habit-empty"><p>{t("То, что делает день немного лучше.")}<br/>{t("Начните с одной привычки.")}</p><button className="text-button" onClick={() => openModal({type:"habit"})}><Plus size={14}/>{t("Добавить привычку")}</button></div>}
        </section>),
    water: (<section className="today-card today-water" aria-labelledby="today-water-title">
          <div className="today-section-head"><div className="today-section-title"><span className="today-support-icon"><Droplets size={17}/></span><h2 id="today-water-title">{t("Вода")}</h2></div><Link href="/water" className="today-subtle-link" aria-label={t("Открыть трекер воды")}><ArrowRight size={15}/></Link></div>
          <p className="today-water-total">{formatNumber(water / 1000, { maximumFractionDigits:2 })}<span> / {formatNumber(data.preferences.waterGoal / 1000)} {t("л")}</span></p>
          <div className="today-water-track" role="progressbar" aria-label={t("Водный баланс")} aria-valuenow={water} aria-valuemin={0} aria-valuemax={Math.max(water,data.preferences.waterGoal)}><span style={{width:`${Math.min(100,water / data.preferences.waterGoal * 100)}%`}}/></div>
          <p className="today-water-note">{water >= data.preferences.waterGoal ? t("Дневной ориентир достигнут") : t("Небольшая пауза на стакан воды")}</p>
          <div className="today-water-actions">{[150,250].map(amount => <button key={amount} disabled={!ready} onClick={() => addWater(amount)}>+ {amount}<span> {t("мл")}</span></button>)}<button disabled={!ready} aria-label={t("Другое количество воды")} onClick={() => openModal({type:"water"})}><Plus size={16}/></button></div>
        </section>),
    food: (<section className="today-card today-food" aria-labelledby="today-food-title">
          <div className="today-section-head"><div className="today-section-title"><span className="today-support-icon"><Utensils size={16}/></span><h2 id="today-food-title">{t("Питание")}</h2></div><Link href="/nutrition" className="today-subtle-link" aria-label={t("Открыть дневник питания")}><ArrowRight size={15}/></Link></div>
          <p>{foodsCount ? <><strong>{formatNumber(Math.round(food.calories))}</strong> {t("ккал записано за день")}</> : t("Как прошёл ваш завтрак, обед или ужин?")}</p>
          <Button variant="outline" onClick={() => openModal({type:"food"})}><Plus size={14}/>{t("Добавить приём пищи")}</Button>
        </section>),
    review: <DailyReview date={date}/>,
  };

  return <div className="today-page" aria-busy={!ready}>
    <header className="today-hero">
      <div className="today-intro">
        <p className="today-date">{ready ? formatDate(date, { weekday: "long", day: "numeric", month: "long" }) : t("Ваше личное пространство")}</p>
        <h1>{ready && !isToday ? t("Ваш день") : t("Сегодня")}<span className="today-title-dot">.</span></h1>
        <p className="today-welcome">{ready && now ? isToday ? welcome : t("Планы на выбранную дату.") : t("Готовим ваш день…")}</p>
        <div className="today-hero-actions">
          {ready && !isToday ? <button className="today-return" onClick={() => setDate(dayKey(new Date()))} aria-label={t("Вернуться к сегодня")}><ArrowRight size={14}/>{t("К сегодняшнему дню")}</button> : <span className="today-motto">{t("Чуть больше порядка. Чуть легче день.")}</span>}
        </div>
      </div>
      <Link href="/progress" className="today-progress" aria-label={t("Открыть мой прогресс")}>
        <Ring value={progress} size={80} stroke={5} label={t("Выполнено задач: {completed} из {total}", {completed:completed.length,total:scheduled.length})}><strong>{ready ? progress : "—"}<small>%</small></strong></Ring>
        <div><span className="today-card-kicker">{t("Ваш план")}</span><p><strong>{ready ? completed.length : "—"}</strong><span> / {ready ? scheduled.length : "—"}</span></p><small>{scheduled.length ? t("задач выполнено") : t("начните с одного дела")}</small></div>
        <ArrowRight size={15} className="today-progress-arrow"/>
      </Link>
    </header>

    {ready && overdue.length > 0 && <section className="today-card today-attention" aria-labelledby="today-attention-title">
          <div className="today-section-head"><div className="today-section-title"><Clock3 size={17}/><h2 id="today-attention-title">{t("Требуют внимания")}</h2><span className="today-count">{overdue.length}</span></div></div>
          <p className="today-section-note">{t("Дела с прошлых дней. Завершите их или измените дату.")}</p>
          {overdue.map(task => <div className="today-overdue-item" key={task.id}><p>{formatDate(task.date, { day:"numeric", month:"long", year:"numeric" })}</p><TaskRow task={task} occurrenceDate={task.date} onToggle={() => focusAfterToggle(false)}/></div>)}
        </section>}
    <TodayLayoutEditor cards={cards}/>
    <p className="today-local-note today-space-note">{t("Ваши записи — в вашем пространстве.")} <Link href="/settings">{t("Профиль и настройки")}<ArrowRight size={12}/></Link></p>
    <PageFooter/>
  </div>;
}
