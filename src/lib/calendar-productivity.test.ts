import { describe, expect, it } from "vitest";
import { emptyData, type Task } from "./domain";
import { calendarPeriodDates, moveCalendarPeriod, productivityDay, productivityDays } from "./calendar-productivity";
const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: id, date: "2026-11-20", time: "", description: "", priority: "normal", category: "Личное", repeat: "none", completedDates: [], ...extra });
describe("productivity dates", () => {
  it("uses Monday weeks across the year boundary", () => {
    expect(calendarPeriodDates("2027-01-01", "week")).toEqual(["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"]);
  });
  it("includes leap day and exactly the days of the selected local year", () => {
    const leap = calendarPeriodDates("2028-02-29", "year");
    expect(leap).toHaveLength(366);
    expect(leap[0]).toBe("2028-01-01");
    expect(leap.at(-1)).toBe("2028-12-31");
    expect(leap).toContain("2028-02-29");
    expect(calendarPeriodDates("2026-02-20", "month")).toHaveLength(28);
  });
  it("moves by whole periods and clamps dates to the next month or year", () => {
    expect(moveCalendarPeriod("2026-01-31", "month", 1)).toBe("2026-02-28");
    expect(moveCalendarPeriod("2028-02-29", "year", 1)).toBe("2029-02-28");
    expect(moveCalendarPeriod("2026-12-28", "week", 1)).toBe("2027-01-04");
  });
});
describe("task productivity", () => {
  it("uses exact ratios for green, yellow and red", () => {
    const data = emptyData();
    data.tasks = [task("done", { completedDates: ["2026-11-20"] }), task("active")];
    expect(productivityDay(data, "2026-11-20", "2026-11-20")).toMatchObject({ total: 2, completed: 1, status: "partial", percentage: 50 });
    data.tasks.push(task("another"));
    expect(productivityDay(data, "2026-11-20", "2026-11-20").status).toBe("low");
    data.tasks = [task("done", { completedDates: ["2026-11-20"] })];
    expect(productivityDay(data, "2026-11-20", "2026-11-20").status).toBe("complete");
    data.tasks = Array.from({ length: 1000 }, (_, i) => task(String(i), { completedDates: i ? ["2026-11-20"] : [] }));
    expect(productivityDay(data, "2026-11-20", "2026-11-20").status).toBe("partial");
  });
  it("keeps empty and future days neutral even when future tasks are completed", () => {
    const data = emptyData();
    expect(productivityDay(data, "2026-11-19", "2026-11-20")).toMatchObject({ total: 0, status: "empty" });
    data.tasks = [task("future", { date: "2026-11-21", completedDates: ["2026-11-21"] })];
    expect(productivityDay(data, "2026-11-21", "2026-11-20")).toMatchObject({ completed: 1, total: 1, status: "future" });
  });
  it("counts repeating occurrences and ignores excluded occurrences", () => {
    const data = emptyData();
    data.tasks = [task("daily", { date: "2026-11-16", repeat: "daily", completedDates: ["2026-11-20"], excludedDates: ["2026-11-19"] }), task("weekdays", { date: "2026-11-16", repeat: "weekdays" }), task("weekly", { date: "2026-11-13", repeat: "weekly" })];
    const [thursday, friday, saturday] = productivityDays(data, ["2026-11-19", "2026-11-20", "2026-11-21"], "2026-11-22");
    expect(thursday.total).toBe(1);
    expect(friday).toMatchObject({ total: 3, completed: 1 });
    expect(saturday.total).toBe(1);
  });
  it("preserves a closed day's snapshot after unfinished tasks move away", () => {
    const data = emptyData();
    data.tasks = [task("moved", { date: "2026-11-21" })];
    data.reviews = [{ date: "2026-11-20", closedAt: "2026-11-20T20:00:00Z", updatedAt: "2026-11-20T20:00:00Z", mood: "steady", note: "", snapshot: { tasks: { completed: 2, total: 3 }, completedTasks: [{ id: "one", title: "One" }, { id: "two", title: "Two" }], habits: { completed: 0, total: 0 }, water: { amount: 0, goal: 2000 }, food: { calories: 0, entries: 0 } } }];
    expect(productivityDay(data, "2026-11-20", "2026-11-20")).toMatchObject({ total: 3, completed: 2, status: "partial", source: "review" });
    data.reviews[0].closedAt = undefined;
    expect(productivityDay(data, "2026-11-20", "2026-11-20")).toMatchObject({ total: 0, source: "tasks" });
  });
});
