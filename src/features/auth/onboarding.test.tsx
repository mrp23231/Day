// @vitest-environment jsdom
import React, { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyData, type AppData, type Preferences } from "@/lib/domain";
import { Onboarding } from "./onboarding";

const { TestContext, push } = await vi.hoisted(async () => ({
  TestContext: (await import("react")).createContext<Record<string, unknown>>({}),
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
// Keep drafts and preference writes real while avoiding the provider's network,
// storage, and authentication lifecycle, which are tested at its own boundary.
vi.mock("@/components/day-provider", async () => {
  const { useContext } = await import("react");
  return { useDay: () => useContext(TestContext) };
});

function Harness({ account = null, initialData = emptyData(), failSave = false }: {
  account?: string | null;
  initialData?: AppData;
  failSave?: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [open, setOpen] = useState(true);
  function setPreferences(preferences: Partial<Preferences>) {
    if (failSave) throw new Error("Хранилище недоступно");
    setData(current => ({ ...current, preferences: { ...current.preferences, ...preferences } }));
  }
  return <TestContext.Provider value={{ data, user: account ? { id: account } : null, setPreferences, closeModal: () => setOpen(false), notify: () => {} }}>
    {open && <Onboarding />}
    <output aria-label="Сохранённые данные">{JSON.stringify(data)}</output>
  </TestContext.Provider>;
}

const saved = () => JSON.parse(screen.getByLabelText("Сохранённые данные").textContent!) as AppData;
const next = () => fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
const finish = () => fireEvent.click(screen.getByRole("button", { name: "Сохранить и продолжить" }));

beforeEach(() => {
  push.mockClear();
  const warn = console.warn;
  // Motion emits an expected development diagnostic for the real media query.
  vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    if (!String(args[0]).startsWith("You have Reduced Motion enabled")) warn(...args);
  });
  vi.stubGlobal("matchMedia", () => ({ matches: true, media: "(prefers-reduced-motion: reduce)", addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("keeps choices as drafts until the final question, then saves before showing the welcome", () => {
  const initial = emptyData();
  render(<Harness account="account-a" initialData={initial} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Как к вам обращаться?" }), { target: { value: "  Ника  " } });
  next();
  fireEvent.click(screen.getByRole("radio", { name: /Привычки/ }));
  next();
  fireEvent.click(screen.getByRole("radio", { name: /Гибко/ }));
  expect(saved()).toEqual(initial);
  finish();
  expect(saved().preferences).toMatchObject({ name: "Ника", onboardingFocus: "habits", onboardingPace: "flexible", onboardingDone: true, accountOnboardingDone: true });
  expect(screen.getByRole("heading", { name: "Добро пожаловать, Ника" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Перейти к моему дню" }));
  expect(screen.queryByRole("heading", { name: "Добро пожаловать, Ника" })).toBeNull();
  expect(saved().preferences.name).toBe("Ника");
  expect(push).toHaveBeenCalledWith("/");
});

it("allows an unnamed guest to continue with defaults without completing account onboarding", () => {
  render(<Harness />);
  next(); next(); finish();
  expect(saved().preferences).toMatchObject({ name: "", onboardingFocus: "planning", onboardingPace: "gentle", onboardingDone: true, accountOnboardingDone: false });
  expect(screen.getByRole("heading", { name: "Добро пожаловать в Day" })).toBeTruthy();
});

it("preserves the name and selected answers when navigating back", () => {
  render(<Harness />);
  fireEvent.change(screen.getByRole("textbox", { name: "Как к вам обращаться?" }), { target: { value: "Мой псевдоним" } });
  next();
  fireEvent.click(screen.getByRole("radio", { name: /Баланс/ }));
  next();
  fireEvent.click(screen.getByRole("radio", { name: /По плану/ }));
  fireEvent.click(screen.getByRole("button", { name: "Назад" }));
  expect((screen.getByRole("radio", { name: /Баланс/ }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Назад" }));
  expect((screen.getByRole("textbox", { name: "Как к вам обращаться?" }) as HTMLInputElement).value).toBe("Мой псевдоним");
  next(); next();
  expect((screen.getByRole("radio", { name: /По плану/ }) as HTMLInputElement).checked).toBe(true);
});

it("limits a chosen name to 60 characters before persisting it", () => {
  render(<Harness />);
  const name = screen.getByRole("textbox", { name: "Как к вам обращаться?" }) as HTMLInputElement;
  expect(name.maxLength).toBe(60);
  fireEvent.change(name, { target: { value: "Н".repeat(80) } });
  next(); next(); finish();
  expect(saved().preferences.name).toBe("Н".repeat(60));
});

it("dismisses a repeated introduction without changing its saved completion or preferences", () => {
  const initial = emptyData();
  initial.preferences = { ...initial.preferences, name: "Саша", onboardingDone: true, accountOnboardingDone: true, onboardingFocus: "balance", onboardingPace: "structured" };
  render(<Harness account="account-a" initialData={initial} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Как к вам обращаться?" }), { target: { value: "Черновик" } });
  next();
  fireEvent.click(screen.getByRole("button", { name: "Продолжить позже" }));
  expect(saved()).toEqual(initial);
  expect(screen.queryByRole("button", { name: "Продолжить" })).toBeNull();
});

it("focuses each new heading and shows the full step when reduced motion is requested", () => {
  render(<Harness />);
  const first = screen.getByRole("heading", { name: "Начнём с вас" });
  expect(document.activeElement).toBe(first);
  expect(first.closest("section")?.style.opacity).not.toBe("0");
  next();
  const second = screen.getByRole("heading", { name: "Что сейчас важнее?" });
  expect(document.activeElement).toBe(second);
  expect(second.closest("section")?.style.transform).not.toMatch(/translate/);
  next(); finish();
  expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Добро пожаловать в Day" }));
});

it("keeps the final question available if saving fails", () => {
  render(<Harness failSave />);
  next(); next(); finish();
  expect(screen.getByRole("alert").textContent).toMatch(/сохранить/i);
  expect(screen.queryByRole("button", { name: "Перейти к моему дню" })).toBeNull();
  expect(saved().preferences.onboardingDone).toBe(false);
});

it("waits for name composition to finish before continuing", () => {
  render(<Harness />);
  const name = screen.getByRole("textbox", { name: "Как к вам обращаться?" });
  fireEvent.compositionStart(name);
  fireEvent.change(name, { target: { value: "明" } });
  fireEvent.submit(name.closest("form")!);
  expect(screen.queryByRole("heading", { name: "Что сейчас важнее?" })).toBeNull();
  fireEvent.compositionEnd(name);
  fireEvent.submit(name.closest("form")!);
  expect(screen.getByRole("heading", { name: "Что сейчас важнее?" })).toBeTruthy();
});

it("does not capture empty defaults when manually opened before account restoration", () => {
  const data = emptyData();
  const day = { data, user: { id: "pending-account" }, ready: true, authReady: false, setPreferences: vi.fn(), closeModal: vi.fn(), notify: vi.fn() };
  const view = render(<TestContext.Provider value={day}><Onboarding /></TestContext.Provider>);
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.getByRole("status").textContent).toContain("Загружаем");
  const restored = { ...data, preferences: { ...data.preferences, name: "Облачное имя", onboardingFocus: "habits" as const, onboardingPace: "flexible" as const } };
  view.rerender(<TestContext.Provider value={{ ...day, data: restored, authReady: true }}><Onboarding /></TestContext.Provider>);
  expect((screen.getByRole("textbox", { name: "Как к вам обращаться?" }) as HTMLInputElement).value).toBe("Облачное имя");
  next();
  expect((screen.getByRole("radio", { name: /Привычки/ }) as HTMLInputElement).checked).toBe(true);
});
