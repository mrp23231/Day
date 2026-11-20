// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/components/i18n-provider";
import { ReviewStats } from "./review-stats";
beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("matchMedia", (media: string) => ({ matches: true, media, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("localized daily recap statistics", () => {
  it.each([
    ["en", "Records for 12 November", "Tasks: 3 of 4 completed, 75%.", "Completed tasks", "1,250 ml of a goal of 2,000 ml"],
    ["it", "Dati del 12 novembre", "Attività: 3 su 4 completate, 75%.", "Attività completate", "1250 ml su un obiettivo di 2000 ml"],
  ] as const)("formats %s counts and dates without translating user content", (locale, region, summary, completed, water) => {
    render(<I18nProvider locale={locale}><ReviewStats date="2026-11-12" summary={{ tasks:{completed:3,total:4}, habits:{completed:2,total:3}, water:{amount:1250,goal:2000}, food:{entries:2,calories:830} }} completedTasks={[{id:"1",title:"Прогуляться у реки"}]}/></I18nProvider>);
    expect(screen.getByRole("region", {name:region})).toBeTruthy();
    expect(screen.getByText(summary)).toBeTruthy();
    expect(screen.getByText(water)).toBeTruthy();
    expect(within(screen.getByRole("list", {name:completed})).getByText("Прогуляться у реки")).toBeTruthy();
  });
});
