"use client";
import { useI18n } from "@/components/i18n-provider";

import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useDay } from "@/components/day-provider";
import { dateSchema, type AppData, type PhotoTarget } from "@/lib/domain";
import { deletePhoto, getPhoto, preparePhoto, putPhoto } from "@/lib/personalization";
import { prepareAvatar } from "@/lib/avatar";
import { downloadCloudPhoto, uploadCloudPhoto } from "@/lib/cloud-photos";
import styles from "./personal-photos.module.css";

type PhotoOperation = PhotoTarget|`day:${string}`;
export type PhotoSyncStatus="local"|"syncing"|"synced"|"pending"|"unavailable";
type PhotosContext = {busy:PhotoOperation|null;urlFor:(target:PhotoTarget)=>string|undefined;missingFor:(target:PhotoTarget)=>boolean;savePhoto:(target:PhotoTarget,file:File)=>Promise<boolean>;removePhoto:(target:PhotoTarget)=>void;dayUrlFor:(date:string)=>string|undefined;dayMissingFor:(date:string)=>boolean;saveDayIcon:(date:string,file:File)=>Promise<boolean>;removeDayIcon:(date:string)=>void;statusFor:(target:PhotoTarget)=>PhotoSyncStatus;dayStatusFor:(date:string)=>PhotoSyncStatus;retryCloudPhotos:()=>void;pendingCloudPhotos:number;cloudPhotoErrors:number};
const Context=createContext<PhotosContext|null>(null);

function retainCloudReferences(preferences:AppData["preferences"]) {
  const linked=new Set(Object.values({...preferences.personalPhotos,...preferences.dayIcons}));
  return {...preferences,cloudPhotoIds:[...new Set(preferences.cloudPhotoIds||[])].filter(id=>linked.has(id))};
}

export function PersonalPhotosProvider({children}:{children:ReactNode}) {
  const {user,resetVersion}=useDay();
  const scope=user?`day-user-${user.id}`:"day-data-v1";
  return <ScopedPhotos key={`${scope}:${resetVersion||0}`} scope={scope}>{children}</ScopedPhotos>;
}

function ScopedPhotos({scope,children}:{scope:string;children:ReactNode}) {
  const {t}=useI18n();
  const {data,user,ready,update,notify,resetVersion}=useDay();
  const [busy,setBusy]=useState<PhotoOperation|null>(null);
  const [urls,setUrls]=useState<Record<string,string>>({});
  const [missing,setMissing]=useState<string[]>([]);
  const [statuses,setStatuses]=useState<Record<string,PhotoSyncStatus>>({});
  const [workVersion,setWorkVersion]=useState(0);
  const [retryVersion,setRetryVersion]=useState(0);
  const epoch=useRef(0);
  const operation=useRef(0);
  const objectUrls=useRef(new Map<string,string>());
  const running=useRef(new Map<string,symbol>());
  const attempted=useRef(new Map<string,string>());
  const downloads=useRef(new Set<AbortController>());
  const photos=data.preferences.personalPhotos;
  const dayIcons=data.preferences.dayIcons||{};
  const references=JSON.stringify({...photos,...dayIcons});
  const cloudReferences=JSON.stringify(data.preferences.cloudPhotoIds||[]);
  const latest=useRef({references,cloudReferences,ready,user,update,resetVersion});
  useEffect(()=>{latest.current={references,cloudReferences,ready,user,update,resetVersion};},[references,cloudReferences,ready,user,update,resetVersion]);
  useEffect(()=>{const version=epoch.current+1;epoch.current=version;const cached=objectUrls.current,controllers=downloads.current,active=running.current,attempts=attempted.current;return()=>{epoch.current=version+1;controllers.forEach(controller=>controller.abort());controllers.clear();active.clear();attempts.clear();cached.forEach(url=>URL.revokeObjectURL(url));cached.clear();};},[]);
  useEffect(()=>{
    if(!user)return;
    const retry=()=>setRetryVersion(version=>version+1);
    const visibleRetry=()=>{if(document.visibilityState==="visible"&&navigator.onLine)retry();};
    window.addEventListener("online",retry);window.addEventListener("offline",retry);window.addEventListener("focus",visibleRetry);document.addEventListener("visibilitychange",visibleRetry);
    const timer=window.setInterval(visibleRetry,60000);
    return()=>{window.removeEventListener("online",retry);window.removeEventListener("offline",retry);window.removeEventListener("focus",visibleRetry);document.removeEventListener("visibilitychange",visibleRetry);window.clearInterval(timer);};
  },[user]);
  useEffect(()=>{
    if(!ready)return;
    const cached=objectUrls.current;
    const ids=[...new Set(Object.values(JSON.parse(references) as Record<string,string>))];
    const cloudIds=new Set<string>(JSON.parse(cloudReferences));
    const retained=new Set(ids);
    cached.forEach((url,id)=>{if(!retained.has(id)){URL.revokeObjectURL(url);cached.delete(id);}});
    attempted.current.forEach((_signature,id)=>{if(!retained.has(id))attempted.current.delete(id);});
    for(const id of ids){
      if(running.current.size>=2)break;
      const signature=`${cloudIds.has(id)}:${retryVersion}`;
      if(running.current.has(id)||attempted.current.get(id)===signature)continue;
      const token=Symbol(id);
      attempted.current.set(id,signature);running.current.set(id,token);
      const started=epoch.current;
      const current=()=>started===epoch.current&&latest.current.ready&&Object.values(JSON.parse(latest.current.references) as Record<string,string>).includes(id);
      const setStatus=(status:PhotoSyncStatus)=>{if(current())setStatuses(previous=>({...previous,[id]:status}));};
      const show=(blob:Blob)=>{
        if(!current())return;
        let url=cached.get(id);
        if(!url){url=URL.createObjectURL(blob);cached.set(id,url);}
        setUrls(previous=>({...previous,[id]:url!}));
        setMissing(previous=>previous.filter(value=>value!==id));
      };
      void (async()=>{
        let blob:Blob|undefined;
        try{
          // Load locally before starting a transfer so editing never waits for it.
          blob=await getPhoto(scope,id);
          if(!current())return;
          if(blob)show(blob);
          const account=latest.current.user;
          const knownCloud=(JSON.parse(latest.current.cloudReferences) as string[]).includes(id);
          if(!account){setStatus(blob?"local":"unavailable");return;}
          if(knownCloud&&blob){setStatus("synced");return;}
          if(!navigator.onLine){setStatus("pending");return;}
          if(!knownCloud&&!blob){setStatus("unavailable");return;}
          setStatus("syncing");
          if(knownCloud){
            const controller=new AbortController();downloads.current.add(controller);
            try{blob=await downloadCloudPhoto(account.id,id,controller.signal);}
            finally{downloads.current.delete(controller);}
            if(!current())return;
            await putPhoto(scope,id,blob);
            if(!current())return;
            show(blob);setStatus("synced");
          }else{
            await uploadCloudPhoto(account.id,id,blob!);
            if(!current())return;
            // Publishing the reference follows upload and a durable scoped commit.
            latest.current.update(value=>{
              const linked=Object.values({...value.preferences.personalPhotos,...value.preferences.dayIcons}).includes(id);
              if(!linked||value.preferences.cloudPhotoIds.includes(id))return value;
              return {...value,preferences:retainCloudReferences({...value.preferences,cloudPhotoIds:[...value.preferences.cloudPhotoIds,id]})};
            },{persist:true,scope,resetVersion:latest.current.resetVersion});
            setStatus("synced");
          }
        }catch{setStatus("pending");}
        finally{
          if(current()&&!blob)setMissing(previous=>previous.includes(id)?previous:[...previous,id]);
          if(running.current.get(id)===token)running.current.delete(id);
          if(started===epoch.current)setWorkVersion(version=>version+1);
        }
      })();
    }
  },[ready,references,cloudReferences,scope,retryVersion,workVersion]);

  async function savePhoto(target:PhotoTarget,file:File) {
    return saveImage(target,file);
  }

  async function saveDayIcon(date:string,file:File) {
    if(!dateSchema.safeParse(date).success)return false;
    return saveImage({date},file);
  }

  async function saveImage(target:PhotoTarget|{date:string},file:File) {
    if(!ready||busy)return false;
    const started=epoch.current,request=++operation.current;
    const isCurrent=()=>started===epoch.current&&request===operation.current;
    const id=crypto.randomUUID();let stored=false;
    setBusy(typeof target==="string"?target:`day:${target.date}`);
    try{
      if(typeof target!=="string"&&!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Для значка дня подойдёт JPEG, PNG или WebP.");
      const blob=await (target==="avatar"?prepareAvatar(file):typeof target==="string"?preparePhoto(file):preparePhoto(file,512));
      if(!isCurrent())return false;
      await putPhoto(scope,id,blob);stored=true;
      if(!isCurrent()){await deletePhoto(scope,id);return false;}
      let previous:string|undefined,previousRetained=false;
      update(current=>{
        if(typeof target==="string"){
          previous=current.preferences.personalPhotos[target];
          const preferences=retainCloudReferences({...current.preferences,personalPhotos:{...current.preferences.personalPhotos,[target]:id}});
          previousRetained=!!previous&&Object.values({...preferences.personalPhotos,...preferences.dayIcons}).includes(previous);
          return {...current,preferences};
        }
        previous=current.preferences.dayIcons[target.date];
        const preferences=retainCloudReferences({...current.preferences,dayIcons:{...current.preferences.dayIcons,[target.date]:id}});
        previousRetained=!!previous&&Object.values({...preferences.personalPhotos,...preferences.dayIcons}).includes(previous);
        return {...current,preferences};
      },{persist:true,scope,resetVersion});
      // Reveal a successfully committed local image even while other photos wait
      // in the bounded network queue.
      const preview=URL.createObjectURL(blob);objectUrls.current.set(id,preview);
      setUrls(current=>({...current,[id]:preview}));
      if(previous&&!previousRetained)void deletePhoto(scope,previous).catch(()=>{});
      notify(t("Фотография добавлена"),{description:t(user?"Сохранена на устройстве. Синхронизация с аккаунтом продолжится автоматически.":"Сохранена только в этом браузере. Войдите, чтобы добавить фото в аккаунт.")});
      return true;
    }catch(error){
      if(stored)void deletePhoto(scope,id).catch(()=>{});
      if(isCurrent())notify(t("Фото не загружено"),{kind:"error",description:error instanceof Error?t(error.message):t("Не удалось сохранить. Попробуйте другой файл.")});
      return false;
    }finally{if(isCurrent())setBusy(null);}
  }

  function removePhoto(target:PhotoTarget) {
    if(!ready||busy)return;
    const id=photos[target];if(!id)return;
    let retained=false;
    try{update(current=>{const next={...current.preferences.personalPhotos};delete next[target];const preferences=retainCloudReferences({...current.preferences,personalPhotos:next});retained=Object.values({...preferences.personalPhotos,...preferences.dayIcons}).includes(id);return {...current,preferences};},{persist:true,scope,resetVersion});}
    catch(error){notify(t("Фото не загружено"),{kind:"error",description:error instanceof Error?t(error.message):t("Не удалось сохранить. Попробуйте другой файл.")});return;}
    if(!retained)void deletePhoto(scope,id).catch(()=>{});
    notify(t("Фотография убрана"));
  }
  function removeDayIcon(date:string) {
    if(!ready||busy||!dateSchema.safeParse(date).success)return;
    const id=dayIcons[date];if(!id)return;
    let retained=false;
    try{update(current=>{const next={...current.preferences.dayIcons};delete next[date];const preferences=retainCloudReferences({...current.preferences,dayIcons:next});retained=Object.values({...preferences.personalPhotos,...preferences.dayIcons}).includes(id);return {...current,preferences};},{persist:true,scope,resetVersion});}
    catch(error){notify(t("Фото не загружено"),{kind:"error",description:error instanceof Error?t(error.message):t("Не удалось сохранить. Попробуйте другой файл.")});return;}
    if(!retained)void deletePhoto(scope,id).catch(()=>{});
    notify(t("Фотография убрана"));
  }
  const urlFor=(target:PhotoTarget)=>{const id=photos[target];return id?urls[id]:undefined;};
  const missingFor=(target:PhotoTarget)=>!!photos[target]&&missing.includes(photos[target]!);
  const dayUrlFor=(date:string)=>{const id=dayIcons[date];return id?urls[id]:undefined;};
  const dayMissingFor=(date:string)=>!!dayIcons[date]&&missing.includes(dayIcons[date]);
  const status=(id?:string):PhotoSyncStatus=>!user?"local":id?statuses[id]||((data.preferences.cloudPhotoIds||[]).includes(id)?"syncing":"pending"):"synced";
  const statusFor=(target:PhotoTarget)=>status(photos[target]);
  const dayStatusFor=(date:string)=>status(dayIcons[date]);
  const retryCloudPhotos=()=>setRetryVersion(version=>version+1);
  const currentIds=[...new Set(Object.values({...photos,...dayIcons}))];
  const pendingCloudPhotos=user?currentIds.filter(id=>status(id)!=="synced").length:0;
  const cloudPhotoErrors=user?currentIds.filter(id=>["pending","unavailable"].includes(statuses[id])).length:0;
  return <Context.Provider value={{busy,urlFor,missingFor,savePhoto,removePhoto,dayUrlFor,dayMissingFor,saveDayIcon,removeDayIcon,statusFor,dayStatusFor,retryCloudPhotos,pendingCloudPhotos,cloudPhotoErrors}}>{children}</Context.Provider>;
}

export function usePersonalPhotos(){const value=useContext(Context);if(!value)throw new Error("PersonalPhotosProvider is required");return value;}
export function useOptionalPersonalPhotos(){return useContext(Context);}

export function PhotoSurface({target,className="",children}:{target:PhotoTarget;className?:string;children:ReactNode}) {
  const photos=useOptionalPersonalPhotos();const {data}=useDay();const url=photos?.urlFor(target);const assigned=!!data.preferences.personalPhotos[target];
  const style=assigned?{"--personal-image":"none","--personal-filter":data.preferences.photoTone==="mono"?"grayscale(1)":"none"} as CSSProperties:undefined;
  return <div className={`personal-surface ${styles.surface} ${assigned?"has-photo":""} ${className}`} data-photo-target={target} style={style}>{assigned&&<PhotoLayers key={target} url={url}/>}{children}</div>;
}

function PhotoLayers({url}:{url?:string}) {
  const [displayed,setDisplayed]=useState<{current?:string;previous?:string}>({});
  const sources=[...new Set([displayed.previous,displayed.current,url].filter((source):source is string=>!!source))];
  return sources.map(source=>{
    const state=source===displayed.previous&&source!==url?"previous":source===displayed.current?"visible":"loading";
    // Local object URLs are already resized and stored on this device.
    // eslint-disable-next-line @next/next/no-img-element
    return <img
      key={source} src={source} alt="" aria-hidden="true" draggable={false} decoding="async"
      className={styles.photo} data-photo-state={state}
      onLoad={event=>{
        const image=event.currentTarget;
        const reveal=()=>{if(image.isConnected&&image.dataset.photoState==="loading")setDisplayed(current=>({current:source,previous:current.current}));};
        if(typeof image.decode==="function")void image.decode().then(reveal,()=>{});else reveal();
      }}
      onTransitionEnd={event=>{if(state==="previous"&&event.propertyName==="opacity")setDisplayed(current=>current.previous===source?{current:current.current}:current);}}
    />;
  });
}
