// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyData, type AppData } from "@/lib/domain";
import { I18nProvider } from "@/components/i18n-provider";
import { Assistant } from "./assistant";

const { DayTestContext } = await vi.hoisted(async () => {
  const { createContext } = await import("react");
  return { DayTestContext: createContext<Record<string, unknown>>({}) };
});
vi.mock("@/components/day-provider", async () => {
  const { useContext } = await import("react");
  return { useDay: () => useContext(DayTestContext) };
});

let data: AppData;
let openModal: ReturnType<typeof vi.fn>;
function Harness({ account = "account-a", version = 0, ready = true }: { account?: string | null; version?: number; ready?: boolean }) {
  return <DayTestContext.Provider value={{ data, date: "2026-11-14", user: account ? { id: account } : null, resetVersion: version, ready, authReady: ready, openModal }}><Assistant /></DayTestContext.Provider>;
}
function reply(message: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => status === 200 ? { message } : { error: message } } as Response;
}
async function submit(message = "Помоги с планом") {
  await userEvent.type(screen.getByRole("textbox", { name: "Сообщение Day AI" }), message);
  await userEvent.click(screen.getByRole("button", { name: "Отправить сообщение" }));
}

beforeEach(() => {
  data = emptyData();
  openModal = vi.fn();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply("Начните с самого важного.")));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Day AI beta", () => {
  it("labels beta limits and lets a guest compose before opening real login", async () => {
    render(<Harness account={null} />);
    expect(screen.getByText("Beta")).toBeTruthy();
    expect(screen.getByText(/создание задач.*позже/i)).toBeTruthy();
    await userEvent.type(screen.getByRole("textbox", { name: "Сообщение Day AI" }), "Мой черновик");
    await userEvent.click(screen.getByRole("button", { name: "Войти в аккаунт" }));
    expect(openModal).toHaveBeenCalledWith({ type: "auth" });
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Мой черновик");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("hands an explicitly submitted guest login draft to the first signed-in account without sharing context", async () => {
    const view = render(<Harness account={null} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Вопрос до входа" } });
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Войти в аккаунт" }));
    view.rerender(<Harness account="account-a" />);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Вопрос до входа");
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByRole("log")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    view.rerender(<Harness account="account-b" />);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
  });

  it("keeps the guest draft when login is cancelled and hands off the latest draft after another login click", async () => {
    const view = render(<Harness account={null} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Мой вопрос" } });
    await userEvent.click(screen.getByRole("button", { name: "Войти в аккаунт" }));
    // Closing a login dialog leaves the same guest scope mounted.
    view.rerender(<Harness account={null} />);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Мой вопрос");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Мой вопрос после отмены" } });
    await userEvent.click(screen.getByRole("button", { name: "Войти в аккаунт" }));
    view.rerender(<Harness account="account-a" />);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Мой вопрос после отмены");
  });

  it("does not hand a guest draft to an account when login was not requested from the composer", async () => {
    const view = render(<Harness account={null} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Непереданный черновик" } });
    view.rerender(<Harness account="account-a" />);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
  });

  it("consumes the guest draft handoff once", async () => {
    const view = render(<Harness account={null} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Разовый черновик" } });
    await userEvent.click(screen.getByRole("button", { name: "Войти в аккаунт" }));
    view.rerender(<Harness account="account-a" />);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Разовый черновик");
    view.rerender(<Harness account={null} />);
    view.rerender(<Harness account="account-b" />);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
  });

  it("clears a pending guest draft handoff when the scope is reset", async () => {
    const view = render(<Harness account={null} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Черновик до сброса" } });
    await userEvent.click(screen.getByRole("button", { name: "Войти в аккаунт" }));
    view.rerender(<Harness account={null} version={1} />);
    view.rerender(<Harness account="account-c" version={1} />);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
  });

  it("sends text without private daily context unless explicitly selected", async () => {
    data.tasks.push({ id: "one", title: "Позвонить", date: "2026-11-14", time: "12:00", description: "Личная заметка", priority: "high", category: "Личное", repeat: "none", completedDates: ["2026-11-14"] });
    data.water.push({ id: "water", date: "2026-11-14", time: "09:00", amount: 250 });
    render(<Harness />);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    await submit();
    expect(await screen.findByText("Начните с самого важного.")).toBeTruthy();
    const first = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(first).toEqual({ locale: "ru", messages: [{ role: "user", content: "Помоги с планом" }] });
    await userEvent.click(screen.getByRole("checkbox"));
    await submit("Учти мои записи");
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const second = JSON.parse((vi.mocked(fetch).mock.calls[1][1] as RequestInit).body as string);
    expect(second.context).toEqual({ date: "2026-11-14", tasks: [{ title: "Позвонить", time: "12:00", priority: "high", done: true }], nutrition: { calories: 0, protein: 0, fat: 0, carbs: 0 }, water: 250 });
    expect(second.messages).toEqual([{ role: "user", content: "Помоги с планом" }, { role: "assistant", content: "Начните с самого важного." }, { role: "user", content: "Учти мои записи" }]);
  });

  it("keeps history and draft on failure, then retries one copy of the failed message", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(reply("Первый ответ"))
      .mockResolvedValueOnce(reply("Day AI пока не подключён. Нужна настройка сервера.", 503))
      .mockResolvedValueOnce(reply("Ответ после повтора"));
    render(<Harness />);
    await submit("Первый вопрос");
    await screen.findByText("Первый ответ");
    await submit("Второй вопрос");
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Первый ответ")).toBeTruthy();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Второй вопрос");
    expect(screen.queryByText("Второй вопрос", { selector: "p" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Повторить запрос" }));
    expect(await screen.findByText("Ответ после повтора")).toBeTruthy();
    const payload = JSON.parse((vi.mocked(fetch).mock.calls[2][1] as RequestInit).body as string);
    expect(payload.messages).toEqual([{ role: "user", content: "Первый вопрос" }, { role: "assistant", content: "Первый ответ" }, { role: "user", content: "Второй вопрос" }]);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
  });

  it("displays the full long response but bounds assistant history to the API message limit", async () => {
    const longAnswer = `${"А".repeat(4000)} Финальная мысль`;
    vi.mocked(fetch).mockResolvedValueOnce(reply(longAnswer)).mockResolvedValueOnce(reply("Следующий ответ"));
    render(<Harness />);
    await submit("Первый вопрос");
    expect(await screen.findByText(longAnswer)).toBeTruthy();
    await submit("Продолжим");
    await screen.findByText("Следующий ответ");
    const payload = JSON.parse((vi.mocked(fetch).mock.calls[1][1] as RequestInit).body as string);
    expect(payload.messages).toEqual([{ role: "user", content: "Первый вопрос" }, { role: "assistant", content: "А".repeat(4000) }, { role: "user", content: "Продолжим" }]);
    expect(screen.getByText(longAnswer)).toBeTruthy();
  });

  it.each([undefined, "", "   ", { text: "not a message" }])("rejects invalid successful payload %j and preserves the draft", async message => {
    vi.mocked(fetch).mockResolvedValue(reply(message));
    render(<Harness />);
    await submit("Сохрани мой вопрос");
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Сохрани мой вопрос");
  });

  it("prevents duplicate pending sends and disables editing during a request", async () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
    render(<Harness />);
    await submit();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(true);
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toMatch(/думает/);
  });

  it.each(["account-b", null])("aborts pending work and hides the previous account conversation on switch to %s", async account => {
    let complete!: (value: Response) => void;
    vi.mocked(fetch).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const view = render(<Harness />);
    await submit("Личный вопрос первого аккаунта");
    const signal = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).signal;
    view.rerender(<Harness account={account} />);
    expect(signal?.aborted).toBe(true);
    expect(screen.queryByText("Личный вопрос первого аккаунта")).toBeNull();
    await act(async () => complete(reply("Поздний ответ первого аккаунта")));
    expect(screen.queryByText("Поздний ответ первого аккаунта")).toBeNull();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  });

  it("aborts on unmount and resets the session when local data is reset", async () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
    const view = render(<Harness />);
    await submit();
    const firstSignal = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).signal;
    view.rerender(<Harness version={1} />);
    expect(firstSignal?.aborted).toBe(true);
    expect(screen.queryByText("Помоги с планом")).toBeNull();
    await submit("Ещё вопрос");
    const secondSignal = (vi.mocked(fetch).mock.calls[1][1] as RequestInit).signal;
    view.unmount();
    expect(secondSignal?.aborted).toBe(true);
  });

  it("offers login after a server session expires without discarding the message", async () => {
    vi.mocked(fetch).mockResolvedValue(reply("Войдите в аккаунт, чтобы использовать Day AI.", 401));
    render(<Harness />);
    await submit();
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: "Войти в аккаунт" }));
    expect(openModal).toHaveBeenCalledWith({ type: "auth" });
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Помоги с планом");
  });

  it("does not send until account restoration is ready", async () => {
    render(<Harness ready={false} />);
    await userEvent.type(screen.getByRole("textbox"), "Мой вопрос");
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    expect(fetch).not.toHaveBeenCalled();
  });
});

it("sends the selected Italian language and translated suggestion without changing user records", async () => {
  render(<I18nProvider locale="it"><Harness /></I18nProvider>);
  await userEvent.click(screen.getByRole("button", {name: /Metti ordine nella giornata/}));
  const draft=screen.getByRole("textbox", {name:"Messaggio a Day AI"}) as HTMLTextAreaElement;
  expect(draft.value).toContain("Aiutami a creare un piano realistico");
  fireEvent.change(draft,{target:{value:"Il mio piano"}});
  await userEvent.click(screen.getByRole("button",{name:"Invia messaggio"}));
  await screen.findByRole("log");
  const payload=JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
  expect(payload).toEqual({locale:"it",messages:[{role:"user",content:"Il mio piano"}]});
});
