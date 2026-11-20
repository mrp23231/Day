// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Scanner } from "./scanner";

const { DayTestContext } = await vi.hoisted(async () => {
  const { createContext } = await import("react");
  return { DayTestContext: createContext<Record<string, unknown>>({}) };
});
vi.mock("@/components/day-provider", async () => {
  const { useContext } = await import("react");
  return { useDay: () => useContext(DayTestContext) };
});

let openModal: ReturnType<typeof vi.fn>;
class ControlledReader {
  static instances: ControlledReader[] = [];
  result: string | ArrayBuffer | null = null;
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
  onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;
  readyState = 0;
  error: DOMException | null = null;
  aborted = false;
  constructor() { ControlledReader.instances.push(this); }
  readAsDataURL() { this.readyState = 1; }
  abort() { this.aborted = true; this.readyState = 2; }
  complete(value: string) {
    this.result = value;
    this.readyState = 2;
    this.onload?.({ target: this } as unknown as ProgressEvent<FileReader>);
  }
  fail() { this.onerror?.({ target: this } as unknown as ProgressEvent<FileReader>); }
}
function Harness({ account = "account-a", version = 0 }: { account?: string | null; version?: number }) {
  return <DayTestContext.Provider value={{ user: account ? { id: account } : null, resetVersion: version, date: "2026-11-14", openModal }}><Scanner /></DayTestContext.Provider>;
}
function select(name = "plate.png") {
  fireEvent.change(screen.getByLabelText("Фотография еды"), { target: { files: [new File(["photo"], name, { type: "image/png" })] } });
  return ControlledReader.instances.at(-1)!;
}
function choosePhoto(value = "data:image/png;base64,cGhvdG8=") {
  const reader = select();
  act(() => reader.complete(value));
  return reader;
}
function response(ingredients: unknown, status = 200) {
  return { ok: status === 200, json: async () => status === 200 ? { ingredients } : { error: "Сервис временно недоступен" } } as Response;
}
const validIngredients = [{ name: "Рис", grams: 150, confidence: "средняя" }];

beforeEach(() => {
  openModal = vi.fn();
  ControlledReader.instances = [];
  vi.stubGlobal("FileReader", ControlledReader);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(validIngredients)));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("food scanner request isolation", () => {
  it("does not let an earlier file read replace the most recently selected photo", () => {
    render(<Harness />);
    const first = select("first.png");
    const second = select("second.png");
    act(() => second.complete("data:image/png;base64,c2Vjb25k"));
    act(() => first.complete("data:image/png;base64,Zmlyc3Q="));
    expect(screen.getByRole("img").getAttribute("src")).toBe("data:image/png;base64,c2Vjb25k");
    expect(first.aborted).toBe(true);
  });

  it("ignores an old analysis and cancels it when another photo is selected", async () => {
    let finish!: (value: Response) => void;
    vi.mocked(fetch).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<Harness />);
    choosePhoto();
    fireEvent.click(screen.getByRole("button", { name: "Распознать блюдо" }));
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
    const next = select("second.png");
    act(() => next.complete("data:image/png;base64,c2Vjb25k"));
    await act(async () => finish(response(validIngredients)));
    expect(screen.queryByLabelText("Порция: Рис")).toBeNull();
    expect(screen.getByRole("img").getAttribute("src")).toBe("data:image/png;base64,c2Vjb25k");
    expect(signal?.aborted).toBe(true);
    expect((screen.getByRole("button", { name: "Распознать блюдо" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it.each([{ account: "account-b", version: 0 }, { account: null, version: 0 }, { account: "account-a", version: 1 }])("clears the photo and ignores pending analysis after scope changes to %j", async scope => {
    let finish!: (value: Response) => void;
    vi.mocked(fetch).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const view = render(<Harness />);
    choosePhoto();
    fireEvent.click(screen.getByRole("button", { name: "Распознать блюдо" }));
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
    view.rerender(<Harness {...scope} />);
    await act(async () => finish(response(validIngredients)));
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByLabelText("Порция: Рис")).toBeNull();
    expect(signal?.aborted).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Добавить еду вручную" }));
    expect(openModal).toHaveBeenCalledWith({ type: "food" });
  });

  it("cancels pending file reading when the scope is reset", () => {
    const view = render(<Harness />);
    const reader = select();
    view.rerender(<Harness version={1} />);
    act(() => reader.complete("data:image/png;base64,b2xk"));
    expect(screen.queryByRole("img")).toBeNull();
    expect(reader.aborted).toBe(true);
  });

  it("aborts an analysis when the scanner is closed", () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
    const view = render(<Harness />);
    choosePhoto();
    fireEvent.click(screen.getByRole("button", { name: "Распознать блюдо" }));
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it.each([
    { ingredients: undefined },
    { ingredients: [] },
    { ingredients: [{ name: "Рис", grams: -1, confidence: "высокая" }] },
    { ingredients: [{ name: "Рис", grams: 20, confidence: "unknown" }] },
    { ingredients: [{ name: " ", grams: 20, confidence: "средняя" }] },
  ])("rejects malformed successful payload $ingredients without losing the selected photo", async ({ ingredients }) => {
    vi.mocked(fetch).mockResolvedValue(response(ingredients));
    render(<Harness />);
    choosePhoto();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Распознать блюдо" })));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("img")).toBeTruthy();
    expect(screen.queryByRole("spinbutton")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Добавить еду вручную" }));
    expect(openModal).toHaveBeenCalledWith({ type: "food" });
  });

  it("reports a file read failure and keeps manual entry available", () => {
    render(<Harness />);
    const reader = select();
    act(() => reader.fail());
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Добавить еду вручную" }));
    expect(openModal).toHaveBeenCalledWith({ type: "food" });
  });

  it("lets the user review recognized portions in the manual food form", async () => {
    render(<Harness />);
    choosePhoto();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Распознать блюдо" })));
    fireEvent.change(screen.getByLabelText("Порция: Рис"), { target: { value: "120" } });
    fireEvent.click(screen.getByRole("button", { name: "Проверить и заполнить пищевую ценность" }));
    expect(openModal).toHaveBeenCalledWith({ type: "food", item: { id: "", name: "Рис", date: "2026-11-14", meal: "lunch", grams: 120, calories: 0, protein: 0, fat: 0, carbs: 0, favorite: false } });
  });
});
