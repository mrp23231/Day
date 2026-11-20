// @vitest-environment jsdom
import React from "react";
import { renderToString } from "react-dom/server";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";
import { Planner } from "@/features/planner/planner";

const session = vi.hoisted(() => ({ ready: false }));
vi.mock("next/navigation", () => ({ usePathname: () => "/planner" }));
vi.mock("./day-provider", async () => {
  const { emptyData, dayKey } = await import("@/lib/domain");
  return { useDay: () => ({
    data: emptyData(), user: null, ready: session.ready, date: dayKey(),
    resolvedTheme: "light", openModal() {}, setTheme() {}, setDate() {},
    update() {}, notify() {},
  }) };
});
vi.mock("@/features/appearance/personal-photos", () => ({ usePersonalPhotos: () => ({ urlFor: () => undefined }), useOptionalPersonalPhotos:()=>null }));
vi.mock("@/features/search/global-search", () => ({ GlobalSearch: () => null }));
vi.mock("@/features/auth/account-onboarding", () => ({ AccountOnboarding: () => null }));
vi.mock("@/features/editors/editors", () => ({ Editors: () => null }));

beforeEach(() => {
  session.ready = false;
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("local space readiness", () => {
  it("keeps date-dependent routes out of the initial shell until local state is ready", () => {
    render(<AppShell><Planner /></AppShell>);

    expect(screen.queryByRole("heading", { name: "Планировщик" })).toBeNull();
    expect(screen.getByRole("status", { name: "Загрузка пространства" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Мобильная навигация" })).toBeTruthy();
  });

  it("produces the same initial HTML when build time and browser time are different days", () => {
    const buildHtml = renderToString(<AppShell><Planner /></AppShell>);
    vi.setSystemTime(new Date("2026-12-15T12:00:00Z"));
    const browserHtml = renderToString(<AppShell><Planner /></AppShell>);

    expect(browserHtml).toBe(buildHtml);
  });

  it("shows the actual route once local state becomes ready", () => {
    const view = render(<AppShell><Planner /></AppShell>);
    session.ready = true;
    view.rerender(<AppShell><Planner /></AppShell>);

    expect(screen.queryByRole("status", { name: "Загрузка пространства" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Планировщик" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Быстро добавить задачу" })).toBeTruthy();
  });
});
