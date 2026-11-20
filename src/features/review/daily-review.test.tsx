// @vitest-environment jsdom
import React, { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyData, type AppData, type Task } from "@/lib/domain";
import { DailyReview } from "./daily-review";
const {TestContext}=await vi.hoisted(async()=>({TestContext:(await import("react")).createContext<Record<string,unknown>>({})}));
vi.mock("@/components/day-provider",async()=>{const{useContext}=await import("react");return{useDay:()=>useContext(TestContext)};});
// Real primitive tests and browser QA cover timing/keyboard. Here only their
// controlled-value/confirm contracts are replaced to test the composed flow.
vi.mock("@/components/ui/rating-group",()=>({default:({value,onValueChange}:{value:number;onValueChange:(value:number)=>void})=><div><button onClick={()=>onValueChange(4.5)}>Оценить на 4,5</button><output aria-label="Оценка дня">{value}</output></div>}));
vi.mock("@/components/ui/motion-hold-to-confirm",()=>({default:({onConfirm,disabled}:{onConfirm:()=>void;disabled?:boolean})=><button disabled={disabled} onClick={onConfirm}>Подтвердить закрытие</button>}));
const date="2026-11-12";
const task=(id:string,done=false):Task=>({id,title:id,date,time:"",description:"",category:"Личное",priority:"normal",repeat:"none",completedDates:done?[date]:[]});
function Harness({selectedDate=date,account=null,initialData=emptyData()}:{selectedDate?:string;account?:string|null;initialData?:AppData}){
  const [data,setData]=useState(initialData);
  const update=(fn:(current:AppData)=>AppData)=>{const next=fn(data);setData(next);return next;};
  return <TestContext.Provider value={{data,update,ready:true,user:account?{id:account}:null,notify:()=>{},setDate:()=>{}}}><DailyReview date={selectedDate}/><output aria-label="Данные">{JSON.stringify(data)}</output></TestContext.Provider>;
}
const savedData=()=>JSON.parse(screen.getByLabelText("Данные").textContent!) as AppData;
function open(){fireEvent.click(screen.getByRole("button",{name:"Подвести итоги"}));}
function next(){fireEvent.click(screen.getByRole("button",{name:"Продолжить"}));}
beforeEach(()=>{vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2026-11-12T20:00:00"));vi.stubGlobal("IntersectionObserver",class{observe(){}unobserve(){}disconnect(){}});});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
it("keeps all choices draft-only until confirmation, then edits without moving tasks twice",()=>{
  render(<Harness initialData={{...emptyData(),tasks:[task("Прогулка",true),task("План на неделю")]}}/>);open();
  expect(screen.getByRole("heading",{name:"Ваш день в цифрах"})).toBeTruthy();next();
  fireEvent.click(screen.getByRole("checkbox",{name:"Перенести: План на неделю"}));
  expect(savedData().tasks[1].date).toBe(date);expect(savedData().reviews).toEqual([]);
  next();fireEvent.click(screen.getByRole("button",{name:"Оценить на 4,5"}));
  fireEvent.change(screen.getByRole("textbox",{name:"Несколько слов о дне"}),{target:{value:"Удалось найти время для себя"}});
  expect(savedData().reviews).toEqual([]);fireEvent.click(screen.getByRole("button",{name:"Подтвердить закрытие"}));
  const closed=savedData();expect(closed.tasks[1].date).toBe("2026-11-13");expect(closed.reviews[0]).toMatchObject({rating:4.5,note:"Удалось найти время для себя"});expect(closed.reviews[0].closedAt).toBeTruthy();expect(closed.reviews[0].snapshot?.tasks).toEqual({completed:1,total:2});
  fireEvent.click(screen.getByRole("button",{name:"Вернуться к дню"}));fireEvent.click(screen.getByRole("button",{name:"Открыть итоги"}));
  next();expect(screen.queryByRole("checkbox",{name:/Перенести:/})).toBeNull();next();
  expect((screen.getByRole("textbox",{name:"Несколько слов о дне"}) as HTMLTextAreaElement).value).toBe("Удалось найти время для себя");
  fireEvent.change(screen.getByRole("textbox",{name:"Несколько слов о дне"}),{target:{value:"Дополненная заметка"}});fireEvent.click(screen.getByRole("button",{name:"Сохранить изменения"}));
  const edited=savedData();expect(edited.tasks).toEqual(closed.tasks);expect(edited.reviews[0].snapshot).toEqual(closed.reviews[0].snapshot);expect(edited.reviews[0].closedAt).toBe(closed.reviews[0].closedAt);expect(edited.reviews[0].note).toBe("Дополненная заметка");
});
it("abandoning a draft never moves tasks or saves a review",()=>{
  const data={...emptyData(),tasks:[task("Оставить на сегодня")]};render(<Harness initialData={data}/>);open();next();fireEvent.click(screen.getByRole("checkbox",{name:"Перенести: Оставить на сегодня"}));fireEvent.click(screen.getByRole("button",{name:"Закрыть итоги"}));expect(savedData()).toEqual(data);expect(screen.queryByRole("dialog")).toBeNull();
});
it("discards the draft when selected date or account changes",()=>{
  const view=render(<Harness/>);open();next();next();fireEvent.change(screen.getByRole("textbox",{name:"Несколько слов о дне"}),{target:{value:"Черновик"}});view.rerender(<Harness selectedDate="2026-11-11"/>);expect(screen.queryByRole("dialog")).toBeNull();open();view.rerender(<Harness selectedDate="2026-11-11" account="other"/>);expect(screen.queryByRole("dialog")).toBeNull();expect(savedData().reviews).toEqual([]);
});
it("blocks future days and rechecks the clock before confirmation",()=>{
  const view=render(<Harness selectedDate="2026-11-13"/>);expect((screen.getByRole("button",{name:"Подвести итоги"}) as HTMLButtonElement).disabled).toBe(true);view.rerender(<Harness/>);open();next();next();vi.setSystemTime(new Date("2026-11-11T20:00:00"));fireEvent.click(screen.getByRole("button",{name:"Подтвердить закрытие"}));expect(within(screen.getByRole("dialog")).getByRole("alert").textContent).toMatch(/сегодняшнего или прошедшего/);expect(savedData().reviews).toEqual([]);
});
