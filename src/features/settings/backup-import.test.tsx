// @vitest-environment jsdom
import React, { useState } from "react";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { emptyData, type AppData } from "@/lib/domain";
import { BackupImport } from "./backup-import";

const { TestContext } = await vi.hoisted(async () => ({ TestContext: (await import("react")).createContext<Record<string, unknown>>({}) }));
vi.mock("@/components/day-provider", async () => {
  const { useContext } = await import("react");
  return { useDay: () => useContext(TestContext) };
});
afterEach(cleanup);

const imported = (): AppData => ({
  ...emptyData(),
  tasks: [{ id: "imported-task", title: "Задача из копии", description: "", date: "2026-11-14", time: "", priority: "normal", category: "Личное", repeat: "none", completedDates: [] }],
  water: [{ id: "imported-water", date: "2026-11-14", time: "10:00", amount: 250 }],
});
type HarnessProps = { accountId?: string; resetVersion?: number; ready?: boolean; authReady?: boolean; failImport?: boolean };
function Harness({ accountId, resetVersion = 0, ready = true, authReady = true, failImport = false }: HarnessProps) {
  const [data, setData] = useState(emptyData);
  function importData(incoming: AppData) {
    if (failImport) throw new Error("Не хватает места для резервной копии.");
    setData(incoming);
  }
  return <TestContext.Provider value={{ data, user: accountId ? { id: accountId } : null, resetVersion, ready, authReady, importData }}>
    <BackupImport />
    <output aria-label="Текущие записи">{JSON.stringify(data)}</output>
  </TestContext.Provider>;
}
function fileWithText(text: () => Promise<string>, name = "day.json") {
  const file = new File(["{}"], name, { type: "application/json" });
  Object.defineProperty(file, "text", { value: text });
  return file;
}
const validFile = () => fileWithText(async () => JSON.stringify(imported()));
const input = () => screen.getByLabelText("JSON-копия Day") as HTMLInputElement;
const current = () => JSON.parse(screen.getByLabelText("Текущие записи").textContent!) as AppData;
async function chooseValidFile() {
  await userEvent.upload(input(), validFile());
  await screen.findByRole("table", { name: "Содержимое резервной копии" });
}
function pendingText() {
  let resolve!: (text: string) => void;
  const promise = new Promise<string>(done => { resolve = done; });
  return { file: fileWithText(() => promise), resolve };
}

it("previews record counts and imports only after explicit replacement confirmation", async () => {
  render(<Harness />);
  await chooseValidFile();
  const table = screen.getByRole("table", { name: "Содержимое резервной копии" });
  expect(within(table).getByRole("row", { name: /Задачи/ }).textContent).toBe("Задачи01");
  expect(within(table).getByRole("row", { name: /Вода/ }).textContent).toBe("Вода01");
  expect(current().tasks).toEqual([]);
  const importButton = screen.getByRole("button", { name: "Импортировать копию" }) as HTMLButtonElement;
  expect(importButton.disabled).toBe(true);
  await userEvent.click(screen.getByRole("checkbox", { name: /заменить текущие записи/ }));
  await userEvent.click(importButton);
  expect(current().tasks[0].title).toBe("Задача из копии");
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.getByText(/Копия импортирована/).getAttribute("role")).toBe("status");
});

it("shows an invalid JSON error and leaves current data unchanged", async () => {
  render(<Harness />);
  await userEvent.upload(input(), fileWithText(async () => "{broken"));
  expect((await screen.findByRole("alert")).textContent).toMatch(/JSON/);
  expect(screen.queryByRole("table")).toBeNull();
  expect(current().tasks).toEqual([]);
});

it("rejects oversized files before reading their contents", async () => {
  render(<Harness />);
  let reads = 0;
  const file = fileWithText(async () => { reads++; return JSON.stringify(imported()); });
  Object.defineProperty(file, "size", { value: 10 * 1024 * 1024 + 1 });
  await userEvent.upload(input(), file);
  expect((await screen.findByRole("alert")).textContent).toMatch(/10 МБ/);
  expect(reads).toBe(0);
  expect(current().tasks).toEqual([]);
});

it("requires fresh confirmation after another file is chosen", async () => {
  render(<Harness />);
  await chooseValidFile();
  await userEvent.click(screen.getByRole("checkbox", { name: /заменить текущие записи/ }));
  await userEvent.upload(input(), validFile());
  await screen.findByRole("table");
  expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  expect((screen.getByRole("button", { name: "Импортировать копию" }) as HTMLButtonElement).disabled).toBe(true);
});

it("cancels a preview without changing current records", async () => {
  render(<Harness />);
  await chooseValidFile();
  await userEvent.click(screen.getByRole("button", { name: "Отмена" }));
  expect(screen.queryByRole("table")).toBeNull();
  expect(input().value).toBe("");
  expect(current().tasks).toEqual([]);
});

it("ignores an older file read after a later selection", async () => {
  render(<Harness />);
  const pending = pendingText();
  await userEvent.upload(input(), pending.file);
  await chooseValidFile();
  await act(async () => { pending.resolve("{broken"); });
  expect(screen.getByRole("table")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(current().tasks).toEqual([]);
});

it("does not revive a cancelled file when its read finishes", async () => {
  render(<Harness />);
  const pending = pendingText();
  await userEvent.upload(input(), pending.file);
  await userEvent.click(screen.getByRole("button", { name: "Отмена" }));
  await act(async () => { pending.resolve(JSON.stringify(imported())); });
  expect(screen.queryByRole("table")).toBeNull();
  expect(current().tasks).toEqual([]);
});

it.each(["reset", "account", "auth"])("invalidates a pending read when %s changes", async change => {
  const view = render(<Harness />);
  const pending = pendingText();
  await userEvent.upload(input(), pending.file);
  view.rerender(<Harness resetVersion={change === "reset" ? 1 : 0} accountId={change === "account" ? "new-account" : undefined} authReady={change !== "auth"} />);
  await act(async () => { pending.resolve(JSON.stringify(imported())); });
  expect(screen.queryByRole("table")).toBeNull();
  expect(current().tasks).toEqual([]);
});

it.each(["reset", "account"])("clears an already confirmed preview when %s changes", async change => {
  const view = render(<Harness />);
  await chooseValidFile();
  await userEvent.click(screen.getByRole("checkbox", { name: /заменить текущие записи/ }));
  view.rerender(<Harness resetVersion={change === "reset" ? 1 : 0} accountId={change === "account" ? "new-account" : undefined} />);
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.queryByRole("button", { name: "Импортировать копию" })).toBeNull();
});

it("keeps the preview and current data when the durable import fails", async () => {
  render(<Harness failImport />);
  await chooseValidFile();
  await userEvent.click(screen.getByRole("checkbox", { name: /заменить текущие записи/ }));
  await userEvent.click(screen.getByRole("button", { name: "Импортировать копию" }));
  expect(screen.getByRole("alert").textContent).toMatch(/места/);
  expect(screen.getByRole("table")).toBeTruthy();
  expect(current().tasks).toEqual([]);
});

it("reports a failed local file read", async () => {
  render(<Harness />);
  await userEvent.upload(input(), fileWithText(async () => { throw new Error("File unavailable"); }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/прочитать файл/);
  expect(current().tasks).toEqual([]);
});

it("disables file selection until both storage and account loading finish", () => {
  const view = render(<Harness ready={false} />);
  expect(input().disabled).toBe(true);
  view.rerender(<Harness ready authReady={false} />);
  expect(input().disabled).toBe(true);
  view.rerender(<Harness ready authReady />);
  expect(input().disabled).toBe(false);
});

it("ignores a file read after the import component unmounts", async () => {
  const pending = pendingText();
  const view = render(<Harness />);
  await userEvent.upload(input(), pending.file);
  view.unmount();
  render(<Harness />);
  await act(async () => { pending.resolve(JSON.stringify(imported())); });
  expect(screen.queryByRole("table")).toBeNull();
  expect(current().tasks).toEqual([]);
});
