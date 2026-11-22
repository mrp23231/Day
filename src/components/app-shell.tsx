"use client";
import Link from "next/link";
import { useI18n } from "./i18n-provider";
import { ProfileAvatar } from "@/features/profile/profile-avatar";
import { usePathname } from "next/navigation";
import { useState, type CSSProperties, type ReactNode } from "react";
import { ArrowUpRight, CalendarDays, ChartNoAxesCombined, ChevronDown, ChevronRight, Droplets, Leaf, Menu, PanelLeftClose, Settings2, Sparkles, Utensils, House } from "lucide-react";
import { useDay } from "./day-provider";
import { GlobalSearch } from "@/features/search/global-search";
import { MobileNav } from "./mobile-nav";
import { dayKey } from "@/lib/domain";
import { ThemeToggle } from "./ui/theme-toggle";
import { AccountOnboarding } from "@/features/auth/account-onboarding";
import { Editors } from "@/features/editors/editors";
import { usePersonalPhotos } from "@/features/appearance/personal-photos";
import { AppReadyContent } from "./app-ready-content";
import { PageTransition } from "./page-transition";
const links=[{href:"/",label:"Сегодня",icon:House},{href:"/planner",label:"Планировщик",short:"Планы",icon:CalendarDays},{href:"/nutrition",label:"Питание",icon:Utensils},{href:"/water",label:"Вода",icon:Droplets},{href:"/habits",label:"Привычки",icon:Leaf},{href:"/progress",label:"Мой прогресс",short:"Прогресс",icon:ChartNoAxesCombined}];
export function AppShell({children}:{children:ReactNode}){
  const {t}=useI18n();
  const pathname=usePathname();const {data,user,openModal,setTheme,resolvedTheme,setDate,ready}=useDay();const [collapsed,setCollapsed]=useState(false);
  const {urlFor}=usePersonalPhotos();
  const spacePhoto=urlFor("space"),navigationPhoto=urlFor("navigation");
  const personalStyle={"--personal-space":spacePhoto?`url("${spacePhoto}")`:undefined,"--personal-navigation":navigationPhoto?`url("${navigationPhoto}")`:undefined,"--personal-filter":data.preferences.photoTone==="mono"?"grayscale(1)":"none"} as CSSProperties;
  const current=links.find(l=>l.href===pathname)?.label||(pathname==="/assistant"?"Day AI":"Настройки");
  return (
    <div className={`app ${collapsed ? "collapsed" : ""} ${spacePhoto?"has-personal-space":""} ${navigationPhoto?"has-personal-navigation":""}`} style={personalStyle}>
      <a href="#main-content" className="skip-link">{t("Перейти к содержимому")}</a>
      <aside className="sidebar" aria-label={t("Основная навигация")}>
        <Link className="brand" href="/" aria-label={t("Day — сегодня")}><span className="brand-initial">D</span><span className="brand-text">Day<span className="brand-dot">.</span></span></Link>
        <div className="nav-caption">{t("Пространство")}</div>
        <nav className="nav-list">{links.map(({href,label,icon:Icon}) => (
          <Link key={href} href={href} className={`nav-link ${pathname===href ? "active" : ""}`} aria-current={pathname===href ? "page" : undefined} aria-label={t(label)}>
            <Icon size={18} strokeWidth={1.65}/><span className="nav-label">{t(label)}</span>
            {href==="/planner"&&data.tasks.length>0&&<span className="nav-count">{data.tasks.length}</span>}
          </Link>
        ))}</nav>
        <div className="ai-nav"><Link href="/assistant" className={`nav-link ${pathname==="/assistant" ? "active" : ""}`} aria-label={t("Day AI")}><Sparkles size={18} strokeWidth={1.6}/><span className="nav-label">Day AI <span className="ai-beta-nav">{t("Бета")}</span></span><ArrowUpRight className="nav-label" size={13} style={{marginLeft:"auto"}}/></Link></div>
        <div className="sidebar-bottom">
          <Link className={`nav-link ${pathname==="/settings" ? "active" : ""}`} href="/settings" aria-label={t("Настройки")}><Settings2 size={18}/><span className="nav-label">{t("Настройки")}</span></Link>
          <Link className="profile-button" href="/settings#profile" aria-label={t("Мой профиль")}><ProfileAvatar className="avatar" name={data.preferences.name}/><span className="profile-text"><strong>{data.preferences.name||t("Мой профиль")}</strong><small>{t(user ? "Личный аккаунт" : "На устройстве")}</small></span><ChevronDown size={13} className="profile-chevron" style={{marginLeft:"auto",color:"var(--muted)"}}/></Link>
        </div>
      </aside>
      <div className={`main ${pathname==="/" ? "today-surface" : ""}`}>
        <div className="day-background-layer" aria-hidden="true"/><header className="topbar"><div className="breadcrumbs"><span className="desktop-crumb">Day</span><ChevronRight size={12}/><span>{t(current)}</span></div><div className="topbar-tools"><GlobalSearch key={user?.id||"guest"}/><span className="local-status"><span className="status-dot"/>{t(user ? "Личный аккаунт" : "На устройстве")}</span><ThemeToggle mode={resolvedTheme} disabled={!ready} showLabel={false} onModeChange={(mode,details)=>setTheme(mode,details?.origin)} className="app-theme-toggle"/><button className="icon-button collapse-toggle" aria-label={t(collapsed ? "Развернуть меню" : "Свернуть меню")} onClick={()=>setCollapsed(!collapsed)}>{collapsed ? <Menu size={18}/> : <PanelLeftClose size={18}/>}</button></div></header>
        <main id="main-content" className="content"><AppReadyContent><PageTransition routeKey={pathname}>{children}</PageTransition></AppReadyContent></main>
      </div>
      <MobileNav pathname={pathname} disabled={!ready} onToday={()=>setDate(dayKey())} onAdd={()=>openModal({type:"task"})}/>
      <AccountOnboarding/>
      <Editors/>
    </div>
  );
}
