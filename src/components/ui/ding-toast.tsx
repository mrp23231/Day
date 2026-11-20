"use client";
import {useI18n} from "@/components/i18n-provider";
import { Toaster } from "@yusufceng1z/ding-react";
import "./ding-toast.css";

/** One shared host; Day supplies the resolved theme rather than a second OS setting. */
export default function DingToast({ theme }: { theme: "light" | "dark" }) {
  const {t}=useI18n();
  return <div className="day-notifications"><Toaster position="top-center" theme={theme} labels={{ region: t("Уведомления"), dismiss: t("Закрыть уведомление") }} /></div>;
}
