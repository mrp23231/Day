import { describe, expect, it } from "vitest";
import { calculateNutrition, foodTotals, taskOnDate, taskDone, habitStreak, dayKey, emptyData, foodSchema, waterSchema, readSavedData } from "./domain";

describe("nutrition estimates", () => {
  it("calculates Mifflin–St Jeor and energy-consistent macros", () => {
    const result = calculateNutrition({ age: 30, sex: "male", weight: 80, height: 180, activity: 1.55, goal: "maintain" });
    expect(result.bmr).toBe(1780);
    expect(result.calories).toBe(2759);
    expect(Math.abs(result.protein * 4 + result.fat * 9 + result.carbs * 4 - result.calories)).toBeLessThanOrEqual(5);
  });
  it("does not calculate targets for minors", () => {
    expect(() => calculateNutrition({ age: 17, sex: "female", weight: 60, height: 170, activity: 1.2, goal: "lose" })).toThrow(/18/);
  });
  it("rejects impossible measurements", () => {
    expect(() => calculateNutrition({ age: 35, sex: "male", weight: -1, height: 180, activity: 1.2, goal: "maintain" })).toThrow();
  });
  it("sums only records belonging to the selected day", () => {
    const food = { id: "a", name: "Рис", date: "2026-11-05", meal: "lunch" as const, grams: 150, calories: 190, protein: 4, fat: 1, carbs: 42, favorite: false };
    expect(foodTotals([food, { ...food, id: "b", date: "2026-11-04" }], "2026-11-05")).toEqual({ calories: 190, protein: 4, fat: 1, carbs: 42 });
  });
  it("rejects negative food and zero water entries", () => {
    expect(foodSchema.safeParse({ id: "a", name: "Еда", date: "2026-11-05", meal: "lunch", grams: 100, calories: -2, protein: 0, fat: 0, carbs: 0, favorite: false }).success).toBe(false);
    expect(waterSchema.safeParse({ id: "a", date: "2026-11-05", amount: 0, time: "12:00" }).success).toBe(false);
  });
});

describe("calendar records", () => {
  const task = { id: "1", title: "Погулять", date: "2026-11-05", time: "09:00", priority: "normal" as const, category: "Личное", description: "", repeat: "daily" as const, completedDates: [] };
  it("repeats daily tasks but not before their start", () => {
    expect(taskOnDate(task, "2026-11-06")).toBe(true);
    expect(taskOnDate(task, "2026-11-04")).toBe(false);
  });
  it("repeats weekly tasks on the same weekday", () => {
    expect(taskOnDate({ ...task, repeat: "weekly" }, "2026-11-12")).toBe(true);
    expect(taskOnDate({ ...task, repeat: "weekly" }, "2026-11-06")).toBe(false);
  });
  it("keeps recurring completion independent per date", () => {
    const done = { ...task, completedDates: ["2026-11-05"] };
    expect(taskDone(done, "2026-11-05")).toBe(true);
    expect(taskDone(done, "2026-11-06")).toBe(false);
  });
  it("counts a streak across scheduled days", () => {
    expect(habitStreak({ id: "1", name: "Читать", icon: "book", days: [1, 2, 3, 4, 5], completions: ["2026-11-04", "2026-11-03", "2026-11-02", "2026-10-30"] }, "2026-11-05")).toBe(4);
  });
  it("formats local dates without shifting to UTC", () => {
    expect(dayKey(new Date(2026, 10, 5, 0, 1))).toBe("2026-11-05");
  });
});

describe("persistence", () => {
  it("starts with no invented personal records", () => {
    const data = emptyData();
    expect(data.tasks.length + data.foods.length + data.water.length + data.habits.length).toBe(0);
  });
  it("loads a validated persisted state", () => {
    const data = emptyData();
    data.preferences.name = "Анна";
    expect(readSavedData(JSON.stringify(data)).preferences.name).toBe("Анна");
  });
  it("reports corrupt data rather than silently replacing it", () => {
    expect(() => readSavedData("{broken")).toThrow(/сохран/);
    expect(() => readSavedData('{"version":999}')).toThrow(/сохран/);
  });
});
