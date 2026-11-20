import { z } from "zod";
import { dateSchema, dayRatingSchema, dayReviewSchema, foodTotals, habitOnDate, reviewTransferSchema, taskDone, taskOnDate, taskSchema, waterTotal, type AppData, type DayReview, type ReviewSnapshot, type ReviewSummary, type Task } from "@/lib/domain";

export type { ReviewSnapshot, ReviewSummary } from "@/lib/domain";

export type CloseDayInput = { date: string; rating: number; note: string; transfers: { taskId: string; toDate: string; newTaskId: string }[] };

const reflectionSchema = z.object({ date: dateSchema, rating: dayRatingSchema, note: dayReviewSchema.shape.note });
const transfersSchema = z.array(reviewTransferSchema).max(10000).refine(items => new Set(items.map(item => item.taskId)).size === items.length, "Выберите каждую задачу только один раз.");

export function reviewSummary(data: AppData, date: string): ReviewSummary {
  const tasks = data.tasks.filter(task => taskOnDate(task, date));
  const habits = data.habits.filter(habit => habitOnDate(habit, date));
  return {
    tasks: { completed: tasks.filter(task => taskDone(task, date)).length, total: tasks.length },
    habits: { completed: habits.filter(habit => habit.completions.includes(date)).length, total: habits.length },
    water: { amount: waterTotal(data.water, date), goal: data.preferences.waterGoal },
    food: { entries: data.foods.filter(food => food.date === date).length, calories: Math.round(foodTotals(data.foods, date).calories) },
  };
}

export function saveDayReview(data: AppData, input: DayReview, today: string): AppData {
  dateSchema.parse(today);
  const review = dayReviewSchema.parse(input);
  if (review.date > today) throw new Error("Итоги будущего дня пока недоступны.");
  const existing = data.reviews.find(item => item.date === review.date);
  const saved = existing?.closedAt ? { ...existing, ...review, closedAt: existing.closedAt, snapshot: existing.snapshot, transfers: existing.transfers } : { ...existing, ...review };
  return replaceReview(data, saved);
}

function replaceReview(data: AppData, review: DayReview): AppData {
  const exists = data.reviews.some(item => item.date === review.date);
  if (!exists && data.reviews.length >= 10000) throw new Error("Не удалось сохранить итоги: достигнут лимит записей.");
  return { ...data, reviews: exists ? data.reviews.map(item => item.date === review.date ? review : item) : [...data.reviews, review] };
}

/** Computes and commits a closure from current state without mutating the draft or existing records. */
export function closeDay(data: AppData, input: CloseDayInput, today: string, nowISO: string): AppData {
  dateSchema.parse(today);
  z.iso.datetime().parse(nowISO);
  const reflection = reflectionSchema.parse(input);
  if (reflection.date > today) throw new Error("Итоги будущего дня пока недоступны.");
  const existing = data.reviews.find(review => review.date === reflection.date);

  // Once closed, only reflection fields change; requests carried by an old draft cannot move tasks again.
  if (existing?.closedAt) return replaceReview(data, { ...existing, rating: reflection.rating, note: reflection.note, updatedAt: nowISO });

  const transfers = transfersSchema.parse(input.transfers);
  const boundary = reflection.date > today ? reflection.date : today;
  if (transfers.some(transfer => transfer.toDate <= boundary)) throw new Error("Перенесите задачи на день позже выбранного дня и сегодняшней даты.");

  const snapshot: ReviewSnapshot = {
    ...reviewSummary(data, reflection.date),
    completedTasks: data.tasks.filter(task => taskOnDate(task, reflection.date) && taskDone(task, reflection.date)).map(({ id, title }) => ({ id, title })),
  };
  const originals = new Map(data.tasks.map(task => [task.id, task]));
  const occupiedIds = new Set(originals.keys());
  const replacements = new Map<string, Task>();
  const copies: Task[] = [];
  const applied: CloseDayInput["transfers"] = [];

  for (const transfer of transfers) {
    const source = originals.get(transfer.taskId);
    if (!source || !taskOnDate(source, reflection.date) || taskDone(source, reflection.date)) continue;
    if (source.repeat === "none") {
      replacements.set(source.id, taskSchema.parse({ ...source, date: transfer.toDate }));
      applied.push({ ...transfer, newTaskId: source.id });
      continue;
    }
    if (occupiedIds.has(transfer.newTaskId)) throw new Error("Не удалось перенести задачу: идентификатор уже используется.");
    if (data.tasks.length + copies.length >= 10000) throw new Error("Не удалось перенести задачу: достигнут лимит задач.");
    const excludedDates = [...(source.excludedDates ?? []), reflection.date];
    replacements.set(source.id, taskSchema.parse({ ...source, excludedDates }));
    const copy = { ...source, id: transfer.newTaskId, date: transfer.toDate, repeat: "none" as const, completedDates: [] };
    delete copy.excludedDates;
    copies.push(taskSchema.parse(copy));
    occupiedIds.add(transfer.newTaskId);
    applied.push(transfer);
  }

  const review = dayReviewSchema.parse({ ...existing, ...reflection, mood: existing?.mood ?? "steady", updatedAt: nowISO, closedAt: nowISO, snapshot, transfers: applied });
  const tasks = replacements.size ? [...data.tasks.map(task => replacements.get(task.id) ?? task), ...copies] : data.tasks;
  return replaceReview({ ...data, tasks }, review);
}
