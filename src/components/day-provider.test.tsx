// @vitest-environment jsdom
import React, { useLayoutEffect } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyData, type AppData } from "@/lib/domain";
import { DayProvider, useDay } from "./day-provider";

const connection = vi.hoisted(() => ({ enabled: false, rpc: vi.fn(async () => ({ data: null, error: null })) as ReturnType<typeof vi.fn>, listener: undefined as ((event: AuthChangeEvent, session: Session | null) => void) | undefined }));
const photos = vi.hoisted(() => ({ clear: vi.fn<(scope:string)=>Promise<void>>(async () => {}) }));
vi.mock("@/lib/personalization", () => ({ clearPhotoScope: (scope:string) => photos.clear(scope) }));
vi.mock("@/lib/supabase/client", () => ({ getSupabase: () => connection.enabled ? {
  auth: { onAuthStateChange: (listener: typeof connection.listener) => {
    connection.listener = listener;
    return { data: { subscription: { unsubscribe() { connection.listener = undefined; } } } };
  } },
  rpc: (...args: unknown[]) => connection.rpc(...args),
} : null }));
vi.mock("@/features/appearance/use-appearance", () => ({ useAppearance: () => ({ resolvedTheme: "light", setTheme() {} }) }));
vi.mock("@/components/ui/balloons", () => ({ Balloons: () => null }));
vi.mock("@/components/ui/ding-toast", () => ({ default: () => null }));
vi.mock("@/lib/notifications", () => ({ dismissNotifications() {}, showNotification() {} }));

type DayContext = ReturnType<typeof useDay>;
let current: DayContext;
function Probe({ transact }: { transact?: (day: DayContext) => void }) {
  const day = useDay();
  useLayoutEffect(() => { current = day; }, [day]);
  return <><button onClick={() => transact?.(day)}>Изменить</button><output aria-label="Состояние">{JSON.stringify(day.data)}</output></>;
}
const renderedData = () => JSON.parse(screen.getByLabelText("Состояние").textContent!) as AppData;
const withName = (data: AppData, name: string): AppData => ({ ...data, preferences: { ...data.preferences, name } });

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "/");
  connection.enabled = false;
  connection.listener = undefined;
  connection.rpc.mockReset().mockResolvedValue({ data: null, error: null });
  photos.clear.mockClear();
});
afterEach(cleanup);

describe("provider transactions", () => {
  it("keeps the current photo reference and state when an immediate durable commit cannot be saved", () => {
    const initial=withName(emptyData(),"Текущий профиль");
    initial.preferences.personalPhotos.avatar="11111111-1111-4111-8111-111111111111";
    localStorage.setItem("day-data-v1",JSON.stringify(initial));
    render(<DayProvider><Probe/></DayProvider>);
    const original=Storage.prototype.setItem;
    const mock=vi.spyOn(Storage.prototype,"setItem").mockImplementation(function(this:Storage,key,value){
      if(key==="day-data-v1")throw new DOMException("full","QuotaExceededError");
      original.call(this,key,value);
    });
    try{
      expect(()=>current.update(data=>({...data,preferences:{...data.preferences,personalPhotos:{avatar:"22222222-2222-4222-8222-222222222222"}}}),{persist:true})).toThrow();
      expect(current.data).toEqual(initial);
      expect(JSON.parse(localStorage.getItem("day-data-v1")!)).toEqual(initial);
    }finally{mock.mockRestore();}
  });
  it("returns each validated commit and chains same-event updates against the latest pending state", () => {
    const initial = withName(emptyData(), "Сохранённое имя");
    localStorage.setItem("day-data-v1", JSON.stringify(initial));
    let first: AppData | undefined;
    let second: AppData | undefined;
    let secondInput: AppData | undefined;
    render(<DayProvider><Probe transact={day => {
      first = day.update(data => withName(data, `${data.preferences.name} · первый`));
      second = day.update(data => {
        secondInput = data;
        return withName(data, `${data.preferences.name} · второй`);
      });
    }} /></DayProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Изменить" }));

    expect(first).toEqual(withName(initial, "Сохранённое имя · первый"));
    expect(secondInput).toBe(first);
    expect(second).toBe(current.data);
    expect(renderedData().preferences.name).toBe("Сохранённое имя · первый · второй");
    expect(JSON.parse(localStorage.getItem("day-data-v1")!).preferences.name).toBe("Сохранённое имя · первый · второй");
  });

  it("throws invalid transactions to the caller while preserving committed state", () => {
    render(<DayProvider><Probe /></DayProvider>);
    const before = current.data;
    let callerError: unknown;

    act(() => {
      try {
        current.update(data => ({ ...data, preferences: { ...data.preferences, waterGoal: 0 } }));
      } catch (error) {
        callerError = error;
      }
    });

    expect(callerError).toBeInstanceOf(Error);
    expect(current.data).toBe(before);
    expect(renderedData()).toEqual(before);
    let nextInput: AppData | undefined;
    act(() => { current.update(data => { nextInput = data; return withName(data, "Следующее изменение"); }); });
    expect(nextInput).toBe(before);
    expect(current.data.preferences.name).toBe("Следующее изменение");
  });

  it("uses the reset state for another transaction in the same event", () => {
    const initial = withName(emptyData(), "До сброса");
    initial.tasks = [{ id: "old", title: "Старая задача", date: "2026-11-12", description: "", time: "", priority: "normal", category: "Личное", repeat: "none", completedDates: [] }];
    localStorage.setItem("day-data-v1", JSON.stringify(initial));
    let receipt: AppData | undefined;
    render(<DayProvider><Probe transact={day => {
      day.resetData();
      receipt = day.update(data => withName(data, "После сброса"));
    }} /></DayProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Изменить" }));

    expect(receipt).toBe(current.data);
    expect(renderedData()).toEqual(withName(emptyData(), "После сброса"));
    expect(current.resetVersion).toBe(1);
  });

  it("uses the newly hydrated account scope before React rerenders", () => {
    connection.enabled = true;
    const guest = withName(emptyData(), "Гость");
    const account = withName(emptyData(), "Аккаунт");
    localStorage.setItem("day-data-v1", JSON.stringify(guest));
    localStorage.setItem("day-user-account", JSON.stringify(account));
    render(<DayProvider><Probe /></DayProvider>);
    let receipt: AppData | undefined;

    act(() => {
      connection.listener!("SIGNED_IN", { user: { id: "account" } } as Session);
      receipt = current.update(data => withName(data, `${data.preferences.name} · изменение`));
    });

    expect(receipt).toBe(current.data);
    expect(renderedData().preferences.name).toBe("Аккаунт · изменение");
    expect(JSON.parse(localStorage.getItem("day-user-account")!).preferences.name).toBe("Аккаунт · изменение");
    expect(JSON.parse(localStorage.getItem("day-data-v1")!).preferences.name).toBe("Гость");
  });
});


describe("account hydration readiness", () => {
  it("waits for cloud restoration before allowing the account welcome", async () => {
    connection.enabled = true;
    let resolveCloud!: (value: unknown) => void;
    connection.rpc.mockImplementation(() => new Promise(resolve => { resolveCloud = resolve; }));
    render(<DayProvider><Probe /></DayProvider>);
    expect(current.authReady).toBe(false);
    act(() => { connection.listener!("SIGNED_IN", { user: { id: "account" } } as Session); });
    expect(current.authReady).toBe(false);
    await waitFor(() => expect(connection.rpc).toHaveBeenCalledOnce());
    const remote = emptyData();
    remote.preferences.accountOnboardingDone = true;
    remote.preferences.name = "Облачный профиль";
    await act(async () => { resolveCloud({ data: { data: remote, revision: 2 }, error: null }); });
    expect(current.authReady).toBe(true);
    expect(current.data.preferences.accountOnboardingDone).toBe(true);
    expect(current.data.preferences.name).toBe("Облачный профиль");
  });

  it("settles on failure without replacing a local account draft", async () => {
    connection.enabled = true;
    connection.rpc.mockRejectedValue(new Error("offline"));
    localStorage.setItem("day-user-account", JSON.stringify(withName(emptyData(), "На устройстве")));
    render(<DayProvider><Probe /></DayProvider>);
    act(() => { connection.listener!("SIGNED_IN", { user: { id: "account" } } as Session); });
    await waitFor(() => expect(current.authReady).toBe(true));
    expect(current.data.preferences.name).toBe("На устройстве");
    expect(current.storageError).toContain("Облако");
  });

  it("ignores a late cloud response after signing out", async () => {
    connection.enabled = true;
    let resolveCloud!: (value: unknown) => void;
    connection.rpc.mockImplementation(() => new Promise(resolve => { resolveCloud = resolve; }));
    render(<DayProvider><Probe /></DayProvider>);
    act(() => { connection.listener!("SIGNED_IN", { user: { id: "account" } } as Session); });
    await waitFor(() => expect(connection.rpc).toHaveBeenCalledOnce());
    act(() => { connection.listener!("SIGNED_OUT", null); });
    expect(current.authReady).toBe(true);
    const remote = withName(emptyData(), "Чужой поздний ответ");
    await act(async () => { resolveCloud({ data: { data: remote, revision: 1 }, error: null }); });
    expect(current.user).toBeNull();
    expect(current.data.preferences.name).toBe("");
    expect(current.authReady).toBe(true);
  });
});

it("keeps a PKCE recovery editor open when the cookie session arrives as INITIAL_SESSION", async () => {
  connection.enabled = true;
  history.replaceState(null, "", "/settings?recovery=1");
  render(<DayProvider><Probe /></DayProvider>);
  act(() => { current.openModal({ type: "auth" }); });
  act(() => { connection.listener!("INITIAL_SESSION", { user: { id: "recovery-account" } } as Session); });
  expect(current.modal).toEqual({ type: "auth" });
  await waitFor(() => expect(current.authReady).toBe(true));
  expect(current.modal).toEqual({ type: "auth" });
  history.replaceState(null, "", "/");
});

describe("recoverable local import", () => {
  it("persists the old space before replacing records and preserves device identity settings", () => {
    const initial = withName(emptyData(), "До импорта");
    initial.preferences.personalPhotos = { space: "11111111-1111-4111-8111-111111111111" };
    initial.preferences.onboardingDone = true;
    localStorage.setItem("day-data-v1", JSON.stringify(initial));
    render(<DayProvider><Probe /></DayProvider>);
    const incoming = withName(emptyData(), "Из копии");
    incoming.preferences.accountOnboardingDone = true;
    incoming.preferences.personalPhotos = { plan: "22222222-2222-4222-8222-222222222222" };
    incoming.tasks.push({ id:"restored", title:"Восстановленная задача", date:"2026-11-14", time:"", priority:"normal", category:"Личное", description:"", repeat:"none", completedDates:[] });
    act(() => { current.importData(incoming); });
    expect(JSON.parse(localStorage.getItem("day-data-v1:backup")!)).toEqual(initial);
    expect(current.data.tasks[0].title).toBe("Восстановленная задача");
    expect(current.data.preferences.personalPhotos).toEqual(initial.preferences.personalPhotos);
    expect(current.data.preferences.accountOnboardingDone).toBe(false);
    expect(current.data.preferences.onboardingDone).toBe(true);
    expect(JSON.parse(localStorage.getItem("day-data-v1")!)).toEqual(current.data);
    expect(current.hasLocalBackup).toBe(true);
    expect(current.resetVersion).toBe(1);
  });

  it("refuses to import if a rollback copy cannot be stored", () => {
    const initial = withName(emptyData(), "Важные записи");
    localStorage.setItem("day-data-v1", JSON.stringify(initial));
    render(<DayProvider><Probe /></DayProvider>);
    const original = Storage.prototype.setItem;
    const mock = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this:Storage,key,value) {
      if (key.endsWith(":backup")) throw new DOMException("full", "QuotaExceededError");
      original.call(this,key,value);
    });
    try {
      expect(() => current.importData(emptyData())).toThrow(/копи|мест/i);
      expect(current.data).toEqual(initial);
      expect(JSON.parse(localStorage.getItem("day-data-v1")!)).toEqual(initial);
    } finally { mock.mockRestore(); }
  });

  it("restores the previous rollback copy if writing imported data fails", () => {
    const initial = withName(emptyData(), "Текущий профиль");
    const previous = JSON.stringify(withName(emptyData(), "Предыдущая копия"));
    localStorage.setItem("day-data-v1", JSON.stringify(initial));
    localStorage.setItem("day-data-v1:backup", previous);
    render(<DayProvider><Probe /></DayProvider>);
    const original = Storage.prototype.setItem;
    const mock = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this:Storage,key,value) {
      if (key === "day-data-v1") throw new DOMException("full", "QuotaExceededError");
      original.call(this,key,value);
    });
    try {
      expect(() => current.importData(emptyData())).toThrow();
      expect(current.data).toEqual(initial);
      expect(localStorage.getItem("day-data-v1:backup")).toBe(previous);
      expect(JSON.parse(localStorage.getItem("day-data-v1")!)).toEqual(initial);
    } finally { mock.mockRestore(); }
  });

  it("rejects an import action retained from the previous account render", () => {
    connection.enabled = true;
    render(<DayProvider><Probe /></DayProvider>);
    const staleImport = current.importData;
    act(() => { connection.listener!("SIGNED_IN", { user: { id:"another" } } as Session); });
    expect(() => staleImport(emptyData())).toThrow(/пространств|аккаунт/i);
    expect(localStorage.getItem("day-data-v1:backup")).toBeNull();
  });

  it("clears the rollback copy when the user clears their local space", () => {
    localStorage.setItem("day-data-v1:backup", JSON.stringify(emptyData()));
    render(<DayProvider><Probe /></DayProvider>);
    expect(current.hasLocalBackup).toBe(true);
    act(() => { current.resetData(); });
    expect(localStorage.getItem("day-data-v1:backup")).toBeNull();
    expect(current.hasLocalBackup).toBe(false);
  });

  it("does not clear records, previous backup or photos when persisting a reset fails", () => {
    const initial = withName(emptyData(), "Сохранённые записи");
    localStorage.setItem("day-data-v1", JSON.stringify(initial));
    localStorage.setItem("day-data-v1:backup", JSON.stringify(initial));
    render(<DayProvider><Probe /></DayProvider>);
    const original = Storage.prototype.setItem;
    const mock = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this:Storage,key,value) {
      if (key === "day-data-v1") throw new DOMException("blocked", "SecurityError");
      original.call(this,key,value);
    });
    try {
      act(() => { current.resetData(); });
      expect(current.data).toEqual(initial);
      expect(localStorage.getItem("day-data-v1:backup")).not.toBeNull();
      expect(photos.clear).not.toHaveBeenCalled();
      expect(current.resetVersion).toBe(0);
    } finally { mock.mockRestore(); }
  });
});

describe("durable cloud restore", () => {
  async function accountSpace() {
    connection.enabled = true;
    const initial = withName(emptyData(), "На устройстве");
    initial.preferences.personalPhotos = { space: "11111111-1111-4111-8111-111111111111" };
    initial.preferences.accountOnboardingDone = true;
    localStorage.setItem("day-user-account", JSON.stringify(initial));
    localStorage.setItem("day-user-account:revision", "2");
    render(<DayProvider><Probe /></DayProvider>);
    act(() => { connection.listener!("SIGNED_IN", { user: { id: "account" } } as Session); });
    await waitFor(() => expect(current.authReady).toBe(true));
    return initial;
  }

  it("persists restored records and account photos before reporting success", async () => {
    const initial = await accountSpace();
    const remote = withName(emptyData(), "Из облака");
    remote.preferences.personalPhotos = { plan: "22222222-2222-4222-8222-222222222222" };
    connection.rpc.mockResolvedValue({ data: { data: remote, revision: 7 }, error: null });
    await act(async () => { await current.restoreCloud(); });
    expect(current.data.preferences.name).toBe("Из облака");
    expect(current.data.preferences.personalPhotos).toEqual(remote.preferences.personalPhotos);
    expect(current.data.preferences.accountOnboardingDone).toBe(true);
    expect(JSON.parse(localStorage.getItem("day-user-account")!)).toEqual(current.data);
    expect(JSON.parse(localStorage.getItem("day-user-account:backup")!)).toEqual(initial);
    expect(localStorage.getItem("day-user-account:revision")).toBe("7");
    expect(current.resetVersion).toBe(1);
  });

  it.each(["day-user-account", "day-user-account:revision"])("keeps current state, cloud revision and previous backup when %s cannot be written", async failingKey => {
    const initial = await accountSpace();
    const previousBackup = JSON.stringify(withName(emptyData(), "Ещё раньше"));
    localStorage.setItem("day-user-account:backup", previousBackup);
    connection.rpc.mockResolvedValue({ data: { data: withName(emptyData(), "Из облака"), revision: 7 }, error: null });
    const original = Storage.prototype.setItem;
    let failed = false;
    const mock = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this:Storage,key,value) {
      if (key === failingKey && !failed) { failed = true; throw new DOMException("full", "QuotaExceededError"); }
      original.call(this,key,value);
    });
    try {
      await act(async () => { await current.restoreCloud(); });
      expect(current.data).toEqual(initial);
      expect(JSON.parse(localStorage.getItem("day-user-account")!)).toEqual(initial);
      expect(localStorage.getItem("day-user-account:backup")).toBe(previousBackup);
      expect(localStorage.getItem("day-user-account:revision")).toBe("2");
    } finally { mock.mockRestore(); }
  });

  it("keeps the original raw file when recovering an unreadable local space", async () => {
    connection.enabled = true;
    const raw = '{"tasks": ["original incomplete source"]';
    localStorage.setItem("day-user-account", raw);
    render(<DayProvider><Probe /></DayProvider>);
    act(() => { connection.listener!("SIGNED_IN", { user: { id: "account" } } as Session); });
    await waitFor(() => expect(current.authReady).toBe(true));
    connection.rpc.mockResolvedValue({ data: { data: withName(emptyData(), "Восстановлено"), revision: 2 }, error: null });
    await act(async () => { await current.restoreCloud(); });
    expect(localStorage.getItem("day-user-account:backup")).toBe(raw);
    expect(current.data.preferences.name).toBe("Восстановлено");
  });
});


describe("automatic account synchronization",()=>{
  beforeEach(()=>vi.useFakeTimers());
  afterEach(()=>vi.useRealTimers());
  const saves=()=>connection.rpc.mock.calls.filter(([name])=>name==="save_day_state");
  async function login(initial=withName(emptyData(),"Local"),remoteRevision=2,dirtyMarker="0"){
    connection.enabled=true;
    localStorage.setItem("day-user-account",JSON.stringify(initial));
    localStorage.setItem("day-user-account:revision","2");
    localStorage.setItem("day-user-account:dirty",dirtyMarker);
    connection.rpc.mockImplementation(async(name:string)=>name==="load_day_state"?{data:{data:initial,revision:remoteRevision},error:null}:{data:remoteRevision+1,error:null});
    render(<DayProvider><Probe/></DayProvider>);
    act(()=>connection.listener!("SIGNED_IN",{user:{id:"account"}} as Session));
    await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
    expect(current.authReady).toBe(true);
  }
  it("debounces edits and persists a pending marker until acknowledgement",async()=>{
    await login();
    act(()=>current.setPreferences({name:"First"}));
    expect(localStorage.getItem("day-user-account:dirty")).toBe("1");
    await act(async()=>{await vi.advanceTimersByTimeAsync(500);});
    act(()=>current.setPreferences({name:"Latest"}));
    await act(async()=>{await vi.advanceTimersByTimeAsync(899);});
    expect(saves()).toHaveLength(0);
    await act(async()=>{await vi.advanceTimersByTimeAsync(1);});
    expect(saves()).toHaveLength(1);
    expect(saves()[0][1]).toMatchObject({expected_revision:2,payload:{preferences:{name:"Latest"}}});
    expect(localStorage.getItem("day-user-account:dirty")).toBe("0");
    expect(current.cloudStatus).toBe("saved");
  });
  it("serializes saves and advances the revision when an edit happens during a save",async()=>{
    await login();
    let resolveSave!:(result:unknown)=>void;
    connection.rpc.mockImplementation((name:string)=>name==="save_day_state"?new Promise(resolve=>{resolveSave=resolve;}):Promise.resolve({data:null,error:null}));
    act(()=>current.setPreferences({name:"First"}));
    await act(async()=>{await vi.advanceTimersByTimeAsync(900);});
    act(()=>current.setPreferences({name:"Second"}));
    await act(async()=>{await vi.advanceTimersByTimeAsync(900);});
    expect(saves()).toHaveLength(1);
    await act(async()=>{resolveSave({data:3,error:null});});
    expect(localStorage.getItem("day-user-account:revision")).toBe("3");
    expect(localStorage.getItem("day-user-account:dirty")).toBe("1");
    await act(async()=>{await vi.advanceTimersByTimeAsync(900);});
    expect(saves()).toHaveLength(2);
    expect(saves()[1][1]).toMatchObject({expected_revision:3,payload:{preferences:{name:"Second"}}});
    await act(async()=>{resolveSave({data:4,error:null});});
    expect(localStorage.getItem("day-user-account:dirty")).toBe("0");
  });
  it("restores newer clean cloud data on focus including personalization",async()=>{
    await login();
    const remote=withName(emptyData(),"Other device");
    remote.preferences.theme="dark";
    connection.rpc.mockResolvedValue({data:{data:remote,revision:3},error:null});
    await act(async()=>{window.dispatchEvent(new Event("focus"));});
    expect(current.data.preferences.name).toBe("Other device");
    expect(current.data.preferences.theme).toBe("dark");
    expect(localStorage.getItem("day-user-account:revision")).toBe("3");
  });
  it("preserves pending local work and stops on a newer remote revision",async()=>{
    await login(withName(emptyData(),"Pending local"),5,"1");
    await act(async()=>{await vi.advanceTimersByTimeAsync(1500);});
    expect(current.cloudStatus).toBe("conflict");
    expect(current.data.preferences.name).toBe("Pending local");
    expect(localStorage.getItem("day-user-account:dirty")).toBe("1");
    expect(saves()).toHaveLength(0);
  });
  it("retries pending offline work after reconnecting",async()=>{
    await login();
    const online=vi.spyOn(navigator,"onLine","get").mockReturnValue(false);
    try{
      act(()=>current.setPreferences({name:"Offline edit"}));
      await act(async()=>{await vi.advanceTimersByTimeAsync(900);});
      expect(saves()).toHaveLength(0);
      expect(current.cloudStatus).toBe("offline");
      online.mockReturnValue(true);
      await act(async()=>{window.dispatchEvent(new Event("online"));});
      expect(saves()).toHaveLength(1);
      expect(current.cloudStatus).toBe("saved");
    }finally{online.mockRestore();}
  });
  it("never uploads an empty local reset until a subsequent explicit change",async()=>{
    await login();
    act(()=>current.resetData());
    await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
    expect(saves()).toHaveLength(0);
    expect(localStorage.getItem("day-user-account:dirty")).toBe("0");
    act(()=>current.setPreferences({name:"Fresh local edit"}));
    await act(async()=>{await vi.advanceTimersByTimeAsync(900);});
    expect(saves()).toHaveLength(1);
  });
  it("ignores an old account save acknowledgement after switching accounts",async()=>{
    await login();
    let resolveSave!:(result:unknown)=>void;
    connection.rpc.mockImplementation((name:string)=>name==="save_day_state"?new Promise(resolve=>{resolveSave=resolve;}):Promise.resolve({data:null,error:null}));
    act(()=>current.setPreferences({name:"First account edit"}));
    await act(async()=>{await vi.advanceTimersByTimeAsync(900);});
    act(()=>connection.listener!("SIGNED_IN",{user:{id:"another"}} as Session));
    await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
    await act(async()=>{resolveSave({data:3,error:null});});
    expect(current.data.preferences.name).toBe("");
    expect(localStorage.getItem("day-user-account:dirty")).toBe("1");
    expect(localStorage.getItem("day-user-another:revision")).toBeNull();
    expect(current.cloudStatus).toBe("saved");
  });
});
