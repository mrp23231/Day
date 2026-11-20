import { appDataSchema, type AppData } from "./domain";

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

export function parseBackup(text: string): AppData {
  if (text.length > MAX_BACKUP_BYTES || new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) {
    throw new Error("Файл слишком большой. Выберите резервную копию до 10 МБ.");
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Не удалось прочитать JSON. Выберите файл, экспортированный из Day.");
  }

  if (value !== null && typeof value === "object" && "version" in value && value.version !== 1) {
    throw new Error("Эта версия резервной копии не поддерживается. Нужна копия Day версии 1.");
  }
  const parsed = appDataSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("Структура резервной копии не прошла проверку. Текущие записи не изменены.");
  }

  const data = parsed.data;
  for (const group of ["tasks", "habits", "foods", "water"] as const) {
    const ids = data[group].map(record => record.id);
    if (new Set(ids).size !== ids.length) {
      throw new Error("В резервной копии повторяются идентификаторы записей. Выберите другую копию.");
    }
  }
  if (new Set(data.reviews.map(review => review.date)).size !== data.reviews.length) {
    throw new Error("В резервной копии повторяются даты итогов дня. Выберите другую копию.");
  }
  return data;
}

export function backupSummary(data: AppData) {
  return {
    tasks: data.tasks.length,
    habits: data.habits.length,
    foods: data.foods.length,
    water: data.water.length,
    reviews: data.reviews.length,
  };
}

/** Blobs and their browser-scoped references never leave this device. */
export function prepareExportData(data: AppData): AppData {
  const validated=appDataSchema.parse(data);
  return {...validated,preferences:{...validated.preferences,personalPhotos:{},dayIcons:{},cloudPhotoIds:[]}};
}

export function prepareImportedData(incoming: AppData, current: AppData): AppData {
  return {
    ...incoming,
    preferences: {
      ...incoming.preferences,
      personalPhotos: { ...current.preferences.personalPhotos },
      dayIcons: { ...current.preferences.dayIcons },
      cloudPhotoIds: [...current.preferences.cloudPhotoIds],
      onboardingDone: current.preferences.onboardingDone,
      accountOnboardingDone: current.preferences.accountOnboardingDone,
    },
  };
}
