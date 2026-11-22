// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyData } from "@/lib/domain";
import { Settings } from "./settings";
import { I18nProvider } from "@/components/i18n-provider";
const mocks = vi.hoisted(() => ({ day: {} as Record<string, unknown>, signOut: vi.fn(), fetch: vi.fn(), notify: vi.fn() }));
vi.mock("@/components/day-provider", () => ({ useDay: () => mocks.day }));
vi.mock("@/lib/supabase/client", () => ({ getSupabase: () => ({ auth: { signOut: mocks.signOut } }) }));
vi.mock("./appearance", () => ({ AppearanceSettings: () => null }));
vi.mock("./backup-import", () => ({ BackupImport: () => <div>Импорт копии</div> }));
vi.mock("@/features/auth/account-entry", () => ({ AccountEntry: () => null }));
beforeEach(() => {
  history.replaceState(null, "", "/settings");
  mocks.signOut.mockReset().mockResolvedValue({ error: null });
  mocks.fetch.mockReset(); mocks.notify.mockReset();
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.day = { data: emptyData(), user: { id: "a", email: "a@example.com" }, ready: true, authReady: true, resetVersion: 0, notify: mocks.notify, openModal: vi.fn() };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("scoped settings confirmations", () => {
  it.each([
    ["denied", "en", "Sign-in was cancelled. Try again or choose email."],
    ["provider", "it", "Impossibile completare l'accesso con Google. Riprova o scegli l'email."],
    ["1", "ru", "Не удалось завершить вход. Попробуйте войти снова или запросите новое письмо."],
  ] as const)("shows a localized retry path for callback %s", (failure, locale, message) => {
    history.replaceState(null, "", `/settings?auth_error=${failure}&error_description=private-details`);
    render(<I18nProvider locale={locale}><Settings /></I18nProvider>);
    expect(screen.getByRole("alert").textContent).toBe(message);
    expect(mocks.day.openModal).not.toHaveBeenCalled();
  });
  it.each([
    ["error=access_denied&error_description=private", "Sign-in was cancelled. Try again or choose email."],
    ["error_code=oauth_error&error_description=private", "Could not complete Google sign-in. Try again or choose email."],
  ])("recognizes auth error fragments after the server callback: %s", (fragment, message) => {
    history.replaceState(null, "", `/settings?auth_error=1#${fragment}`);
    render(<I18nProvider locale="en"><Settings /></I18nProvider>);
    expect(screen.getByRole("alert").textContent).toBe(message);
  });
  it.each(["error=access_denied&error_code=otp_expired", "error_code=otp_expired"])("offers a new email for expired link fragments: %s", fragment => {
    history.replaceState(null, "", `/settings?auth_error=1#${fragment}`);
    render(<I18nProvider locale="en"><Settings /></I18nProvider>);
    expect(screen.getByRole("alert").textContent).toBe("Could not complete sign-in. Try signing in again or request a new email.");
  });
  it("discards destructive confirmations when the account changes", () => {
    const view = render(<Settings />);
    fireEvent.click(screen.getByRole("button", { name: "Удалить аккаунт" }));
    expect(screen.getByRole("button", { name: "Подтверждаю удаление аккаунта" })).toBeTruthy();
    mocks.day = { ...mocks.day, user: { id: "b", email: "b@example.com" } };
    view.rerender(<Settings />);
    expect(screen.queryByRole("button", { name: "Подтверждаю удаление аккаунта" })).toBeNull();
  });
  it("binds the request to the confirmed account and ignores its late result after a switch", async () => {
    let resolve!: (value: Response) => void;
    mocks.fetch.mockImplementation(() => new Promise<Response>(done => { resolve = done; }));
    const view = render(<Settings />);
    fireEvent.click(screen.getByRole("button", { name: "Удалить аккаунт" }));
    fireEvent.click(screen.getByRole("button", { name: "Подтверждаю удаление аккаунта" }));
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).accountId).toBe("a");
    mocks.day = { ...mocks.day, user: { id: "b", email: "b@example.com" } };
    view.rerender(<Settings />);
    await act(async () => { resolve(new Response(JSON.stringify({ success: true }), { status: 200 })); });
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("shows import and a recoverable previous copy", () => {
    mocks.day.hasLocalBackup = true;
    render(<Settings />);
    expect(screen.getByText("Импорт копии")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Скачать предыдущую копию" })).toBeTruthy();
  });
  it("saves the language choice as a preference",()=>{
    const setPreferences=vi.fn();mocks.day.setPreferences=setPreferences;
    render(<Settings/>);
    fireEvent.change(screen.getByRole("combobox",{name:"Язык приложения"}),{target:{value:"it"}});
    expect(setPreferences).toHaveBeenCalledWith({language:"it"});
  });
  it("translates profile controls without translating the user's name",()=>{
    const data=emptyData();data.preferences.name="Никита";mocks.day.data=data;
    const view=render(<I18nProvider locale="en"><Settings/></I18nProvider>);
    expect(screen.getByRole("heading",{name:"Profile & settings"})).toBeTruthy();
    expect(screen.getByRole("heading",{name:"Никита"})).toBeTruthy();
    expect(screen.getByRole("combobox",{name:"App language"})).toBeTruthy();
    view.rerender(<I18nProvider locale="it"><Settings/></I18nProvider>);
    expect(screen.getByRole("heading",{name:"Profilo e impostazioni"})).toBeTruthy();
    expect(screen.getByRole("combobox",{name:"Lingua dell’app"})).toBeTruthy();
    expect(screen.getByRole("button",{name:"Modifica avatar"})).toBeTruthy();
  });
});
