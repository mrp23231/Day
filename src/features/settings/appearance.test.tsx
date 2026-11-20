// @vitest-environment jsdom
import React, { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyData, type Preferences } from "@/lib/domain";
import { AppearanceSettings } from "./appearance";
const { TestContext }=await vi.hoisted(async()=>({TestContext:(await import("react")).createContext<Record<string,unknown>>({})}));
vi.mock("@/components/day-provider",async()=>{const {useContext}=await import("react");return {useDay:()=>useContext(TestContext)};});
// jsdom omits CSS.escape; these radio names contain only ASCII identifier characters.
beforeEach(()=>vi.stubGlobal("CSS",{escape:(value:string)=>value}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function Harness(){
  const [preferences,setPreferences]=useState(emptyData().preferences);
  const change=(partial:Partial<Preferences>)=>setPreferences(p=>({...p,...partial}));
  return <TestContext.Provider value={{data:{...emptyData(),preferences},ready:true,resolvedTheme:preferences.theme==="dark"?"dark":"light",setPreferences:change,setTheme:(theme:Preferences["theme"])=>change({theme})}}><AppearanceSettings/><output aria-label="Выбор">{preferences.theme}:{preferences.background}:{preferences.nutritionMode}</output></TestContext.Provider>;
}
it("selects a background by pointer and native radio arrow keys",async()=>{
  render(<Harness/>);
  await userEvent.click(screen.getByRole("radio",{name:/Горы/}));
  expect((screen.getByRole("radio",{name:/Горы/}) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByLabelText("Выбор").textContent).toBe("system:mountains:simple");
  await userEvent.keyboard("{ArrowRight}");
  expect((screen.getByRole("radio",{name:/Архитектура/}) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByLabelText("Выбор").textContent).toBe("system:architecture:simple");
});
it("keeps system mode and explicit toggle choice in agreement",async()=>{
  render(<Harness/>);
  const auto=screen.getByRole("checkbox",{name:"Как на устройстве"}) as HTMLInputElement;
  expect(auto.checked).toBe(true);
  await userEvent.click(screen.getByRole("switch",{name:"Тёмная тема"}));
  expect(auto.checked).toBe(false);
  expect(screen.getByRole("switch",{name:"Тёмная тема"}).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByLabelText("Выбор").textContent).toBe("dark:classic:simple");
  await userEvent.click(auto);
  expect(auto.checked).toBe(true);
  expect(screen.getByLabelText("Выбор").textContent).toBe("system:classic:simple");
});
it("keeps nutrition preference available after appearance changes",async()=>{
  render(<Harness/>);
  await userEvent.click(screen.getByRole("radio",{name:/Мягкий/}));
  await userEvent.click(screen.getByRole("button",{name:"Про"}));
  expect(screen.getByLabelText("Выбор").textContent).toBe("system:soft:advanced");
});
