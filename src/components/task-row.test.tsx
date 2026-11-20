// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Task } from "@/lib/domain";
import { TaskRow } from "./shared";

const { DayTestContext } = await vi.hoisted(async () => {
  const { createContext } = await import("react");
  return { DayTestContext: createContext<Record<string, unknown>>({}) };
});
vi.mock("./day-provider", async () => {
  const { useContext } = await import("react");
  return { useDay: () => useContext(DayTestContext) };
});
afterEach(cleanup);
const task: Task = {id:"past",title:"Забрать заказ",date:"2026-11-05",time:"12:00",description:"",category:"Личное",priority:"normal",repeat:"none",completedDates:[]};

function Harness({occurrenceDate}:{occurrenceDate?:string}) {
  const [value, setValue] = useState(task);
  const contextValue = {date:"2026-11-07", openModal:()=>{}, toggleTask:(id:string,date="2026-11-07")=>setValue(t=>({...t,completedDates:t.completedDates.includes(date)?[]:[date]}))};
  return <DayTestContext.Provider value={contextValue}><TaskRow task={value} occurrenceDate={occurrenceDate}/><output aria-label="Дата выполнения">{value.completedDates.join(",")}</output></DayTestContext.Provider>;
}

describe("task occurrence controls",()=>{
  it("completes and undoes an overdue task on its original occurrence",async()=>{
    render(<Harness occurrenceDate="2026-11-05"/>);
    const check=screen.getByRole("checkbox");
    await userEvent.click(check);
    expect(screen.getByLabelText("Дата выполнения").textContent).toBe("2026-11-05");
    expect((check as HTMLInputElement).checked).toBe(true);
    await userEvent.click(check);
    expect(screen.getByLabelText("Дата выполнения").textContent).toBe("");
  });
  it("keeps the selected-date default for normal planner rows",async()=>{
    render(<Harness/>);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByLabelText("Дата выполнения").textContent).toBe("2026-11-07");
  });
});
