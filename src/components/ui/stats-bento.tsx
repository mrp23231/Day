"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import { ArrowUpRight, Droplets } from "lucide-react";
import { dailyProgress, habitOnDate, taskDone, taskOnDate, waterTotal, type AppData } from "@/lib/domain";
import { taskCompletionHistory } from "@/lib/completion";
import { cn } from "@/lib/utils";

export interface StatsBentoProps { data: AppData; date: string; ready?: boolean; className?: string }

export function StatsBento({ data, date, ready = true, className }: StatsBentoProps) {
  const {t,formatDate,formatNumber}=useI18n();
  const tasks = data.tasks.filter(task => taskOnDate(task, date));
  const completed = tasks.filter(task => taskDone(task, date)).length;
  const habits = data.habits.filter(habit => habitOnDate(habit, date));
  const habitsDone = habits.filter(habit => habit.completions.includes(date)).length;
  const history = taskCompletionHistory(data.tasks, date);
  const water = waterTotal(data.water, date);
  const progress = dailyProgress(data, date);
  const liters = (value: number) => formatNumber(value / 1000, { maximumFractionDigits: 2 });

  return <section className={cn("stats-bento", className)} aria-label={t("Сводка дня")} aria-busy={!ready}>
    <Link href="/progress" className="bento-primary bg-primary text-primary-foreground">
      <div className="bento-card-head"><span className="bento-badge">{t("Прогресс дня")}</span><ArrowUpRight size={18} /></div>
      <div className="bento-main-value">{ready ? progress : "—"}<span>%</span></div>
      <div className="bento-primary-foot"><p>{t("Задачи, привычки, вода и питание")}</p><span>{t("По вашим записям")}</span></div>
    </Link>

    <Link href="/planner" className="bento-tasks bg-muted border border-border">
      <div className="bento-task-copy"><span className="bento-label">{t("Задачи")}</span><p className="bento-value">{ready ? completed : "—"}<span> / {tasks.length}</span></p><small>{t("выполнено за день")}</small></div>
      <div className="bento-history"><div className="bento-bars" role="list" aria-label={t("Выполнение задач за 7 дней")}>
        {history.map(day => <div className="bento-bar-column" key={day.date} role="listitem" aria-label={t("{date}: {completed} из {total}",{date:formatDate(day.date),completed:day.completed,total:day.total})} title={t("{date}: {completed} из {total}",{date:formatDate(day.date),completed:day.completed,total:day.total})}>
          <div className="bento-bar-track" aria-hidden="true"><span style={{ height: `${day.percent}%` }} /></div><span aria-hidden="true">{formatDate(day.date,{weekday:"short"})}</span>
        </div>)}
      </div><p>{t("Последние 7 дней")}</p></div>
    </Link>

    <Link href="/habits" className="bento-habits bg-card border border-border">
      <p className="bento-value">{ready ? habitsDone : "—"}<span> / {habits.length}</span></p><span className="bento-label">{t("Привычки")}</span>
    </Link>

    <Link href="/water" className="bento-water bg-muted">
      <span className="bento-water-icon"><Droplets size={22} strokeWidth={1.5} /></span>
      <div><span className="bento-label">{t("Водный баланс")}</span><p className="bento-water-value">{ready ? liters(water) : "—"}<span> / {liters(data.preferences.waterGoal)} {t("л")}</span></p><small>{t("{amount} мл за день",{amount:formatNumber(water)})}</small></div>
      <ArrowUpRight className="bento-water-arrow" size={16} />
    </Link>
  </section>;
}

export default StatsBento;
