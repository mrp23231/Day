"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronLeft, ChevronRight, Plus, Search, SlidersHorizontal } from "lucide-react";
import { MotionConfig, motion, useReducedMotion } from "motion/react";
import { useI18n } from "@/components/i18n-provider";
import { useDay } from "@/components/day-provider";
import { Empty, PageFooter, PageHeading, TaskRow, WeekStrip } from "@/components/shared";
import { DayPicker, type CalendarView } from "@/components/ui/day-picker";
import { DayIcon, DayIconButton } from "@/features/calendar/day-icon";
import { QuickTaskForm } from "./quick-task-form";
import { Button } from "@/components/ui/button";
import { filterTasksForDate } from "@/lib/state-policy";
import { dateFromKey, dayKey, shiftDay, taskDone, weekDays, type Task } from "@/lib/domain";
import { calendarMonthDays, shiftCalendarDate } from "./calendar-period";
import styles from "./planner.module.css";

interface MonthCalendarProps {
  date: string;
  selectedDate: string;
  tasksForDate: (date: string) => Task[];
  onSelectDate: (date: string) => void;
  onTaskClick: (task: Task, date: string) => void;
  compact?: boolean;
}

function MonthCalendar({ date, selectedDate, tasksForDate, onSelectDate, onTaskClick, compact = false }: MonthCalendarProps) {
  const { t, formatDate, formatNumber } = useI18n();
  const days = calendarMonthDays(date);
  const month = date.slice(0, 7);
  const [focusDate, setFocusDate] = useState(selectedDate.startsWith(month) ? selectedDate : `${month}-01`);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const today = dayKey();

  function handleDayKey(event: KeyboardEvent<HTMLButtonElement>, current: string) {
    const weekday = (dateFromKey(current).getDay() + 6) % 7;
    const offset = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : event.key === "ArrowDown" ? 7 : event.key === "ArrowUp" ? -7 : event.key === "Home" ? -weekday : event.key === "End" ? 6 - weekday : null;
    if (offset === null) return;
    event.preventDefault();
    const next = shiftDay(current, offset);
    const target = buttons.current.get(next);
    if (target) { setFocusDate(next); target.focus(); }
  }

  return <div role="grid" aria-label={formatDate(date, { month: "long", year: "numeric" })} className={compact ? styles.compactCalendar : styles.monthCalendar}>
    <div className={styles.calendarRow} role="row">
      {days.slice(0, 7).map(day => <div key={day} role="columnheader" className={styles.weekday} aria-label={formatDate(day, { weekday: "long" })}>{formatDate(day, { weekday: "short" })}</div>)}
    </div>
    {Array.from({ length: 6 }, (_, week) => <div key={week} role="row" className={styles.calendarRow}>
      {days.slice(week * 7, week * 7 + 7).map(day => {
        const outside = !day.startsWith(month);
        const dayTasks = compact && outside ? [] : tasksForDate(day);
        const completed = dayTasks.filter(task => taskDone(task, day)).length;
        return <div key={day} role="gridcell" aria-selected={day === selectedDate} className={`${styles.cell} ${outside ? styles.outside : ""}`}>
          {!(compact && outside) && <>
            <button
              ref={element => { if (element) buttons.current.set(day, element); else buttons.current.delete(day); }}
              type="button"
              className={`${styles.dayNumber} ${day === selectedDate ? styles.selectedDate : ""} ${day === today ? styles.todayDate : ""}`}
              aria-label={`${formatDate(day, { day: "numeric", month: "long", year: "numeric" })}. ${t("{completed} из {total} выполнено", { completed, total: dayTasks.length })}`}
              aria-current={day === today ? "date" : undefined}
              tabIndex={day === focusDate ? 0 : -1}
              onFocus={() => setFocusDate(day)}
              onClick={() => onSelectDate(day)}
              onKeyDown={event => handleDayKey(event, day)}
            >
              <span>{formatNumber(dateFromKey(day).getDate())}</span>
              {!compact && <DayIcon date={day} className={styles.dayImage} />}
              {compact && dayTasks.length > 0 && <span aria-hidden="true" className={`${styles.taskDot} ${completed === dayTasks.length ? styles.completedDot : ""}`} />}
            </button>
            {!compact && <>
              <div className={styles.monthEvents}>{dayTasks.slice(0, 3).map(task => <button type="button" className={`${styles.monthEvent} ${taskDone(task, day) ? styles.done : ""}`} key={task.id} onClick={() => onTaskClick(task, day)}>
                <span aria-hidden="true" className={styles.eventDot} />{task.time && <time>{task.time}</time>}<span>{task.title}</span>
              </button>)}
                {dayTasks.length > 3 && <button type="button" className={styles.moreEvents} onClick={() => onSelectDate(day)}>{t("ещё {count}", { count: dayTasks.length - 3 })}</button>}
              </div>
              {dayTasks.length > 0 && <span className={styles.mobileCount} aria-hidden="true"><span className={`${styles.taskDot} ${completed === dayTasks.length ? styles.completedDot : ""}`} />{formatNumber(dayTasks.length)}</span>}
            </>}
          </>}
        </div>;
      })}
    </div>)}
  </div>;
}

export function Planner() {
  const { t, formatDate } = useI18n();
  const { data, date, setDate, openModal, update, notify } = useDay();
  const [view, setView] = useState<CalendarView>("day");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const reducedMotion = useReducedMotion();
  const dateTasks = useMemo(() => {
    const dates = new Set([date, ...weekDays(date)]);
    if (view === "month") calendarMonthDays(date).forEach(day => dates.add(day));
    if (view === "year") {
      const year = dateFromKey(date).getFullYear();
      for (let month = 1; month <= 12; month++) calendarMonthDays(`${year}-${String(month).padStart(2,"0")}-01`).forEach(day => dates.add(day));
    }
    return new Map([...dates].map(day => [day, filterTasksForDate(data.tasks, day, search, filter).sort((a,b) => (a.time || "99").localeCompare(b.time || "99"))]));
  }, [data.tasks,date,view,search,filter]);
  const forDate = (day: string) => dateTasks.get(day) ?? [];
  const tasks = forDate(date);
  const week = weekDays(date);
  const year = dateFromKey(date).getFullYear();
  const months = Array.from({ length: 12 }, (_, month) => `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-01`);
  const periodLabel = view === "year" ? formatDate(date, { year: "numeric" }) : view === "week" ? `${formatDate(week[0], { day: "numeric", month: "short" })} — ${formatDate(week[6], { day: "numeric", month: "short", year: "numeric" })}` : formatDate(date, { month: "long", year: "numeric" });

  function selectDay(day: string) { setDate(day); setView("day"); }
  function editTask(task: Task, day: string) { setDate(day); openModal({ type: "task", item: task }); }

  return <MotionConfig reducedMotion="user">
    <PageHeading title={t("Планировщик")} subtitle={t("Задачи, встречи и время для себя.")}><Button aria-label={t("Новая задача")} onClick={() => openModal({ type: "task" })}><Plus size={16} /><span className="compact-action-label">{t("Новая задача")}</span></Button></PageHeading>
    <section className={styles.workspace}>
      <div className={styles.periodBar}>
        <div className={styles.periodIdentity}>
          {view === "day" ? <DayIcon date={date}/> : <DayIconButton date={date} />}
          <div><span className={styles.calendarCaption}>{t("Ваш календарь")}</span><h2 aria-live="polite">{periodLabel}</h2></div>
        </div>
        <div className={styles.navigation}>
          <div className={styles.arrows}>
            <button type="button" className="icon-button" onClick={() => setDate(shiftCalendarDate(date, view, -1))} aria-label={t("Предыдущий период")}><ChevronLeft size={17} /></button>
            <button type="button" className="icon-button" onClick={() => setDate(shiftCalendarDate(date, view, 1))} aria-label={t("Следующий период")}><ChevronRight size={17} /></button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setDate(dayKey())}>{t("Сегодня")}</Button>
        </div>
        <DayPicker value={view} onValueChange={setView} className={styles.viewPicker} />
      </div>

      <div className={styles.filterBar}>
        <label className={styles.search}><Search size={16} aria-hidden="true" /><input type="search" placeholder={t("Поиск задач")} aria-label={t("Найти задачу")} value={search} onChange={event => setSearch(event.target.value)} /></label>
        <label className={styles.filter}><SlidersHorizontal size={14} aria-hidden="true" /><select aria-label={t("Фильтр задач")} value={filter} onChange={event => setFilter(event.target.value)}><option value="all">{t("Все задачи")}</option><option value="active">{t("В работе")}</option><option value="done">{t("Выполненные")}</option><option value="high">{t("Высокий приоритет")}</option></select></label>
      </div>

      <motion.div key={view} initial={reducedMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.18 }}>
        {view === "day" ? <>
          <WeekStrip />
          <div className={styles.agendaHeading}><span>{formatDate(date, { weekday: "long", day: "numeric", month: "long" })}</span><span>{t("{completed} из {total} выполнено", { completed: tasks.filter(task => taskDone(task, date)).length, total: tasks.length })}</span></div>
          <QuickTaskForm date={date} onAdd={task => { update(current => ({ ...current, tasks: [...current.tasks, task] })); setSearch(""); setFilter("all"); notify(t("Задача добавлена в план")); }} />
          {tasks.length ? <div className="planner-task-list">{tasks.map(task => <TaskRow key={task.id} task={task} />)}</div> : <div className="planner-empty"><Empty title={search || filter !== "all" ? t("Задачи не найдены") : t("Пока нет задач")} description={search || filter !== "all" ? t("Измените поиск или фильтр.") : t("Запишите первое дело в строке выше.")} icon="task" /></div>}
        </> : view === "week" ? <div className={styles.weekView}>
          {week.map(day => <div className={styles.weekColumn} key={day}>
            <button type="button" className={`${styles.weekHeading} ${day === date ? styles.selectedWeek : ""}`} aria-label={formatDate(day, { weekday: "long", day: "numeric", month: "long" })} aria-current={day === dayKey() ? "date" : undefined} onClick={() => selectDay(day)}><span>{formatDate(day, { weekday: "short" })}</span><strong>{dateFromKey(day).getDate()}</strong><DayIcon date={day} className={styles.weekImage} /></button>
            <div className={styles.weekTasks}>{forDate(day).map(task => <button type="button" className={`${styles.weekTask} ${taskDone(task, day) ? styles.done : ""}`} key={task.id} onClick={() => editTask(task, day)}><small>{taskDone(task, day) && <Check size={10} aria-hidden="true" />}{task.time || t("В течение дня")}</small><span>{task.title}</span></button>)}
              {!forDate(day).length && <p className={styles.noPlans}>{search || filter !== "all" ? t("Задачи не найдены") : t("Без планов")}</p>}
              <button type="button" className={styles.addTask} aria-label={t("Добавить задачу на {date}", { date: formatDate(day, { day: "numeric", month: "long" }) })} onClick={() => { setDate(day); openModal({ type: "task" }); }}><Plus size={15} /></button>
            </div>
          </div>)}
        </div> : view === "month" ? <MonthCalendar key={date.slice(0, 7)} date={date} selectedDate={date} tasksForDate={forDate} onSelectDate={selectDay} onTaskClick={editTask} /> : <div className={styles.yearView}>
          {months.map(month => <section className={`${styles.yearMonth} ${month.slice(0, 7) === date.slice(0, 7) ? styles.currentMonth : ""}`} key={month}>
            <h3><button type="button" aria-label={t("Открыть {month}", { month: formatDate(month, { month: "long" }) })} onClick={() => { setDate(month); setView("month"); }}>{formatDate(month, { month: "long" })}<ChevronRight size={13} aria-hidden="true" /></button></h3>
            <MonthCalendar date={month} selectedDate={date} tasksForDate={forDate} onSelectDate={selectDay} onTaskClick={editTask} compact />
          </section>)}
        </div>}
      </motion.div>
      {view !== "day" && <p className={styles.calendarHint}>{t("Выберите день, чтобы открыть план")}</p>}
    </section>
    <PageFooter />
  </MotionConfig>;
}
