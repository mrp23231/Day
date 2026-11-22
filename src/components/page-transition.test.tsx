// @vitest-environment jsdom
import { createContext, useContext, useState, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageTransition } from "./page-transition";

const SessionContext = createContext<{ count: number; increment: () => void }>({ count: 0, increment() {} });
function SessionProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  return <SessionContext.Provider value={{ count, increment: () => setCount(value => value + 1) }}>{children}</SessionContext.Provider>;
}
function Draft() {
  const [draft, setDraft] = useState("");
  const { count, increment } = useContext(SessionContext);
  return <><input aria-label="Draft" value={draft} onChange={event => setDraft(event.target.value)} /><button onClick={increment}>Session {count}</button></>;
}
function Space({ route, title }: { route: string; title: string }) {
  return <SessionProvider><PageTransition routeKey={route}><h1>{title}</h1><Draft /></PageTransition></SessionProvider>;
}

let reduced = false;
let preference: EventTarget;
let requests: { element: HTMLElement; cancelled: boolean }[];
let originalAnimate: PropertyDescriptor | undefined;
beforeEach(() => {
  reduced = false;
  requests = [];
  preference = new EventTarget();
  Object.defineProperty(preference, "matches", { get: () => reduced });
  vi.stubGlobal("matchMedia", () => preference);
  // JSDOM has no Web Animations API. Record only the browser playback boundary;
  // state, focus, input updates and route replacement use real React and DOM.
  originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: function (this: HTMLElement) {
    const request = { element: this, cancelled: false };
    requests.push(request);
    return { cancel: () => { request.cancelled = true; } };
  } });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalAnimate) Object.defineProperty(HTMLElement.prototype, "animate", originalAnimate);
  else Reflect.deleteProperty(HTMLElement.prototype, "animate");
});

describe("route entry", () => {
  it("keeps a focused draft and session state without replaying on incidental renders", () => {
    const view = render(<Space route="/" title="Today" />);
    expect(requests).toHaveLength(1);
    const input = screen.getByRole("textbox", { name: "Draft" });
    fireEvent.change(input, { target: { value: "Keep writing" } });
    fireEvent.click(screen.getByRole("button", { name: "Session 0" }));
    input.focus();
    const content = requests[0].element;
    content.scrollTop = 75;

    view.rerender(<Space route="/" title="Today, updated" />);

    expect(screen.getByRole("textbox", { name: "Draft" })).toBe(input);
    expect((input as HTMLInputElement).value).toBe("Keep writing");
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole("button", { name: "Session 1" })).toBeTruthy();
    expect(content.scrollTop).toBe(75);
    expect(requests).toHaveLength(1);
  });

  it("reuses the content node and provider when navigating, without retaining the old route", () => {
    const view = render(<Space route="/" title="Today" />);
    expect(requests).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Session 0" }));
    const input = screen.getByRole("textbox", { name: "Draft" });
    fireEvent.change(input, { target: { value: "Shared draft" } });

    view.rerender(<Space route="/planner" title="Planner" />);

    expect(screen.queryByRole("heading", { name: "Today" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Planner" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Session 1" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Draft" })).toBe(input);
    expect((input as HTMLInputElement).value).toBe("Shared draft");
    expect(requests).toHaveLength(2);
    expect(requests[0].cancelled).toBe(true);
    expect(requests[1].element).toBe(requests[0].element);
  });

  it("leaves content available without starting animation when reduced motion is requested", () => {
    reduced = true;
    const view = render(<Space route="/" title="Today" />);
    view.rerender(<Space route="/planner" title="Planner" />);

    const input = screen.getByRole("textbox", { name: "Draft" });
    input.focus();
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole("heading", { name: "Planner" })).toBeTruthy();
    expect(requests).toHaveLength(0);
  });

  it("stops an in-flight entry when the motion preference changes", () => {
    render(<Space route="/" title="Today" />);
    expect(requests).toHaveLength(1);
    act(() => { reduced = true; preference.dispatchEvent(new Event("change")); });

    expect(requests[0].cancelled).toBe(true);
    expect(screen.getByRole("heading", { name: "Today" })).toBeTruthy();
  });
});
