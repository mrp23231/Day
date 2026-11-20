// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Task } from "@/lib/domain";
import { QuickTaskForm } from "./quick-task-form";

afterEach(cleanup);

describe("inline task creation", () => {
  it("creates a trimmed task on Enter for the selected day and leaves the input ready", async () => {
    const added: Task[] = [];
    render(<QuickTaskForm date="2026-11-06" onAdd={task=>added.push(task)}/>);
    const input = screen.getByRole("textbox", {name:"Быстро добавить задачу"}) as HTMLInputElement;
    await userEvent.type(input,"  Записаться на встречу  {Enter}");
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({title:"Записаться на встречу",date:"2026-11-06",time:"",repeat:"none",priority:"normal",completedDates:[]});
    expect(added[0].id).toBeTruthy();
    expect(input.value).toBe("");
    expect(document.activeElement).toBe(input);
  });

  it("does not create blank tasks or duplicate the last task on another Enter", async () => {
    const added: Task[] = [];
    render(<QuickTaskForm date="2026-11-06" onAdd={task=>added.push(task)}/>);
    const input = screen.getByRole("textbox", {name:"Быстро добавить задачу"});
    await userEvent.type(input,"   {Enter}");
    expect(added).toHaveLength(0);
    await userEvent.clear(input);
    await userEvent.type(input,"Прогулка{Enter}{Enter}");
    expect(added).toHaveLength(1);
  });

  it("adds a draft to the newly selected date after navigating", async () => {
    const added: Task[] = [];
    const view = render(<QuickTaskForm date="2026-11-06" onAdd={task=>added.push(task)}/>);
    await userEvent.type(screen.getByRole("textbox"),"Проверить план");
    view.rerender(<QuickTaskForm date="2026-11-09" onAdd={task=>added.push(task)}/>);
    await userEvent.click(screen.getByRole("button",{name:"Добавить задачу в план"}));
    expect(added[0].date).toBe("2026-11-09");
    expect(added[0].title).toBe("Проверить план");
  });
});
