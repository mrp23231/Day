import { z } from "zod";

export const dateSchema = z.iso.date();
export const dayIconsSchema = z.record(dateSchema,z.uuid()).refine(icons=>Object.keys(icons).length<=3660).default({});
const idSchema = z.string().min(1).max(100);
const amountSchema = z.number().finite().min(0).max(50000);
export const taskSchema = z.object({ id: idSchema, title: z.string().trim().min(1,"Добавьте название").max(180), description: z.string().max(2000), date: dateSchema, time: z.union([z.literal(""),z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]), priority: z.enum(["low","normal","high"]), category: z.string().min(1).max(50), repeat: z.enum(["none","daily","weekdays","weekly"]), completedDates: z.array(dateSchema).max(20000), excludedDates: z.array(dateSchema).max(20000).optional() });
export const foodSchema = z.object({ id: idSchema, name: z.string().trim().min(1,"Добавьте название блюда").max(180), date: dateSchema, meal: z.enum(["breakfast","lunch","dinner","snack"]), grams: z.number().finite().positive().max(10000), calories: amountSchema, protein: amountSchema, fat: amountSchema, carbs: amountSchema, favorite: z.boolean() });
export const waterSchema = z.object({ id: idSchema, date: dateSchema, time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), amount: z.number().int().min(1).max(3000) });
export const habitSchema = z.object({ id: idSchema, name: z.string().trim().min(1,"Добавьте название привычки").max(120), icon: z.enum(["leaf","book","activity","moon","heart","sun"]), days: z.array(z.number().int().min(0).max(6)).min(1,"Выберите хотя бы один день").max(7), completions: z.array(dateSchema).max(20000) });
export const todayCards = ["plan","next","habits","water","food","review"] as const;
export const photoTargets = ["space","navigation","avatar",...todayCards] as const;
export type TodayCard = typeof todayCards[number];
export type PhotoTarget = typeof photoTargets[number];
export const dayRatingSchema = z.number().finite().min(0).max(5).multipleOf(0.5);
const completionSummarySchema = (maximum: number) => z.object({ completed: z.number().int().min(0).max(maximum), total: z.number().int().min(0).max(maximum) }).refine(value => value.completed <= value.total);
export const reviewSummarySchema = z.object({
  tasks: completionSummarySchema(10000),
  habits: completionSummarySchema(500),
  water: z.object({ amount: z.number().int().min(0).max(90000000), goal: z.number().int().min(250).max(6000) }),
  food: z.object({ entries: z.number().int().min(0).max(30000), calories: z.number().int().min(0).max(1500000000) }),
});
export const reviewSnapshotSchema = reviewSummarySchema.extend({ completedTasks: z.array(z.object({ id: idSchema, title: taskSchema.shape.title })).max(10000) }).refine(value => value.completedTasks.length === value.tasks.completed && new Set(value.completedTasks.map(task => task.id)).size === value.completedTasks.length);
export const reviewTransferSchema = z.object({ taskId: idSchema, toDate: dateSchema, newTaskId: idSchema });
export type ReviewSummary = z.infer<typeof reviewSummarySchema>;
export type ReviewSnapshot = z.infer<typeof reviewSnapshotSchema>;
export const dayReviewSchema = z.object({date:dateSchema,note:z.string().trim().max(2000),mood:z.enum(["great","steady","hard"]),updatedAt:z.iso.datetime(),rating:dayRatingSchema.optional(),closedAt:z.iso.datetime().optional(),snapshot:reviewSnapshotSchema.optional(),transfers:z.array(reviewTransferSchema).max(10000).optional()});
export type DayReview = z.infer<typeof dayReviewSchema>;
export const preferencesSchema = z.object({ name: z.string().max(60), language: z.enum(["ru","en","it"]).default("ru"), theme: z.enum(["system","light","dark"]), background: z.enum(["classic","soft","mountains","architecture"]).default("classic"), personalPhotos:z.partialRecord(z.enum(photoTargets),z.uuid()).default({}), dayIcons:dayIconsSchema, cloudPhotoIds:z.array(z.uuid()).max(4000).default([]), photoTone:z.enum(["mono","original"]).default("mono"), todayOrder:z.array(z.enum(todayCards)).length(todayCards.length).refine(items=>new Set(items).size===todayCards.length).default([...todayCards]), todayHidden:z.array(z.enum(todayCards)).max(todayCards.length-1).refine(items=>new Set(items).size===items.length).default([]), nutritionMode: z.enum(["simple","advanced"]), waterGoal: z.number().int().min(250).max(6000), calorieGoal: z.number().int().min(800).max(6000), proteinGoal: z.number().int().min(0).max(500), fatGoal: z.number().int().min(0).max(300), carbsGoal: z.number().int().min(0).max(1000), onboardingDone: z.boolean(), accountOnboardingDone: z.boolean().default(false), onboardingFocus: z.enum(["planning","habits","balance"]).default("planning"), onboardingPace: z.enum(["gentle","structured","flexible"]).default("gentle"), calorieGoalSet: z.boolean() });
export const appDataSchema = z.object({ version: z.literal(1), tasks: z.array(taskSchema).max(10000), foods: z.array(foodSchema).max(30000), water: z.array(waterSchema).max(30000), habits: z.array(habitSchema).max(500), reviews:z.array(dayReviewSchema).max(10000).default([]), preferences: preferencesSchema });
export type Task = z.infer<typeof taskSchema>;
export type Food = z.infer<typeof foodSchema>;
export type Water = z.infer<typeof waterSchema>;
export type Habit = z.infer<typeof habitSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type AppData = z.infer<typeof appDataSchema>;
export type ModalState = { type:"task"; item?:Task } | { type:"food"; item?:Food; meal?:Food["meal"] } | { type:"water" } | { type:"habit"; item?:Habit } | { type:"calculator" } | { type:"scanner" } | { type:"auth"; method?:"email"; mode?:"login"|"signup" } | { type:"onboarding" } | null;
export const meals = { breakfast:"Завтрак", lunch:"Обед", dinner:"Ужин", snack:"Перекус" };
export const weekdays = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
export function emptyData(): AppData { return { version:1, tasks:[], foods:[], water:[], habits:[], reviews:[], preferences: { name:"", language:"ru", theme:"system", background:"classic", personalPhotos:{},dayIcons:{},cloudPhotoIds:[],photoTone:"mono",todayOrder:[...todayCards],todayHidden:[],nutritionMode:"simple", waterGoal:2000, calorieGoal:2000, proteinGoal:100, fatGoal:67, carbsGoal:250, onboardingDone:false, accountOnboardingDone:false, onboardingFocus:"planning", onboardingPace:"gentle", calorieGoalSet:false } }; }
export function readSavedData(raw:string):AppData { try { return appDataSchema.parse(JSON.parse(raw)); } catch { throw new Error("Не удалось прочитать сохранённые данные. Исходная копия сохранена; экспортируйте её перед сбросом."); } }
export function dayKey(date:Date = new Date()):string { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
export function dateFromKey(key:string):Date { return new Date(`${key}T12:00:00`); }
export function shiftDay(key:string, amount:number):string { const d=dateFromKey(key); d.setDate(d.getDate()+amount); return dayKey(d); }
export function weekDays(key:string):string[] { const d=dateFromKey(key); const offset=(d.getDay()+6)%7; return Array.from({length:7},(_,i)=>shiftDay(key,i-offset)); }
export function dateLabel(key:string,opts:Intl.DateTimeFormatOptions={day:"numeric",month:"long"}):string { return dateFromKey(key).toLocaleDateString("ru-RU",opts); }
export function taskOnDate(task:Task,date:string):boolean { if(date<task.date||task.excludedDates?.includes(date))return false; if(task.repeat==="none")return task.date===date; if(task.repeat==="daily")return true; const weekday=dateFromKey(date).getDay(); return task.repeat==="weekdays"?weekday!==0&&weekday!==6:weekday===dateFromKey(task.date).getDay(); }
export function taskDone(task:Task,date:string):boolean { return task.completedDates.includes(date); }
export function foodTotals(foods:Food[],date:string) { return foods.filter(f=>f.date===date).reduce((a,f)=>({calories:a.calories+f.calories,protein:a.protein+f.protein,fat:a.fat+f.fat,carbs:a.carbs+f.carbs}),{calories:0,protein:0,fat:0,carbs:0}); }
export function waterTotal(water:Water[],date:string):number { return water.filter(w=>w.date===date).reduce((a,w)=>a+w.amount,0); }
export function habitOnDate(habit:Habit,date:string):boolean { return habit.days.includes(dateFromKey(date).getDay()); }
export function habitStreak(habit:Habit,today:string):number { let count=0; for(let i=0;i<3660;i++){ const date=shiftDay(today,-i); if(!habitOnDate(habit,date))continue; if(habit.completions.includes(date))count++; else if(i!==0)break; } return count; }
const nutritionInputSchema = z.object({ age:z.number().int().min(18,"Расчёт доступен с 18 лет").max(100), sex:z.enum(["male","female"]), weight:z.number().min(35).max(300), height:z.number().min(130).max(230), activity:z.union([z.literal(1.2),z.literal(1.375),z.literal(1.55),z.literal(1.725),z.literal(1.9)]), goal:z.enum(["maintain","gain","lose","balanced"]) });
export type NutritionInput=z.infer<typeof nutritionInputSchema>;
export function calculateNutrition(raw:NutritionInput) { const p=nutritionInputSchema.parse(raw); const bmr=10*p.weight+6.25*p.height-5*p.age+(p.sex==="male"?5:-161); const tdee=Math.round(bmr*p.activity); const calories=Math.round(tdee*(p.goal==="lose"?.9:p.goal==="gain"?1.1:1)); const protein=Math.round(p.weight*(p.goal==="gain"?1.6:1.2)); const fat=Math.round(calories*.3/9); const carbs=Math.max(0,Math.round((calories-protein*4-fat*9)/4)); return { bmr:Math.round(bmr),tdee,calories,protein,fat,carbs }; }
export function dailyProgress(data:AppData,date:string):number { const tasks=data.tasks.filter(t=>taskOnDate(t,date)); const habits=data.habits.filter(h=>habitOnDate(h,date)); const parts:number[]=[]; if(tasks.length)parts.push(tasks.filter(t=>taskDone(t,date)).length/tasks.length); if(habits.length)parts.push(habits.filter(h=>h.completions.includes(date)).length/habits.length); parts.push(Math.min(1,waterTotal(data.water,date)/data.preferences.waterGoal)); if(data.foods.some(f=>f.date===date))parts.push(1); return Math.round(parts.reduce((a,v)=>a+v,0)/parts.length*100); }
