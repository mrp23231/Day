// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyData, type Task } from "@/lib/domain";
import { FocusLauncher, FocusProvider } from "./focus-provider";

const { TestContext }=await vi.hoisted(async()=>({TestContext:(await import("react")).createContext<Record<string,unknown>>({})}));
vi.mock("@/components/day-provider",async()=>{const{useContext}=await import("react");return{useDay:()=>useContext(TestContext)};});
const date="2026-11-08";
const task:Task={id:"one",title:"Подготовить проект",description:"",date,time:"11:00",priority:"normal",category:"Работа",repeat:"none",completedDates:[]};
const notify=vi.fn(),toggleTask=vi.fn(),openModal=vi.fn();
function App({tasks=[task],user=null}:{tasks?:Task[];user?:{id:string}|null}) {
  return <TestContext.Provider value={{data:{...emptyData(),tasks},ready:true,user,notify,toggleTask,openModal}}><FocusProvider><FocusLauncher/></FocusProvider></TestContext.Provider>;
}
beforeEach(()=>{vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date(2026,10,8,10));localStorage.clear();vi.clearAllMocks();});
afterEach(()=>{cleanup();vi.useRealTimers();});

async function startFocus(){
  fireEvent.click(screen.getByRole("button",{name:"Фокус"}));
  fireEvent.click(screen.getByRole("button",{name:"Начать фокус"}));
}

describe("focus experience",()=>{
  it("lets the user explicitly finish their task before the timer ends",async()=>{
    render(<App/>);await startFocus();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button",{name:"Задача готова"}));
    expect(toggleTask).toHaveBeenCalledWith("one",date);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("runs one real task, keeps a paused session after reload and never auto-completes it",async()=>{
    const first=render(<App/>);
    await startFocus();
    expect(screen.getByRole("dialog").textContent).toContain(task.title);
    fireEvent.click(screen.getByRole("button",{name:"Пауза"}));
    fireEvent.click(screen.getByRole("button",{name:"Закрыть"}));
    expect(screen.getByRole("button",{name:/Открыть фокус/}).textContent).toContain("25:00");
    first.unmount();render(<App/>);
    fireEvent.click(await screen.findByRole("button",{name:/Открыть фокус/}));
    expect(screen.getByRole("button",{name:"Продолжить"})).toBeTruthy();
    expect(toggleTask).not.toHaveBeenCalled();
  });
  it("requires an explicit start when the task countdown ends and explicit completion when focus ends",async()=>{
    render(<App/>);
    fireEvent.click(screen.getByRole("button",{name:"Фокус"}));
    fireEvent.click(screen.getByRole("button",{name:"Ждать до 11:00"}));
    expect(screen.getByRole("dialog").textContent).toContain("До начала задачи");
    act(()=>{vi.setSystemTime(new Date(2026,10,8,11,1));document.dispatchEvent(new Event("visibilitychange"));});
    expect(screen.getByRole("dialog").textContent).toContain("Можно начинать");
    expect(toggleTask).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"Начать сейчас"}));
    act(()=>{vi.setSystemTime(new Date(2026,10,8,11,27));document.dispatchEvent(new Event("visibilitychange"));});
    const dialog=screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Время фокуса завершено");
    expect(toggleTask).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button",{name:"Завершить задачу"}));
    expect(toggleTask).toHaveBeenCalledWith("one",date);
    expect(screen.queryByRole("button",{name:/Открыть фокус/})).toBeNull();
  });
  it("removes a session when its task is completed or deleted outside focus",async()=>{
    const view=render(<App/>);await startFocus();
    fireEvent.click(screen.getByRole("button",{name:"Закрыть"}));
    view.rerender(<App tasks={[{...task,completedDates:[date]}]}/>);
    await waitFor(()=>expect(screen.queryByRole("button",{name:/Открыть фокус/})).toBeNull());
  });
  it("does not expose the guest session in a different account and restores it on return",async()=>{
    const view=render(<App/>);await startFocus();
    fireEvent.click(screen.getByRole("button",{name:"Закрыть"}));
    view.rerender(<App user={{id:"another-account"}}/>);
    expect(screen.queryByRole("button",{name:/Открыть фокус/})).toBeNull();
    view.rerender(<App/>);
    expect(await screen.findByRole("button",{name:/Открыть фокус/})).toBeTruthy();
  });
  it("offers the existing task editor for an empty day instead of inventing a task",async()=>{
    render(<App tasks={[]}/>);
    fireEvent.click(screen.getByRole("button",{name:"Фокус"}));
    expect(screen.queryByRole("button",{name:"Начать фокус"})).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Добавить задачу"}));
    expect(openModal).toHaveBeenCalledWith({type:"task"});
    expect(toggleTask).not.toHaveBeenCalled();
  });
});
