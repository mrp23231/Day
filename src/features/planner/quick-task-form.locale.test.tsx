// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/components/i18n-provider";
import { QuickTaskForm } from "./quick-task-form";
afterEach(cleanup);
describe("localized quick task form", () => {
  it.each([
    ["en", "Quickly add a task", "Add task to your plan"],
    ["it", "Aggiungi rapidamente un'attività", "Aggiungi l'attività al programma"],
  ] as const)("uses %s labels while preserving a user's task title", (locale, label, submit) => {
    const onAdd = vi.fn();
    render(<I18nProvider locale={locale}><QuickTaskForm date="2026-11-14" onAdd={onAdd}/></I18nProvider>);
    const input = screen.getByRole("textbox", { name: label });
    fireEvent.change(input, { target: { value: "Мой собственный план" } });
    fireEvent.click(screen.getByRole("button", { name: submit }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ title: "Мой собственный план", date: "2026-11-14", category: "Личное" }));
    expect((input as HTMLInputElement).value).toBe("");
  });
});
