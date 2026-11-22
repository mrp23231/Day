"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { User, AuthChangeEvent, Session } from "@supabase/supabase-js";
import { WifiOff } from "lucide-react";
import { appDataSchema, dayKey, emptyData, readSavedData, waterSchema, type AppData, type ModalState, type Preferences } from "@/lib/domain";
import { I18nProvider } from "./i18n-provider";
import { getTranslator } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase/client";
import { Balloons, type BalloonsHandle } from "@/components/ui/balloons";
import { shouldCelebrateTasks } from "@/lib/completion";
import { useAppearance } from "@/features/appearance/use-appearance";
import type { ThemeMode, ThemeRevealOrigin } from "@/components/ui/theme-toggle";
import { canRestoreCloud, currentCloudOperation, recoveryRequested } from "@/lib/state-policy";
import { decodeCloudState, encodeCloudState, hasPendingCloudPhotos, prepareAutomaticCloudRestoreData, prepareCloudRestoreData } from "@/lib/cloud-state";
import { parseBackup, prepareExportData, prepareImportedData } from "@/lib/backup";
import { withNetworkDeadline } from "@/lib/network-deadline";
import { clearPhotoScope } from "@/lib/personalization";
import { isCloudConflict, type CloudStatus } from "@/lib/cloud-sync";
import DingToast from "@/components/ui/ding-toast";
import { dismissNotifications, showNotification, type NotifyOptions } from "@/lib/notifications";

type DayContextType={ data:AppData; update:(fn:(data:AppData)=>AppData,options?:{persist?:boolean;scope?:string;resetVersion?:number})=>AppData; ready:boolean; authReady:boolean; resetVersion:number; date:string; setDate:(date:string)=>void; modal:ModalState; openModal:(modal:ModalState)=>void; closeModal:()=>void; notify:(message:string,options?:NotifyOptions)=>void; addWater:(amount:number)=>void; toggleTask:(id:string,date?:string)=>void; toggleHabit:(id:string,date?:string)=>void; setPreferences:(p:Partial<Preferences>)=>void; resolvedTheme:ThemeMode; setTheme:(theme:Preferences["theme"],origin?:ThemeRevealOrigin)=>void; user:User|null; syncCloud:()=>Promise<void>; restoreCloud:()=>Promise<void>; syncing:boolean; cloudStatus:CloudStatus; exportData:()=>void; importData:(incoming:AppData)=>void; exportPreviousData:()=>void; hasLocalBackup:boolean; resetData:()=>void; storageError:string; };
const Context=createContext<DayContextType|null>(null);
const GUEST_KEY="day-data-v1";
export function DayProvider({children}:{children:ReactNode}) {
  const [data,setDataState]=useState<AppData>(emptyData);
  const currentData=useRef(data);
  const setData=useCallback((next:AppData)=>{currentData.current=next;setDataState(next);},[]);
  const [ready,setReady]=useState(false);
  const [authReady,setAuthReady]=useState(false);
  const [resetVersion,setResetVersion]=useState(0);
  const resetEpoch=useRef(0);
  const [date,setDate]=useState("");
  const [modal,openModal]=useState<ModalState>(null);
  const [offline,setOffline]=useState(false);
  const [storageError,setStorageError]=useState("");
  const [hasLocalBackup,setHasLocalBackup]=useState(false);
  const [user,setUser]=useState<User|null>(null);
  const [syncing,setSyncing]=useState(false);
  const [cloudStatus,setCloudStatus]=useState<CloudStatus>("local");
  const [cloudPulse,setCloudPulse]=useState(0);
  const dirty=useRef(false);
  const cloudConflict=useRef(false);
  const cloudResetPending=useRef(false);
  const baselineKnown=useRef(false);
  const saving=useRef<{scope:string;generation:number;promise:Promise<void>}|null>(null);
  const pulling=useRef<{scope:string;generation:number;promise:Promise<void>}|null>(null);
  const cloudActions=useRef<{save:(manual?:boolean)=>Promise<void>;pull:()=>Promise<void>}>({save:async()=>{},pull:async()=>{}});
  const [storageScope,setStorageScope]=useState(GUEST_KEY);
  const scope=useRef(GUEST_KEY);
  const generation=useRef(0);
  const mutation=useRef(0);
  const revision=useRef(0);
  const blocked=useRef(false);
  const balloons=useRef<BalloonsHandle>(null);
  const celebrated=useRef(new Set<string>());
  const notify=useCallback((message:string,options?:NotifyOptions)=>{const t=getTranslator(currentData.current.preferences.language);showNotification(t(message),options?{...options,description:options.description?t(options.description):undefined,action:options.action?{...options.action,label:t(options.action.label)}:undefined}:undefined,currentData.current.preferences.language);},[]);
  const closeModal=useCallback(()=>openModal(null),[]);
  useEffect(()=>{
    setDate(dayKey());
    try { const raw=localStorage.getItem(GUEST_KEY); if(raw)setData(readSavedData(raw)); setHasLocalBackup(!!localStorage.getItem(`${GUEST_KEY}:backup`)); }
    catch(error){blocked.current=true;setStorageError(error instanceof Error?error.message:"Хранилище недоступно. Экспортируйте данные перед закрытием.");}
    setReady(true);
    setOffline(!navigator.onLine);
    const online=()=>setOffline(!navigator.onLine);
    window.addEventListener("online",online);window.addEventListener("offline",online);
    const midnight=setInterval(()=>setDate(current=>current===dayKey(new Date(Date.now()-60000))?dayKey():current),60000);
    if(process.env.NODE_ENV==="production"&&"serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});
    return ()=>{window.removeEventListener("online",online);window.removeEventListener("offline",online);clearInterval(midnight);};
  },[setData]);
  useEffect(()=>()=>dismissNotifications(),[]);
  useEffect(()=>{
    if(!ready||blocked.current||storageScope!==scope.current)return;
    try { localStorage.setItem(storageScope,JSON.stringify(currentData.current)); } catch { setStorageError("Не хватает места для сохранения. Экспортируйте данные в настройках."); }
  },[data,ready,storageScope]);
  useEffect(()=>{
    const client=getSupabase();if(!client){setAuthReady(true);return;}
    let active=true;
    const {data:{subscription}}=client.auth.onAuthStateChange((_event:AuthChangeEvent,session:Session|null)=>{
      if(!active)return;
      setUser(session?.user??null);
      const recovery=_event==="PASSWORD_RECOVERY"||recoveryRequested(window.location.href,!!session?.user);
      const nextScope=session?.user?`day-user-${session.user.id}`:GUEST_KEY;
      if(nextScope===scope.current){if(!session?.user)setAuthReady(true);if(recovery)openModal({type:"auth"});return;}
      setAuthReady(!session?.user);
      dismissNotifications();scope.current=nextScope;generation.current++;mutation.current=0;revision.current=0;dirty.current=false;baselineKnown.current=false;cloudConflict.current=false;cloudResetPending.current=false;blocked.current=false;setStorageError("");setSyncing(false);setCloudStatus(session?.user?"pending":"local");setStorageScope(nextScope);openModal(recovery?{type:"auth"}:null);
      setHasLocalBackup(false);
      try{
        setHasLocalBackup(!!localStorage.getItem(`${nextScope}:backup`));
        const raw=localStorage.getItem(nextScope);
        setData(raw?readSavedData(raw):{...emptyData(),preferences:{...emptyData().preferences,language:currentData.current.preferences.language}});
        const storedRevision=Number(localStorage.getItem(`${nextScope}:revision`)||0);
        revision.current=Number.isSafeInteger(storedRevision)&&storedRevision>=0?storedRevision:0;
        // Pre-autosync account copies may contain unsaved changes. Preserve them.
        dirty.current=!!session?.user&&(localStorage.getItem(`${nextScope}:dirty`)==="1"||!!raw&&localStorage.getItem(`${nextScope}:dirty`)===null);
        cloudResetPending.current=!!session?.user&&localStorage.getItem(`${nextScope}:reset-pending`)==="1";
        cloudConflict.current=cloudResetPending.current;
      }catch{blocked.current=true;setStorageError("Не удалось прочитать сохранённые записи этого аккаунта.");setData(emptyData());}
      const started={scope:nextScope,generation:generation.current,mutation:mutation.current};
      if(session?.user)setTimeout(async()=>{
        if(!active||!currentCloudOperation(started,{scope:scope.current,generation:generation.current,mutation:mutation.current}))return;
        await cloudActions.current.pull();
        if(active&&currentCloudOperation(started,{scope:scope.current,generation:generation.current,mutation:mutation.current}))setAuthReady(true);
      },0);
    });
    const invalidate=()=>{generation.current++;};
    return()=>{active=false;invalidate();subscription.unsubscribe();};
  },[setData]);
  const update=useCallback((fn:(data:AppData)=>AppData,options?:{persist?:boolean;scope?:string;resetVersion?:number}):AppData=>{
    if(options?.scope!==undefined&&options.scope!==scope.current||options?.resetVersion!==undefined&&options.resetVersion!==resetEpoch.current)throw new Error(getTranslator(currentData.current.preferences.language)("Пространство изменилось. Выберите файл для текущего аккаунта заново."));
    const next=appDataSchema.parse(fn(currentData.current));
    if(options?.persist&&blocked.current)throw new Error(getTranslator(currentData.current.preferences.language)("Не удалось прочитать сохранённые данные. Исходная копия сохранена; экспортируйте её перед сбросом."));
    // Write the pending marker before primary data, so a reload never mistakes unsaved work for a clean copy.
    try{if(scope.current!==GUEST_KEY)localStorage.setItem(`${scope.current}:dirty`,"1");if(options?.persist)localStorage.setItem(scope.current,JSON.stringify(next));}
    catch{if(options?.persist)throw new Error(getTranslator(currentData.current.preferences.language)("Не хватает места для сохранения. Экспортируйте данные в настройках."));setStorageError("Не хватает места для сохранения. Экспортируйте данные в настройках.");}
    if(scope.current!==GUEST_KEY){dirty.current=true;setCloudStatus(!navigator.onLine?"offline":cloudConflict.current?"conflict":"pending");}
    mutation.current++;setData(next);return next;
  },[setData]);
  function addWater(amount:number){const entry=waterSchema.parse({id:crypto.randomUUID(),date:date||dayKey(),amount,time:new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})});update(d=>({...d,water:[...d.water,entry]}));notify(getTranslator(currentData.current.preferences.language)("Добавлено {amount} мл воды",{amount}),{action:{label:"Отменить",onClick:()=>{update(d=>({...d,water:d.water.filter(item=>item.id!==entry.id)}));}}});}
  function toggleTask(id:string,target=date||dayKey()){
    const celebrate=shouldCelebrateTasks(data.tasks,id,target,dayKey());
    update(d=>({...d,tasks:d.tasks.map(t=>t.id!==id?t:{...t,completedDates:t.completedDates.includes(target)?t.completedDates.filter(v=>v!==target):[...t.completedDates,target]})}));
    const key=`${scope.current}:${target}`;
    if(celebrate&&!celebrated.current.has(key)){
      celebrated.current.add(key);
      notify("Все задачи на сегодня выполнены. Отличная работа!");
      void balloons.current?.launchAnimation();
    }
  }
  function toggleHabit(id:string,target=date){update(d=>({...d,habits:d.habits.map(h=>h.id!==id?h:{...h,completions:h.completions.includes(target)?h.completions.filter(v=>v!==target):[...h.completions,target]})}));}
  function setPreferences(p:Partial<Preferences>){update(d=>({...d,preferences:{...d.preferences,...p}}));}
  const {resolvedTheme,setTheme}=useAppearance(data.preferences,ready,setPreferences);
  async function pullCloud(){
    const client=getSupabase();if(!client||scope.current===GUEST_KEY||blocked.current)return;
    const started={scope:scope.current,generation:generation.current,mutation:mutation.current};
    if(pulling.current&&currentCloudOperation(started,{...pulling.current,mutation:0}))return pulling.current.promise;
    if(saving.current&&currentCloudOperation(started,{...saving.current,mutation:0}))return;
    if(!navigator.onLine){setCloudStatus("offline");return;}
    const operation=Promise.resolve().then(async()=>{
      try{
        const {data:remote,error}=await withNetworkDeadline(client.rpc("load_day_state"));
        const current={scope:scope.current,generation:generation.current,mutation:mutation.current};
        if(!currentCloudOperation(started,current))return;
        if(error)throw error;
        const remoteRevision=remote?.revision??0;
        if(!Number.isSafeInteger(remoteRevision)||remoteRevision<0)throw new Error("Invalid cloud revision");
        baselineKnown.current=true;
        if(cloudResetPending.current){
          if(remote){cloudConflict.current=true;setCloudStatus("conflict");return;}
          // An empty account has no remote records for a local reset to erase.
          localStorage.setItem(`${started.scope}:reset-pending`,"0");cloudResetPending.current=false;cloudConflict.current=false;
        }
        if(dirty.current||started.mutation!==mutation.current){
          if(remoteRevision!==revision.current){cloudConflict.current=true;setCloudStatus("conflict");}
          else{cloudConflict.current=false;setCloudStatus("pending");}
          return;
        }
        if(remote&&remoteRevision>revision.current){
          const validated=prepareAutomaticCloudRestoreData(decodeCloudState(remote.data),currentData.current);
          // Commit before exposing a remote state; keep the local source if quota or validation fails.
          const revisionKey=`${started.scope}:revision`,dirtyKey=`${started.scope}:dirty`;
          const previousRevision=localStorage.getItem(revisionKey),previousDirty=localStorage.getItem(dirtyKey);
          try{localStorage.setItem(revisionKey,String(remoteRevision));localStorage.setItem(dirtyKey,"0");localStorage.setItem(started.scope,JSON.stringify(validated));}
          catch(error){
            if(previousRevision===null)localStorage.removeItem(revisionKey);else localStorage.setItem(revisionKey,previousRevision);
            if(previousDirty===null)localStorage.removeItem(dirtyKey);else localStorage.setItem(dirtyKey,previousDirty);
            throw error;
          }
          revision.current=remoteRevision;setData(validated);
        }
        cloudConflict.current=false;setStorageError("");setCloudStatus(hasPendingCloudPhotos(currentData.current)?"pending":"saved");
      }catch{
        if(currentCloudOperation(started,{scope:scope.current,generation:generation.current,mutation:mutation.current})){
          setCloudStatus(navigator.onLine?"error":"offline");setStorageError("Облако недоступно. Записи сохраняются только на этом устройстве.");
        }
      }finally{if(pulling.current?.promise===operation)pulling.current=null;}
    });
    pulling.current={...started,promise:operation};return operation;
  }
  async function saveCloud(manual=false){
    const client=getSupabase();if(!client||scope.current===GUEST_KEY){if(manual)openModal({type:"auth"});return;}
    if(blocked.current)return;
    const started={scope:scope.current,generation:generation.current,mutation:mutation.current};
    if(saving.current&&currentCloudOperation(started,{...saving.current,mutation:0}))return saving.current.promise;
    if(!navigator.onLine){setCloudStatus("offline");return;}
    if(!baselineKnown.current||pulling.current){await pullCloud();if(!currentCloudOperation(started,{scope:scope.current,generation:generation.current,mutation:mutation.current}))return;}
    if(saving.current&&currentCloudOperation(started,{...saving.current,mutation:0}))return saving.current.promise;
    if(!baselineKnown.current||cloudConflict.current||cloudResetPending.current){if(manual)notify("Сначала разрешите конфликт облачных копий",{kind:"error"});return;}
    if(!dirty.current&&!manual)return;
    const sentMutation=mutation.current;
    const payload=encodeCloudState(currentData.current);
    setSyncing(true);setCloudStatus("saving");
    const operation=Promise.resolve().then(async()=>{
      try{
        const {data:result,error}=await withNetworkDeadline(client.rpc("save_day_state",{payload,expected_revision:revision.current}));
        if(!currentCloudOperation(started,{scope:scope.current,generation:generation.current,mutation:mutation.current}))return;
        if(error)throw error;
        if(!Number.isSafeInteger(result)||result<0)throw new Error("Invalid cloud revision");
        // The revision belongs to the acknowledged request, even if another edit happened meanwhile.
        revision.current=result;localStorage.setItem(`${started.scope}:revision`,String(result));
        if(mutation.current===sentMutation){localStorage.setItem(started.scope,JSON.stringify(currentData.current));localStorage.setItem(`${started.scope}:dirty`,"0");dirty.current=false;}
        setStorageError("");setCloudStatus(dirty.current||hasPendingCloudPhotos(currentData.current)?"pending":"saved");
        if(manual)notify("Записи сохранены в облаке");
      }catch(error){
        if(currentCloudOperation(started,{scope:scope.current,generation:generation.current,mutation:mutation.current})){
          cloudConflict.current=isCloudConflict(error);setCloudStatus(cloudConflict.current?"conflict":navigator.onLine?"error":"offline");
          if(manual)notify("Не удалось сохранить в облаке",{kind:"error",description:"Возможен конфликт с другой копией. Экспортируйте локальные записи перед восстановлением облачной копии."});
        }
      }finally{
        if(saving.current?.promise===operation)saving.current=null;
        if(currentCloudOperation(started,{scope:scope.current,generation:generation.current,mutation:mutation.current})){
          setSyncing(false);
          // A later edit waits for this acknowledgement instead of racing a second save.
          if(dirty.current&&mutation.current!==sentMutation&&!cloudConflict.current)setCloudPulse(value=>value+1);
        }
      }
    });
    saving.current={...started,promise:operation};return operation;
  }
  useEffect(()=>{cloudActions.current={save:saveCloud,pull:pullCloud};});
  async function syncCloud(){await saveCloud(true);}
  useEffect(()=>{
    if(!user||!ready||!authReady||!dirty.current||blocked.current||cloudConflict.current)return;
    const timer=setTimeout(()=>{void cloudActions.current.save();},900);
    return()=>clearTimeout(timer);
  },[data,user,ready,authReady,storageScope,cloudPulse]);
  useEffect(()=>{
    const retry=()=>{
      if(document.visibilityState==="hidden"||scope.current===GUEST_KEY)return;
      void (async()=>{await cloudActions.current.pull();if(dirty.current&&!cloudConflict.current)await cloudActions.current.save();})();
    };
    window.addEventListener("online",retry);window.addEventListener("focus",retry);document.addEventListener("visibilitychange",retry);
    return()=>{window.removeEventListener("online",retry);window.removeEventListener("focus",retry);document.removeEventListener("visibilitychange",retry);};
  },[]);
  // Primary data is written last: a failed write leaves its previous value intact.
  // Earlier backup/revision writes are rolled back before callers change React state.
  function persistReplacement(next:AppData,nextRevision?:number,nextDirty=true){
    const key=scope.current,backupKey=`${key}:backup`,revisionKey=`${key}:revision`;
    const previous=blocked.current?localStorage.getItem(key):JSON.stringify(currentData.current);
    const previousBackup=localStorage.getItem(backupKey),previousRevision=localStorage.getItem(revisionKey),previousDirty=localStorage.getItem(`${key}:dirty`),previousReset=localStorage.getItem(`${key}:reset-pending`);
    if(!previous)throw new Error("Не удалось подготовить предыдущую копию.");
    try{
      localStorage.setItem(backupKey,previous);
      localStorage.setItem(`${key}:dirty`,nextDirty?"1":"0");
      localStorage.setItem(`${key}:reset-pending`,"0");
      if(nextRevision!==undefined)localStorage.setItem(revisionKey,String(nextRevision));
      localStorage.setItem(key,JSON.stringify(next));
    }catch(error){
      if(previousDirty===null)localStorage.removeItem(`${key}:dirty`);else localStorage.setItem(`${key}:dirty`,previousDirty);
      if(previousReset===null)localStorage.removeItem(`${key}:reset-pending`);else localStorage.setItem(`${key}:reset-pending`,previousReset);
      if(nextRevision!==undefined){if(previousRevision===null)localStorage.removeItem(revisionKey);else localStorage.setItem(revisionKey,previousRevision);}
      if(previousBackup===null)localStorage.removeItem(backupKey);else localStorage.setItem(backupKey,previousBackup);
      throw error;
    }
  }
  function finishReplacement(next:AppData,clean=false){
    dirty.current=scope.current!==GUEST_KEY&&!clean;cloudConflict.current=false;cloudResetPending.current=false;baselineKnown.current=true;setCloudStatus(scope.current===GUEST_KEY?"local":dirty.current||hasPendingCloudPhotos(next)?"pending":"saved");
    generation.current++;mutation.current++;blocked.current=false;dismissNotifications();setStorageError("");setSyncing(false);setAuthReady(true);setHasLocalBackup(true);setData(next);openModal(null);resetEpoch.current++;setResetVersion(resetEpoch.current);
  }
  async function restoreCloud(){
    const client=getSupabase();if(!client||!user||!authReady||viewGeneration!==generation.current||storageScope!==scope.current)return;
    const started={scope:scope.current,generation:generation.current,mutation:mutation.current};setSyncing(true);
    try{
      const {data:remote,error}=await withNetworkDeadline(client.rpc("load_day_state"));
      const current={scope:scope.current,generation:generation.current,mutation:mutation.current};
      if(!currentCloudOperation(started,current))return;
      if(error)throw error;
      if(!remote){notify("В облаке пока нет сохранённой копии",{kind:"info"});return;}
      if(!canRestoreCloud(started,current,false)){notify("Локальные записи изменились во время загрузки",{kind:"info",description:"Повторите восстановление."});return;}
      const validated=prepareCloudRestoreData(decodeCloudState(remote.data),currentData.current);
      if(!Number.isSafeInteger(remote.revision)||remote.revision<0)throw new Error("Некорректная ревизия");
      persistReplacement(validated,remote.revision,false);
      revision.current=remote.revision;finishReplacement(validated,true);
      notify("Облачная копия восстановлена. Предыдущую локальную копию можно скачать в настройках.");
    }catch{if(currentCloudOperation(started,{scope:scope.current,generation:generation.current,mutation:mutation.current}))notify("Не удалось восстановить облачную копию",{kind:"error",description:"Локальные записи сохранены. Проверьте сеть и свободное место на устройстве."});}
    finally{if(currentCloudOperation(started,{scope:scope.current,generation:generation.current,mutation:mutation.current}))setSyncing(false);}
  }
  const viewGeneration=generation.current;
  function downloadData(raw:string,name:string){const url=URL.createObjectURL(new Blob([raw],{type:"application/json"}));const anchor=document.createElement("a");anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function exportCopy(raw:string){try{return JSON.stringify(prepareExportData(readSavedData(raw)),null,2);}catch{return raw;}}
  function exportData(){try{const raw=blocked.current?localStorage.getItem(scope.current):null;downloadData(raw?exportCopy(raw):JSON.stringify(prepareExportData(currentData.current),null,2),`day-${dayKey()}.json`);}catch{notify("Не удалось экспортировать записи",{kind:"error"});}}
  function exportPreviousData(){try{if(viewGeneration!==generation.current||storageScope!==scope.current)throw new Error();const raw=localStorage.getItem(`${scope.current}:backup`);if(!raw)throw new Error();downloadData(exportCopy(raw),`day-before-restore-${dayKey()}.json`);}catch{notify("Предыдущая копия недоступна",{kind:"error"});}}
  function importData(incoming:AppData){
    if(viewGeneration!==generation.current||storageScope!==scope.current)throw new Error("Пространство изменилось. Выберите файл для текущего аккаунта заново.");
    if(!ready||!authReady)throw new Error("Подождите, пока загрузится ваше пространство.");
    const next=appDataSchema.parse(prepareImportedData(parseBackup(JSON.stringify(incoming)),currentData.current));
    try{persistReplacement(next);}catch{throw new Error("Не удалось сохранить резервную копию и новые записи. Освободите место; текущие данные сохранены.");}
    finishReplacement(next);notify("Записи восстановлены. Предыдущую копию можно скачать в настройках.");
  }
  function resetData(){
    const next=emptyData(),targetScope=scope.current;
    const guardCloud=targetScope!==GUEST_KEY&&(cloudResetPending.current||revision.current>0||!baselineKnown.current);
    let previousDirty:string|null=null,previousReset:string|null=null;
    try{previousDirty=localStorage.getItem(`${targetScope}:dirty`);previousReset=localStorage.getItem(`${targetScope}:reset-pending`);localStorage.setItem(`${targetScope}:dirty`,"0");localStorage.setItem(`${targetScope}:reset-pending`,guardCloud?"1":"0");localStorage.setItem(targetScope,JSON.stringify(next));}
    catch{try{if(previousDirty===null)localStorage.removeItem(`${targetScope}:dirty`);else localStorage.setItem(`${targetScope}:dirty`,previousDirty);if(previousReset===null)localStorage.removeItem(`${targetScope}:reset-pending`);else localStorage.setItem(`${targetScope}:reset-pending`,previousReset);}catch{}notify("Не удалось очистить записи. Текущие данные сохранены.",{kind:"error"});return;}
    generation.current++;mutation.current++;dirty.current=false;cloudConflict.current=guardCloud;cloudResetPending.current=guardCloud;blocked.current=false;dismissNotifications();setStorageError("");setSyncing(false);setCloudStatus(scope.current===GUEST_KEY?"local":guardCloud?"conflict":"saved");setAuthReady(true);
    try{localStorage.removeItem(`${targetScope}:backup`);setHasLocalBackup(false);}
    catch{setStorageError("Записи очищены, но не удалось удалить предыдущую резервную копию из браузера.");}
    setData(next);resetEpoch.current++;setResetVersion(resetEpoch.current);notify("Локальные записи очищены");
    const resetGeneration=generation.current;
    void clearPhotoScope(targetScope).then(()=>{if(generation.current===resetGeneration)notify("Локальные записи и фотографии удалены");}).catch(()=>{if(generation.current===resetGeneration)notify("Записи очищены, но не удалось очистить хранилище фото",{kind:"error"});});
  }

  return <Context.Provider value={{data,update,ready,authReady,resetVersion,date:date||dayKey(),setDate,modal,openModal,closeModal,notify,addWater,toggleTask,toggleHabit,setPreferences,resolvedTheme,setTheme,user,syncCloud,restoreCloud,syncing,cloudStatus,exportData,importData,exportPreviousData,hasLocalBackup,resetData,storageError}}><I18nProvider locale={data.preferences.language}>{offline&&<div className="banner"><WifiOff size={14}/>{getTranslator(data.preferences.language)("Нет сети. Доступны локальные записи; облако и AI требуют подключения.")}</div>}{storageError&&<div className="banner" role="alert">{getTranslator(data.preferences.language)(storageError)}<button onClick={exportData}>{getTranslator(data.preferences.language)("Экспортировать")}</button></div>}{children}<Balloons ref={balloons}/><DingToast theme={resolvedTheme}/></I18nProvider></Context.Provider>;
}
export function useDay(){const value=useContext(Context);if(!value)throw new Error("DayProvider is required");return value;}
