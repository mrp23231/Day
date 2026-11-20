// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyData, type AppData, type Task } from "@/lib/domain";
import { Overview } from "./overview";
vi.mock("@/features/focus/focus-provider",()=>({FocusLauncher:()=> <button>Фокус</button>}));
const { DayTestContext } = await vi.hoisted(async () => {
  const { createContext } = await import("react");
  return { DayTestContext: createContext<Record<string, unknown>>({}) };
});
vi.mock("@/components/day-provider", async () => {
  const { useContext } = await import("react");
  return { useDay: () => useContext(DayTestContext) };
});
const task=(id:string,extra:Partial<Task>={}):Task=>({id,title:id,date:"2026-11-07",time:"",description:"",category:"Личное",priority:"normal",repeat:"none",completedDates:[],...extra});
function Harness({tasks=[],initialDate="2026-11-07"}:{tasks?:Task[];initialDate?:string}){
  const [data,setData]=useState<AppData>({...emptyData(),tasks});
  const [date,setDate]=useState(initialDate);
  const contextValue={data,date,setDate,ready:true,openModal:()=>{},notify:()=>{},addWater:()=>{},toggleHabit:()=>{},update:setData,toggleTask:(id:string,target=date)=>setData(d=>({...d,tasks:d.tasks.map(t=>t.id===id?{...t,completedDates:t.completedDates.includes(target)?t.completedDates.filter(v=>v!==target):[...t.completedDates,target]}:t)}))};
  return <DayTestContext.Provider value={contextValue}><Overview/></DayTestContext.Provider>;
}
beforeEach(()=>{vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2026-11-07T10:00:00"));});
afterEach(()=>{cleanup();vi.useRealTimers();});

describe("Today task flow",()=>{
  it("filters important work without losing the full plan or completed tasks",async()=>{
    render(<Harness tasks={[task("Покупки"),task("Встреча",{priority:"high"}),task("Сделано",{priority:"high",completedDates:["2026-11-07"]})]}/>);
    const plan=screen.getByRole("region",{name:"План на день"});
    await userEvent.click(within(plan).getByRole("button",{name:/^Важные/}));
    expect(within(plan).queryByRole("button",{name:/Покупки/})).toBeNull();
    expect(within(plan).getByRole("button",{name:/^Встреча/})).toBeTruthy();
    expect(screen.getByRole("img",{name:"Выполнено задач: 1 из 3"})).toBeTruthy();
    await userEvent.click(within(plan).getByRole("button",{name:"Все"}));
    expect(within(plan).getByRole("button",{name:/^Покупки/})).toBeTruthy();
    await userEvent.click(screen.getByText("Завершено",{exact:true}));
    expect(screen.getByRole("checkbox",{name:"Выполнить: Сделано"})).toBeTruthy();
  });
  it("completes prior work on its original date and removes it from attention",async()=>{
    render(<Harness tasks={[task("Заказ",{date:"2026-11-05"})]}/>);
    const backlog=screen.getByRole("region",{name:"Требуют внимания"});
    await userEvent.click(within(backlog).getByRole("checkbox",{name:"Выполнить: Заказ"}));
    expect(screen.queryByRole("region",{name:"Требуют внимания"})).toBeNull();
    // Return to the original occurrence: the task must be done there too.
    await userEvent.click(screen.getByRole("button",{name:"четверг, 5 ноября"}));
    await userEvent.click(screen.getByText("Завершено",{exact:true}));
    expect((screen.getByRole("checkbox",{name:"Выполнить: Заказ"}) as HTMLInputElement).checked).toBe(true);
  });
  it("keeps keyboard focus available after a row moves to completed",async()=>{
    render(<Harness tasks={[task("Заметки")]}/>);
    await userEvent.click(screen.getByRole("checkbox",{name:"Выполнить: Заметки"}));
    const summary=screen.getByText("Завершено",{exact:true}).closest("summary");
    await waitFor(()=>expect(document.activeElement).toBe(summary));
    await userEvent.click(screen.getByText("Завершено",{exact:true}));
    await userEvent.click(screen.getByRole("checkbox",{name:"Выполнить: Заметки"}));
    await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole("heading",{name:"План на день"})));
    expect(screen.getByRole("checkbox",{name:"Выполнить: Заметки"})).toBeTruthy();
  });
  it("shows every active task after the fifth row",()=>{
    render(<Harness tasks={Array.from({length:8},(_,i)=>task(`Дело ${i+1}`))}/>);
    expect(screen.getByRole("checkbox",{name:"Выполнить: Дело 8"})).toBeTruthy();
  });
  it("returns from a selected future day to the current day",async()=>{
    render(<Harness initialDate="2026-11-08" tasks={[task("Сегодняшнее"),task("Завтрашнее",{date:"2026-11-08"})]}/>);
    expect(screen.queryByRole("region",{name:"Требуют внимания"})).toBeNull();
    await userEvent.click(screen.getByRole("button",{name:"Вернуться к сегодня"}));
    expect(screen.getByRole("checkbox",{name:"Выполнить: Сегодняшнее"})).toBeTruthy();
    expect(screen.queryByRole("checkbox",{name:"Выполнить: Завтрашнее"})).toBeNull();
  });
});
