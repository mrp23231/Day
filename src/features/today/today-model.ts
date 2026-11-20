import { dayKey, taskDone, taskOnDate, type Task } from "@/lib/domain";

const byTime = (a: Task, b: Task) => (a.time || "99").localeCompare(b.time || "99");

export function selectDayTasks(tasks: Task[], date: string, today: string) {
  const scheduled = tasks.filter(task => taskOnDate(task, date)).sort(byTime);
  const active = scheduled.filter(task => !taskDone(task, date));
  const important = active.filter(task => task.priority === "high");
  const completed = scheduled.filter(task => taskDone(task, date));
  const overdue = date === today
    ? tasks.filter(task => task.repeat === "none" && task.date < today && !taskDone(task, task.date))
      .sort((a, b) => a.date.localeCompare(b.date) || byTime(a, b))
    : [];

  return { scheduled, active, important, completed, overdue };
}

export function nextTimedTask(tasks: Task[], date: string, now: Date): Task | undefined {
  const today = dayKey(now);
  if (date < today) return undefined;
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return selectDayTasks(tasks, date, today).active.find(task =>
    task.time !== "" && (date > today || task.time >= time)
  );
}
