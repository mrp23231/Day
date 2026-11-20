import { notFound } from "next/navigation";
import { Planner } from "@/features/planner/planner";
import { Nutrition } from "@/features/nutrition/nutrition";
import { WaterPage } from "@/features/water/water";
import { Habits } from "@/features/habits/habits";
import { Progress } from "@/features/progress/progress";
import { Assistant } from "@/features/assistant/assistant";
import { Settings } from "@/features/settings/settings";
const pages={planner:{component:Planner,title:"Планировщик"},nutrition:{component:Nutrition,title:"Питание"},water:{component:WaterPage,title:"Вода"},habits:{component:Habits,title:"Привычки"},progress:{component:Progress,title:"Мой прогресс"},assistant:{component:Assistant,title:"Day AI"},settings:{component:Settings,title:"Настройки"}};
export function generateStaticParams(){return Object.keys(pages).map(section=>({section}));}
export async function generateMetadata({params}:{params:Promise<{section:string}>}){const {section}=await params;return {title:pages[section as keyof typeof pages]?.title||"Day"};}
export default async function Page({params}:{params:Promise<{section:string}>}){const {section}=await params;if(!(section in pages))notFound();const Component=pages[section as keyof typeof pages].component;return <Component/>;}
