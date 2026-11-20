import { describe, expect, it } from "vitest";
import { calendarMonthDays, shiftCalendarDate } from "./calendar-period";

describe("planner calendar dates", () => {
  it("clamps month and year navigation to real days", () => {
    expect(shiftCalendarDate("2024-01-31", "month", 1)).toBe("2024-02-29");
    expect(shiftCalendarDate("2024-02-29", "year", 1)).toBe("2025-02-28");
    expect(shiftCalendarDate("2026-12-31", "month", 1)).toBe("2027-01-31");
    expect(shiftCalendarDate("2026-01-01", "week", -1)).toBe("2025-12-25");
  });

  it("builds Monday-first local calendars across year boundaries", () => {
    const january = calendarMonthDays("2026-01-15");
    expect(january).toHaveLength(42);
    expect(january[0]).toBe("2025-12-29");
    expect(january[41]).toBe("2026-02-08");
    const february = calendarMonthDays("2024-02-14");
    expect(february).toContain("2024-02-29");
    expect(february.filter(date => date.startsWith("2024-02"))).toHaveLength(29);
  });
});
