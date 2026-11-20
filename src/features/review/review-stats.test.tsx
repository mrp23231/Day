// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ReviewStats } from "./review-stats";

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  vi.stubGlobal("matchMedia", (media: string) => ({ matches: false, media, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("review result statistics", () => {
  it("exposes actual final counts and completed task titles before any animation", () => {
    render(<ReviewStats date="2026-11-12" summary={{
      tasks: { completed: 3, total: 4 },
      habits: { completed: 2, total: 3 },
      water: { amount: 1250, goal: 2000 },
      food: { entries: 2, calories: 830 },
    }} completedTasks={[{ id: "walk", title: "Прогуляться у реки" }, { id: "book", title: "Прочитать главу" }]} />);

    expect(screen.getByText("Задачи: 3 из 4 выполнено, 75%.")).toBeTruthy();
    expect(screen.getByText("2 из 3 отмечено")).toBeTruthy();
    expect(screen.getByText("1 250 мл из цели 2 000 мл")).toBeTruthy();
    expect(screen.getByText("2 записи, 830 ккал")).toBeTruthy();
    const tasks = screen.getByRole("list", { name: "Выполненные задачи" });
    expect(within(tasks).getAllByRole("listitem")).toHaveLength(2);
    expect(within(tasks).getByText("Прогуляться у реки")).toBeTruthy();
    expect(within(tasks).getByText("Прочитать главу")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("does not turn an empty day into a positive completion percentage or invented activity", () => {
    render(<ReviewStats date="2026-11-12" summary={{
      tasks: { completed: 0, total: 0 },
      habits: { completed: 0, total: 0 },
      water: { amount: 0, goal: 2000 },
      food: { entries: 0, calories: 0 },
    }} />);

    expect(screen.getByText("На этот день задач не было.")).toBeTruthy();
    expect(screen.getByText("Задачи: 0 из 0 выполнено.")).toBeTruthy();
    expect(screen.queryByText(/100%/)).toBeNull();
    expect(screen.queryByRole("list", { name: "Выполненные задачи" })).toBeNull();
    expect(screen.getByText("0 из 0 отмечено")).toBeTruthy();
    expect(screen.getByText("0 записей, 0 ккал")).toBeTruthy();
  });
});
