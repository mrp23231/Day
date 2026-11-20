// @vitest-environment jsdom
import React, { type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { emptyData } from "@/lib/domain";
import { I18nProvider } from "@/components/i18n-provider";
import { Planner } from "./planner";
vi.mock("@/components/day-provider", () => ({ useDay: () => ({
  data: { ...emptyData(), tasks: [{ id:"untimed", title:"Моя задача", date:"2026-11-14", time:"", description:"", category:"Личное", priority:"normal", repeat:"none", completedDates:[] }] },
  date:"2026-11-14", setDate:vi.fn(), openModal:vi.fn(), update:vi.fn(), notify:vi.fn(),
}) }));
vi.mock("@/components/shared", () => ({
  Empty: () => null, PageFooter: () => null, TaskRow: () => null, WeekStrip: () => null,
  PageHeading: ({title,children}:{title:string;children?:ReactNode}) => <header><h1>{title}</h1>{children}</header>,
}));
afterEach(cleanup);
describe("localized planner week", () => {
  it.each([
    ["en", "Week", "Anytime today", "Mon"],
    ["it", "Settimana", "Durante il giorno", "lun"],
  ] as const)("shows an untimed task in %s without confusing it with the translator", (locale, week, fallback, monday) => {
    render(<I18nProvider locale={locale}><Planner/></I18nProvider>);
    fireEvent.click(screen.getByRole("radio",{name:week}));
    expect(screen.getByText(fallback)).toBeTruthy();
    expect(screen.getByText("Моя задача")).toBeTruthy();
    expect(screen.getByText(monday)).toBeTruthy();
  });
});
