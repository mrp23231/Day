"use client";

import { useEffect, useRef, useState } from "react";
import { applyTheme, type ThemeMode, type ThemeRevealOrigin } from "@/components/ui/theme-toggle";
import { resolveTheme } from "@/lib/appearance";
import type { Preferences } from "@/lib/domain";

/** One theme controller for header, settings, device changes and restored data. */
export function useAppearance(preferences:Preferences, ready:boolean, updatePreferences:(partial:Partial<Preferences>)=>void) {
  const [resolvedTheme,setResolvedTheme] = useState<ThemeMode>("light");
  const pending = useRef<{theme:Preferences["theme"];origin?:ThemeRevealOrigin}|null>(null);

  useEffect(()=>{
    if(!ready)return;
    const media=window.matchMedia("(prefers-color-scheme: dark)");
    const requested=pending.current;
    pending.current=null;
    const paint=(animate=false)=>{
      const next=resolveTheme(preferences.theme,media.matches);
      setResolvedTheme(next);
      void applyTheme(next,!animate,undefined,{origin:requested?.origin});
    };
    paint(requested?.theme===preferences.theme);
    try{localStorage.setItem("day-theme",preferences.theme);}catch{}
    if(preferences.theme!=="system")return;
    const onDeviceChange=()=>paint(false);
    media.addEventListener("change",onDeviceChange);
    return()=>media.removeEventListener("change",onDeviceChange);
  },[preferences.theme,ready]);

  useEffect(()=>{
    if(!ready)return;
    document.documentElement.dataset.background=preferences.background;
    try{localStorage.setItem("day-background",preferences.background);}catch{}
  },[preferences.background,ready]);

  function setTheme(theme:Preferences["theme"],origin?:ThemeRevealOrigin){
    pending.current=theme===preferences.theme?null:{theme,origin};
    updatePreferences({theme});
  }
  return {resolvedTheme,setTheme};
}
