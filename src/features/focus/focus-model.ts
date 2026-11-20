import { z } from "zod";
import { dateSchema, dayKey, taskDone, taskOnDate, type Task } from "@/lib/domain";

const MINUTE=60_000;
const sessionSchema=z.object({
  version:z.literal(1), scope:z.string().min(1).max(150), taskId:z.string().min(1).max(100), occurrenceDate:dateSchema,
  durationMs:z.number().int().min(5*MINUTE).max(120*MINUTE),
  remainingMs:z.number().finite().min(0).max(120*MINUTE),
  phase:z.enum(["waiting","running","paused","finished"]),
  startedAt:z.number().finite().nonnegative().nullable(), scheduledAt:z.number().finite().nonnegative().nullable(),
  createdAt:z.number().finite().nonnegative(),
});
export type FocusSession=z.infer<typeof sessionSchema>;
export function focusTaskEligible(task:Task|undefined,date:string):task is Task {
  return !!task && taskOnDate(task,date) && !taskDone(task,date);
}
export function scheduledTaskTime(task:Task,date:string):number|null {
  if(!task.time)return null;
  const timestamp=new Date(`${date}T${task.time}:00`).getTime();
  return Number.isFinite(timestamp)?timestamp:null;
}
export function createFocusSession({scope,task,occurrenceDate,minutes,now,mode}:{scope:string;task:Task;occurrenceDate:string;minutes:number;now:number;mode:"now"|"wait"}):FocusSession {
  if(occurrenceDate!==dayKey(new Date(now)) || !focusTaskEligible(task,occurrenceDate))throw new Error("Выберите незавершённую задачу на сегодня.");
  const scheduledAt=scheduledTaskTime(task,occurrenceDate);
  if(mode==="wait" && (scheduledAt===null||scheduledAt<=now))throw new Error("Время начала этой задачи уже наступило.");
  return sessionSchema.parse({version:1,scope,taskId:task.id,occurrenceDate,durationMs:minutes*MINUTE,remainingMs:minutes*MINUTE,phase:mode==="wait"?"waiting":"running",startedAt:mode==="now"?now:null,scheduledAt:mode==="wait"?scheduledAt:null,createdAt:now});
}
export function focusRemaining(session:FocusSession,now:number):number {
  if(session.phase==="finished")return 0;
  if(session.phase==="waiting")return Math.max(0,(session.scheduledAt??now)-now);
  if(session.phase==="paused")return session.remainingMs;
  return Math.max(0,session.remainingMs-Math.max(0,now-(session.startedAt??now)));
}
export function settleFocusSession(session:FocusSession,now:number):FocusSession {
  return session.phase==="running" && focusRemaining(session,now)<=0 ? {...session,phase:"finished",remainingMs:0,startedAt:null}:session;
}
export function pauseFocusSession(session:FocusSession,now:number):FocusSession {
  if(session.phase!=="running")return session;
  const settled=settleFocusSession(session,now);
  return settled.phase==="finished"?settled:{...session,phase:"paused",remainingMs:focusRemaining(session,now),startedAt:null};
}
export function resumeFocusSession(session:FocusSession,now:number):FocusSession {
  return session.phase==="paused"||session.phase==="waiting"?{...session,phase:"running",startedAt:now,scheduledAt:null}:session;
}
export function restoreFocusSession(raw:string|null,scope:string,tasks:Task[],now:number):FocusSession|null {
  if(!raw)return null;
  try {
    const session=sessionSchema.parse(JSON.parse(raw));
    if(session.scope!==scope||session.createdAt>now||now-session.createdAt>24*60*MINUTE||session.remainingMs>session.durationMs)return null;
    const task=tasks.find(task=>task.id===session.taskId);
    if(!focusTaskEligible(task,session.occurrenceDate))return null;
    if(session.phase==="waiting"&&scheduledTaskTime(task,session.occurrenceDate)!==session.scheduledAt)return null;
    if(session.phase==="running" && (session.startedAt===null||session.startedAt<session.createdAt||session.startedAt>now))return null;
    if(session.phase==="waiting" && (session.scheduledAt===null||session.scheduledAt<session.createdAt||session.startedAt!==null||session.remainingMs!==session.durationMs))return null;
    if((session.phase==="paused"||session.phase==="finished")&&session.startedAt!==null)return null;
    if(session.phase==="finished"&&session.remainingMs!==0)return null;
    if(session.phase==="paused"&&session.remainingMs===0)return null;
    return settleFocusSession(session,now);
  }catch{return null;}
}
export function focusStorageKey(scope:string):string {return `day-focus-v1:${scope}`;}
export function formatFocusTime(ms:number):string {
  const total=Math.max(0,Math.ceil(ms/1000));
  const hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60),seconds=total%60;
  return hours?`${hours}:${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`:`${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;
}
