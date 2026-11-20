"use client";

import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";
import styles from "./schedule-calendar.module.css";

export interface ScheduleDay {
  isoDate: string;
  weekday: string;
  date: number;
  label: string;
  summary: string;
  total: number;
  completed: number;
  icon?: ReactNode;
  today?: boolean;
}
export interface ScheduleCalendarProps {
  days: ScheduleDay[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  monthLabel: string;
  label: string;
  previousLabel: string;
  nextLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  onExpand?: () => void;
  expandLabel?: string;
  action?: ReactNode;
}

/** The supplied schedule calendar, controlled by ISO dates and real Day records. */
export default function ScheduleCalendar({ days, selectedDate, onSelectDate, monthLabel, label, previousLabel, nextLabel, onPrevious, onNext, onExpand, expandLabel, action }: ScheduleCalendarProps) {
  const reduce = useReducedMotion();
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectAndFocus = (index: number) => {
    const day = days[index];
    if (!day) return;
    onSelectDate(day.isoDate);
    refs.current[index]?.focus();
  };
  return <section className={styles.calendar} aria-label={label}>
    <header className={styles.header}>
      <span className={styles.month}>{monthLabel}</span>
      <div className={styles.tools}>
        {action}
        {onExpand && <button type="button" className={styles.tool} aria-label={expandLabel} onClick={onExpand}><Expand size={14}/></button>}
        <span className={styles.divider}/>
        <button type="button" className={styles.tool} aria-label={previousLabel} onClick={onPrevious}><ChevronLeft size={15}/></button>
        <button type="button" className={styles.tool} aria-label={nextLabel} onClick={onNext}><ChevronRight size={15}/></button>
      </div>
    </header>
    <LayoutGroup id={id}>
      <div className={styles.days} role="group" aria-label={label}>
        {days.map((day, index) => <button key={day.isoDate} type="button" ref={node => { refs.current[index] = node; }}
          className={styles.day} data-selected={day.isoDate === selectedDate} data-today={day.today || undefined}
          aria-label={day.label} aria-describedby={`${id}-${day.isoDate}`} aria-pressed={day.isoDate === selectedDate}
          tabIndex={day.isoDate === selectedDate ? 0 : -1} onClick={() => onSelectDate(day.isoDate)}
          onKeyDown={event => {
            const next = event.key === "ArrowRight" ? (index + 1) % days.length : event.key === "ArrowLeft" ? (index - 1 + days.length) % days.length : event.key === "Home" ? 0 : event.key === "End" ? days.length - 1 : null;
            if (next !== null) { event.preventDefault(); selectAndFocus(next); }
          }}>
          {day.isoDate === selectedDate && <motion.span className={styles.selection} layoutId="selected-day" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }} />}
          <small className={styles.weekday}>{day.weekday}</small>
          <span className={styles.identity}>{day.icon}<strong>{day.date}</strong></span>
          <span className={styles.marks} aria-hidden="true">{day.total > 0 ? <><i data-done={day.completed === day.total || undefined}/><span>{day.completed}/{day.total}</span></> : <i className={styles.emptyMark}/>}</span>
          <span className="sr-only" id={`${id}-${day.isoDate}`}>{day.summary}</span>
        </button>)}
      </div>
    </LayoutGroup>
  </section>;
}
