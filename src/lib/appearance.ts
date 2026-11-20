import type { Preferences } from "./domain";

export type Background = Preferences["background"];
export type ResolvedTheme = "light" | "dark";
export const backgrounds: {id:Background;name:string;description:string;image?:string;author?:string;source?:string}[] = [
  {id:"classic",name:"Чистый",description:"Только самое важное"},
  {id:"soft",name:"Мягкий",description:"Спокойные оттенки серого"},
  {id:"mountains",name:"Горы",description:"Тишина над облаками",image:"/backgrounds/mountains.jpg",author:"Willian Chan",source:"https://unsplash.com/photos/mountain-peak-emerging-from-swirling-fog-vCJjfgrZS-c"},
  {id:"architecture",name:"Архитектура",description:"Свет, линии и пространство",image:"/backgrounds/architecture.jpg",author:"Joel Filipe",source:"https://unsplash.com/photos/white-concrete-building-jkNrjZ5w-Nk"},
];

export function resolveTheme(theme:Preferences["theme"],systemDark:boolean):ResolvedTheme {
  return theme === "system" ? systemDark ? "dark" : "light" : theme;
}

/** Runs before paint; validated provider/account preferences take over after hydration. */
export const appearanceBootstrapScript = `(function(){var t='system',b='classic';try{var v=localStorage.getItem('day-theme');if(v==='light'||v==='dark')t=v;var c=localStorage.getItem('day-background');if(${JSON.stringify(backgrounds.map(item=>item.id))}.indexOf(c)!==-1)b=c;}catch(e){}var r=document.documentElement,m=t==='system'?(typeof matchMedia==='function'&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;r.dataset.theme=m;r.dataset.mode=m;r.dataset.background=b;})()`;
