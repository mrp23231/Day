// @vitest-environment jsdom
import React, { useState } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyData, type Preferences } from "@/lib/domain";
import { applyTheme } from "@/components/ui/theme-toggle";
import { useAppearance } from "./use-appearance";

class Media extends EventTarget { matches=false; addListener(){} removeListener(){} }
let device:Media;
beforeEach(()=>{
  device=new Media();const reduced=new Media();
  vi.stubGlobal("matchMedia",(query:string)=>query.includes("prefers-color-scheme")?device:reduced);
  vi.stubGlobal("CSS",{supports:()=>true});
  Object.defineProperty(document,"hidden",{configurable:true,value:false});
  document.startViewTransition=((change:()=>void)=>{change();return {ready:Promise.resolve(),finished:new Promise(()=>{}),updateCallbackDone:Promise.resolve(),skipTransition(){}};}) as typeof document.startViewTransition;
  document.documentElement.dataset.theme="light";
});
afterEach(async()=>{cleanup();await applyTheme("light",true);localStorage.clear();delete document.documentElement.dataset.background;vi.unstubAllGlobals();delete (document as unknown as Record<string,unknown>).startViewTransition;});
function Harness({ready=true,initial=emptyData().preferences}:{ready?:boolean;initial?:Preferences}) {
  const [preferences,setPreferences]=useState(initial);
  const {resolvedTheme,setTheme}=useAppearance(preferences,ready,partial=>setPreferences(p=>({...p,...partial})));
  return <><button onClick={()=>setTheme("dark",{x:40,y:40})}>Тёмная</button><button onClick={()=>setTheme("light")}>Светлая</button><button onClick={()=>setTheme("system")}>Система</button><button onClick={()=>setPreferences(p=>({...p,background:"mountains"}))}>Горы</button><output aria-label="Режим">{preferences.theme}:{resolvedTheme}</output></>;
}
it("persists a user choice without canceling its reveal on another preference update",async()=>{
  render(<Harness/>);
  await userEvent.click(screen.getByRole("button",{name:"Тёмная"}));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.documentElement.dataset.themeReveal).toBe("dark");
  expect(localStorage.getItem("day-theme")).toBe("dark");
  expect(screen.getByLabelText("Режим").textContent).toBe("dark:dark");
  await userEvent.click(screen.getByRole("button",{name:"Горы"}));
  expect(localStorage.getItem("day-background")).toBe("mountains");
  expect(document.documentElement.dataset.background).toBe("mountains");
  expect(document.documentElement.dataset.themeReveal).toBe("dark");
});
it("observes system changes quietly and stops following them after a manual choice",async()=>{
  device.matches=true;
  render(<Harness/>);
  expect(screen.getByLabelText("Режим").textContent).toBe("system:dark");
  expect(document.documentElement.dataset.themeReveal).toBeUndefined();
  await act(async()=>{device.matches=false;device.dispatchEvent(new Event("change"));});
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(localStorage.getItem("day-theme")).toBe("system");
  await userEvent.click(screen.getByRole("button",{name:"Тёмная"}));
  await act(async()=>{device.dispatchEvent(new Event("change"));});
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(screen.getByLabelText("Режим").textContent).toBe("dark:dark");
});
it("keeps prepaint appearance until saved preferences are ready",()=>{
  document.documentElement.dataset.theme="dark";document.documentElement.dataset.background="architecture";
  const view=render(<Harness ready={false}/>);
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.documentElement.dataset.background).toBe("architecture");
  expect(localStorage.getItem("day-theme")).toBeNull();
  view.rerender(<Harness ready/>);
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(document.documentElement.dataset.background).toBe("classic");
});
