"use client";

import { useRef, useState } from "react";
import { CalendarDays, ImagePlus, LoaderCircle, LockKeyhole, Trash2, Upload } from "lucide-react";
import { useDay } from "@/components/day-provider";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useOptionalPersonalPhotos } from "@/features/appearance/personal-photos";
import styles from "./day-icon.module.css";
import { photoStorageMessage } from "@/lib/cloud-photos";

/** Decorative: the date's surrounding button supplies its accessible name. */
export function DayIcon({date,className=""}:{date:string;className?:string}) {
  const photos=useOptionalPersonalPhotos();
  const url=photos?.dayUrlFor?.(date);
  return <span className={`${styles.icon} ${className}`} aria-hidden="true" data-day-icon={date}>
    <CalendarDays size={14}/>{url&&<DayImage key={url} src={url}/>}
  </span>;
}

function DayImage({src}:{src:string}) {
  const [loaded,setLoaded]=useState(false);
  // Device-local object URLs intentionally bypass the remote image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" draggable={false} decoding="async" data-loaded={loaded} onLoad={()=>setLoaded(true)}/>;
}

export function DayIconButton({date}:{date:string}) {
  const {t,formatDate}=useI18n();const [open,setOpen]=useState(false);
  const label=t("Фото дня · {date}",{date:formatDate(date,{day:"numeric",month:"long",year:"numeric"})});
  return <>
    <button type="button" className={styles.editButton} aria-label={label} title={label} onClick={()=>setOpen(true)}><ImagePlus size={16}/><span>{t("Фото дня")}</span></button>
    {open&&<DayIconEditor date={date} onClose={()=>setOpen(false)}/>}
  </>;
}

export function DayIconEditor({date,onClose}:{date:string;onClose:()=>void}) {
  const {t,formatDate}=useI18n();const {data,user,ready}=useDay();const photos=useOptionalPersonalPhotos();const input=useRef<HTMLInputElement>(null);
  const selected=!!data.preferences.dayIcons?.[date];const busy=photos?.busy===`day:${date}`;const disabled=!ready||!!photos?.busy||!photos;
  const storageMessage=photoStorageMessage(!!user,selected?photos?.dayStatusFor?.(date):undefined,!!photos?.dayUrlFor?.(date));
  return <Dialog open onClose={onClose} title={t("Фото дня")} description={formatDate(date,{weekday:"long",day:"numeric",month:"long",year:"numeric"})}>
    <div className={styles.editor}>
      <div className={styles.preview}><DayIcon date={date} className={styles.large}/>{busy&&<span role="status" className={styles.loading}><LoaderCircle size={20}/><span className="sr-only">{t("Готовим фото дня…")}</span></span>}</div>
      <p className={styles.intro}>{t("Один маленький кадр, чтобы запомнить этот день. Он появится в календаре.")}</p>
      <input ref={input} type="file" className="sr-only" tabIndex={-1} aria-label={t("Картинка для дня")} accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={event=>{const file=event.target.files?.[0];event.target.value="";if(file)void photos?.saveDayIcon(date,file);}}/>
      <div className={styles.actions}>
        <Button disabled={disabled} onClick={()=>input.current?.click()}><Upload size={14}/>{busy?t("Готовим фото дня…"):selected?t("Заменить фото дня"):t("Выбрать фото дня")}</Button>
        {selected&&<Button variant="ghost" disabled={disabled} onClick={()=>photos?.removeDayIcon(date)}><Trash2 size={14}/>{t("Убрать фото дня")}</Button>}
      </div>
      {photos?.dayMissingFor?.(date)&&<p className="form-notice">{t(user?storageMessage:"Это фото недоступно в текущем браузере. Выберите его снова.")}</p>}
      <p className={styles.hint}>{t("JPEG, PNG или WebP · до 20 МБ. В календаре фотография отображается в квадрате.")}</p>
      <p className={styles.storage}><LockKeyhole size={13}/><span>{t(storageMessage)}</span></p>
      <Button variant="outline" onClick={onClose}>{t("Готово")}</Button>
    </div>
  </Dialog>;
}
