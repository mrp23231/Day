// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyData, type AppData, type Food } from "@/lib/domain";
import { Nutrition } from "./nutrition";
const { DayTestContext } = await vi.hoisted(async () => {
  const { createContext } = await import("react");
  return { DayTestContext: createContext<Record<string, unknown>>({}) };
});
vi.mock("@/components/day-provider", async () => {
  const { useContext } = await import("react");
  return { useDay: () => useContext(DayTestContext) };
});
vi.mock("@/features/progress/activity-chart", () => ({ ActivityChart: () => <div /> }));
vi.mock("@/components/shared", () => ({
  DatePicker: () => <button>Выбрать дату</button>,
  Enter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PageFooter: () => null,
  Ring: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PageHeading: ({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) => <header><h1>{title}</h1><p>{subtitle}</p>{children}</header>,
}));
const food = (id: string, extra: Partial<Food> = {}): Food => ({ id, name: "Овсянка", date: "2026-11-21", meal: "breakfast", grams: 200, calories: 250, protein: 10, fat: 5, carbs: 40, favorite: false, ...extra });
let data: AppData;
let openModal: ReturnType<typeof vi.fn>;
let setPreferences: ReturnType<typeof vi.fn>;
function harness() {
  return <DayTestContext.Provider value={{ data, date: "2026-11-21", openModal, setPreferences, update: (fn: (value: AppData) => AppData) => { data = fn(data); } }}><Nutrition /></DayTestContext.Provider>;
}
beforeEach(() => { data = emptyData(); openModal = vi.fn(); setPreferences = vi.fn(); });
afterEach(cleanup);

describe("nutrition daily journal", () => {
  it("summarizes the selected date and opens the right meal without inserting food", () => {
    data.foods = [food("one"), food("two", { meal: "lunch", name: "Суп", calories: 300 }), food("other-day", { date: "2026-11-20", calories: 900 })];
    render(harness());
    const balance = screen.getByRole("region", { name: "Баланс за день" });
    expect(within(balance).getByText("550")).toBeTruthy();
    expect(within(balance).getByText(/1\s450/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Добавить: Ужин" }));
    expect(openModal).toHaveBeenLastCalledWith({ type: "food", meal: "dinner" });
    expect(data.foods).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Сканировать еду" }));
    expect(openModal).toHaveBeenLastCalledWith({ type: "scanner" });
  });

  it("keeps favorite toggling and reuse connected to the actual diary", () => {
    data.foods = [food("favorite", { favorite: true, date: "2026-11-20" }), food("today", { name: "Суп" })];
    render(harness());
    fireEvent.click(screen.getByRole("button", { name: "Повторить блюдо: Овсянка" }));
    expect(openModal).toHaveBeenCalledWith({ type: "food", item: { ...data.foods[0], id: "", date: "2026-11-21" } });
    fireEvent.click(screen.getByRole("button", { name: "Добавить в избранное: Суп" }));
    expect(data.foods.find(value => value.id === "today")?.favorite).toBe(true);
  });

  it("persists simple or detailed mode while always allowing manual entry", () => {
    render(harness());
    fireEvent.click(screen.getByRole("button", { name: "Продвинутый" }));
    expect(setPreferences).toHaveBeenCalledWith({ nutritionMode: "advanced" });
    fireEvent.click(screen.getByRole("button", { name: "Записать вручную" }));
    expect(openModal).toHaveBeenCalledWith({ type: "food" });
  });

  it("keeps estimated meals visibly marked in the saved diary", () => {
    data.foods = [food("estimate", { estimated: true, calories: 275 })];
    render(harness());
    const breakfast = screen.getByRole("region", { name: "Завтрак" });
    expect(within(breakfast).getByText(/Примерно/)).toBeTruthy();
    expect(within(breakfast).getByText(/≈ 275/)).toBeTruthy();
  });
});
