"use client";
import { useI18n } from "@/components/i18n-provider";

import { Check, Monitor } from "lucide-react";
import { useDay } from "@/components/day-provider";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { backgrounds } from "@/lib/appearance";
import { useOptionalPersonalPhotos } from "@/features/appearance/personal-photos";

export function AppearanceSettings(){
  const {t}=useI18n();
  const {data,resolvedTheme,setTheme,setPreferences,ready}=useDay();
  const photos=useOptionalPersonalPhotos();
  const ownPhoto=!!data.preferences.personalPhotos.space;
  const selected=backgrounds.find(item=>item.id===data.preferences.background)!;
  const automatic=data.preferences.theme==="system";
  return <section className="panel appearance-panel" aria-labelledby="appearance-title">
    <header className="appearance-heading"><div><p className="appearance-eyebrow">{t("Ваше пространство")}</p><h2 id="appearance-title">{t("Оформление")}</h2></div><span className="appearance-monogram" aria-hidden="true">D.</span></header>
    <div className="appearance-theme-row"><div><strong>{t("В нужном свете")}</strong><p>{automatic?t("Сейчас — как на вашем устройстве."):resolvedTheme==="dark"?t("Тёмная тема для спокойного вечера."):t("Светлая тема. Больше воздуха.")}</p></div><ThemeToggle mode={resolvedTheme} disabled={!ready} onModeChange={(mode,details)=>setTheme(mode,details?.origin)}/></div>
    <label className="appearance-automatic"><span><Monitor size={16}/><span>{t("Как на устройстве")}</span></span><input type="checkbox" checked={automatic} disabled={!ready} onChange={event=>setTheme(event.target.checked?"system":resolvedTheme)}/></label>
    <fieldset className="appearance-backgrounds"><legend>{t("Фон пространства")}</legend><p className="appearance-description">{t("Немного настроения. Всё важное — на виду.")}</p><div className="background-options">
      {backgrounds.map(background=><label className={`background-option ${!ownPhoto&&background.id===selected.id?"selected":""}`} key={background.id}>
        <input type="radio" name="day-background" value={background.id} checked={!ownPhoto&&background.id===selected.id} disabled={!ready||!!photos?.busy} onChange={()=>{if(ownPhoto)photos?.removePhoto("space");setPreferences({background:background.id});}}/>
        <span className={`background-swatch background-swatch-${background.id}`} style={background.image?{backgroundImage:`url(${background.image})`}:undefined} aria-hidden="true"><span className="background-selected"><Check size={13}/></span></span>
        <span className="background-name">{t(background.name)}</span><span className="background-description">{t(background.description)}</span>
      </label>)}
    </div></fieldset>
    <p className="appearance-credit">{ownPhoto?t("Сейчас используется ваше фото. Заменить его можно на главной."):selected.source?<a href={selected.source} target="_blank" rel="noreferrer">{t("Фото:")} {selected.author} / Unsplash</a>:t("Ваш выбор сохраняется автоматически.")}</p>
    <div className="settings-row appearance-nutrition"><div><strong>{t("Режим питания")}</strong><small>{t("Данные сохраняются при переключении")}</small></div><div className="segmented"><button aria-pressed={data.preferences.nutritionMode==="simple"} className={data.preferences.nutritionMode==="simple"?"active":""} onClick={()=>setPreferences({nutritionMode:"simple"})}>{t("Простой")}</button><button aria-pressed={data.preferences.nutritionMode==="advanced"} className={data.preferences.nutritionMode==="advanced"?"active":""} onClick={()=>setPreferences({nutritionMode:"advanced"})}>{t("Про")}</button></div></div>
  </section>;
}
