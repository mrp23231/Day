import { describe, expect, it } from "vitest";
import { appDataSchema, dayReviewSchema, emptyData, readSavedData, taskOnDate, type AppData, type Task } from "@/lib/domain";
import { closeDay, reviewSummary, saveDayReview, type CloseDayInput } from "./review-model";

const date = "2026-11-08";
const task = (id: string, extra: Partial<Task> = {}): Task => ({
  id, title: id, description: "", date, time: "", priority: "normal", category: "Личное", repeat: "none", completedDates: [], ...extra,
});

const now = "2026-11-08T20:00:00.000Z";
const tomorrow = "2026-11-09";
const closure = (extra: Partial<CloseDayInput> = {}): CloseDayInput => ({ date, rating: 4.5, note: "Прогулка помогла", transfers: [], ...extra });

describe("day closure", () => {
  it("keeps old saved reviews and tasks readable without closure fields", () => {
    const old = { ...emptyData(), tasks: [task("legacy")], reviews: [{ date, note: "Раньше", mood: "hard", updatedAt: now }] };
    expect(readSavedData(JSON.stringify(old))).toEqual(old);
    expect(appDataSchema.parse({ ...old, tasks: [{ ...old.tasks[0], excludedDates: [date] }] }).tasks[0]).toHaveProperty("excludedDates", [date]);
  });

  it("round-trips closure metadata and rejects inconsistent or unbounded reflection data", () => {
    const review = {
      date, note: "  Хороший день  ", mood: "steady", updatedAt: now, rating: 3.5, closedAt: now,
      snapshot: { tasks: { completed: 1, total: 2 }, habits: { completed: 0, total: 0 }, water: { amount: 250, goal: 2000 }, food: { entries: 0, calories: 0 }, completedTasks: [{ id: "done", title: "Готово" }] },
      transfers: [{ taskId: "one", toDate: tomorrow, newTaskId: "one" }],
    };
    expect(dayReviewSchema.parse(review)).toEqual({ ...review, note: "Хороший день" });
    for (const rating of [-0.5, 0.25, 5.5, Infinity, NaN]) expect(dayReviewSchema.safeParse({ ...review, rating }).success).toBe(false);
    expect(dayReviewSchema.safeParse({ ...review, snapshot: { ...review.snapshot, tasks: { completed: 3, total: 2 } } }).success).toBe(false);
    expect(dayReviewSchema.safeParse({ ...review, snapshot: { ...review.snapshot, completedTasks: [] } }).success).toBe(false);
    expect(dayReviewSchema.safeParse({ ...review, note: "x".repeat(2001) }).success).toBe(false);
  });

  it("honors excluded occurrences while leaving other recurring dates scheduled", () => {
    const repeating = { ...task("daily", { repeat: "daily" }), excludedDates: [date] };
    expect(taskOnDate(repeating, date)).toBe(false);
    expect(taskOnDate(repeating, tomorrow)).toBe(true);
  });

  it("captures the actual day before moving one-off tasks without changing their identity", () => {
    const data: AppData = { ...emptyData(), tasks: [task("done", { title: "Готовая прогулка", completedDates: [date] }), task("move"), task("stay")] };
    const result = closeDay(data, closure({ transfers: [{ taskId: "move", toDate: tomorrow, newTaskId: "unused" }] }), date, now);
    expect(result.tasks.map(item => ({ id: item.id, date: item.date, completedDates: item.completedDates }))).toEqual([
      { id: "done", date, completedDates: [date] }, { id: "move", date: tomorrow, completedDates: [] }, { id: "stay", date, completedDates: [] },
    ]);
    expect(result.reviews[0]).toMatchObject({ date, rating: 4.5, note: "Прогулка помогла", mood: "steady", closedAt: now, updatedAt: now, transfers: [{ taskId: "move", toDate: tomorrow, newTaskId: "move" }] });
    expect(result.reviews[0].snapshot).toEqual({ tasks: { completed: 1, total: 3 }, habits: { completed: 0, total: 0 }, water: { amount: 0, goal: 2000 }, food: { entries: 0, calories: 0 }, completedTasks: [{ id: "done", title: "Готовая прогулка" }] });
  });

  it("copies a recurring occurrence independently even when its destination already has the series", () => {
    const recurring = { ...task("daily", { repeat: "daily", completedDates: ["2026-11-07", tomorrow] }), excludedDates: ["2026-11-06"] };
    const result = closeDay({ ...emptyData(), tasks: [recurring] }, closure({ transfers: [{ taskId: "daily", toDate: tomorrow, newTaskId: "moved-occurrence" }] }), date, now);
    expect(result.tasks[0]).toEqual({ ...recurring, excludedDates: ["2026-11-06", date] });
    expect(taskOnDate(result.tasks[0], date)).toBe(false);
    expect(taskOnDate(result.tasks[0], tomorrow)).toBe(true);
    expect(result.tasks[1]).toEqual({ ...task("daily", { repeat: "daily" }), id: "moved-occurrence", date: tomorrow, repeat: "none", completedDates: [] });
    expect(result.reviews[0].transfers).toEqual([{ taskId: "daily", toDate: tomorrow, newTaskId: "moved-occurrence" }]);
  });

  it("keeps completed titles and statistics stable across later edits and repeated close attempts", () => {
    const first = closeDay({ ...emptyData(), tasks: [task("done", { completedDates: [date] }), task("daily", { repeat: "daily" })] }, closure({ transfers: [{ taskId: "daily", toDate: tomorrow, newTaskId: "copy" }] }), date, now);
    const changed = { ...first, tasks: first.tasks.map(item => ({ ...item, title: "Переименовано", completedDates: [] })) };
    const edited = closeDay(changed, closure({ rating: 2, note: "Изменено", transfers: [{ taskId: "daily", toDate: date, newTaskId: "copy" }] }), date, "2026-11-08T21:00:00.000Z");
    expect(edited.tasks).toBe(changed.tasks);
    expect(edited.reviews[0]).toEqual({ ...first.reviews[0], rating: 2, note: "Изменено", updatedAt: "2026-11-08T21:00:00.000Z" });
    expect(edited.reviews[0].snapshot?.completedTasks).toEqual([{ id: "done", title: "done" }]);
  });

  it("preserves closure metadata through the legacy save operation", () => {
    const first = closeDay(emptyData(), closure(), date, now);
    const edited = saveDayReview(first, { date, note: "Изменено старой формой", mood: "great", updatedAt: "2026-11-08T21:00:00.000Z" }, date);
    expect(edited.reviews[0]).toEqual({ ...first.reviews[0], note: "Изменено старой формой", mood: "great", updatedAt: "2026-11-08T21:00:00.000Z" });
  });

  it("upgrades an old review while preserving its mood and without implicitly completing tasks", () => {
    const data = { ...emptyData(), tasks: [task("unfinished")], reviews: [{ date, note: "Раньше", mood: "hard" as const, updatedAt: now }] };
    const result = closeDay(data, closure({ rating: 0, note: "" }), date, now);
    expect(result.reviews[0]).toMatchObject({ mood: "hard", rating: 0, note: "", closedAt: now });
    expect(result.tasks).toEqual(data.tasks);
    expect(result.tasks[0].completedDates).toEqual([]);
  });

  it("skips deleted, completed and no-longer-scheduled selected tasks at commit time", () => {
    const data = { ...emptyData(), tasks: [task("done", { completedDates: [date] }), task("later", { date: tomorrow }), { ...task("excluded", { repeat: "daily" }), excludedDates: [date] }] };
    const result = closeDay(data, closure({ transfers: ["deleted", "done", "later", "excluded"].map(taskId => ({ taskId, toDate: tomorrow, newTaskId: `copy-${taskId}` })) }), date, now);
    expect(result.tasks).toEqual(data.tasks);
    expect(result.reviews[0].transfers).toEqual([]);
    expect(result.reviews[0].snapshot?.tasks).toEqual({ completed: 1, total: 1 });
  });

  it("requires valid dates, timestamps, half-star ratings and bounded notes", () => {
    for (const input of [closure({ date: "2026-11-31" }), closure({ date: tomorrow }), closure({ rating: 0.1 }), closure({ rating: 6 }), closure({ note: "x".repeat(2001) })]) {
      expect(() => closeDay(emptyData(), input, date, now)).toThrow();
    }
    expect(() => closeDay(emptyData(), closure(), "not-a-date", now)).toThrow();
    expect(() => closeDay(emptyData(), closure(), date, "not-a-time")).toThrow();
  });

  it("requires transfers after both selected day and actual today", () => {
    const data = { ...emptyData(), tasks: [task("past")] };
    for (const toDate of ["2026-11-31", date, tomorrow, "2026-11-10"]) {
      expect(() => closeDay(data, closure({ transfers: [{ taskId: "past", toDate, newTaskId: "unused" }] }), "2026-11-10", now)).toThrow();
    }
    expect(closeDay(data, closure({ transfers: [{ taskId: "past", toDate: "2026-11-11", newTaskId: "unused" }] }), "2026-11-10", now).tasks[0].date).toBe("2026-11-11");
  });

  it("rejects duplicate selections and recurring clone IDs that collide", () => {
    const data = { ...emptyData(), tasks: [task("one", { repeat: "daily" }), task("two", { repeat: "daily" }), task("existing")] };
    for (const transfers of [
      [{ taskId: "one", toDate: tomorrow, newTaskId: "existing" }],
      [{ taskId: "one", toDate: tomorrow, newTaskId: "clone" }, { taskId: "two", toDate: tomorrow, newTaskId: "clone" }],
      [{ taskId: "one", toDate: tomorrow, newTaskId: "clone" }, { taskId: "one", toDate: tomorrow, newTaskId: "clone-2" }],
    ]) expect(() => closeDay(data, closure({ transfers }), date, now)).toThrow();
    expect(data.tasks).toHaveLength(3);
  });

  it("rejects capacity overflow atomically but still permits a one-off move at capacity", () => {
    const full = { ...emptyData(), tasks: Array.from({ length: 10000 }, (_, index) => task(`task-${index}`)) };
    expect(closeDay(full, closure({ transfers: [{ taskId: "task-0", toDate: tomorrow, newTaskId: "unused" }] }), date, now).tasks).toHaveLength(10000);
    full.tasks[0] = { ...full.tasks[0], repeat: "daily" };
    expect(() => closeDay(full, closure({ transfers: [{ taskId: "task-0", toDate: tomorrow, newTaskId: "clone" }] }), date, now)).toThrow();
    expect(full.tasks[0].date).toBe(date);
    expect(full.tasks[0].excludedDates).toBeUndefined();
    const reviews = Array.from({ length: 10000 }, (_, index) => ({ date: `1900-${String(Math.floor(index / 28) % 12 + 1).padStart(2, "0")}-${String(index % 28 + 1).padStart(2, "0")}`, note: "", mood: "steady" as const, updatedAt: now }));
    expect(() => closeDay({ ...emptyData(), reviews }, closure(), date, now)).toThrow();
  });

  it("does not mutate the original data, selected transfer list or nested arrays", () => {
    const data = { ...emptyData(), tasks: [{ ...task("daily", { repeat: "daily" }), excludedDates: ["2026-11-07"] }] };
    const input = closure({ transfers: [{ taskId: "daily", toDate: tomorrow, newTaskId: "copy" }] });
    const before = JSON.stringify({ data, input });
    Object.freeze(data.tasks[0].completedDates);
    Object.freeze(data.tasks[0].excludedDates);
    Object.freeze(data.tasks[0]);
    Object.freeze(data.tasks);
    Object.freeze(data);
    Object.freeze(input.transfers[0]);
    Object.freeze(input.transfers);
    Object.freeze(input);
    closeDay(data, input, date, now);
    expect(JSON.stringify({ data, input })).toBe(before);
  });
});

describe("daily review", () => {
  it("summarizes scheduled occurrences and entries for exactly the selected day", () => {
    const data: AppData = {
      ...emptyData(),
      tasks: [task("Разовая", { completedDates: [date] }), task("Ежедневная", { date: "2026-11-01", repeat: "daily" }), task("Вчера", { date: "2026-11-07" }), task("Будни", { repeat: "weekdays" }), task("Будущая", { date: "2026-11-09", repeat: "daily" })],
      habits: [
        { id: "h1", name: "Чтение", icon: "book", days: [0], completions: [date] },
        { id: "h2", name: "Движение", icon: "activity", days: [0], completions: ["2026-11-01"] },
        { id: "h3", name: "Работа", icon: "sun", days: [1], completions: [date] },
      ],
      water: [{ id: "w1", date, time: "09:00", amount: 250 }, { id: "w2", date, time: "11:00", amount: 150 }, { id: "w3", date: "2026-11-07", time: "09:00", amount: 500 }],
      foods: [
        { id: "f1", name: "Завтрак", date, meal: "breakfast", grams: 100, calories: 400, protein: 10, fat: 10, carbs: 30, favorite: false },
        { id: "f2", name: "Обед", date, meal: "lunch", grams: 200, calories: 500, protein: 10, fat: 10, carbs: 30, favorite: false },
        { id: "f3", name: "Вчера", date: "2026-11-07", meal: "dinner", grams: 100, calories: 999, protein: 0, fat: 0, carbs: 0, favorite: false },
      ],
    };
    expect(reviewSummary(data, date)).toEqual({ tasks: { completed: 1, total: 2 }, habits: { completed: 1, total: 2 }, water: { amount: 400, goal: 2000 }, food: { entries: 2, calories: 900 } });
  });

  it("updates only the selected review and preserves every task and record", () => {
    const previous = { date: "2026-11-07", note: "Вчера", mood: "steady" as const, updatedAt: "2026-11-07T20:00:00.000Z" };
    const data = { ...emptyData(), tasks: [task("Оставить без изменений")], reviews: [previous] };
    const saved = saveDayReview(data, { date, note: "Хорошая прогулка", mood: "great", updatedAt: "2026-11-08T20:00:00.000Z" }, date);
    const edited = saveDayReview(saved, { date, note: "Новая заметка", mood: "hard", updatedAt: "2026-11-08T21:00:00.000Z" }, date);
    expect(edited.reviews).toEqual([previous, { date, note: "Новая заметка", mood: "hard", updatedAt: "2026-11-08T21:00:00.000Z" }]);
    expect(edited.tasks).toBe(data.tasks);
    expect(edited.foods).toBe(data.foods);
    expect(edited.habits).toBe(data.habits);
    expect(edited.water).toBe(data.water);
  });

  it("rejects future-day and oversized reviews instead of mutating data", () => {
    const data = emptyData();
    expect(() => saveDayReview(data, { date: "2026-11-09", note: "Рано", mood: "steady", updatedAt: "2026-11-08T20:00:00.000Z" }, date)).toThrow();
    expect(() => saveDayReview(data, { date, note: "x".repeat(2001), mood: "steady", updatedAt: "2026-11-08T20:00:00.000Z" }, date)).toThrow();
  });
});
