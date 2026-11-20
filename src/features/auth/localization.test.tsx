// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { I18nProvider } from "@/components/i18n-provider";
import { AccountEntry } from "./account-entry";
import { WaterVisual } from "@/features/water/water-visual";
import { PromptInput } from "@/components/ui/ai-chat-input";

vi.mock("@/components/day-provider", () => ({ useDay: () => ({ user: null, openModal: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ getSupabase: () => null }));
afterEach(cleanup);

it("shows English account choices and a useful unconfigured Google error", () => {
  render(<I18nProvider locale="en"><AccountEntry /></I18nProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  expect(screen.getByRole("button", { name: "Email" })).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toContain("Google sign-in is not connected yet");
});

it("uses Italian accessible water progress and composer instructions", () => {
  render(<I18nProvider locale="it"><WaterVisual value={35} /><PromptInput value="Ciao" onValueChange={vi.fn()} onSubmit={vi.fn()} /></I18nProvider>);
  expect(screen.getByLabelText("Hai bevuto il 35% del tuo obiettivo")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Invia messaggio" })).toBeTruthy();
  expect(screen.getByText("Invio — invia · Maiusc + Invio — nuova riga")).toBeTruthy();
});
