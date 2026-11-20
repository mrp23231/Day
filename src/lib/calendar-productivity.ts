import { dateFromKey, dayKey, shiftDay, taskDone, taskOnDate, weekDays, type AppData } from "./domain";

export type ProductivityPeriod = "week" | "month" | "year";
export type ProductivityStatus = "empty" | "future" | "low" | "partial" | "complete";
export type ProductivityDay = {
  date: string;
  completed: number;
  total: number;
  percentage: number;
  status: ProductivityStatus;
  source: "tasks" | "review";
};

/** Calendar periods use local noon, matching the planner and recurring task rules. */
export function calendarPeriodDates(anchor: string, period: ProductivityPeriod): string[] {
  if (period === "week") return weekDays(anchor);
  const parsed = dateFromKey(anchor);
  const first = new Date(parsed.getFullYear(), period === "year" ? 0 : parsed.getMonth(), 1, 12);
  const end = new Date(parsed.getFullYear() + (period === "year" ? 1 : 0), period === "year" ? 0 : parsed.getMonth() + 1, 0, 12);
  const result: string[] = [];
  for (const current = new Date(first); current <= end; current.setDate(current.getDate() + 1)) result.push(dayKey(current));
  return result;
}

export function moveCalendarPeriod(anchor: string, period: ProductivityPeriod, offset: number): string {
  if (period === "week") return shiftDay(anchor, offset * 7);
  const parsed = dateFromKey(anchor);
  const target = new Date(parsed.getFullYear() + (period === "year" ? offset : 0), parsed.getMonth() + (period === "month" ? offset : 0), 1, 12);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0, 12).getDate();
  target.setDate(Math.min(parsed.getDate(), lastDay));
  return dayKey(target);
}

export function productivityDay(data: AppData, date: string, today: string): ProductivityDay {
  return productivityDays(data, [date], today)[0];
}

export function productivityDays(data: AppData, dates: string[], today: string): ProductivityDay[] {
  const snapshots = new Map(data.reviews.filter(review => review.closedAt && review.snapshot).map(review => [review.date, review.snapshot!]));
  return dates.map(date => {
    const snapshot = snapshots.get(date);
    let total = 0, completed = 0;
    if (snapshot) ({ total, completed } = snapshot.tasks);
    else for (const task of data.tasks) {
      if (taskOnDate(task, date)) {
        total++;
        if (taskDone(task, date)) completed++;
      }
    }
    const ratio = total ? completed / total : 0;
    // Status uses the exact ratio; rounding 99.9% must never turn a day green.
    const status: ProductivityStatus = date > today ? "future" : !total ? "empty" : completed === total ? "complete" : ratio >= .5 ? "partial" : "low";
    return { date, completed, total, percentage: ratio * 100, status, source: snapshot ? "review" : "tasks" };
  });
}
