import { shiftDay, taskDone, taskOnDate, type Task } from "./domain";

/** Called from the completion action, never from hydration or a date-change effect. */
export function shouldCelebrateTasks(tasks: Task[], id: string, date: string, today: string): boolean {
  if (date !== today) return false;
  const scheduled = tasks.filter(task => taskOnDate(task, date));
  const changed = scheduled.find(task => task.id === id);
  return !!changed && !taskDone(changed, date) && scheduled.every(task => task.id === id || taskDone(task, date));
}

export function taskCompletionHistory(tasks: Task[], date: string) {
  return Array.from({ length: 7 }, (_, index) => {
    const target = shiftDay(date, index - 6);
    const scheduled = tasks.filter(task => taskOnDate(task, target));
    const completed = scheduled.filter(task => taskDone(task, target)).length;
    return { date: target, total: scheduled.length, completed, percent: scheduled.length ? Math.round(completed / scheduled.length * 100) : 0 };
  });
}
