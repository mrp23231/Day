"use client";

import { useI18n } from "@/components/i18n-provider";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCheck, Moon, Repeat2, Star, X } from "lucide-react";
import { useDay } from "@/components/day-provider";
import { Button } from "@/components/ui/button";
import BasicRating from "@/components/ui/rating-group";
import HoldToConfirm from "@/components/ui/motion-hold-to-confirm";
import { dateSchema, dayKey, shiftDay, taskDone, taskOnDate, type DayReview } from "@/lib/domain";
import { closeDay, reviewSummary, type CloseDayInput } from "./review-model";
import { ReviewStats } from "./review-stats";
import { dismissNotifications } from "@/lib/notifications";

const stages=["Результаты","Планы дальше","Впечатления"];
const titles=["Ваш день в цифрах","Остальное — на потом","Каким был этот день?"];
function taskWord(count:number){return count%10===1&&count%100!==11?"дело":count%10>=2&&count%10<=4&&(count%100<12||count%100>14)?"дела":"дел";}

export function ReviewFlow({date,onClose}:{date:string;onClose:()=>void}) {
  const { t, formatDate, formatNumber } = useI18n();
  const {data,ready,update,notify,setDate}=useDay();
  const saved=data.reviews.find(review=>review.date===date);
  const closed=!!saved?.closedAt;
  const [step,setStep]=useState(0);
  const [rating,setRating]=useState(saved?.rating??0);
  const [note,setNote]=useState(saved?.note??"");
  const [destinations,setDestinations]=useState<Record<string,string>>({});
  const [error,setError]=useState("");
  const [receipt,setReceipt]=useState<DayReview|null>(null);
  const [receiptEdited,setReceiptEdited]=useState(false);
  const [confirmationAttempt,setConfirmationAttempt]=useState(0);
  const [opener]=useState(()=>typeof document!=="undefined"&&document.activeElement instanceof HTMLElement?document.activeElement:null);
  const heading=useRef<HTMLHeadingElement>(null);
  const scroller=useRef<HTMLDivElement>(null);
  const reduced=useReducedMotion();
  const summary=saved?.snapshot??reviewSummary(data,date);
  const completedTasks=saved?.snapshot?.completedTasks??data.tasks.filter(task=>taskOnDate(task,date)&&taskDone(task,date)).map(({id,title})=>({id,title}));
  const unfinished=data.tasks.filter(task=>taskOnDate(task,date)&&!taskDone(task,date));
  const selected=unfinished.filter(task=>destinations[task.id]!==undefined);
  const tomorrow=shiftDay(dayKey(),1);
  const invalidDestination=selected.some(task=>!dateSchema.safeParse(destinations[task.id]).success||destinations[task.id]<tomorrow);

  useEffect(()=>{dismissNotifications();},[]);

  useEffect(()=>{
    const frame=window.requestAnimationFrame(()=>{if(scroller.current)scroller.current.scrollTop=0;heading.current?.focus({preventScroll:true});});
    return()=>window.cancelAnimationFrame(frame);
  },[step,receipt]);

  function advance(){
    if(step===1&&!closed&&invalidDestination){setError(t("Выберите для переноса завтрашний день или более позднюю дату."));return;}
    setError("");setStep(current=>Math.min(2,current+1));
  }
  function back(){setError("");setStep(current=>Math.max(0,current-1));}
  function commit(){
    try{
      const today=dayKey();
      if(!ready||date>today)throw new Error(t("Итоги можно сохранить для сегодняшнего или прошедшего дня."));
      const input:CloseDayInput={date,rating,note,transfers:closed?[]:selected.map(task=>({taskId:task.id,toDate:destinations[task.id],newTaskId:crypto.randomUUID()}))};
      const now=new Date().toISOString();
      // IDs are prepared once outside the React updater. The pure model rechecks
      // task eligibility against the latest state and applies every change together.
      const next=update(current=>closeDay(current,input,today,now));
      const committed=next.reviews.find(review=>review.date===date)!;
      const edited=closed||committed.closedAt!==now;
      setError("");setReceiptEdited(edited);setReceipt(committed);
      notify(edited?t("Итоги дня обновлены"):t("День сохранён"),{description:edited?t("Оценка и заметка обновлены."):committed.transfers?.length?t("Выбранные дела перенесены в план."):t("Можно выдохнуть и вернуться к своим планам.")});
    }catch(cause){
      setError(cause instanceof Error&&!("issues" in cause)?t(cause.message):t("Проверьте оценку, дату переноса и длину заметки."));
      // Remounting resets an interrupted/failed confirmation; no persisted change
      // has been applied when validation above fails.
      setConfirmationAttempt(value=>value+1);
    }
  }

  return <DialogPrimitive.Root open onOpenChange={open=>{if(!open)onClose();}}><DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="recap-overlay"/>
    <DialogPrimitive.Content className="recap-screen" onCloseAutoFocus={event=>{event.preventDefault();if(opener?.isConnected&&!document.activeElement?.closest('[role="dialog"]'))opener.focus({preventScroll:true});}}>
      <DialogPrimitive.Title className="sr-only">{t("Итоги дня")}</DialogPrimitive.Title>
      <DialogPrimitive.Description className="sr-only">{t("Результаты дня, перенос оставшихся задач, оценка и заметка. Изменения сохраняются только после подтверждения.")}</DialogPrimitive.Description>
      <header className="recap-topbar"><span className="recap-brand">Day<span>.</span></span><span className="recap-top-date">{formatDate(date,{day:"numeric",month:"long",year:"numeric"})}</span><DialogPrimitive.Close className="recap-close" aria-label={t("Закрыть итоги")}><X size={20}/></DialogPrimitive.Close></header>
      <div className="recap-scroll" ref={scroller}>
        {receipt?<motion.div className="recap-success" initial={reduced?false:{opacity:0,y:12}} animate={{opacity:1,y:0}}>
          <motion.div className="recap-success-mark" initial={reduced?false:{scale:.8,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:"spring",stiffness:180,damping:20}}><CheckCheck size={39} strokeWidth={1.3}/></motion.div>
          <p className="recap-eyebrow">{formatDate(date,{day:"numeric",month:"long"})} {t("· сохранено")}</p>
          <h1 ref={heading} tabIndex={-1}>{receiptEdited?t("Итоги обновлены."):t("Этот день — ваш.")}</h1>
          <p className="recap-success-copy">{receiptEdited?t("Впечатления сохранены. Планы остались на своих местах."):t("Всё главное сохранено. Для следующего дня есть новое место.")}</p>
          <div className="recap-receipt"><span><Check size={15}/>{receipt.snapshot?.tasks.completed??summary.tasks.completed} {t("из")} {receipt.snapshot?.tasks.total??summary.tasks.total} {t("задач выполнено")}</span>{!!receipt.rating&&<span><Star size={15} fill="currentColor"/>{formatNumber(receipt.rating)} {t("из 5 — ваша оценка")}</span>}{!receiptEdited&&!!receipt.transfers?.length&&<span><CalendarDays size={15}/>{receipt.transfers.length} {t(taskWord(receipt.transfers.length))} {t("в новых планах")}</span>}</div>
          <div className="recap-success-actions"><Button onClick={onClose}>{t("Вернуться к дню")}<ArrowRight size={15}/></Button><Button variant="ghost" onClick={()=>{setDate(tomorrow);onClose();}}>{t("Посмотреть завтра")}</Button></div>
          <p className="recap-success-footnote">{t("К оценке и заметке можно вернуться в любое время.")}</p>
        </motion.div>:<div className="recap-layout">
          <aside className="recap-rail"><div className="recap-rail-intro"><Moon size={18} strokeWidth={1.4}/><p>{t("Маленькая пауза.")}<br/>{t("Чтобы заметить свой день.")}</p></div><ol aria-label={t("Этапы итогов дня")}>{stages.map((stage,index)=><li key={stage} aria-current={step===index?"step":undefined} className={step===index?"current":step>index?"passed":""}><span>{step>index?<Check size={13}/>:String(index+1).padStart(2,"0")}</span><strong>{t(stage)}</strong></li>)}</ol><p className="recap-rail-note">{t("Ваш темп. Ваши ощущения.")}<br/>{t("Здесь нет правильного результата.")}</p></aside>
          <main className="recap-main">
            <div className="recap-section-heading"><p className="recap-eyebrow">{String(step+1).padStart(2,"0")} / 03 · {t(stages[step])}</p><h1 ref={heading} tabIndex={-1}>{t(titles[step])}</h1><p>{step===0?closed?t("Сохранённый взгляд на этот день — до переноса дел."):t("За каждым числом — немного вашей жизни."):step===1?closed?t("Решения о планах уже сохранены."):t("Не всё нужно успеть сегодня. Дайте оставшимся делам своё время."):t("Оцените день по своим ощущениям. И сохраните то, что хочется запомнить.")}</p></div>
            <motion.div key={step} className="recap-step-body" initial={reduced?false:{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:reduced?0:.32,ease:[.22,.68,0,1]}}>
              {step===0&&<ReviewStats summary={summary} completedTasks={completedTasks} date={date}/>}
              {step===1&&(closed?<div className="recap-closed-plans"><CheckCheck size={29} strokeWidth={1.3}/><h2>{t("Планы на своих местах")}</h2><p>{saved.transfers?.length?t("{count} {tasks} {moved} при закрытии дня. Повторного переноса не будет.",{count:saved.transfers.length,tasks:t(taskWord(saved.transfers.length)),moved:t(taskWord(saved.transfers.length)==="дело"?"перенесено":"перенесены")}):t("В этом дне вы не переносили задачи.")}</p>{!!saved.transfers?.length&&<ul>{saved.transfers.map(transfer=><li key={transfer.taskId}><span>{data.tasks.find(task=>task.id===transfer.newTaskId)?.title||t("Перенесённая задача")}</span><span>{formatDate(transfer.toDate,{day:"numeric",month:"long"})}</span></li>)}</ul>}</div>:unfinished.length?<>
                <div className="recap-transfer-toolbar"><span>{t("{count} {tasks} осталось в плане", {count:unfinished.length,tasks:t(taskWord(unfinished.length))})}</span><button onClick={()=>setDestinations(Object.fromEntries(unfinished.map(task=>[task.id,tomorrow])))}>{t("Все на завтра")}<ArrowRight size={12}/></button></div>
                <div className="recap-transfer-list">{unfinished.map(task=>{const chosen=destinations[task.id]!==undefined;return <div className={`recap-transfer-row ${chosen?"chosen":""}`} key={task.id}><label className="recap-transfer-task"><input type="checkbox" aria-label={t("Перенести: {title}",{title:task.title})} checked={chosen} onChange={()=>{setError("");setDestinations(current=>{const next={...current};if(chosen)delete next[task.id];else next[task.id]=tomorrow;return next;});}}/><span><strong>{task.title}</strong><small>{task.time?`${task.time} · `:""}{task.category}{task.repeat!=="none"&&<><Repeat2 size={10}/>{t("Только это выполнение")}</>}</small></span></label>{chosen&&<label className="recap-transfer-date"><span>{t("На какой день")}</span><input type="date" aria-label={t("Дата переноса: {title}",{title:task.title})} min={tomorrow} required value={destinations[task.id]} onChange={event=>{const value=event.target.value;setDestinations(current=>({...current,[task.id]:value}));setError("");}}/></label>}</div>;})}</div>
                <div className="recap-selection-note"><span>{selected.length?t("{count} {tasks} выбрано для переноса",{count:selected.length,tasks:t(taskWord(selected.length))}):t("Можно оставить всё на прежних датах")}</span>{selected.length>0&&<button onClick={()=>setDestinations({})}>{t("Снять выбор")}</button>}</div>
                <p className="recap-field-note">{t("Перенос применится только после подтверждения в конце. Остальные дела останутся в плане.")}</p>
              </>:<div className="recap-nothing-left"><CheckCheck size={32} strokeWidth={1.3}/><h2>{summary.tasks.total?t("Всё запланированное завершено"):t("Сегодня без незавершённых задач")}</h2><p>{t("Можно перейти к впечатлениям о дне.")}</p></div>)}
              {step===2&&<>
                <div className="recap-reflection"><div className="recap-rating-panel"><BasicRating value={rating} onValueChange={setRating} label={t("Ваша оценка дня")}/><p className="recap-field-note">{t("Можно оставить день без оценки.")}</p></div><label className="recap-note-field"><span>{t("Несколько слов о дне")}</span><textarea aria-label={t("Несколько слов о дне")} rows={5} maxLength={2000} value={note} onChange={event=>setNote(event.target.value)} placeholder={t("Что запомнилось? Что удалось? Что хочется оставить в этом дне?")}/><small>{note.length} / 2000</small></label></div>
                <section className="recap-confirmation" aria-labelledby="recap-confirm-title"><div className="recap-confirm-copy"><span className="recap-confirm-icon"><Moon size={18}/></span><h2 id="recap-confirm-title">{closed?t("Дополнить этот день"):t("Готовы закрыть день?")}</h2><p>{closed?t("Обновятся только оценка и заметка. Сохранённые результаты и планы останутся прежними."):selected.length?t("{count} {tasks} {move}. Оценка и заметка сохранятся вместе с результатами.",{count:selected.length,tasks:t(taskWord(selected.length)),move:t(taskWord(selected.length)==="дело"?"перейдёт на выбранную дату":"перейдут на выбранные даты")}):t("Оценка и заметка сохранятся вместе с результатами. К этому дню можно будет вернуться.")}</p></div>{closed?<Button className="recap-save-edit" disabled={!ready} onClick={commit}><Check size={15}/>{t("Сохранить изменения")}</Button>:<HoldToConfirm key={confirmationAttempt} onConfirm={commit} disabled={!ready} label={t("Удерживайте, чтобы закрыть день")} confirmedLabel={t("День закрыт")}/>}</section>
              </>}
            </motion.div>
            {error&&<p className="recap-error" role="alert">{error}</p>}
            <footer className="recap-step-footer"><Button variant="ghost" onClick={step===0?onClose:back}><ArrowLeft size={14}/>{step===0?t("Вернуться"):t("Назад")}</Button>{step<2?<Button onClick={advance}>{t("Продолжить")}<ArrowRight size={14}/></Button>:<span>{t("Изменения сохранятся после подтверждения")}</span>}</footer>
          </main>
        </div>}
      </div>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal></DialogPrimitive.Root>;
}
