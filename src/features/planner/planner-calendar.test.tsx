// @vitest-environment jsdom
import React, { type ReactNode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { emptyData, taskSchema, type Task } from "@/lib/domain";
import { Planner } from "./planner";

let initialDate = "2024-02-29";
let tasks: Task[] = [];
const openModal = vi.fn();
vi.mock("@/components/day-provider", () => ({ useDay: () => {
  const [date, setDate] = useState(initialDate);
  return { data: { ...emptyData(), tasks }, date, setDate, openModal, update: vi.fn(), notify: vi.fn() };
} }));
vi.mock("@/components/shared", () => ({
  Empty: ({ title }: { title: string }) => <p>{title}</p>, PageFooter: () => null, WeekStrip: () => null,
  TaskRow: ({ task }: { task: Task }) => <article>{task.title}</article>,
  PageHeading: ({ title, children }: { title: string; children?: ReactNode }) => <header><h1>{title}</h1>{children}</header>,
}));

function task(title: string, date: string, completed = false) {
  return taskSchema.parse({ id: title, title, date, description: "", time: "", priority: "normal", category: "Личное", repeat: "none", completedDates: completed ? [date] : [] });
}

beforeEach(() => {
  initialDate = "2024-02-29";
  tasks = [task("Leap day", "2024-02-29"), task("Finished", "2024-02-29", true)];
  openModal.mockClear();
});
afterEach(cleanup);

describe("planner calendar views", () => {
  it("opens twelve real month calendars and drills down to a leap day", () => {
    render(<Planner />);
    fireEvent.click(screen.getByRole("radio", { name: "Год" }));
    expect(screen.getAllByRole("grid")).toHaveLength(12);
    const february = screen.getByRole("grid", { name: "февраль 2024 г." });
    fireEvent.click(within(february).getByRole("button", { name: /29 февраля 2024/ }));
    expect(screen.getByRole("radio", { name: "День" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Leap day").tagName).toBe("ARTICLE");
  });

  it("moves by a year and clamps February 29 before returning to the day view", () => {
    render(<Planner />);
    fireEvent.click(screen.getByRole("radio", { name: "Год" }));
    fireEvent.click(screen.getByRole("button", { name: "Следующий период" }));
    expect(screen.getByRole("heading", { name: "2025" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "День" }));
    expect(screen.getByText("пятница, 28 февраля")).toBeTruthy();
  });

  it("opens a month from the year and applies the existing task filter", () => {
    render(<Planner />);
    fireEvent.click(screen.getByRole("radio", { name: "Год" }));
    fireEvent.click(screen.getByRole("button", { name: "Открыть февраль" }));
    expect(screen.getByRole("radio", { name: "Месяц" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.change(screen.getByRole("combobox", { name: "Фильтр задач" }), { target: { value: "done" } });
    expect(screen.queryByRole("button", { name: "Leap day" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Finished" }));
    expect(openModal).toHaveBeenCalledWith({ type: "task", item: tasks[1] });
    fireEvent.change(screen.getByRole("searchbox", { name: "Найти задачу" }), { target: { value: "no match" } });
    expect(screen.queryByRole("button", { name: "Finished" })).toBeNull();
  });
});
