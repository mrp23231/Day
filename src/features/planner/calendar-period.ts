import { dateFromKey, dayKey, shiftDay } from "@/lib/domain";
import type { CalendarView } from "@/components/ui/day-picker";

/** Keep local noon and clamp the selected day when the next month is shorter. */
export function shiftCalendarDate(date: string, view: CalendarView, amount: number): string {
  if (view === "day" || view === "week") return shiftDay(date, amount * (view === "week" ? 7 : 1));
  const value = dateFromKey(date);
  const selectedDay = value.getDate();
  value.setDate(1);
  if (view === "year") value.setFullYear(value.getFullYear() + amount);
  else value.setMonth(value.getMonth() + amount);
  const end = new Date(value);
  end.setMonth(end.getMonth() + 1, 0);
  value.setDate(Math.min(selectedDay, end.getDate()));
  return dayKey(value);
}

export function calendarMonthDays(date: string): string[] {
  const first = dateFromKey(date);
  first.setDate(1);
  const start = shiftDay(dayKey(first), -((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, index) => shiftDay(start, index));
}
