// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AuthForm } from "./auth-form";

const { state, auth, closeModal, notify } = vi.hoisted(() => ({
  state: { configured: true, user: null as null | { id: string; email: string } },
  auth: {
    signInWithOAuth: vi.fn(), signInWithPassword: vi.fn(), signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(), updateUser: vi.fn(),
  },
  closeModal: vi.fn(), notify: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({ getSupabase: () => state.configured ? { auth } : null }));
vi.mock("@/components/day-provider", () => ({ useDay: () => ({ user: state.user, closeModal, notify }) }));

beforeEach(() => {
  vi.clearAllMocks();
  state.configured = true;
  state.user = null;
  history.replaceState(null, "", "/settings");
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("offers Google and email before collecting credentials", async () => {
  render(<AuthForm />);
  expect(screen.getByRole("button", { name: /Google/ })).toBeTruthy();
  expect(screen.queryByLabelText("Электронная почта")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: /почт/ }));
  expect(screen.getByLabelText("Электронная почта")).toBeTruthy();
});

it("keeps the selected email signup flow and waits for actual confirmation", async () => {
  auth.signUp.mockResolvedValue({ data: { user: { id: "new" }, session: null }, error: null });
  render(<AuthForm initialMethod="email" initialMode="signup" />);
  await userEvent.type(screen.getByLabelText("Электронная почта"), "day@example.com");
  await userEvent.type(screen.getByLabelText("Пароль"), "password123");
  await userEvent.click(screen.getByRole("button", { name: "Создать аккаунт" }));
  expect(auth.signUp).toHaveBeenCalledWith({ email: "day@example.com", password: "password123", options: { emailRedirectTo: "http://localhost:3000/auth/callback" } });
  expect((await screen.findByRole("status")).textContent).toMatch(/подтвердите регистрацию/);
  expect(closeModal).not.toHaveBeenCalled();
  expect(notify).not.toHaveBeenCalled();
});

it("keeps provider choices available without inventing an unconfigured session", async () => {
  state.configured = false;
  render(<AuthForm />);
  await userEvent.click(screen.getByRole("button", { name: /Google/ }));
  expect(screen.getByRole("alert").textContent).toMatch(/не подключ/);
  expect(auth.signInWithOAuth).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: /почт/ }));
  expect(screen.getByText("Облако пока не подключено")).toBeTruthy();
  expect(closeModal).not.toHaveBeenCalled();
});

it("uses Google PKCE callback and only redirects after the real provider response", async () => {
  let resolve!: (result: unknown) => void;
  auth.signInWithOAuth.mockImplementation(() => new Promise(r => { resolve = r; }));
  const assign = vi.fn();
  vi.stubGlobal("location", { origin: "http://localhost:3000", href: "http://localhost:3000/settings", assign });
  render(<AuthForm />);
  await userEvent.click(screen.getByRole("button", { name: /Google/ }));
  expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: "http://localhost:3000/auth/callback", skipBrowserRedirect: true } });
  expect((screen.getByRole("button", { name: /Google/ }) as HTMLButtonElement).disabled).toBe(true);
  expect(assign).not.toHaveBeenCalled();
  await act(async () => resolve({ data: { provider: "google", url: "https://accounts.google.com/o/oauth2/auth" }, error: null }));
  expect(assign).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/auth");
  expect(closeModal).not.toHaveBeenCalled();
});

it("unlocks Google retry after a real provider error", async () => {
  auth.signInWithOAuth.mockResolvedValue({ data: { provider: "google", url: null }, error: new Error("provider disabled") });
  render(<AuthForm />);
  await userEvent.click(screen.getByRole("button", { name: /Google/ }));
  expect(screen.getByRole("alert").textContent).toMatch(/Google/);
  expect((screen.getByRole("button", { name: /Google/ }) as HTMLButtonElement).disabled).toBe(false);
});

it("does not redirect after the auth view unmounts", async () => {
  let resolve!: (result: unknown) => void;
  auth.signInWithOAuth.mockImplementation(() => new Promise(r => { resolve = r; }));
  const assign = vi.fn();
  vi.stubGlobal("location", { origin: "http://localhost:3000", href: "http://localhost:3000/settings", assign });
  const view = render(<AuthForm />);
  await userEvent.click(screen.getByRole("button", { name: /Google/ }));
  view.unmount();
  await act(async () => resolve({ data: { provider: "google", url: "https://accounts.google.com" }, error: null }));
  expect(assign).not.toHaveBeenCalled();
});

it("preserves password recovery instead of presenting signup choices", async () => {
  state.user = { id: "account-a", email: "day@example.com" };
  history.replaceState(null, "", "/settings?recovery=1");
  auth.updateUser.mockResolvedValue({ data: { user: state.user }, error: null });
  render(<AuthForm />);
  expect(screen.queryByRole("button", { name: /Google/ })).toBeNull();
  await userEvent.type(screen.getByLabelText("Новый пароль"), "newpassword123");
  await userEvent.click(screen.getByRole("button", { name: "Сохранить пароль" }));
  expect(auth.updateUser).toHaveBeenCalledWith({ password: "newpassword123" });
  expect(location.pathname).toBe("/settings");
  expect(closeModal).toHaveBeenCalledOnce();
  expect(notify).toHaveBeenCalledWith("Пароль обновлён");
});

it("sends password recovery to the existing recovery callback", async () => {
  auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  render(<AuthForm initialMethod="email" initialMode="login" />);
  await userEvent.click(screen.getByRole("button", { name: "Забыли пароль?" }));
  await userEvent.type(screen.getByLabelText("Электронная почта"), "day@example.com");
  await userEvent.click(screen.getByRole("button", { name: "Отправить письмо" }));
  expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("day@example.com", { redirectTo: "http://localhost:3000/auth/callback?recovery=1" });
  expect(screen.getByRole("status").textContent).toMatch(/восстановления отправлено/);
});

it("ignores email completion after switching accounts", async () => {
  let resolve!: (result: unknown) => void;
  auth.signInWithPassword.mockImplementation(() => new Promise(r => { resolve = r; }));
  const view = render(<AuthForm initialMethod="email" initialMode="login" />);
  await userEvent.type(screen.getByLabelText("Электронная почта"), "day@example.com");
  await userEvent.type(screen.getByLabelText("Пароль"), "password123");
  await userEvent.click(screen.getByRole("button", { name: "Войти" }));
  state.user = { id: "other-account", email: "other@example.com" };
  view.rerender(<AuthForm initialMethod="email" initialMode="login" />);
  await act(async () => resolve({ data: { user: { id: "old-account" }, session: {} }, error: null }));
  expect(closeModal).not.toHaveBeenCalled();
  expect(notify).not.toHaveBeenCalled();
});
