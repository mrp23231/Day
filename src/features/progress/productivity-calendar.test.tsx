// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { emptyData, type AppData, type Task } from "@/lib/domain";
import { ProductivityCalendar } from "./productivity-calendar";
import { I18nProvider } from "@/components/i18n-provider";
const { Context } = await vi.hoisted(async () => ({ Context: (await import("react")).createContext<Record<string, unknown>>({}) }));
vi.mock("@/components/day-provider", async () => { const { useContext } = await import("react"); return { useDay: () => useContext(Context) }; });
vi.mock("@/features/calendar/day-icon", () => ({ DayIcon: () => null }));
const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: id, date: "2026-11-20", time: "", description: "", priority: "normal", category: "Личное", repeat: "none", completedDates: [], ...extra });
function Harness({ data = emptyData(), initialDate = "2026-11-20" }: { data?: AppData; initialDate?: string }) {
  const [date, setDate] = useState(initialDate);
  return <Context.Provider value={{ data, date, setDate }}><ProductivityCalendar /></Context.Provider>;
}
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-20T12:00:00")); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe("productivity calendar", () => {
  it("selects a day, exposes exact completion counts and opens that day in the planner", () => {
    const data = emptyData();
    data.tasks = [task("one", { completedDates: ["2026-11-20"] }), task("two"), task("yesterday", { date: "2026-11-19", completedDates: ["2026-11-19"] })];
    render(<Harness data={data} />);
    const calendar = screen.getByRole("region", { name: "Календарь продуктивности" });
    expect(within(calendar).getByText("Завершено 1 из 2 задач")).toBeTruthy();
    fireEvent.click(within(calendar).getByRole("button", { name: /19 ноября 2026.*1 из 1 задач/ }));
    expect(within(calendar).getByText("Завершено 1 из 1 задач")).toBeTruthy();
    expect((within(calendar).getByRole("link", { name: "Открыть план дня" }) as HTMLAnchorElement).getAttribute("href")).toBe("/planner");
  });
  it("renders a leap year without filling non-existent days or marking empty days red", () => {
    render(<Harness initialDate="2028-02-29" />);
    fireEvent.click(screen.getByRole("button", { name: "Год" }));
    const calendar = screen.getByRole("region", { name: "Календарь продуктивности" });
    const days = within(calendar).getAllByRole("button").filter(button => button.hasAttribute("data-date"));
    expect(days).toHaveLength(366);
    expect(days.some(button => button.getAttribute("data-date") === "2028-02-29")).toBe(true);
    expect(days.every(button => button.getAttribute("data-status") === "future")).toBe(true);
    fireEvent.click(within(calendar).getByRole("button", { name: "Предыдущий период" }));
    expect(within(calendar).getAllByRole("button").filter(button => button.hasAttribute("data-date"))).toHaveLength(365);
  });
  it("offers keyboard day navigation in the city view with truthful task-based geometry", () => {
    const data = emptyData();
    data.tasks = [task("done", { completedDates: ["2026-11-20"] })];
    render(<Harness data={data} />);
    fireEvent.click(screen.getByRole("button", { name: "3D" }));
    expect(screen.getByRole("img", { name: "Город продуктивности" })).toBeTruthy();
    expect(screen.queryByText(/минут|сессий/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Предыдущий день продуктивности" }));
    expect(screen.getByText("День без запланированных задач")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Выбрать день продуктивности"), { target: { value: "2026-11-20" } });
    expect(screen.getByText("Завершено 1 из 1 задач")).toBeTruthy();
  });
});

it.each([
  ["en", "Productivity calendar", "Week", "Open day plan", "Productivity city"],
  ["it", "Calendario della produttività", "Settimana", "Apri il programma del giorno", "Città della produttività"],
] as const)("localizes the calendar and task city in %s", (locale, title, week, link, city) => {
  render(<I18nProvider locale={locale}><Harness /></I18nProvider>);
  expect(screen.getByRole("region", { name: title })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: week }));
  expect(screen.getByRole("link", { name: link })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "3D" }));
  expect(screen.getByRole("img", { name: city })).toBeTruthy();
});
