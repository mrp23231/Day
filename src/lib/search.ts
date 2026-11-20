import { formatLocaleDate, getTranslator, type Locale } from "./i18n";
import { meals, taskOnDate, type AppData, type ModalState } from "./domain";

export type SearchKind = "action" | "page" | "task" | "habit" | "food";
export interface SearchResult {
  id: string;
  title: string;
  description: string;
  kind: SearchKind;
  href: string;
  date?: string;
  modal?: Exclude<ModalState, null>;
}
export interface SearchDocument { result: SearchResult; titleKey: string; terms: string }

function normalize(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}
function indexResult(result: SearchResult, keywords = ""): SearchDocument {
  return { result, titleKey: normalize(result.title), terms: normalize(`${result.title} ${result.description} ${result.date ?? ""} ${keywords}`) };
}
const kindRank: Record<SearchKind, number> = { task: 0, habit: 0, food: 0, page: 1, action: 2 };

export function createSearchIndex(data: AppData, date: string, locale: Locale = "ru"): SearchDocument[] {
  const t = getTranslator(locale);
  const dateLabels = new Map<string, string>();
  const dated = (value: string) => {
    if (!dateLabels.has(value)) dateLabels.set(value, formatLocaleDate(locale, value, { day: "numeric", month: "long", year: "numeric" }));
    return dateLabels.get(value)!;
  };
  const index: SearchDocument[] = [
    indexResult({ id: "action:task", title: t("Новая задача"), description: t("В план на {date}", {date: dated(date)}), kind: "action", href: "/planner", date, modal: { type: "task" } }, "создать добавить дело встреча"),
    indexResult({ id: "action:food", title: t("Добавить приём пищи"), description: t("В дневник на {date}", {date: dated(date)}), kind: "action", href: "/nutrition", date, modal: { type: "food" } }, "создать еда блюдо завтрак обед ужин перекус"),
    indexResult({ id: "action:water", title: t("Добавить воду"), description: t("Записать объём на {date}", {date: dated(date)}), kind: "action", href: "/water", date, modal: { type: "water" } }, "создать стакан порция мл"),
    indexResult({ id: "action:habit", title: t("Новая привычка"), description: t("Название и расписание"), kind: "action", href: "/habits", date, modal: { type: "habit" } }, "создать добавить ритуал"),
    ...([
      ["/", "Сегодня", "Сводка выбранного дня", "обзор главный день"],
      ["/planner", "Планировщик", "Задачи и календарь", "планы расписание неделя месяц"],
      ["/nutrition", "Питание", "Дневник и ориентиры", "еда калории ккал бжу белки жиры углеводы фото"],
      ["/water", "Вода", "Водный баланс и история", "питьевой объём стакан"],
      ["/habits", "Привычки", "Расписание и серии", "регулярные дела ритуалы"],
      ["/progress", "Прогресс", "Графики за день, неделю и месяц", "аналитика статистика итоги"],
      ["/assistant", "Day AI", "Помощник по планам и записям", "ассистент ии чат"],
      ["/settings", "Настройки", "Профиль, оформление и данные", "имя тема аккаунт облако экспорт"],
    ] as const).map(([href, title, description, keywords]) => indexResult({ id: `page:${href}`, title: t(title), description: t(description), kind: "page", href }, keywords)),
  ];
  for (const task of data.tasks) {
    const target = taskOnDate(task, date) ? date : task.date;
    index.push(indexResult({ id: `task:${task.id}`, title: task.title, description: `${["Личное","Работа","Здоровье","Учёба","Дом"].includes(task.category) ? t(task.category) : task.category} · ${dated(target)}${task.time ? ` · ${task.time}` : ""}${task.repeat !== "none" ? ` · ${t("Повторяется")}` : ""}`, kind: "task", href: "/planner", date: target, modal: { type: "task", item: task } }, task.description));
  }
  for (const habit of data.habits) {
    index.push(indexResult({ id: `habit:${habit.id}`, title: habit.name, description: `${t("Привычка")} · ${habit.days.length === 7 ? t("Каждый день") : t("По расписанию")}`, kind: "habit", href: "/habits", date, modal: { type: "habit", item: habit } }));
  }
  for (const food of [...data.foods].sort((a, b) => b.date.localeCompare(a.date))) {
    index.push(indexResult({ id: `food:${food.id}`, title: food.name, description: `${t(meals[food.meal])} · ${dated(food.date)} · ${Math.round(food.calories)} ${t("ккал")}`, kind: "food", href: "/nutrition", date: food.date, modal: { type: "food", item: food } }));
  }
  return index;
}

export function searchDay(index: SearchDocument[], query: string): SearchResult[] {
  const normalized = normalize(query);
  if (!normalized) return index.filter(({ result }) => result.kind === "action" || result.kind === "page").map(({ result }) => result);
  const words = normalized.split(" ");
  return index.filter(item => words.every(word => item.terms.includes(word)))
    .map(item => ({ item, rank: item.titleKey === normalized ? 0 : item.titleKey.startsWith(normalized) ? 1 : words.every(word => item.titleKey.includes(word)) ? 2 : 3 }))
    .sort((a, b) => a.rank - b.rank || kindRank[a.item.result.kind] - kindRank[b.item.result.kind]).slice(0, 12).map(({ item }) => item.result);
}
