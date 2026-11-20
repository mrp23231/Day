"use client";
import { useI18n } from "@/components/i18n-provider";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, LockKeyhole, Trash2, Upload } from "lucide-react";
import { useDay } from "@/components/day-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { PhotoTarget } from "@/lib/domain";
import { personalTargets, validatePhotoFile } from "@/lib/personalization";
import { usePersonalPhotos } from "./personal-photos";
import styles from "./photo-editor.module.css";
import { photoStorageMessage } from "@/lib/cloud-photos";

export function PhotoEditor({ target, onClose }: { target: PhotoTarget; onClose: () => void }) {
  return <PhotoEditorSession key={target} target={target} onClose={onClose} />;
}

function PhotoEditorSession({ target, onClose }: { target: PhotoTarget; onClose: () => void }) {
  const {t}=useI18n();
  const { data, user, ready, setPreferences } = useDay();
  const { busy, urlFor, missingFor, savePhoto, removePhoto, statusFor } = usePersonalPhotos();
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const meta = personalTargets.find(item => item.id === target)!;
  const url = urlFor(target);
  const selected = !!data.preferences.personalPhotos[target];
  const saving = pending || busy === target;
  const disabled = !ready || !!busy || pending;
  const missing = missingFor(target);
  const storageMessage=photoStorageMessage(!!user,selected?statusFor?.(target):undefined,!!url);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function choosePhoto(file: File) {
    if (disabled) return;
    setError("");
    try { validatePhotoFile(file); }
    catch (failure) { setError(failure instanceof Error ? failure.message : t("Не удалось открыть фото.")); return; }
    setPending(true);
    try {
      const saved = await savePhoto(target, file);
      if (mounted.current && !saved) setError("Фото не загружено. Попробуйте другой файл — прежнее фото сохранено.");
    } catch {
      if (mounted.current) setError("Фото не загружено. Попробуйте ещё раз.");
    } finally {
      if (mounted.current) setPending(false);
    }
  }

  return <Dialog open onClose={onClose} title={t("Фото: {value0}",{value0:t(meta.label)})} description={t(meta.description)}>
    <div className={styles.editor}>
      <div className={`${styles.preview} ${data.preferences.photoTone === "mono" ? styles.mono : ""}`} role="img" aria-label={url ? t("Ваше фото: {value0}",{value0:t(meta.label)}) : t("Фото для «{value0}» ещё не выбрано",{value0:t(meta.label)})} aria-busy={saving || (!url && selected && !missing)}>
        {url ? <>
          {/* Local object URLs cannot use the server image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className={styles.previewImage} />
          <span className={styles.caption}>{t(meta.label)}</span>
        </> : <div className={styles.empty}>
          {saving || (!url && selected && !missing) ? <LoaderCircle size={26} strokeWidth={1.25} className={styles.spinner} /> : <ImagePlus size={29} strokeWidth={1.15} />}
          <span>{saving ? t("Готовим фотографию…") : !ready || (selected && !missing) ? t("Загружаем фотографию…") : missing ? t("Фото недоступно в этом браузере") : t("Добавьте немного своего")}</span>
          {!selected && !saving && <small>{t("Фотография станет фоном этого блока")}</small>}
        </div>}
        {saving && url && <span className={styles.progress} role="status"><LoaderCircle size={14} className={styles.spinner} />{t("Готовим фотографию…")}</span>}
      </div>
      <input ref={input} type="file" className="sr-only" tabIndex={-1} aria-label={t("Фото для: {value0}",{value0:t(meta.label)})} accept="image/jpeg,image/png,image/webp,image/avif" disabled={disabled} onChange={event => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void choosePhoto(file);
      }} />
      <div className={styles.actions}>
        <Button disabled={disabled} onClick={() => input.current?.click()}><Upload size={15} strokeWidth={1.6} />{saving ? t("Обрабатываем…") : selected ? t("Заменить фото") : t("Выбрать фото")}</Button>
        {selected && <Button variant="ghost" disabled={disabled} onClick={() => { setError(""); removePhoto(target); }}><Trash2 size={15} strokeWidth={1.6} />{t("Убрать фото")}</Button>}
      </div>
      {error && <p className={styles.notice} role="alert">{t(error)}</p>}
      {missing && !error && <p className={styles.notice}>{t(user?storageMessage:"Выберите фото снова. Оно хранится только в браузере, где было добавлено.")}</p>}
      <div className={styles.tone}>
        <div><span>{t("Цвет фотографии")}</span><small>{t("Для всех ваших фото")}</small></div>
        <div className={styles.segmented} role="group" aria-label={t("Цвет фотографии")}>
          <button type="button" disabled={disabled} aria-pressed={data.preferences.photoTone === "mono"} onClick={() => setPreferences({ photoTone: "mono" })}>{t("Чёрно-белый")}</button>
          <button type="button" disabled={disabled} aria-pressed={data.preferences.photoTone === "original"} onClick={() => setPreferences({ photoTone: "original" })}>{t("Оригинал")}</button>
        </div>
      </div>
      <p className={styles.formats}>{t("JPEG, PNG, WebP или AVIF · до 20 МБ")}</p>
      <p className={styles.storage}><LockKeyhole size={12} strokeWidth={1.5} /><span>{t(storageMessage)}</span></p>
      <div className={styles.footer}><Button variant="outline" onClick={onClose}>{t("Готово")}</Button></div>
    </div>
  </Dialog>;
}
