// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import HoldToConfirm from "./motion-hold-to-confirm";

let reducedMotion = false;
let notifyMotionPreference: (() => void) | undefined;
const motionQuery = {
  get matches() { return reducedMotion; },
  addListener() {}, removeListener() {},
  addEventListener(_event: string, listener: () => void) { notifyMotionPreference = listener; },
  removeEventListener() {},
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  reducedMotion = false;
  notifyMotionPreference?.();
  vi.stubGlobal("matchMedia", vi.fn(() => motionQuery));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function advance(ms: number) { act(() => { vi.advanceTimersByTime(ms); }); }
function pointerHold(button: HTMLElement, buttonNumber = 0) {
  fireEvent.pointerDown(button, { button: buttonNumber, isPrimary: true, pointerId: 1 });
}

describe("hold to confirm", () => {
  it("confirms only after two full seconds and once across release and later holds", async () => {
    const onConfirm = vi.fn();
    render(<HoldToConfirm onConfirm={onConfirm} />);
    const button = screen.getByRole("button");
    pointerHold(button);
    advance(1999);
    expect(onConfirm).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(button, { pointerId: 1 });
    pointerHold(button);
    advance(4000);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(button.textContent).toContain("День завершён");
  });

  it.each(["pointerUp", "pointerLeave", "pointerCancel", "lostPointerCapture", "blur"] as const)("cancels an interrupted %s hold and starts the next hold from zero", async (eventName) => {
    const onConfirm = vi.fn();
    render(<HoldToConfirm onConfirm={onConfirm} />);
    const button = screen.getByRole("button");
    pointerHold(button);
    advance(1500);
    fireEvent[eventName](button, { pointerId: 1 });
    advance(3000);
    expect(onConfirm).not.toHaveBeenCalled();
    pointerHold(button);
    advance(500);
    expect(onConfirm).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("cancels when a captured touch pointer moves outside the button", () => {
    const onConfirm = vi.fn();
    render(<HoldToConfirm onConfirm={onConfirm} />);
    const button = screen.getByRole("button");
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 300, bottom: 60, width: 300, height: 60, toJSON() {} });
    fireEvent.pointerDown(button, { pointerType: "touch", button: 0, pointerId: 1, isPrimary: true });
    advance(1500);
    fireEvent.pointerMove(button, { pointerType: "touch", pointerId: 1, clientX: 310, clientY: 30 });
    advance(1000);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("locks while an asynchronous confirmation is pending", async () => {
    let saved: () => void = () => {};
    const onConfirm = vi.fn(() => new Promise<void>(resolve => { saved = resolve; }));
    render(<HoldToConfirm onConfirm={onConfirm} />);
    const button = screen.getByRole("button");
    fireEvent.keyDown(button, { key: "Enter" });
    advance(2000);
    fireEvent.keyDown(button, { key: " " });
    advance(3000);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { saved(); });
    expect(button.textContent).toContain("День завершён");
  });

  it.each([" ", "Enter"])("supports holding %s without restarting on keyboard repeat", async (key) => {
    const onConfirm = vi.fn();
    render(<HoldToConfirm onConfirm={onConfirm} />);
    const button = screen.getByRole("button");
    fireEvent.keyDown(button, { key });
    advance(1200);
    fireEvent.keyDown(button, { key, repeat: true });
    await act(async () => { vi.advanceTimersByTime(800); });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("cancels keyboard release, ignores unrelated release, normal clicks and right clicks", () => {
    const onConfirm = vi.fn();
    render(<HoldToConfirm onConfirm={onConfirm} />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    pointerHold(button, 2);
    advance(3000);
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.keyDown(button, { key: " " });
    advance(1000);
    fireEvent.keyUp(button, { key: " " });
    advance(2000);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("cancels on window blur, hidden document, disabled change and unmount", () => {
    const onConfirm = vi.fn();
    const view = render(<HoldToConfirm onConfirm={onConfirm} />);
    const button = screen.getByRole("button");
    pointerHold(button);
    advance(1000);
    fireEvent(window, new Event("blur"));
    advance(2000);
    expect(onConfirm).not.toHaveBeenCalled();
    pointerHold(button);
    advance(1000);
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    fireEvent(document, new Event("visibilitychange"));
    advance(2000);
    expect(onConfirm).not.toHaveBeenCalled();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    pointerHold(button);
    advance(1000);
    view.rerender(<HoldToConfirm onConfirm={onConfirm} disabled />);
    advance(2000);
    expect(onConfirm).not.toHaveBeenCalled();
    view.rerender(<HoldToConfirm onConfirm={onConfirm} />);
    pointerHold(button);
    advance(1000);
    view.unmount();
    advance(2000);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("retains the hold duration with reduced motion", async () => {
    reducedMotion = true;
    notifyMotionPreference?.();
    // Motion announces this user preference once in development builds.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const onConfirm = vi.fn();
    render(<HoldToConfirm onConfirm={onConfirm} durationMs={1000} />);
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    advance(999);
    expect(onConfirm).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
