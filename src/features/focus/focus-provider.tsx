"use client";

import { useI18n } from "@/components/i18n-provider";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Crosshair, Pause, Play, Plus, Square, Timer } from "lucide-react";
import { useDay } from "@/components/day-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { dayKey, type Task } from "@/lib/domain";
import { createFocusSession, focusRemaining, focusStorageKey, focusTaskEligible, formatFocusTime, pauseFocusSession, restoreFocusSession, resumeFocusSession, scheduledTaskTime, settleFocusSession, type FocusSession } from "./focus-model";
import "./focus.css";

type FocusContextValue={session:FocusSession|null;task:Task|undefined;now:number;launch:(task?:Task,date?:string)=>void;pause:()=>void;resume:()=>void;end:()=>void;complete:()=>void;};
const FocusContext=createContext<FocusContextValue|null>(null);
function useFocus(){const context=useContext(FocusContext);if(!context)throw new Error("FocusLauncher needs FocusProvider");return context;}

export function FocusProvider({children}:{children:ReactNode}) {
  const { t } = useI18n();
  const {data,ready,user,toggleTask,notify,openModal}=useDay();
  const scope=user?.id??"guest";
  const [stored,setStored]=useState<{scope:string;session:FocusSession|null}|null>(null);
  const [dialog,setDialog]=useState<{scope:string;taskId?:string}|null>(null);
  const [now,setNow]=useState(0);
  const restoredScope=useRef<string|null>(null);
  const storageWarning=useRef(false);
  const finishedNotice=useRef("");
  const session=ready&&stored?.scope===scope?stored.session:null;
  const dialogOpen=dialog?.scope===scope;
  const task=session?data.tasks.find(item=>item.id===session.taskId):undefined;

  useEffect(()=>{
    if(!ready||restoredScope.current===scope)return;
    restoredScope.current=scope;
    storageWarning.current=false;
    finishedNotice.current="";
    setDialog(null);
    const timestamp=Date.now();setNow(timestamp);
    try{setStored({scope,session:restoreFocusSession(localStorage.getItem(focusStorageKey(scope)),scope,data.tasks,timestamp)});}
    catch{setStored({scope,session:null});}
  },[scope,ready,data.tasks]);

  useEffect(()=>{
    if(!ready||stored?.scope!==scope)return;
    try{
      if(stored.session)localStorage.setItem(focusStorageKey(scope),JSON.stringify(stored.session));
      else localStorage.removeItem(focusStorageKey(scope));
    }catch{
      if(!storageWarning.current){storageWarning.current=true;notify(t("Не удалось сохранить таймер"),{kind:"error",description:t("Он продолжит работать в этой вкладке.")});}
    }
  },[stored,scope,ready,notify,t]);

  useEffect(()=>{
    if(!session)return;
    if(!focusTaskEligible(task,session.occurrenceDate)||(session.phase==="waiting"&&scheduledTaskTime(task,session.occurrenceDate)!==session.scheduledAt)){
      setStored({scope,session:null});setDialog(null);
    }
  },[session,task,scope]);

  useEffect(()=>{
    if(!ready)return;
    const refresh=()=>{
      const timestamp=Date.now();setNow(timestamp);
      setStored(current=>{
        if(current?.scope!==scope||!current.session)return current;
        const next=settleFocusSession(current.session,timestamp);
        return next===current.session?current:{...current,session:next};
      });
    };
    const timer=dialogOpen||session?.phase==="running"||session?.phase==="waiting"?window.setInterval(refresh,1000):undefined;
    document.addEventListener("visibilitychange",refresh);
    window.addEventListener("focus",refresh);
    return()=>{if(timer!==undefined)window.clearInterval(timer);document.removeEventListener("visibilitychange",refresh);window.removeEventListener("focus",refresh);};
  },[scope,ready,session?.phase,dialogOpen]);

  useEffect(()=>{
    if(!ready)return;
    const receive=(event:StorageEvent)=>{
      if(event.key!==focusStorageKey(scope))return;
      const timestamp=Date.now();setNow(timestamp);
      setStored({scope,session:restoreFocusSession(event.newValue,scope,data.tasks,timestamp)});
    };
    window.addEventListener("storage",receive);
    return()=>window.removeEventListener("storage",receive);
  },[ready,scope,data.tasks]);

  useEffect(()=>{
    if(session?.phase!=="finished")return;
    const identity=`${scope}:${session.taskId}:${session.createdAt}`;
    if(finishedNotice.current===identity)return;
    finishedNotice.current=identity;notify(t("Время фокуса завершено"),{kind:"info",description:t("Подведите итог, когда будете готовы."),action:{label:t("Открыть фокус"),onClick:()=>setDialog({scope,taskId:session.taskId})}});
  },[session,scope,notify,t]);

  function launch(selected?:Task,date?:string){
    if(!ready||stored?.scope!==scope)return;
    const timestamp=Date.now();setNow(timestamp);
    const today=dayKey(new Date(timestamp));
    const selectedDate=date??today;
    const eligible=selectedDate===today&&focusTaskEligible(selected,selectedDate);
    setDialog({scope,taskId:session?.taskId??(eligible?selected?.id:undefined)});
  }
  function pause(){if(session){const timestamp=Date.now();setNow(timestamp);setStored({scope,session:pauseFocusSession(session,timestamp)});}}
  function resume(){if(session&&focusTaskEligible(task,session.occurrenceDate)){const timestamp=Date.now();setNow(timestamp);setStored({scope,session:resumeFocusSession(session,timestamp)});}}
  function end(){setStored({scope,session:null});setDialog(null);}
  function complete(){
    if(!session||session.phase==="waiting"||!focusTaskEligible(task,session.occurrenceDate))return;
    toggleTask(session.taskId,session.occurrenceDate);end();
  }
  function start(selected:Task,minutes:number,mode:"now"|"wait"){
    const timestamp=Date.now();
    try{const next=createFocusSession({scope,task:selected,occurrenceDate:dayKey(new Date(timestamp)),minutes,now:timestamp,mode});setNow(timestamp);setStored({scope,session:next});}
    catch(error){notify(error instanceof Error?t(error.message):t("Не удалось начать фокус."),{kind:"error"});}
  }
  return <FocusContext.Provider value={{session,task,now,launch,pause,resume,end,complete}}>
    {children}
    <FocusDock/>
    {dialog?.scope===scope&&<FocusDialog key={`${scope}:${dialog.taskId??"choose"}`} taskId={dialog.taskId} tasks={data.tasks} onClose={()=>setDialog(null)} onStart={start} onAdd={()=>{setDialog(null);openModal({type:"task"});}}/>}
  </FocusContext.Provider>;
}

export function FocusLauncher({task,occurrenceDate,className}:{task?:Task;occurrenceDate?:string;className?:string}) {
  const { t } = useI18n();
  const {launch,session}=useFocus();
  const {ready}=useDay();
  return <Button variant="secondary" className={`focus-launcher ${className??""}`} disabled={!ready} onClick={()=>launch(task,occurrenceDate)}><Crosshair size={15}/>{session?t("К фокусу"):t("Фокус")}</Button>;
}

export function FocusDock(){
  const { t } = useI18n();
  const {session,task,now,launch,pause,resume}=useFocus();
  if(!session||!task)return null;
  const waiting=session.phase==="waiting",paused=session.phase==="paused",finished=session.phase==="finished";
  const status=waiting?focusRemaining(session,now)>0?t("До начала"):t("Можно начинать"):paused?t("На паузе"):finished?t("Фокус завершён"):t("В фокусе");
  return <aside className="focus-dock" aria-label={t("Текущий фокус")}>
    <button className="focus-dock-open" aria-label={t("Открыть фокус: {title}",{title:task.title})} onClick={()=>launch()}><span className="focus-dock-icon"><Crosshair size={19}/></span><span className="focus-dock-copy"><small>{status}</small><strong>{task.title}</strong></span><span className="focus-dock-time" aria-hidden="true">{formatFocusTime(focusRemaining(session,now))}</span></button>
    {session.phase==="running"?<button className="focus-dock-control" onClick={pause} aria-label={t("Поставить фокус на паузу")}><Pause size={17}/></button>:paused?<button className="focus-dock-control" onClick={resume} aria-label={t("Продолжить фокус")}><Play size={17}/></button>:null}
  </aside>;
}

function FocusDialog({taskId,tasks,onClose,onStart,onAdd}:{taskId?:string;tasks:Task[];onClose:()=>void;onStart:(task:Task,minutes:number,mode:"now"|"wait")=>void;onAdd:()=>void;}){
  const { t } = useI18n();
  const {session,task,now,pause,resume,end,complete}=useFocus();
  const today=dayKey(new Date(now));
  const available=tasks.filter(item=>focusTaskEligible(item,today));
  const [selectedId,setSelectedId]=useState(taskId??available[0]?.id??"");
  const [minutes,setMinutes]=useState(25);
  const [confirmEnd,setConfirmEnd]=useState(false);
  const selected=available.find(item=>item.id===selectedId)??available[0];
  const scheduledAt=selected?scheduledTaskTime(selected,today):null;
  const canWait=scheduledAt!==null&&scheduledAt>now;
  const remaining=session?focusRemaining(session,now):0;
  const waiting=session?.phase==="waiting",finished=session?.phase==="finished",paused=session?.phase==="paused";
  const progress=session&&!waiting?Math.min(100,Math.max(0,(1-remaining/session.durationMs)*100)):0;
  const durationValid=Number.isInteger(minutes)&&minutes>=5&&minutes<=120;
  return <Dialog open onClose={onClose} title={t("Фокус")} description={t("Одно дело. Немного пространства для внимания.")}>
    <div className="focus-dialog">
      {session&&task?<>
        <p className="focus-eyebrow">{waiting?remaining>0?t("До начала задачи"):t("Можно начинать"):finished?t("Время фокуса завершено"):paused?t("Небольшая пауза"):t("Только это дело")}</p>
        <h3 className="focus-task-title">{task.title}</h3>
        <div className="focus-clock" role="timer" aria-label={waiting?t("Время до начала задачи"):t("Оставшееся время фокуса")} aria-live="off">{formatFocusTime(remaining)}</div>
        <div className="focus-progress" aria-hidden="true"><span style={{width:`${progress}%`}}/></div>
        <p className="focus-description">{waiting?t("Когда наступит время, нажмите «Начать сейчас». Таймер фокуса запустится по вашему решению."):finished?t("Можно завершить задачу или оставить её в плане. Решение за вами."):paused?t("Таймер остановлен. Продолжите, когда будете готовы."):t("{minutes} минут для одного дела. Остальное подождёт.",{minutes:session.durationMs/60_000})}</p>
        {confirmEnd?<div className="focus-end-confirm"><p>{t("Закончить эту сессию? Задача останется в плане.")}</p><div className="focus-actions"><Button onClick={end}>{t("Закончить сессию")}</Button><Button variant="secondary" onClick={()=>setConfirmEnd(false)}>{t("Остаться")}</Button></div></div>:<div className="focus-actions">
          {finished?<><Button onClick={complete}><Check size={15}/>{t("Завершить задачу")}</Button><Button variant="secondary" onClick={end}>{t("Оставить в плане")}</Button></>:<>
            <Button onClick={session.phase==="running"?pause:resume}>{session.phase==="running"?<Pause size={15}/>:<Play size={15}/>} {waiting?t("Начать сейчас"):paused?t("Продолжить"):t("Пауза")}</Button>
            {!waiting&&<Button variant="secondary" onClick={complete}><Check size={15}/>{t("Задача готова")}</Button>}
            <Button variant="ghost" onClick={()=>setConfirmEnd(true)}><Square size={13}/>{t("Закончить")}</Button>
          </>}
        </div>}
      </>:available.length?<>
        <div className="focus-setup-mark" aria-hidden="true"><Crosshair size={27} strokeWidth={1.3}/></div>
        <label className="focus-label" htmlFor="focus-task">{t("На чём сосредоточимся?")}</label>
        <select id="focus-task" value={selected?.id??""} onChange={event=>setSelectedId(event.target.value)} className="focus-select">{available.map(item=><option key={item.id} value={item.id}>{item.time?`${item.time} · `:""}{item.title}</option>)}</select>
        <fieldset className="focus-duration"><legend>{t("Время для фокуса")}</legend><div className="focus-duration-options">{[15,25,45].map(value=><button key={value} type="button" aria-pressed={minutes===value} onClick={()=>setMinutes(value)}>{value} {t("мин")}</button>)}<label><input aria-label={t("Длительность фокуса в минутах")} type="number" aria-invalid={!durationValid} min={5} max={120} step={1} value={Number.isNaN(minutes)?"":minutes} onChange={event=>setMinutes(event.target.value===""?NaN:Number(event.target.value))}/><span>{t("мин")}</span></label></div><p>{durationValid?t("От 5 до 120 минут. Выберите комфортный отрезок."):t("Укажите целое число от 5 до 120 минут.")}</p></fieldset>
        {canWait&&<div className="focus-before-start"><Timer size={17}/><span>{t("До задачи в")} {selected.time}<strong>{formatFocusTime(scheduledAt-now)}</strong></span></div>}
        <div className="focus-actions"><Button disabled={!durationValid||!selected} onClick={()=>selected&&onStart(selected,minutes,"now")}><Play size={15}/>{t("Начать фокус")}</Button>{canWait&&<Button variant="secondary" disabled={!durationValid} onClick={()=>selected&&onStart(selected,minutes,"wait")}>{t("Ждать до")} {selected.time}</Button>}</div>
        <p className="focus-local-note">{t("Таймер сохранится на этом устройстве. Задача завершится только по вашему нажатию.")}</p>
      </>:<div className="focus-empty"><Crosshair size={30} strokeWidth={1.2}/><h3>{t("Начните с одного дела")}</h3><p>{t("Добавьте задачу на сегодня, затем выделите для неё время без переключений.")}</p><Button onClick={onAdd}><Plus size={15}/>{t("Добавить задачу")}</Button></div>}
    </div>
  </Dialog>;
}
