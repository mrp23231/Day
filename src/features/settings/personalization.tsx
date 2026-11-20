"use client";
import { useI18n } from "@/components/i18n-provider";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, RotateCcw, SlidersHorizontal, Trash2, Upload } from "lucide-react";
import { useDay } from "@/components/day-provider";
import { Button } from "@/components/ui/button";
import { usePersonalPhotos } from "@/features/appearance/personal-photos";
import { todayCards, type PhotoTarget } from "@/lib/domain";
import { moveCard, personalTargets, toggleCardVisibility } from "@/lib/personalization";

export function PersonalizationSettings() {
  const {t}=useI18n();
  const {data,ready,setPreferences}=useDay();
  const {busy,urlFor,missingFor,savePhoto,removePhoto}=usePersonalPhotos();
  const [target,setTarget]=useState<PhotoTarget>("space");
  const input=useRef<HTMLInputElement>(null);
  const url=urlFor(target),meta=personalTargets.find(item=>item.id===target)!;
  const {todayOrder:order,todayHidden:hidden}=data.preferences;

  return <section className="panel personalization-panel" aria-labelledby="personalization-title">
    <div className="panel-heading"><div><p className="appearance-eyebrow">{t("Настроено вами")}</p><h2 id="personalization-title">{t("Личное пространство")}</h2></div><SlidersHorizontal size={18}/></div>
    <p className="personalization-intro">{t("Ваши фотографии. Ваш порядок. Всё, чтобы день ощущался своим.")}</p>
    <label className="field">{t("Где использовать фото")}<select value={target} onChange={event=>setTarget(event.target.value as PhotoTarget)} disabled={!!busy||!ready}>{personalTargets.map(item=><option key={item.id} value={item.id}>{t(item.label)}</option>)}</select></label>
    <div className={`personal-photo-preview ${url?"has-photo":""} ${data.preferences.photoTone==="mono"?"mono":""}`} style={url?{backgroundImage:`url("${url}")`}:undefined} role="img" aria-label={url?t("Ваше фото: {value0}",{value0:t(meta.label)}):t("Фото для «{value0}» ещё не выбрано",{value0:t(meta.label)})}>
      {!url&&<><ImagePlus size={25} strokeWidth={1.3}/><span>{busy===target?t("Готовим фотографию…"):t("Здесь будет ваше фото")}</span></>}
      {url&&<span className="personal-photo-caption">{t(meta.label)}</span>}
    </div>
    <p className="field-hint personal-target-description">{t(meta.description)}. {target==="space"?t("Готовый фон можно выбрать выше."):t("Подложка помогает тексту оставаться читаемым.")}</p>
    <input ref={input} type="file" className="sr-only" aria-label={t("Фото для: {value0}",{value0:t(meta.label)})} accept="image/jpeg,image/png,image/webp,image/avif" tabIndex={-1} onChange={event=>{const file=event.target.files?.[0];event.target.value="";if(file)void savePhoto(target,file);}} disabled={!!busy||!ready}/>
    <div className="personal-photo-actions"><Button variant="outline" disabled={!ready||!!busy} onClick={()=>input.current?.click()}><Upload size={14}/>{busy?t("Обрабатываем…"):data.preferences.personalPhotos[target]?t("Заменить фото"):t("Выбрать фото")}</Button>{data.preferences.personalPhotos[target]&&<Button variant="ghost" disabled={!ready||!!busy} onClick={()=>removePhoto(target)}><Trash2 size={14}/>{t("Убрать")}</Button>}</div>
    {missingFor(target)&&<p className="form-notice">{t("Это фото недоступно в текущем браузере. Выберите его снова.")}</p>}
    <div className="personal-tone"><span>{t("Цвет фотографии")}</span><div className="segmented"><button disabled={!ready} aria-pressed={data.preferences.photoTone==="mono"} className={data.preferences.photoTone==="mono"?"active":""} onClick={()=>setPreferences({photoTone:"mono"})}>{t("Чёрно-белый")}</button><button disabled={!ready} aria-pressed={data.preferences.photoTone==="original"} className={data.preferences.photoTone==="original"?"active":""} onClick={()=>setPreferences({photoTone:"original"})}>{t("Оригинал")}</button></div></div>
    <p className="personal-photo-storage">{t("JPEG, PNG, WebP или AVIF до 20 МБ. Фото сохраняются только в этом браузере и не входят в облачную копию или JSON-экспорт.")}</p>
    <div className="personal-layout-heading"><div><h3>{t("Блоки на главной")}</h3><p>{t("Порядок идёт сверху вниз. Оставьте то, что нужно вам.")}</p></div></div>
    <ol className="personal-card-list" aria-label={t("Порядок блоков")}>{order.map((card,index)=>{
      const label=t(personalTargets.find(item=>item.id===card)!.label),visible=!hidden.includes(card);
      return <li key={card} className={!visible?"is-hidden":""}><span className="personal-card-number" aria-hidden="true">{String(index+1).padStart(2,"0")}</span><label><input type="checkbox" checked={visible} disabled={!ready||(hidden.length===todayCards.length-1&&visible)} onChange={()=>setPreferences({todayHidden:toggleCardVisibility(hidden,card)})}/><span>{label}</span></label><div><button className="icon-button" aria-label={t("Выше: {value0}",{value0:label})} disabled={!ready||index===0} onClick={()=>setPreferences({todayOrder:moveCard(order,card,-1)})}><ArrowUp size={15}/></button><button className="icon-button" aria-label={t("Ниже: {value0}",{value0:label})} disabled={!ready||index===order.length-1} onClick={()=>setPreferences({todayOrder:moveCard(order,card,1)})}><ArrowDown size={15}/></button></div></li>;
    })}</ol>
    <Button variant="ghost" className="personal-layout-reset" disabled={!ready} onClick={()=>setPreferences({todayOrder:[...todayCards],todayHidden:[]})}><RotateCcw size={13}/>{t("Вернуть стандартный порядок")}</Button>
  </section>;
}
