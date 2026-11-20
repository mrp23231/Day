"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Check, Circle } from "lucide-react";
import { useDay } from "@/components/day-provider";
import { useI18n } from "@/components/i18n-provider";
import { DayIcon, DayIconButton } from "@/features/calendar/day-icon";
import { taskDone, taskOnDate } from "@/lib/domain";
import { Dialog } from "./dialog";
import styles from "./calendar-day-card.module.css";

/** Accessible cell-to-card expansion, using the selected day's actual tasks. */
export default function CalendarDayCard({date,onClose}:{date:string;onClose:()=>void}) {
  const {data,setDate,openModal}=useDay();
  const {t,formatDate}=useI18n();
  const reduce=useReducedMotion();
  const tasks=data.tasks.filter(task=>taskOnDate(task,date));
  const completed=tasks.filter(task=>taskDone(task,date)).length;
  return <Dialog open onClose={onClose} title={t("Обзор дня")} description={formatDate(date,{weekday:"long",day:"numeric",month:"long",year:"numeric"})}>
    <motion.div className={styles.card} initial={reduce?false:{opacity:0,y:8,scale:.98}} animate={{opacity:1,y:0,scale:1}} transition={{duration:.22}}>
      <div className={styles.identity}><DayIcon date={date} className={styles.icon}/><div><span>{formatDate(date,{weekday:"long"})}</span><strong>{formatDate(date,{day:"numeric",month:"long"})}</strong></div><DayIconButton date={date}/></div>
      <div className={styles.summary}><strong>{completed}<span> / {tasks.length}</span></strong><span>{t("задач выполнено")}</span></div>
      <div className={styles.track} aria-hidden="true"><span style={{width:`${tasks.length?completed/tasks.length*100:0}%`}}/></div>
      <div className={styles.tasks}>{tasks.slice(0,4).map(task=><button type="button" key={task.id} onClick={()=>{setDate(date);onClose();openModal({type:"task",item:task});}}>{taskDone(task,date)?<Check size={15}/>:<Circle size={15}/>}<span>{task.title}</span><small>{task.time}</small></button>)}{tasks.length===0&&<p>{t("День открыт для ваших планов")}</p>}</div>
      <Link href="/planner" className={styles.link} onClick={()=>{setDate(date);onClose();}}>{t("Открыть план дня")}<ArrowUpRight size={15}/></Link>
    </motion.div>
  </Dialog>;
}
