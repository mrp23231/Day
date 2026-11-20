import { afterEach, describe, expect, it, vi } from "vitest";
import { boundedFetch, withNetworkDeadline } from "./network-deadline";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("network deadlines", () => {
  it("settles successful thenables and clears their deadline", async () => {
    vi.useFakeTimers();
    const thenable: PromiseLike<string> = { then: Promise.resolve("saved").then.bind(Promise.resolve("saved")) };
    await expect(withNetworkDeadline(thenable)).resolves.toBe("saved");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects stalled operations and ignores their later result", async () => {
    vi.useFakeTimers();
    let resolve!: (value: string) => void;
    const operation = new Promise<string>(done => { resolve = done; });
    const pending = withNetworkDeadline(operation, 15000);
    const rejected = expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(15000);
    await rejected;
    resolve("late result");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves operation failures without leaving a timer", async () => {
    vi.useFakeTimers();
    const error = new Error("Service unavailable");
    await expect(withNetworkDeadline(Promise.reject(error))).rejects.toBe(error);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts a stalled transport at the deadline", async () => {
    vi.stubGlobal("fetch", (_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    }));
    await expect(boundedFetch("https://day.example", undefined, 10)).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("continues enforcing the deadline after headers arrive", async () => {
    let signal: AbortSignal | null | undefined;
    vi.stubGlobal("fetch", async (_input: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal;
      return new Response("{}");
    });
    await boundedFetch("https://day.example", undefined, 10);
    await new Promise<void>(resolve => signal!.addEventListener("abort", () => resolve(), { once: true }));
    expect(signal?.reason).toMatchObject({ name: "TimeoutError" });
  });

  it.each(["options", "request"])("preserves caller cancellation supplied through %s", async source => {
    const controller = new AbortController();
    const reason = new DOMException("View closed", "AbortError");
    vi.stubGlobal("fetch", (_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    }));
    const pending = source === "options"
      ? boundedFetch("https://day.example", { signal: controller.signal })
      : boundedFetch(new Request("https://day.example", { signal: controller.signal }));
    const rejected = expect(pending).rejects.toBe(reason);
    controller.abort(reason);
    await rejected;
  });
});
