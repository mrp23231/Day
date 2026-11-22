// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthApiError } from "@supabase/supabase-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { I18nProvider } from "@/components/i18n-provider";
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

it.each([
  ["ru", "invalid_credentials", "Неверная почта или пароль. Проверьте данные или восстановите пароль."],
  ["en", "invalid_credentials", "Incorrect email or password. Check your details or reset your password."],
  ["it", "invalid_credentials", "Email o password non corretti. Controlla i dati o reimposta la password."],
  ["ru", "email_not_confirmed", "Подтвердите почту по ссылке в письме, затем войдите снова."],
  ["en", "email_not_confirmed", "Confirm your email using the link in your inbox, then sign in again."],
  ["it", "email_not_confirmed", "Conferma l'email tramite il link ricevuto, poi accedi di nuovo."],
  ["ru", "over_request_rate_limit", "Слишком много попыток. Подождите несколько минут и попробуйте снова."],
  ["en", "over_email_send_rate_limit", "Too many attempts. Wait a few minutes and try again."],
  ["it", "over_request_rate_limit", "Troppi tentativi. Attendi qualche minuto e riprova."],
] as const)("offers useful %s recovery for %s without completing login", async (locale, code, message) => {
  auth.signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error: new AuthApiError("Private provider details", 400, code) });
  const view = render(<I18nProvider locale={locale}><AuthForm initialMethod="email" initialMode="login" /></I18nProvider>);
  fireEvent.change(view.container.querySelector('[name="email"]')!, { target: { value: "day@example.com" } });
  fireEvent.change(view.container.querySelector('[name="password"]')!, { target: { value: "password123" } });
  fireEvent.submit(view.container.querySelector("form")!);
  expect((await screen.findByRole("alert")).textContent).toBe(message);
  expect(view.container.querySelector<HTMLButtonElement>('[type="submit"]')!.disabled).toBe(false);
  expect(closeModal).not.toHaveBeenCalled();
  expect(notify).not.toHaveBeenCalled();
});

it.each([
  ["weak_password", "Выберите более надёжный пароль: используйте буквы, цифры и символы."],
  ["email_address_not_authorized", "Не удалось отправить письмо на этот адрес. Выберите вход через Google или попробуйте позже."],
  ["signup_disabled", "Регистрация сейчас недоступна. Если у вас уже есть аккаунт, войдите в него."],
] as const)("keeps signup open with a useful recovery for %s", async (code, message) => {
  auth.signUp.mockResolvedValue({ data: { user: null, session: null }, error: new AuthApiError("Private provider details", 400, code) });
  const view = render(<AuthForm initialMethod="email" initialMode="signup" />);
  fireEvent.change(screen.getByLabelText("Электронная почта"), { target: { value: "day@example.com" } });
  fireEvent.change(screen.getByLabelText("Пароль"), { target: { value: "password123" } });
  fireEvent.submit(view.container.querySelector("form")!);
  expect((await screen.findByRole("alert")).textContent).toBe(message);
  expect(closeModal).not.toHaveBeenCalled();
  expect(notify).not.toHaveBeenCalled();
});

it("keeps unknown provider error details private and allows email retry", async () => {
  auth.signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error: new AuthApiError("Sensitive internal failure", 500, "unexpected_failure") });
  const view = render(<AuthForm initialMethod="email" initialMode="login" />);
  fireEvent.change(screen.getByLabelText("Электронная почта"), { target: { value: "day@example.com" } });
  fireEvent.change(screen.getByLabelText("Пароль"), { target: { value: "password123" } });
  fireEvent.submit(view.container.querySelector("form")!);
  expect((await screen.findByRole("alert")).textContent).not.toContain("Sensitive internal failure");
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "Войти" }).disabled).toBe(false);
});

it("explains a disabled Google provider and keeps email available", async () => {
  auth.signInWithOAuth.mockResolvedValue({ data: { provider: "google", url: null }, error: new AuthApiError("Provider disabled", 400, "provider_disabled") });
  render(<I18nProvider locale="en"><AuthForm /></I18nProvider>);
  await userEvent.click(screen.getByRole("button", { name: /Google/ }));
  expect(screen.getByRole("alert").textContent).toBe("Google sign-in is currently unavailable. Choose email or try again later.");
  expect(screen.getByRole("button", { name: "Email" })).toBeTruthy();
  expect(closeModal).not.toHaveBeenCalled();
});
