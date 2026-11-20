// @vitest-environment jsdom
import React, { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyData, todayCards, type AppData } from "@/lib/domain";
import { TodayLayoutEditor } from "./today-layout-editor";
const { TestContext }=await vi.hoisted(async()=>({TestContext:(await import("react")).createContext<Record<string,unknown>>({})}));
vi.mock("@/components/day-provider",async()=>{const {useContext}=await import("react");return {useDay:()=>useContext(TestContext)};});
vi.mock("@/features/appearance/photo-editor",async()=>{const {Dialog}=await import("@/components/ui/dialog");return {PhotoEditor:({target,onClose}:{target:string;onClose:()=>void})=><Dialog open title={`Фото ${target}`} onClose={onClose}><p>Фото блока</p></Dialog>};});
vi.mock("@/features/focus/focus-provider",()=>({FocusLauncher:()=> <button>Фокус</button>}));
const notify=vi.fn();
function Harness({hidden=[]}:{hidden?:AppData["preferences"]["todayHidden"]}){
  const [data,setData]=useState(()=>({...emptyData(),preferences:{...emptyData().preferences,todayHidden:hidden}}));
  return <TestContext.Provider value={{data,ready:true,notify,update:(fn:(d:AppData)=>AppData)=>{setData(fn);}}}>
    <TodayLayoutEditor cards={Object.fromEntries(todayCards.map(card=>[card,<section key={card}><h2>{card}</h2><button onClick={()=>notify("content")}>Action {card}</button></section>])) as Record<typeof todayCards[number],React.ReactNode>}/>
    <output aria-label="Порядок">{data.preferences.todayOrder.join(",")}</output>
  </TestContext.Provider>;
}
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal("matchMedia",()=>({matches:false,addEventListener:()=>{},removeEventListener:()=>{}}));});
afterEach(()=>{cleanup();if(vi.isFakeTimers())act(()=>{vi.runOnlyPendingTimers();});vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});
it("enters editing only after a stationary hold and keeps short taps harmless",()=>{
  vi.useFakeTimers();render(<Harness/>);
  const card=document.querySelector('[data-home-card="water"]')!;
  fireEvent.mouseDown(card,{button:0,clientX:20,clientY:20});act(()=>{vi.advanceTimersByTime(200);});fireEvent.mouseUp(document);
  expect(screen.queryByRole("toolbar",{name:"Настройка главной"})).toBeNull();
  fireEvent.mouseDown(card,{button:0,clientX:20,clientY:20});act(()=>{vi.advanceTimersByTime(600);});fireEvent.mouseUp(document);
  expect(screen.getByRole("toolbar",{name:"Настройка главной"})).toBeTruthy();
  expect(document.querySelector('[data-home-card="water"] [inert]')).toBeTruthy();
  expect(screen.getByLabelText("Порядок").textContent).toBe("plan,next,habits,water,food,review");
});
it("does not turn a task control hold or a scrolling movement into editing",()=>{
  vi.useFakeTimers();render(<Harness/>);
  fireEvent.mouseDown(screen.getByRole("button",{name:"Action water"}),{button:0,clientX:20,clientY:20});act(()=>{vi.advanceTimersByTime(600);});fireEvent.mouseUp(document);
  expect(screen.queryByRole("toolbar",{name:"Настройка главной"})).toBeNull();
  const card=document.querySelector('[data-home-card="water"]')!;
  fireEvent.mouseDown(card,{button:0,clientX:20,clientY:20});fireEvent.mouseMove(document,{clientX:20,clientY:50});act(()=>{vi.advanceTimersByTime(600);});fireEvent.mouseUp(document);
  expect(screen.queryByRole("toolbar",{name:"Настройка главной"})).toBeNull();
});
it("moves with accessible controls, retains hidden slots and exits with Escape",async()=>{
  render(<Harness hidden={["next"]}/>);
  await userEvent.click(screen.getByRole("button",{name:"Настроить главную"}));
  await userEvent.click(screen.getByRole("button",{name:"Выше: Привычки"}));
  expect(screen.getByLabelText("Порядок").textContent).toBe("habits,next,plan,water,food,review");
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("toolbar",{name:"Настройка главной"})).toBeNull();
  expect(document.querySelector('[data-home-card="water"] [inert]')).toBeNull();
});
it("opens photo editing in place and keeps edit mode when its dialog closes",async()=>{
  render(<Harness/>);await userEvent.click(screen.getByRole("button",{name:"Настроить главную"}));
  await userEvent.click(screen.getByRole("button",{name:"Изменить: Вода"}));
  expect(screen.getByRole("dialog",{name:"Фото water"})).toBeTruthy();
  await userEvent.keyboard("{Escape}");
  expect(screen.getByRole("toolbar",{name:"Настройка главной"})).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
  await userEvent.click(screen.getByRole("button",{name:"Готово"}));
  expect(screen.queryByRole("toolbar",{name:"Настройка главной"})).toBeNull();
});
it("prevents hiding the last visible block and can restore hidden ones",async()=>{
  render(<Harness hidden={["next","habits","water","food","review"]}/>);await userEvent.click(screen.getByRole("button",{name:"Настроить главную"}));
  expect((screen.getByRole("button",{name:"Скрыть: План на день"}) as HTMLButtonElement).disabled).toBe(true);
  await userEvent.click(screen.getByRole("button",{name:/Скрытые блоки/}));
  await userEvent.click(screen.getByRole("button",{name:"Показать: Вода"}));
  expect(document.querySelector('[data-home-card="water"]')).toBeTruthy();
});

it("cancels pending holds on window blur and keeps order when an active drag is cancelled",()=>{
  vi.useFakeTimers();render(<Harness/>);
  let card=document.querySelector('[data-home-card="water"]')!;
  fireEvent.mouseDown(card,{button:0,clientX:20,clientY:20});act(()=>{vi.advanceTimersByTime(200);});fireEvent.blur(window);act(()=>{vi.advanceTimersByTime(600);});
  expect(screen.queryByRole("toolbar",{name:"Настройка главной"})).toBeNull();
  card=document.querySelector('[data-home-card="water"]')!;
  fireEvent.mouseDown(card,{button:0,clientX:20,clientY:20});act(()=>{vi.advanceTimersByTime(600);});fireEvent.keyDown(document,{code:"Escape",key:"Escape"});
  expect(screen.getByRole("toolbar",{name:"Настройка главной"})).toBeTruthy();
  expect(screen.getByLabelText("Порядок").textContent).toBe("plan,next,habits,water,food,review");
});
it("allows touch scrolling before activation and enters editing after a touch hold",()=>{
  vi.useFakeTimers();render(<Harness/>);
  const card=document.querySelector('[data-home-card="water"]')!;
  const touch={identifier:1,clientX:30,clientY:30};
  fireEvent.touchStart(card,{touches:[touch]});fireEvent.touchMove(card,{touches:[{...touch,clientY:60}]});act(()=>{vi.advanceTimersByTime(600);});fireEvent.touchEnd(card,{touches:[],changedTouches:[touch]});
  expect(screen.queryByRole("toolbar",{name:"Настройка главной"})).toBeNull();
  fireEvent.touchStart(card,{touches:[touch]});act(()=>{vi.advanceTimersByTime(600);});fireEvent.touchEnd(card,{touches:[],changedTouches:[touch]});
  expect(screen.getByRole("toolbar",{name:"Настройка главной"})).toBeTruthy();
  expect(screen.getByLabelText("Порядок").textContent).toBe("plan,next,habits,water,food,review");
});


it("never commits a moved drag released after the window loses focus",()=>{
  vi.useFakeTimers();
  vi.spyOn(HTMLElement.prototype,"getBoundingClientRect").mockImplementation(function(this:HTMLElement){
    const ids=["plan","next","habits","water","food","review"];
    const card=this.closest("[data-home-card]");
    const y=card?ids.indexOf(card.getAttribute("data-home-card")!)*200:0;
    return {top:y,left:0,bottom:y+150,right:300,width:300,height:150,x:0,y,toJSON:()=>({})} as DOMRect;
  });
  render(<Harness/>);
  fireEvent.mouseDown(document.querySelector('[data-home-card="water"]')!,{button:0,clientX:50,clientY:650});
  act(()=>{vi.advanceTimersByTime(600);});fireEvent.mouseMove(document,{clientX:50,clientY:450});act(()=>{vi.advanceTimersByTime(100);});
  fireEvent.blur(window);fireEvent.mouseUp(document);
  expect(screen.getByLabelText("Порядок").textContent).toBe("plan,next,habits,water,food,review");
});

it("does not exit editing for an Escape already consumed by a closing dialog",async()=>{
  render(<Harness/>);await userEvent.click(screen.getByRole("button",{name:"Настроить главную"}));
  const consumed=new KeyboardEvent("keydown",{key:"Escape",code:"Escape",bubbles:true,cancelable:true});consumed.preventDefault();fireEvent(document,consumed);
  expect(screen.getByRole("toolbar",{name:"Настройка главной"})).toBeTruthy();
});
