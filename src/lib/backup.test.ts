import { describe, expect, it } from "vitest";
import { emptyData, type AppData } from "./domain";
import { backupSummary, parseBackup, prepareExportData, prepareImportedData } from "./backup";

function populatedData(): AppData {
  return {
    ...emptyData(),
    tasks: [{ id: "task-1", title: "Прогулка", description: "", date: "2026-11-14", time: "", priority: "normal", category: "Личное", repeat: "none", completedDates: [] }],
    habits: [{ id: "habit-1", name: "Чтение", icon: "book", days: [1, 2], completions: [] }],
    foods: [{ id: "food-1", name: "Завтрак", date: "2026-11-14", meal: "breakfast", grams: 100, calories: 100, protein: 1, fat: 1, carbs: 1, favorite: false }],
    water: [{ id: "water-1", date: "2026-11-14", time: "10:00", amount: 250 }, { id: "water-2", date: "2026-11-14", time: "11:00", amount: 250 }],
    reviews: [{ date: "2026-11-14", note: "Хороший день", mood: "great", updatedAt: "2026-11-14T20:00:00.000Z" }],
  };
}

describe("parseBackup", () => {
  it("validates a v1 export and provides record counts without changing the input", () => {
    const source = populatedData();
    const raw = JSON.stringify(source);
    const result = parseBackup(raw);
    expect(result).toEqual(source);
    expect(backupSummary(result)).toEqual({ tasks: 1, habits: 1, foods: 1, water: 2, reviews: 1 });
    expect(JSON.stringify(source)).toBe(raw);
  });

  it("fills supported defaults in older v1 exports", () => {
    const legacy = JSON.parse(JSON.stringify(populatedData()));
    delete legacy.reviews;
    for (const key of ["background", "personalPhotos", "photoTone", "todayOrder", "todayHidden", "accountOnboardingDone", "onboardingFocus", "onboardingPace"]) delete legacy.preferences[key];
    const result = parseBackup(JSON.stringify(legacy));
    expect(result.tasks[0].title).toBe("Прогулка");
    expect(result.reviews).toEqual([]);
    expect(result.preferences.personalPhotos).toEqual({});
    expect(result.preferences.accountOnboardingDone).toBe(false);
    expect(result.preferences.todayOrder).toEqual(["plan", "next", "habits", "water", "food", "review"]);
  });

  it("rejects malformed JSON with a readable Russian error", () => {
    expect(() => parseBackup("{broken")).toThrow(/JSON/);
  });

  it.each([2, "1", null])("rejects unsupported version %s", version => {
    expect(() => parseBackup(JSON.stringify({ ...emptyData(), version }))).toThrow(/верси/);
  });

  it("rejects invalid records rather than importing a partial copy", () => {
    const source = populatedData();
    source.water[1].amount = 0;
    expect(() => parseBackup(JSON.stringify(source))).toThrow(/структур|проверку/);
  });

  it.each(["tasks", "habits", "foods", "water"] as const)("rejects duplicate IDs within %s", group => {
    const source = populatedData();
    const records = source[group];
    const duplicate = { ...records[0] };
    const raw = JSON.stringify({ ...source, [group]: [...records, duplicate] });
    expect(() => parseBackup(raw)).toThrow(/повтор/);
  });

  it("allows matching IDs in different record groups", () => {
    const source = populatedData();
    source.habits[0].id = source.tasks[0].id;
    expect(parseBackup(JSON.stringify(source)).habits[0].id).toBe("task-1");
  });

  it("rejects two reviews of the same date", () => {
    const source = populatedData();
    source.reviews.push({ ...source.reviews[0], note: "Второй итог" });
    expect(() => parseBackup(JSON.stringify(source))).toThrow(/повтор/);
  });

  it("accepts an export at the byte limit and rejects oversized UTF-8 before parsing", () => {
    const maximum = 10 * 1024 * 1024;
    const raw = JSON.stringify(emptyData());
    expect(parseBackup(raw + " ".repeat(maximum - new TextEncoder().encode(raw).byteLength)).tasks).toEqual([]);
    expect(() => parseBackup("я".repeat(maximum / 2 + 1))).toThrow(/10 МБ/);
  });
});

describe("prepareImportedData", () => {
  it("keeps this device's photos and onboarding flags without mutating either copy", () => {
    const incoming = populatedData();
    incoming.preferences.personalPhotos = { space: "9daf3dd3-64c2-4a3c-a12a-c63175ec6dd8" };
    incoming.preferences.name = "Из копии";
    incoming.preferences.onboardingDone = true;
    incoming.preferences.accountOnboardingDone = true;
    const current = emptyData();
    current.preferences.personalPhotos = { navigation: "bdc893f4-3372-4512-ae87-2c8db9e9ed2e" };
    current.preferences.dayIcons = {"2026-11-20":"bdc893f4-3372-4512-ae87-2c8db9e9ed2e"};
    incoming.preferences.dayIcons = {"2026-11-21":"9daf3dd3-64c2-4a3c-a12a-c63175ec6dd8"};
    const before = JSON.stringify({ incoming, current });
    const result = prepareImportedData(incoming, current);
    expect(result.preferences.name).toBe("Из копии");
    expect(result.tasks[0].title).toBe("Прогулка");
    expect(result.preferences.personalPhotos).toEqual({ navigation: "bdc893f4-3372-4512-ae87-2c8db9e9ed2e" });
    expect(result.preferences.onboardingDone).toBe(false);
    expect(result.preferences.accountOnboardingDone).toBe(false);
    expect(result.preferences.personalPhotos).not.toBe(current.preferences.personalPhotos);
    expect(result.preferences.dayIcons).toEqual(current.preferences.dayIcons);
    expect(result.preferences.dayIcons).not.toBe(current.preferences.dayIcons);
    expect(JSON.stringify({ incoming, current })).toBe(before);
  });

  it("retains completed onboarding and does not import unavailable photo IDs", () => {
    const incoming = emptyData();
    incoming.preferences.personalPhotos = { space: "9daf3dd3-64c2-4a3c-a12a-c63175ec6dd8" };
    const current = emptyData();
    current.preferences.onboardingDone = true;
    current.preferences.accountOnboardingDone = true;
    const result = prepareImportedData(incoming, current);
    expect(result.preferences.personalPhotos).toEqual({});
    expect(result.preferences.onboardingDone).toBe(true);
    expect(result.preferences.accountOnboardingDone).toBe(true);
  });
});

it("excludes browser-local photo references from JSON exports without changing local data",()=>{
  const data=populatedData();
  data.preferences.personalPhotos={avatar:"9daf3dd3-64c2-4a3c-a12a-c63175ec6dd8"};
  data.preferences.dayIcons={"2026-11-20":"bdc893f4-3372-4512-ae87-2c8db9e9ed2e"};
  const before=JSON.stringify(data), exported=prepareExportData(data);
  expect(exported.preferences.personalPhotos).toEqual({});
  expect(exported.preferences.dayIcons).toEqual({});
  expect(exported.tasks).toEqual(data.tasks);
  expect(JSON.stringify(data)).toBe(before);
});
