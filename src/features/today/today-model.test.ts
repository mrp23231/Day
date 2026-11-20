import { describe, expect, it } from "vitest";
import type { Task } from "@/lib/domain";
import { nextTimedTask, selectDayTasks } from "./today-model";

const today = "2026-11-06";
const base: Task = { id: "task", title: "Задача", description: "", date: today, time: "", priority: "normal", category: "Личное", repeat: "none", completedDates: [] };

describe("selected-day task groups", () => {
  it("sorts scheduled tasks by time with stable ties and untimed tasks last", () => {
    const tasks: Task[] = [
      { ...base, id: "late", time: "17:00" },
      { ...base, id: "untimed-first" },
      { ...base, id: "tie-first", time: "09:00" },
      { ...base, id: "earliest", time: "08:30" },
      { ...base, id: "tie-second", time: "09:00" },
      { ...base, id: "untimed-second" },
    ];

    expect(selectDayTasks(tasks, today, today).scheduled.map(task => task.id)).toEqual([
      "earliest", "tie-first", "tie-second", "late", "untimed-first", "untimed-second",
    ]);
    expect(tasks.map(task => task.id)).toEqual([
      "late", "untimed-first", "tie-first", "earliest", "tie-second", "untimed-second",
    ]);
  });

  it("partitions selected-day occurrences and keeps completed high-priority tasks out of important", () => {
    const tasks: Task[] = [
      { ...base, id: "high-untimed", priority: "high" },
      { ...base, id: "normal", time: "12:00" },
      { ...base, id: "done-high", time: "08:00", priority: "high", completedDates: [today] },
      { ...base, id: "high-timed", time: "09:00", priority: "high" },
      { ...base, id: "done-normal", completedDates: [today] },
      { ...base, id: "low", time: "12:00", priority: "low" },
    ];

    const groups = selectDayTasks(tasks, today, today);
    expect(groups.active.map(task => task.id)).toEqual(["high-timed", "normal", "low", "high-untimed"]);
    expect(groups.important.map(task => task.id)).toEqual(["high-timed", "high-untimed"]);
    expect(groups.completed.map(task => task.id)).toEqual(["done-high", "done-normal"]);
  });

  it("uses recurrence schedules and completion for the selected occurrence", () => {
    const tasks: Task[] = [
      { ...base, id: "daily", date: "2026-11-01", repeat: "daily", completedDates: ["2026-11-05"] },
      { ...base, id: "weekly", date: "2026-10-30", repeat: "weekly", completedDates: [today] },
      { ...base, id: "weekdays", date: "2026-11-02", repeat: "weekdays" },
      { ...base, id: "other-weekday", date: "2026-11-05", repeat: "weekly" },
      { ...base, id: "future-series", date: "2026-11-07", repeat: "daily" },
      { ...base, id: "old-one-off", date: "2026-11-05" },
    ];

    const groups = selectDayTasks(tasks, today, today);
    expect(groups.scheduled.map(task => task.id)).toEqual(["daily", "weekly", "weekdays"]);
    expect(groups.active.map(task => task.id)).toEqual(["daily", "weekdays"]);
    expect(groups.completed.map(task => task.id)).toEqual(["weekly"]);
    expect(selectDayTasks(tasks, "2026-11-07", today).scheduled.map(task => task.id)).toEqual(["daily", "future-series"]);
  });

  it("shows only unfinished past one-off tasks in today's backlog, sorted by date then time", () => {
    const tasks: Task[] = [
      { ...base, id: "recent", date: "2026-11-05", time: "08:00" },
      { ...base, id: "old-untimed", date: "2026-11-03" },
      { ...base, id: "old-tie-first", date: "2026-11-03", time: "10:00" },
      { ...base, id: "old-tie-second", date: "2026-11-03", time: "10:00" },
      { ...base, id: "finished", date: "2026-11-01", completedDates: ["2026-11-01"] },
      { ...base, id: "missed-daily", date: "2020-01-01", repeat: "daily" },
      { ...base, id: "missed-weekdays", date: "2020-01-01", repeat: "weekdays" },
      { ...base, id: "missed-weekly", date: "2020-01-01", repeat: "weekly" },
      { ...base, id: "today" },
      { ...base, id: "future", date: "2026-11-07" },
    ];
    const before = structuredClone(tasks);

    expect(selectDayTasks(tasks, today, today).overdue.map(task => task.id)).toEqual([
      "old-tie-first", "old-tie-second", "old-untimed", "recent",
    ]);
    expect(tasks).toEqual(before);
  });

  it.each(["2026-11-05", "2026-11-08"])("hides backlog when viewing %s instead of today", date => {
    const tasks: Task[] = [
      { ...base, id: "old", date: "2026-11-01" },
      { ...base, id: "future", date: "2026-11-07" },
    ];

    expect(selectDayTasks(tasks, date, today).overdue).toEqual([]);
  });

  it("returns empty groups for an empty day", () => {
    expect(selectDayTasks([], today, today)).toEqual({ scheduled: [], active: [], important: [], completed: [], overdue: [] });
  });
});

describe("next timed task", () => {
  const now = new Date(2026, 10, 6, 10, 5, 45);

  it("allows the current minute and skips completed, untimed, earlier, and other-day tasks", () => {
    const tasks: Task[] = [
      { ...base, id: "later", time: "10:06" },
      { ...base, id: "untimed" },
      { ...base, id: "finished", time: "10:05", completedDates: [today] },
      { ...base, id: "earlier", time: "10:04" },
      { ...base, id: "other-day", date: "2026-11-07", time: "10:05" },
      { ...base, id: "current-minute", time: "10:05" },
    ];
    const before = structuredClone(tasks);

    expect(nextTimedTask(tasks, today, now)?.id).toBe("current-minute");
    expect(tasks).toEqual(before);
  });

  it("keeps source order for tasks at the same next time", () => {
    expect(nextTimedTask([
      { ...base, id: "first", time: "11:00" },
      { ...base, id: "second", time: "11:00" },
    ], today, now)?.id).toBe("first");
  });

  it("checks recurring completion for today rather than a previous occurrence", () => {
    expect(nextTimedTask([
      { ...base, id: "recurring", date: "2026-11-01", repeat: "daily", time: "10:10", completedDates: ["2026-11-05"] },
      { ...base, id: "unscheduled", date: "2026-11-05", repeat: "weekly", time: "10:06" },
    ], today, now)?.id).toBe("recurring");
  });

  it("chooses any future day's earliest timed active task regardless of the current clock", () => {
    expect(nextTimedTask([
      { ...base, id: "future-late", date: "2026-11-07", time: "18:00" },
      { ...base, id: "future-done", date: "2026-11-07", time: "06:00", completedDates: ["2026-11-07"] },
      { ...base, id: "future-early", date: "2026-11-07", time: "07:00" },
    ], "2026-11-07", now)?.id).toBe("future-early");
  });

  it("does not preview a historical day's task", () => {
    expect(nextTimedTask([{ ...base, date: "2026-11-05", time: "23:00" }], "2026-11-05", now)).toBeUndefined();
  });

  it("returns no preview when no active timed task remains", () => {
    expect(nextTimedTask([
      { ...base, id: "untimed" },
      { ...base, id: "past", time: "09:00" },
      { ...base, id: "done", time: "11:00", completedDates: [today] },
    ], today, now)).toBeUndefined();
    expect(nextTimedTask([], today, now)).toBeUndefined();
  });
});
