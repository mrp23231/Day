"use client";

import Link from "next/link";
import { useI18n } from "./i18n-provider";
import { CalendarDays, House, Leaf, Plus, UserRound } from "lucide-react";

export function MobileNav({ pathname, onAdd, onToday, disabled }: { pathname:string; onAdd:()=>void; onToday:()=>void; disabled:boolean }) {
  const {t}=useI18n();
  return <nav className="bottom-nav day-mobile-nav" aria-label={t("Мобильная навигация")}>
    <Link href="/" className={pathname === "/" ? "active" : ""} aria-current={pathname === "/" ? "page" : undefined} onClick={onToday}><House size={20}/><span>{t("Сегодня")}</span></Link>
    <Link href="/planner" className={pathname === "/planner" ? "active" : ""} aria-current={pathname === "/planner" ? "page" : undefined}><CalendarDays size={20}/><span>{t("Календарь")}</span></Link>
    <button className="mobile-add" aria-label={t("Добавить задачу")} onClick={onAdd} disabled={disabled}><span className="mobile-add-icon"><Plus size={24}/></span><span>{t("Добавить")}</span></button>
    <Link href="/habits" className={pathname === "/habits" ? "active" : ""} aria-current={pathname === "/habits" ? "page" : undefined}><Leaf size={20}/><span>{t("Привычки")}</span></Link>
    <Link href="/settings" className={pathname === "/settings" ? "active" : ""} aria-current={pathname === "/settings" ? "page" : undefined}><UserRound size={20}/><span>{t("Профиль")}</span></Link>
  </nav>;
}
