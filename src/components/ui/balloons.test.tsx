// @vitest-environment jsdom
import React, { createRef } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Balloons, type BalloonsHandle } from "./balloons";

type Effect = {
  element: HTMLElement;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  finish: () => void;
  cancelled: boolean;
};

let effects: Effect[];
let motion: MediaQueryList;
const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");

beforeEach(() => {
  vi.useFakeTimers();
  effects = [];
  motion = Object.assign(new EventTarget(), { matches: false, media: "(prefers-reduced-motion: reduce)" }) as MediaQueryList;
  vi.stubGlobal("matchMedia", () => motion);
  // jsdom has no Web Animations implementation. Keep the real DOM and expose
  // only the browser completion/cancellation boundary to each regression test.
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: function (
    this: HTMLElement, keyframes: Keyframe[], options: KeyframeAnimationOptions,
  ) {
    let finish!: () => void;
    let reject!: (error: Error) => void;
    const finished = new Promise<void>((resolve, fail) => { finish = resolve; reject = fail; });
    const effect: Effect = { element: this, keyframes: keyframes as Keyframe[], options: options as KeyframeAnimationOptions, finish, cancelled: false };
    effects.push(effect);
    return {
      finished,
      cancel() { effect.cancelled = true; reject(new Error("Animation cancelled")); },
    } as unknown as Animation;
  } });
});

afterEach(async () => {
  effects.forEach(effect => effect.finish());
  await vi.advanceTimersByTimeAsync(5000);
  cleanup();
  document.querySelectorAll("balloons, text-balloons, [data-day-celebration]").forEach(element => element.remove());
  vi.restoreAllMocks();
  if (originalAnimate) Object.defineProperty(HTMLElement.prototype, "animate", originalAnimate);
  else Reflect.deleteProperty(HTMLElement.prototype, "animate");
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function launch(ref: React.RefObject<BalloonsHandle | null>) {
  const completion = ref.current!.launchAnimation();
  await vi.dynamicImportSettled();
  await vi.advanceTimersByTimeAsync(20);
  return { completion };
}

describe("decorative celebration balloons", () => {
  it("bounds the launch to small sprites and a short transform/opacity animation", async () => {
    const ref = createRef<BalloonsHandle>();
    render(<Balloons ref={ref} />);
    const { completion } = await launch(ref);

    expect(effects.length).toBeGreaterThanOrEqual(5);
    expect(effects.length).toBeLessThanOrEqual(12);
    expect(effects.every(effect => Number(effect.options.duration) + Number(effect.options.delay ?? 0) <= 4000)).toBe(true);
    expect(effects.every(effect => parseFloat(effect.element.style.width) <= 64)).toBe(true);
    expect(effects.every(effect => effect.keyframes.every(frame => Object.keys(frame).every(key => ["transform", "opacity", "offset"].includes(key))))).toBe(true);

    effects.forEach(effect => effect.finish());
    await completion;
    expect(effects.every(effect => !effect.element.isConnected)).toBe(true);
  });

  it("uses several balloon colors and keeps the effect hidden from assistive technology", async () => {
    const ref = createRef<BalloonsHandle>();
    render(<Balloons ref={ref} />);
    await launch(ref);
    const colors = new Set(effects.map(effect => effect.element.style.getPropertyValue("--balloon-color")));
    expect(colors.size).toBeGreaterThanOrEqual(4);
    expect(effects[0].element.parentElement?.getAttribute("aria-hidden")).toBe("true");
  });

  it("stays idle until explicitly launched and skips reduced motion", async () => {
    const ref = createRef<BalloonsHandle>();
    const onLaunch = vi.fn();
    render(<Balloons ref={ref} onLaunch={onLaunch} />);
    await vi.advanceTimersByTimeAsync(5000);
    expect(effects).toHaveLength(0);
    Object.defineProperty(motion, "matches", { value: true });
    await ref.current!.launchAnimation();
    expect(effects).toHaveLength(0);
    expect(onLaunch).not.toHaveBeenCalled();
  });

  it("keeps text props while preventing overlapping text launches", async () => {
    const ref = createRef<BalloonsHandle>();
    const onLaunch = vi.fn();
    render(<Balloons ref={ref} type="text" text="Day <3" fontSize={48} color="#123456" onLaunch={onLaunch} />);
    const { completion } = await launch(ref);
    const count = effects.length;
    const second = await launch(ref);
    expect(effects).toHaveLength(count);
    expect(onLaunch).toHaveBeenCalledTimes(1);
    expect(effects[0].element.textContent).toBe("Day <3");
    expect(effects[0].element.style.fontSize).toBe("48px");
    expect(effects[0].element.style.color).toBe("rgb(18, 52, 86)");
    effects.forEach(effect => effect.finish());
    await Promise.all([completion, second.completion]);
    expect(effects.every(effect => !effect.element.isConnected)).toBe(true);
    expect(document.querySelector("[data-day-celebration]")).toBeNull();
  });

  it("cancels and removes its sprites when unmounted", async () => {
    const ref = createRef<BalloonsHandle>();
    const view = render(<Balloons ref={ref} />);
    const { completion } = await launch(ref);
    view.unmount();
    expect(effects.every(effect => !effect.element.isConnected && effect.cancelled)).toBe(true);
    await completion;
    expect(document.querySelector("[data-day-celebration]")).toBeNull();
  });

  it("ends an active celebration if reduced motion is enabled", async () => {
    const ref = createRef<BalloonsHandle>();
    render(<Balloons ref={ref} />);
    const { completion } = await launch(ref);
    Object.defineProperty(motion, "matches", { value: true });
    motion.dispatchEvent(new Event("change"));
    expect(effects.every(effect => !effect.element.isConnected && effect.cancelled)).toBe(true);
    await completion;
  });

  it("removes the effect within four seconds if browser completion never arrives", async () => {
    const ref = createRef<BalloonsHandle>();
    render(<Balloons ref={ref} />);
    const { completion } = await launch(ref);
    await vi.advanceTimersByTimeAsync(4000);
    expect(effects.every(effect => !effect.element.isConnected && effect.cancelled)).toBe(true);
    await completion;
  });
});
