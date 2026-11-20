"use client";

import { useRef, useState } from "react";
import { Camera, LoaderCircle, LockKeyhole, Trash2, Upload } from "lucide-react";
import { useDay } from "@/components/day-provider";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useOptionalPersonalPhotos } from "@/features/appearance/personal-photos";
import { ProfileAvatar } from "./profile-avatar";
import { photoStorageMessage } from "@/lib/cloud-photos";
import styles from "./avatar-editor.module.css";

export function AvatarEditorSettings() {
  const {t}=useI18n();const [open,setOpen]=useState(false);
  return <><Button variant="ghost" onClick={()=>setOpen(true)}><Camera size={14}/>{t("Изменить аватар")}</Button>{open&&<AvatarEditor onClose={()=>setOpen(false)}/>}</>;
}

function AvatarEditor({onClose}:{onClose:()=>void}) {
  const {t}=useI18n();const {data,user,ready}=useDay();const photos=useOptionalPersonalPhotos();const input=useRef<HTMLInputElement>(null);
  const selected=!!data.preferences.personalPhotos.avatar;const busy=photos?.busy==="avatar";const disabled=!ready||!!photos?.busy||!photos;
  const storageMessage=photoStorageMessage(!!user,selected?photos?.statusFor?.("avatar"):undefined,!!photos?.urlFor?.("avatar"));
  return <Dialog open onClose={onClose} title={t("Ваш аватар")} description={t("Фотография или короткая анимация — маленькая деталь, которая делает Day вашим.")}>
    <div className={styles.editor}>
      <div className={styles.preview}><ProfileAvatar className={styles.large}/>{busy&&<span role="status" className={styles.loading}><LoaderCircle size={20}/><span className="sr-only">{t("Готовим аватар…")}</span></span>}</div>
      <input ref={input} type="file" className="sr-only" tabIndex={-1} aria-label={t("Фото или GIF для аватара")} accept="image/jpeg,image/png,image/webp,image/gif" disabled={disabled} onChange={event=>{const file=event.target.files?.[0];event.target.value="";if(file)void photos?.savePhoto("avatar",file);}}/>
      <div className={styles.actions}><Button disabled={disabled} onClick={()=>input.current?.click()}><Upload size={14}/>{busy?t("Готовим аватар…"):selected?t("Заменить аватар"):t("Выбрать фото или GIF")}</Button>{selected&&<Button variant="ghost" disabled={disabled} onClick={()=>photos?.removePhoto("avatar")}><Trash2 size={14}/>{t("Убрать аватар")}</Button>}</div>
      {photos?.missingFor("avatar")&&<p className="form-notice">{t(user?storageMessage:"Это фото недоступно в текущем браузере. Выберите его снова.")}</p>}
      <p className={styles.hint}>{t("JPEG, PNG, WebP или GIF · до 5 МБ. GIF — до 512 × 512 пикселей и 120 кадров.")}</p>
      <p className={styles.hint}>{t("Фотография обрезается по центру в квадрат. Анимация GIF сохраняется; при уменьшении движения показывается неподвижный кадр.")}</p>
      <p className={styles.storage}><LockKeyhole size={13}/><span>{t(storageMessage)}</span></p>
      <Button variant="outline" onClick={onClose}>{t("Готово")}</Button>
    </div>
  </Dialog>;
}
