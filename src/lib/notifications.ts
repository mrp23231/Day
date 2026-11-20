"use client";
import { getTranslator, type Locale } from "./i18n";
import { toast } from "@yusufceng1z/ding-react";

export type NotifyOptions = {
  kind?: "success" | "error" | "info";
  description?: string;
  action?: { label: string; onClick: () => void | Promise<void> };
};

let notificationGeneration = 0;

/** A dismissed account's action must never run against the next account. */
export function dismissNotifications(): void {
  notificationGeneration++;
  toast.dismiss(undefined, { immediate: true });
}

export function showNotification(message: string, options: NotifyOptions = {}, locale:Locale="ru"): void {
  const t=getTranslator(locale);
  let caller = "";
  let started = false;
  const generation = notificationGeneration;
  const action = options.action;
  caller = toast[options.kind ?? "success"](message, {
    description: options.description,
    action: action ? {
      label: action.label,
      onClick: () => {
        if (!started) {
          started = true;
          // Ding actions are synchronous patches. Run the app action after this
          // patch so its own notification cannot be dismissed by Ding's handler.
          void Promise.resolve().then(() => {
            if (generation === notificationGeneration) return action.onClick();
          }).then(
            () => { if (generation === notificationGeneration) toast.update(caller, { type: "success", title: t("Готово"), description: "", action: null }); },
            () => { if (generation === notificationGeneration) toast.update(caller, { type: "error", title: t("Не удалось выполнить действие"), description: t("Попробуйте ещё раз."), action: null }); },
          );
        }
        // Caller-owned updates above cannot overwrite a newer notification.
        return { type: "loading", title: t("Выполняем…"), description: "", action: null };
      },
    } : undefined,
  });
}
