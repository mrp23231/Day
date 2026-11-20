import { describe, expect, it } from "vitest";
import { emptyData, type Food, type Task } from "./domain";
import { createSearchIndex, searchDay } from "./search";

const date="2026-11-07";
const task:Task={id:"same",title:"Записаться на приём",description:"Стоматолог на Пушкинской",category:"Здоровье",date:"2026-11-05",time:"09:00",priority:"normal",repeat:"none",completedDates:[]};
const food:Food={id:"same",name:"Гречневая каша",date:"2026-11-04",meal:"breakfast",grams:150,calories:180,protein:6,fat:2,carbs:35,favorite:false};
function records(){const data=emptyData();data.tasks=[task];data.foods=[food];data.habits=[{id:"same",name:"Читать 20 минут",icon:"book",days:[0,1,2,3,4,5,6],completions:[]}];return data;}

describe("global search",()=>{
  it("offers creation commands and every section without exposing arbitrary records for an empty query",()=>{
    const found=searchDay(createSearchIndex(records(),date),"   ");
    expect(found.filter(item=>item.kind==="action").map(item=>item.modal?.type)).toEqual(["task","food","water","habit"]);
    expect(found.filter(item=>item.kind==="page").map(item=>item.href)).toEqual(["/","/planner","/nutrition","/water","/habits","/progress","/assistant","/settings"]);
    expect(found.some(item=>["task","food","habit"].includes(item.kind))).toBe(false);
  });
  it("normalizes Russian case and е/ё and finds words in descriptions regardless of order",()=>{
    const index=createSearchIndex(records(),date);
    expect(searchDay(index,"  ПРИЕМ  ")[0].title).toBe("Записаться на приём");
    expect(searchDay(index,"пушкинской  стоматолог")[0].id).toBe("task:same");
    expect(searchDay(index,"здоровье приём")[0].kind).toBe("task");
  });
  it("ranks an exact record title before a prefix and a description match",()=>{
    const data=records();data.tasks=[{...task,id:"description",title:"Другой план",description:"Книга"},{...task,id:"prefix",title:"Книга на выходные"},{...task,id:"exact",title:"Книга"}];
    expect(searchDay(createSearchIndex(data,date),"книга").map(item=>item.id)).toEqual(["task:exact","task:prefix","task:description"]);
  });
  it("opens dated food and task records in their own existing editors",()=>{
    const index=createSearchIndex(records(),date);
    expect(searchDay(index,"Гречневая")[0]).toMatchObject({kind:"food",href:"/nutrition",date:"2026-11-04",modal:{type:"food",item:{id:"same"}}});
    expect(searchDay(index,"Записаться")[0]).toMatchObject({href:"/planner",date:"2026-11-05",modal:{type:"task",item:{id:"same"}}});
    expect(searchDay(index,"Читать")[0]).toMatchObject({href:"/habits",modal:{type:"habit",item:{id:"same"}}});
  });
  it("uses the selected occurrence for a recurring task, otherwise its start date",()=>{
    const data=records();data.tasks=[{...task,repeat:"daily"}];
    expect(searchDay(createSearchIndex(data,date),"Записаться")[0].date).toBe("2026-11-07");
    expect(searchDay(createSearchIndex(data,"2026-11-01"),"Записаться")[0].date).toBe("2026-11-05");
  });
  it("keeps identical meal names distinguishable by date and returns the recent entry first",()=>{
    const data=records();data.foods=[food,{...food,id:"new",date:"2026-11-06"}];
    const found=searchDay(createSearchIndex(data,date),"Гречневая");
    expect(found.map(item=>item.date)).toEqual(["2026-11-06","2026-11-04"]);
    expect(found[0].description).toContain("6 ноября");
  });
  it("does not leak earlier indexed records into a different account's empty data",()=>{
    const first=createSearchIndex(records(),date);
    expect(searchDay(first,"Гречневая")).toHaveLength(1);
    expect(searchDay(createSearchIndex(emptyData(),date),"Гречневая")).toHaveLength(0);
  });
});
