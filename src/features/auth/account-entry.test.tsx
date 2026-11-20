// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccountEntry } from "./account-entry";

const { openModal } = vi.hoisted(() => ({ openModal: vi.fn() }));
vi.mock("@/components/day-provider", () => ({ useDay: () => ({ user: null, openModal }) }));
vi.mock("@/lib/supabase/client", () => ({ getSupabase: () => null }));
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

it("opens accessible provider choices from the profile CTA and restores focus on Escape", async () => {
  render(<AccountEntry />);
  expect(screen.queryByRole("button", { name: /Google/ })).toBeNull();
  const trigger = screen.getByRole("button", { name: "Создать аккаунт" });
  trigger.focus();
  await userEvent.keyboard("{Enter}");
  expect(screen.getByRole("button", { name: /Google/ })).toBe(document.activeElement);
  await userEvent.tab();
  expect(screen.getByRole("button", { name: "Электронная почта" })).toBe(document.activeElement);
  await userEvent.keyboard("{Escape}");
  expect(trigger).toBe(document.activeElement);
  expect(screen.queryByRole("button", { name: /Google/ })).toBeNull();
});

it("routes profile signup and existing-account login to the selected email form", async () => {
  render(<AccountEntry />);
  await userEvent.click(screen.getByRole("button", { name: "Создать аккаунт" }));
  await userEvent.click(screen.getByRole("button", { name: "Электронная почта" }));
  expect(openModal).toHaveBeenLastCalledWith({ type: "auth", method: "email", mode: "signup" });
  await userEvent.click(screen.getByRole("button", { name: "Уже есть аккаунт? Войти" }));
  expect(openModal).toHaveBeenLastCalledWith({ type: "auth", method: "email", mode: "login" });
});
