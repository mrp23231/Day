// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { applyTheme, ThemeToggle, type ThemeChangeDetails, type ThemeMode } from "./theme-toggle";

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  void promise.catch(() => {});
  return { promise, resolve, reject };
}

function installTransition() {
  const ready = deferred();
  const finished = deferred();
  let update: (() => void | Promise<void>) | undefined;
  let skipped = false;
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    value: (callback: () => void | Promise<void>) => {
      update = callback;
      return { ready: ready.promise, finished: finished.promise, updateCallbackDone: Promise.resolve(), skipTransition: () => { skipped = true; } };
    },
  });
  return { ready, finished, update: () => update?.(), get skipped() { return skipped; } };
}

beforeEach(() => {
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("CSS", { supports: () => true });
  document.documentElement.dataset.theme = "light";
  document.documentElement.dataset.mode = "light";
});

afterEach(async () => {
  cleanup();
  await applyTheme("light", true);
  document.documentElement.removeAttribute("data-theme-reveal");
  document.documentElement.removeAttribute("data-theme-progress");
  document.documentElement.removeAttribute("data-theme-origin");
  document.documentElement.style.removeProperty("--day-theme-clip");
  Reflect.deleteProperty(document, "startViewTransition");
  Reflect.deleteProperty(document, "hidden");
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("controlled theme switch", () => {
  it("requests a theme and origin without changing the value owned by its parent", async () => {
    let request: { mode: ThemeMode; details?: ThemeChangeDetails } | undefined;
    const view = render(<ThemeToggle mode="light" onModeChange={(mode, details) => { request = { mode, details }; }} />);
    const control = screen.getByRole("switch");
    await userEvent.click(control);
    expect(request?.mode).toBe("dark");
    expect(Number.isFinite(request?.details?.origin.x)).toBe(true);
    expect(Number.isFinite(request?.details?.origin.y)).toBe(true);
    expect(control.getAttribute("aria-checked")).toBe("false");
    view.rerender(<ThemeToggle mode="dark" onModeChange={() => {}} />);
    expect(control.getAttribute("aria-checked")).toBe("true");
  });

  it("supports keyboard activation and an accessible name supplied by its parent", async () => {
    let requested: ThemeMode | undefined;
    render(<ThemeToggle mode="dark" showLabel={false} aria-label="Тёмная тема" onModeChange={mode => { requested = mode; }} />);
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("switch", { name: "Тёмная тема" }));
    await user.keyboard(" ");
    expect(requested).toBe("light");
  });

  it("does not submit its enclosing form or activate a disabled switch", async () => {
    let changes = 0;
    let submissions = 0;
    const view = render(<form onSubmit={event => { event.preventDefault(); submissions++; }}><ThemeToggle mode="light" onModeChange={() => { changes++; }} /></form>);
    await userEvent.click(screen.getByRole("switch"));
    expect(submissions).toBe(0);
    expect(changes).toBe(1);
    view.rerender(<ThemeToggle disabled mode="light" onModeChange={() => { changes++; }} />);
    await userEvent.click(screen.getByRole("switch"));
    expect(changes).toBe(1);
  });

  it("lets a consumer cancel the theme request in onClick", async () => {
    let requested = false;
    render(<ThemeToggle mode="light" onClick={event => event.preventDefault()} onModeChange={() => { requested = true; }} />);
    await userEvent.click(screen.getByRole("switch"));
    expect(requested).toBe(false);
  });
});

describe("theme reveal", () => {
  it("applies both theme conventions immediately when native transitions are unavailable", async () => {
    await applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.mode).toBe("dark");
    expect(document.documentElement.hasAttribute("data-theme-reveal")).toBe(false);
  });

  it.each(["quiet", "reduced motion", "hidden page"])("commits without an overlay for %s", async reason => {
    const transition = installTransition();
    if (reason === "reduced motion") vi.stubGlobal("matchMedia", () => ({ matches: true }));
    if (reason === "hidden page") Object.defineProperty(document, "hidden", { configurable: true, value: true });
    await applyTheme("dark", reason === "quiet");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.mode).toBe("dark");
    expect(document.documentElement.hasAttribute("data-theme-reveal")).toBe(false);
    expect(transition.skipped).toBe(false);
  });

  it("restores preexisting styles and reveal attributes after the native transition finishes", async () => {
    const root = document.documentElement;
    root.style.setProperty("--day-theme-clip", "none");
    root.setAttribute("data-theme-origin", "existing");
    const transition = installTransition();
    const completion = applyTheme("dark", false, root, { origin: { x: 120, y: 80 } });
    expect(root.dataset.themeReveal).toBe("dark");
    expect(root.dataset.themeOrigin).toBe("120 80");
    await transition.update();
    expect(root.dataset.theme).toBe("dark");
    expect(root.dataset.mode).toBe("dark");
    transition.finished.resolve();
    await completion;
    expect(root.hasAttribute("data-theme-reveal")).toBe(false);
    expect(root.hasAttribute("data-theme-progress")).toBe(false);
    expect(root.getAttribute("data-theme-origin")).toBe("existing");
    expect(root.style.getPropertyValue("--day-theme-clip")).toBe("none");
  });

  it("keeps the latest request when a superseded native update runs late", async () => {
    const old = installTransition();
    const first = applyTheme("dark");
    const current = installTransition();
    const latest = applyTheme("light");
    await current.update();
    await old.update();
    old.ready.resolve();
    old.finished.resolve();
    current.finished.resolve();
    await Promise.all([first, latest]);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.mode).toBe("light");
    expect(document.documentElement.hasAttribute("data-theme-reveal")).toBe(false);
    expect(old.skipped).toBe(true);
  });

  it("cleans up and commits the destination when native capture rejects", async () => {
    const transition = installTransition();
    const completion = applyTheme("dark");
    transition.ready.reject(new Error("capture interrupted"));
    await completion;
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.mode).toBe("dark");
    expect(document.documentElement.hasAttribute("data-theme-reveal")).toBe(false);
  });

  it("releases a stalled native transition without leaving an overlay", async () => {
    vi.useFakeTimers();
    installTransition();
    const completion = applyTheme("dark");
    await vi.advanceTimersByTimeAsync(10000);
    await completion;
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.hasAttribute("data-theme-reveal")).toBe(false);
  });
});
