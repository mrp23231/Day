"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Box, CalendarDays, ChevronLeft, ChevronRight, Grid2X2 } from "lucide-react";
import { useDay } from "@/components/day-provider";
import { useI18n } from "@/components/i18n-provider";
import { FocusCity } from "@/components/ui/focus-city";
import { DayIcon } from "@/features/calendar/day-icon";
import { calendarPeriodDates, moveCalendarPeriod, productivityDays, type ProductivityDay, type ProductivityPeriod, type ProductivityStatus } from "@/lib/calendar-productivity";
import { dateFromKey, dayKey, shiftDay } from "@/lib/domain";
import styles from "./productivity-calendar.module.css";

const statusSources: Record<ProductivityStatus, string> = { complete: "Все задачи выполнены", partial: "Выполнено от половины", low: "Выполнено меньше половины", empty: "Нет задач", future: "Будущий день" };
const periods: { value: ProductivityPeriod; label: string }[] = [{ value: "week", label: "Неделя" }, { value: "month", label: "Месяц" }, { value: "year", label: "Год" }];

export function ProductivityCalendar() {
  const { data, date, setDate } = useDay();
  const { t, formatDate, formatNumber } = useI18n();
  const [period, setPeriod] = useState<ProductivityPeriod>("month");
  const [view, setView] = useState<"calendar" | "city">("calendar");
  const today = dayKey();
  const dates = useMemo(() => calendarPeriodDates(date, period), [date, period]);
  const days = useMemo(() => productivityDays(data, dates, today), [data, dates, today]);
  const active = days.find(day => day.date === date) ?? days[0];
  const measured = days.filter(day => day.status !== "future");
  const completed = measured.reduce((sum, day) => sum + day.completed, 0);
  const total = measured.reduce((sum, day) => sum + day.total, 0);
  const completeDays = measured.filter(day => day.status === "complete").length;
  const number = (value: number) => formatNumber(value, { maximumFractionDigits: 0 });
  const percent = (value: number) => value < 1 && Math.round(value * 1000) >= 1000 ? "<100%" : formatNumber(value, { style: "percent", maximumFractionDigits: 1 });
  const describeDay = (day: ProductivityDay) => t("{date}: {completed} из {total} задач. {status}", { date: formatDate(day.date, { day: "numeric", month: "long", year: "numeric" }), completed: number(day.completed), total: number(day.total), status: t(statusSources[day.status]) });
  const dayButton = (day: ProductivityDay, compact = false) => <button type="button" key={day.date} data-date={day.date} data-status={day.status} aria-label={describeDay(day)} aria-pressed={day.date === date} aria-current={day.date === today ? "date" : undefined} className={`${styles.day} ${compact ? styles.compactDay : ""}`} onClick={() => setDate(day.date)}>
    {period === "week" && <span className={styles.weekday}>{formatDate(day.date, { weekday: "short" })}</span>}
    <span className={styles.dayNumber}>{formatDate(day.date, { day: "numeric" })}</span>
    {!compact && <><DayIcon date={day.date} className={styles.dayIcon} /><span className={styles.dayCount}>{day.total ? t("{completed} из {total}", { completed: number(day.completed), total: number(day.total) }) : "—"}</span></>}
  </button>;
  const weekdayLabels = Array.from({ length: 7 }, (_, index) => <span key={index}>{formatDate(shiftDay("2026-11-16", index), { weekday: "narrow" })}</span>);
  const monthGrid = (monthDays: ProductivityDay[], compact: boolean) => {
    const blanks = (dateFromKey(monthDays[0].date).getDay() + 6) % 7;
    return <><div className={styles.weekdays} aria-hidden="true">{weekdayLabels}</div><div className={styles.monthGrid}>{Array.from({ length: blanks }, (_, index) => <span key={`empty-${index}`} aria-hidden="true" />)}{monthDays.map(day => dayButton(day, compact))}</div></>;
  };
  const title = period === "week" ? `${formatDate(dates[0], { day: "numeric", month: "short" })} — ${formatDate(dates.at(-1)!, { day: "numeric", month: "short", year: "numeric" })}` : formatDate(date, period === "year" ? { year: "numeric" } : { month: "long", year: "numeric" });
  return <section className={`panel ${styles.calendar}`} aria-labelledby="productivity-calendar-title">
    <header className={styles.header}><div><div className={styles.kicker}><CalendarDays size={13} aria-hidden="true" />{t("День за днём")}</div><h2 id="productivity-calendar-title">{t("Календарь продуктивности")}</h2><p>{t("Каждый день — часть вашей истории.")}</p></div><div className={styles.viewSwitch} role="group" aria-label={t("Вид календаря продуктивности")}><button type="button" aria-label="2D" aria-pressed={view === "calendar"} onClick={() => setView("calendar")}><Grid2X2 size={14} aria-hidden="true" /><span>2D</span></button><button type="button" aria-label="3D" aria-pressed={view === "city"} onClick={() => setView("city")}><Box size={14} aria-hidden="true" /><span>3D</span></button></div></header>
    <div className={styles.toolbar}><div className={styles.periods} role="group" aria-label={t("Период календаря продуктивности")}>{periods.map(item => <button type="button" key={item.value} aria-pressed={period === item.value} onClick={() => setPeriod(item.value)}>{t(item.label)}</button>)}</div><div className={styles.navigation}><button type="button" className="icon-button" aria-label={t("Предыдущий период")} onClick={() => setDate(moveCalendarPeriod(date, period, -1))}><ChevronLeft size={16} aria-hidden="true" /></button><span>{title}</span><button type="button" className="icon-button" aria-label={t("Следующий период")} onClick={() => setDate(moveCalendarPeriod(date, period, 1))}><ChevronRight size={16} aria-hidden="true" /></button></div></div>
    <div className={styles.stats}>{[{ label: t("Выполнено за период"), value: number(completed) }, { label: t("Доля выполненных задач"), value: total ? percent(completed / total) : "—" }, { label: t("Дней со всеми задачами"), value: number(completeDays) }].map(stat => <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}</div>
    {view === "city" ? <FocusCity days={days} selectedDate={date} onDaySelect={setDate} describeDay={describeDay} /> : <div className={styles.visual}>
      {period === "week" ? <div className={styles.weekGrid}>{days.map(day => dayButton(day))}</div> : period === "month" ? monthGrid(days, false) : <div className={styles.yearGrid} role="group" aria-label={t("Месяцы года")}>{Array.from({ length: 12 }, (_, month) => { const monthDays = days.filter(day => dateFromKey(day.date).getMonth() === month); return <div className={styles.miniMonth} key={month}><h3>{formatDate(monthDays[0].date, { month: "long" })}</h3>{monthGrid(monthDays, true)}</div>; })}</div>}
    </div>}
    <div className={styles.legend}>{[{ status: "complete", label: "100%" }, { status: "partial", label: "50–99%" }, { status: "low", label: "<50%" }, { status: "empty", label: t("Нет задач или день ещё впереди") }].map(item => <span key={item.status}><i data-status={item.status} aria-hidden="true" />{item.label}</span>)}</div>
    <div className={styles.selected}>
      <div className={styles.selectedIdentity}><span className={styles.dateEmblem}><DayIcon date={active.date} className={styles.selectedPhoto} /><CalendarDays size={18} aria-hidden="true" /></span><div aria-live="polite" aria-atomic="true"><strong>{formatDate(active.date, { weekday: "long", day: "numeric", month: "long" })}</strong><span>{active.status === "empty" ? t("День без запланированных задач") : t("Завершено {completed} из {total} задач", { completed: number(active.completed), total: number(active.total) })}</span><small>{active.status === "future" ? t("Результат появится в этот день") : active.source === "review" ? t("Сохранено в итогах дня") : t("По текущему плану дня")}</small></div></div>
      <div className={styles.dayNavigation}><button type="button" className="icon-button" aria-label={t("Предыдущий день продуктивности")} disabled={active.date === dates[0]} onClick={() => setDate(shiftDay(active.date, -1))}><ChevronLeft size={15} aria-hidden="true" /></button><label><span className="sr-only">{t("Выбрать день продуктивности")}</span><input aria-label={t("Выбрать день продуктивности")} type="date" min={dates[0]} max={dates.at(-1)} value={active.date} onChange={event => { if (dates.includes(event.target.value)) setDate(event.target.value); }} /></label><button type="button" className="icon-button" aria-label={t("Следующий день продуктивности")} disabled={active.date === dates.at(-1)} onClick={() => setDate(shiftDay(active.date, 1))}><ChevronRight size={15} aria-hidden="true" /></button></div>
      <Link href="/planner" className={styles.openPlan}>{t("Открыть план дня")}<ArrowUpRight size={14} aria-hidden="true" /></Link>
    </div>
  </section>;
}
