// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "@yusufceng1z/ding-react";
import DingToast from "./ding-toast";
import { dismissNotifications, showNotification } from "@/lib/notifications";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
});

afterEach(async () => {
  cleanup();
  toast.dismiss(undefined, { immediate: true });
  await vi.advanceTimersByTimeAsync(1000);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function showAction(message: string, onClick: () => void | Promise<void>) {
  act(() => { showNotification(message, { kind: "info", action: { label: "Продолжить", onClick } }); });
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
  await act(async () => { await Promise.resolve(); });
}

describe("Day notifications", () => {
  it("uses the resolved Day theme and Russian accessible names", () => {
    const view = render(<DingToast theme="light" />);
    const region = screen.getByRole("region", { name: "Уведомления" });
    expect(region.getAttribute("data-theme")).toBe("light");
    expect(region.getAttribute("data-position")).toBe("top-center");
    view.rerender(<DingToast theme="dark" />);
    expect(region.getAttribute("data-theme")).toBe("dark");
    act(() => { showNotification("Файл не сохранён", { kind: "error" }); });
    expect(screen.getByRole("button", { name: "Закрыть уведомление" })).toBeTruthy();
  });

  it("announces ordinary feedback politely and errors with their explanation", () => {
    render(<DingToast theme="light" />);
    act(() => { showNotification("Добавлено 250 мл воды"); });
    expect(screen.getByRole("status").textContent?.trim()).toBe("Добавлено 250 мл воды");
    act(() => { showNotification("Фото не удалось сохранить", { kind: "error", description: "Освободите место на устройстве." }); });
    expect(screen.getByRole("alert").textContent?.trim()).toBe("Фото не удалось сохранить. Освободите место на устройстве.");
  });

  it("performs an action once without dismissing feedback created by that action", async () => {
    render(<DingToast theme="light" />);
    let opened = 0;
    await showAction("Можно продолжить", () => {
      opened++;
      showNotification("Открыт фокус", { kind: "info" });
    });
    expect(opened).toBe(1);
    expect(screen.getByRole("status").textContent?.trim()).toBe("Открыт фокус");
    expect(screen.queryByRole("button", { name: "Продолжить" })).toBeNull();
    expect(document.querySelector('.tst[data-phase="open"] .tst-title')?.textContent).toBe("Открыт фокус");
  });

  it("reports a rejected async action instead of losing its failure", async () => {
    render(<DingToast theme="light" />);
    await showAction("Сохранить копию", async () => { throw new Error("network"); });
    expect(screen.getByRole("alert").textContent).toContain("Не удалось выполнить действие");
    expect(screen.getByRole("button", { name: "Закрыть уведомление" })).toBeTruthy();
  });

  it("does not let an old asynchronous action overwrite a newer notification", async () => {
    render(<DingToast theme="light" />);
    let reject!: (error: Error) => void;
    const operation = new Promise<void>((_resolve, no) => { reject = no; });
    await showAction("Подготовить копию", () => operation);
    act(() => { showNotification("Новая задача сохранена"); });
    await act(async () => { reject(new Error("network")); await Promise.resolve(); });
    expect(screen.getByRole("status").textContent?.trim()).toBe("Новая задача сохранена");
    expect(document.querySelector('.tst[data-phase="open"] .tst-title')?.textContent).toBe("Новая задача сохранена");
  });

  it("invalidates queued actions when the account scope changes", async () => {
    render(<DingToast theme="light" />);
    let changes = 0;
    act(() => { showNotification("Изменить запись", { action: { label: "Продолжить", onClick: () => { changes++; } } }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
      dismissNotifications();
    });
    await act(async () => { await Promise.resolve(); });
    expect(changes).toBe(0);
  });
});
