"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import { CalendarDays, Columns3, Grid2X2, Rows3 } from "lucide-react";
import { motion, MotionConfig, useReducedMotion } from "motion/react";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import styles from "./day-picker.module.css";

export type CalendarView = "day" | "week" | "month" | "year";

const views = [
  { value: "day", label: "День", icon: CalendarDays },
  { value: "week", label: "Неделя", icon: Columns3 },
  { value: "month", label: "Месяц", icon: Grid2X2 },
  { value: "year", label: "Год", icon: Rows3 },
] as const;

export interface DayPickerProps {
  value: CalendarView;
  onValueChange: (view: CalendarView) => void;
  className?: string;
  label?: string;
}

/** Controlled calendar views, adapted from the supplied animated day picker. */
export function DayPicker({ value, onValueChange, className, label }: DayPickerProps) {
  const { t } = useI18n();
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const reducedMotion = useReducedMotion();

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % views.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index + views.length - 1) % views.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = views.length - 1;
    else return;
    event.preventDefault();
    onValueChange(views[next].value);
    buttons.current[next]?.focus();
  }

  return <MotionConfig reducedMotion="user">
    <div className={cn(styles.picker, className)} role="radiogroup" aria-label={label || t("Вид календаря")}>
      {views.map(({ value: option, label: source, icon: Icon }, index) => <button
        key={option}
        ref={element => { buttons.current[index] = element; }}
        type="button"
        role="radio"
        aria-checked={value === option}
        tabIndex={value === option ? 0 : -1}
        className={styles.option}
        onClick={() => onValueChange(option)}
        onKeyDown={event => handleKeyDown(event, index)}
      >
        {value === option && <motion.span className={styles.active} layoutId={`${id}-calendar-view`} transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 460, damping: 38 }} />}
        <Icon size={14} aria-hidden="true" />
        <span>{t(source)}</span>
      </button>)}
    </div>
  </MotionConfig>;
}

export default DayPicker;
