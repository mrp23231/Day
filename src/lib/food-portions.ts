import type { Food } from "./domain";
export type FoodNutrition = Pick<Food,"calories"|"protein"|"fat"|"carbs">;
// Approximate household weights; sources and volume conversions: docs/food-ai.md.
// These are food-specific estimates, not a universal conversion from ml to grams.
export const portionMeasures = [
  {id:"rice-spoon",label:"Рис, готовый · ложка 15 мл без горки",grams:10},
  {id:"rice-cup",label:"Рис, готовый · чашка 200 мл",grams:134},
  {id:"milk-glass",label:"Молоко · стакан 250 мл",grams:258},
  {id:"bread-slice",label:"Хлеб · средний ломтик",grams:30},
  {id:"egg",label:"Яйцо · 1 штука без скорлупы",grams:50},
  {id:"banana",label:"Банан · средний, без кожуры",grams:120},
  {id:"apple",label:"Яблоко · среднее",grams:140},
] as const;
function validGrams(grams:number){return Number.isFinite(grams)&&grams>=1&&grams<=10000;}
export function scaleFoodNutrition(nutrition:FoodNutrition, fromGrams:number, toGrams:number):FoodNutrition {
  if(!validGrams(fromGrams)||!validGrams(toGrams))throw new Error("Invalid portion weight");
  const scale=(value:number)=>{
    if(!Number.isFinite(value)||value<0||value>50000)throw new Error("Invalid nutrition value");
    if(fromGrams===toGrams)return value;
    const scaled=Math.round(value*toGrams/fromGrams*10)/10;
    if(!Number.isFinite(scaled)||scaled>50000)throw new Error("Nutrition value exceeds supported range");
    return scaled;
  };
  return {calories:scale(nutrition.calories),protein:scale(nutrition.protein),fat:scale(nutrition.fat),carbs:scale(nutrition.carbs)};
}
export function estimatePortionGrams(preset:string,quantity:number):number {
  const measure=portionMeasures.find(measure=>measure.id===preset);
  if(!measure||!Number.isFinite(quantity)||quantity<=0)throw new Error("Invalid portion measure");
  const grams=Math.round(measure.grams*quantity);
  if(!validGrams(grams))throw new Error("Invalid portion weight");
  return grams;
}
