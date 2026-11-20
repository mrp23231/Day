// @vitest-environment jsdom
import React, { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyData, type AppData, type PhotoTarget } from "@/lib/domain";
import { PersonalPhotosProvider } from "./personal-photos";
import { PhotoEditor } from "./photo-editor";

const { TestContext, media } = await vi.hoisted(async () => ({
  TestContext: (await import("react")).createContext<Record<string, unknown>>({}),
  media: { preparePhoto: vi.fn(), putPhoto: vi.fn(), getPhoto: vi.fn(), deletePhoto: vi.fn() },
}));
vi.mock("@/components/day-provider", async () => {
  const { useContext } = await import("react");
  return { useDay: () => useContext(TestContext) };
});
vi.mock("@/lib/personalization", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/personalization")>(),
  ...media,
}));

const oldId = "32a7a121-eb5a-4a18-924a-9eebfed16f40";
const notify = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  media.preparePhoto.mockResolvedValue(new Blob(["prepared"], { type: "image/jpeg" }));
  media.getPhoto.mockResolvedValue(new Blob(["photo"], { type: "image/jpeg" }));
  media.putPhoto.mockResolvedValue(undefined);
  media.deletePhoto.mockResolvedValue(undefined);
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:photo"), revokeObjectURL: vi.fn() });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function Harness({ target = "water", existing = false }: { target?: PhotoTarget; existing?: boolean }) {
  const [data, setData] = useState(() => {
    const initial = emptyData();
    if (existing) initial.preferences.personalPhotos[target] = oldId;
    return initial;
  });
  const [open, setOpen] = useState(true);
  return <TestContext.Provider value={{ data, user: null, ready: true, resetVersion: 0, update: (fn: (current: AppData) => AppData) => setData(fn), setPreferences: (patch: object) => setData(current => ({ ...current, preferences: { ...current.preferences, ...patch } })), notify }}>
    <PersonalPhotosProvider>{open && <PhotoEditor target={target} onClose={() => setOpen(false)} />}</PersonalPhotosProvider>
    <output aria-label="Saved photos">{JSON.stringify(data.preferences.personalPhotos)}</output>
    <output aria-label="Saved tone">{data.preferences.photoTone}</output>
  </TestContext.Provider>;
}

it("uploads to the selected card and lets the shared photo tone change here", async () => {
  render(<Harness />);
  expect(screen.getByRole("dialog", { name: "Фото: Вода" })).toBeTruthy();
  const file = new File(["image"], "water.webp", { type: "image/webp" });
  await userEvent.upload(screen.getByLabelText("Фото для: Вода"), file);
  await waitFor(() => expect(JSON.parse(screen.getByLabelText("Saved photos").textContent || "{}").water).toBeTruthy());
  expect(Object.keys(JSON.parse(screen.getByLabelText("Saved photos").textContent || "{}"))).toEqual(["water"]);
  await userEvent.click(screen.getByRole("button", { name: "Оригинал" }));
  expect(screen.getByLabelText("Saved tone").textContent).toBe("original");
});

it("removes only the selected card photo", async () => {
  render(<Harness target="food" existing />);
  await userEvent.click(screen.getByRole("button", { name: "Убрать фото" }));
  expect(screen.getByLabelText("Saved photos").textContent).toBe("{}");
  expect(screen.getByRole("button", { name: "Выбрать фото" })).toBeTruthy();
});

it("keeps the old photo and reports a failed replacement", async () => {
  media.preparePhoto.mockRejectedValue(new Error("Не удалось открыть фото"));
  render(<Harness existing />);
  await userEvent.upload(screen.getByLabelText("Фото для: Вода"), new File(["broken"], "broken.jpg", { type: "image/jpeg" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/Фото не загружено/));
  expect(JSON.parse(screen.getByLabelText("Saved photos").textContent || "{}")).toEqual({ water: oldId });
  expect(screen.getByRole("button", { name: "Заменить фото" })).toBeTruthy();
});

it("rejects an oversized photo before changing the stored photo", async () => {
  render(<Harness existing />);
  const file = new File(["image"], "large.jpg", { type: "image/jpeg" });
  Object.defineProperty(file, "size", { value: 20 * 1024 * 1024 + 1 });
  fireEvent.change(screen.getByLabelText("Фото для: Вода"), { target: { files: [file] } });
  expect(screen.getByRole("alert").textContent).toMatch(/до 20 МБ/);
  expect(JSON.parse(screen.getByLabelText("Saved photos").textContent || "{}")).toEqual({ water: oldId });
});

it("disables replacements and removal while a save continues safely after closing", async () => {
  let finish!: (blob: Blob) => void;
  media.preparePhoto.mockReturnValue(new Promise<Blob>(resolve => { finish = resolve; }));
  render(<Harness existing />);
  await userEvent.upload(screen.getByLabelText("Фото для: Вода"), new File(["photo"], "new.png", { type: "image/png" }));
  expect((screen.getByLabelText("Фото для: Вода") as HTMLInputElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Убрать фото" }) as HTMLButtonElement).disabled).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: "Закрыть" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  await act(async () => finish(new Blob(["prepared"], { type: "image/jpeg" })));
  await waitFor(() => expect(JSON.parse(screen.getByLabelText("Saved photos").textContent || "{}").water).not.toBe(oldId));
});
