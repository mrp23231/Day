"use client";

import { useI18n } from "@/components/i18n-provider";

import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import type { ReviewSummary } from "./review-model";

export type ReviewStatsProps = {
  summary: ReviewSummary;
  completedTasks?: { id: string; title: string }[];
  date: string;
};

const ease = [.16, 1, .3, 1] as const;
const reveal = {
  rest: { opacity: 1, y: 0 },
  enter: { opacity: [0, 1], y: [12, 0], transition: { duration: .55, ease } },
};

function entryLabel(value: number, locale: string) {
  if(locale!=="ru") return locale==="it" ? value===1?"voce":"voci" : value===1?"entry":"entries";
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return "записей";
  if (value % 10 === 1) return "запись";
  return value % 10 >= 2 && value % 10 <= 4 ? "записи" : "записей";
}

function progress(amount: number, goal: number) {
  return goal > 0 ? Math.max(0, Math.min(1, amount / goal)) : 0;
}

/** Visual numbers are hidden from assistive technology; the final totals stay in the document. */
function AnimatedNumber({ value, play, delay = 0 }: { value: number; play: boolean; delay?: number }) {
  const { formatNumber } = useI18n();
  const count = useMotionValue(value);
  const text = useTransform(count, latest => formatNumber(Math.round(latest)));

  useEffect(() => {
    if (!play || value === 0) {
      count.set(value);
      return;
    }
    const playback = animate(count, [0, value], { duration: .95, delay, ease });
    return () => playback.stop();
  }, [count, delay, play, value]);

  return <motion.span>{text}</motion.span>;
}

function StatProgress({ value, play, delay }: { value: number; play: boolean; delay: number }) {
  return <div className="recap-stats-track" aria-hidden="true">
    <motion.span initial={false} animate={{ scaleX: play ? [0, value] : value }} transition={{ duration: .9, delay, ease }} />
  </div>;
}

export function ReviewStats({ summary, completedTasks = [], date }: ReviewStatsProps) {
  const { t, formatDate, formatNumber, locale } = useI18n();
  const hero = useRef<HTMLDivElement>(null);
  const inView = useInView(hero, { once: true, amount: .2 });
  const reducedMotion = useReducedMotion();
  const play = inView && reducedMotion === false;
  const percent = summary.tasks.total > 0 ? Math.round(progress(summary.tasks.completed, summary.tasks.total) * 100) : null;
  const circumference = 2 * Math.PI * 100;
  const taskProgress = progress(summary.tasks.completed, summary.tasks.total);
  const taskText = t(percent === null ? "Задачи: {completed} из {total} выполнено." : "Задачи: {completed} из {total} выполнено, {percent}%.", {completed:summary.tasks.completed,total:summary.tasks.total,percent:percent??0});

  return <motion.section className="recap-stats" aria-label={t("Записи за {date}",{date:formatDate(date, { day: "numeric", month: "long" })})}
    initial={false} animate={play ? "enter" : "rest"}
    variants={{ enter: { transition: { staggerChildren: .085 } }, rest: {} }}>
    <motion.div ref={hero} className="recap-stats-hero" variants={reveal}>
      <div className="recap-stats-ring" aria-hidden="true">
        <svg viewBox="0 0 224 224" fill="none">
          <circle className="recap-stats-ring-track" cx="112" cy="112" r="100" strokeWidth="5" />
          <motion.circle className="recap-stats-ring-fill" cx="112" cy="112" r="100" strokeWidth="5"
            strokeLinecap={taskProgress > 0 ? "round" : "butt"} strokeDasharray={circumference}
            initial={false} animate={{ strokeDashoffset: play ? [circumference, circumference * (1 - taskProgress)] : circumference * (1 - taskProgress) }}
            transition={{ duration: 1.1, delay: .08, ease }} transform="rotate(-90 112 112)" />
        </svg>
        <div className="recap-stats-ring-center">
          <span className="recap-stats-percentage">{percent === null ? "—" : <><AnimatedNumber value={percent} play={play} delay={.08} /><small>%</small></>}</span>
          <span className="recap-stats-ring-caption">{percent === null ? t("нет задач") : t("выполнено")}</span>
        </div>
      </div>
      <div className="recap-stats-task-summary">
        <p className="recap-stats-eyebrow">{t("Выполнено задач")}</p>
        <p className="recap-stats-sr-only">{taskText}</p>
        <p className="recap-stats-task-count" aria-hidden="true"><AnimatedNumber value={summary.tasks.completed} play={play} delay={.12} /><span>{t("из")} {formatNumber(summary.tasks.total)}</span></p>
        <p className="recap-stats-task-caption">{summary.tasks.total === 0 ? t("На этот день задач не было.") : summary.tasks.completed === 0 ? t("Пока нет завершённых задач. Сохраните день таким, каким он был.") : t("Каждая завершённая задача — часть вашего дня.")}</p>
      </div>
    </motion.div>

    <motion.dl className="recap-stats-details" variants={reveal}>
      <motion.div className="recap-stats-detail" variants={reveal}>
        <dt>{t("Привычки")}</dt>
        <dd>
          <span className="recap-stats-sr-only">{summary.habits.completed} {t("из")} {summary.habits.total} {t("отмечено")}</span>
          <span className="recap-stats-detail-value" aria-hidden="true"><AnimatedNumber value={summary.habits.completed} play={play} delay={.18} /><small>{t("из")} {formatNumber(summary.habits.total)}</small></span>
          <span className="recap-stats-detail-caption" aria-hidden="true">{summary.habits.total === 0 ? t("на день не запланированы") : t("отмечено за день")}</span>
          <StatProgress value={progress(summary.habits.completed, summary.habits.total)} play={play} delay={.18} />
        </dd>
      </motion.div>
      <motion.div className="recap-stats-detail" variants={reveal}>
        <dt>{t("Вода")}</dt>
        <dd>
          <span className="recap-stats-sr-only">{formatNumber(summary.water.amount)} {t("мл из цели")} {formatNumber(summary.water.goal)} {t("мл")}</span>
          <span className="recap-stats-detail-value" aria-hidden="true"><AnimatedNumber value={summary.water.amount} play={play} delay={.24} /><small>{t("мл")}</small></span>
          <span className="recap-stats-detail-caption" aria-hidden="true">{t("цель")} {formatNumber(summary.water.goal)} {t("мл")}</span>
          <StatProgress value={progress(summary.water.amount, summary.water.goal)} play={play} delay={.24} />
        </dd>
      </motion.div>
      <motion.div className="recap-stats-detail" variants={reveal}>
        <dt>{t("Питание")}</dt>
        <dd>
          <span className="recap-stats-sr-only">{summary.food.entries} {entryLabel(summary.food.entries,locale)}, {formatNumber(summary.food.calories)} {t("ккал")}</span>
          <span className="recap-stats-detail-value" aria-hidden="true"><AnimatedNumber value={summary.food.entries} play={play} delay={.3} /><small>{entryLabel(summary.food.entries,locale)}</small></span>
          <span className="recap-stats-detail-caption" aria-hidden="true">{formatNumber(summary.food.calories)} {t("ккал записано")}</span>
        </dd>
      </motion.div>
    </motion.dl>

    {completedTasks.length > 0 && <motion.div className="recap-stats-completed" variants={reveal}>
      <p className="recap-stats-eyebrow">{t("Уже сделано")}</p>
      <ul className="recap-stats-completed-list" aria-label={t("Выполненные задачи")}>
        {completedTasks.map((task, index) => <motion.li key={task.id} initial={false}
          animate={play ? { opacity: [0, 1], y: [8, 0] } : { opacity: 1, y: 0 }}
          transition={{ duration: .4, delay: .3 + Math.min(index, 6) * .035, ease }}>
          <span className="recap-stats-task-check" aria-hidden="true"><Check size={12} strokeWidth={2} /></span><span>{task.title}</span>
        </motion.li>)}
      </ul>
    </motion.div>}
  </motion.section>;
}
