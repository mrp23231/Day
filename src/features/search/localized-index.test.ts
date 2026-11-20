import { expect, it } from "vitest";
import { createSearchIndex, searchDay } from "@/lib/search";
import { emptyData } from "@/lib/domain";

it("finds English pages and actions while preserving user-entered task titles", () => {
  const data=emptyData();
  data.tasks.push({id:"1",title:"Купить кофе",description:"",date:"2026-11-14",time:"",priority:"normal",category:"Личное",repeat:"none",completedDates:[]});
  const index=createSearchIndex(data,"2026-11-14","en");
  expect(searchDay(index,"nutrition").some(x=>x.href==="/nutrition")).toBe(true);
  expect(searchDay(index,"new task")[0]?.title).toBe("New task");
  expect(searchDay(index,"кофе")[0]?.title).toBe("Купить кофе");
  expect(searchDay(index,"кофе")[0]?.description).toContain("Personal");
});
it("indexes Italian meal names and dates", () => {
 const data=emptyData();
 data.foods.push({id:"f",name:"Pasta",date:"2026-11-14",meal:"lunch",grams:100,calories:200,protein:4,fat:2,carbs:30,favorite:false});
 const index=createSearchIndex(data,"2026-11-14","it");
 expect(searchDay(index,"pranzo")[0]?.description).toContain("14 novembre 2026");
 expect(searchDay(index,"impostazioni")[0]?.href).toBe("/settings");
});
