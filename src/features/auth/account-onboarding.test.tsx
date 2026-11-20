// @vitest-environment jsdom
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyData } from "@/lib/domain";
import { AccountOnboarding } from "./account-onboarding";
const state = vi.hoisted(() => ({ day: {} as Record<string, unknown> }));
vi.mock("@/components/day-provider", () => ({ useDay: () => state.day }));
afterEach(cleanup);
beforeEach(() => { state.day = { data: emptyData(), ready: true, authReady: false, user: { id: "first" }, modal: null, openModal: vi.fn() }; });
it("waits for restored preferences then opens the account introduction only once", () => {
  const { rerender } = render(<AccountOnboarding />);
  expect(state.day.openModal).not.toHaveBeenCalled();
  state.day.authReady = true;
  rerender(<AccountOnboarding />);
  expect(state.day.openModal).toHaveBeenCalledExactlyOnceWith({ type: "onboarding" });
  state.day.modal = { type: "onboarding" };
  rerender(<AccountOnboarding />);
  state.day.modal = null;
  rerender(<AccountOnboarding />);
  expect(state.day.openModal).toHaveBeenCalledOnce();
});
it("does not interrupt recovery or completed account onboarding", () => {
  state.day.authReady = true;
  state.day.modal = { type: "auth" };
  const { rerender } = render(<AccountOnboarding />);
  expect(state.day.openModal).not.toHaveBeenCalled();
  state.day.modal = null;
  state.day.data = { ...emptyData(), preferences: { ...emptyData().preferences, accountOnboardingDone: true } };
  rerender(<AccountOnboarding />);
  expect(state.day.openModal).not.toHaveBeenCalled();
});
it("allows a different unfinished account and a later sign-in to resume", () => {
  state.day.authReady = true;
  const { rerender } = render(<AccountOnboarding />);
  state.day.user = { id: "second" };
  rerender(<AccountOnboarding />);
  expect(state.day.openModal).toHaveBeenCalledTimes(2);
  state.day.user = null;
  rerender(<AccountOnboarding />);
  state.day.user = { id: "second" };
  rerender(<AccountOnboarding />);
  expect(state.day.openModal).toHaveBeenCalledTimes(3);
});
