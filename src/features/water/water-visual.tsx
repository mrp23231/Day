"use client";
import { useI18n } from "@/components/i18n-provider";
import { Droplets } from "lucide-react";

export function WaterVisual({value}:{value:number}) {const { t } = useI18n();
  return <div className="water-glass" aria-label={t("Выпито {percent} процентов цели", {percent: Math.round(value)})}>
    <div className="water-fill" style={{height:`${Math.min(100,Math.max(0,value))}%`}}/>
    <Droplets size={26} strokeWidth={1.5}/>
  </div>;
}
