// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyData } from "@/lib/domain";
import { WeekStrip } from "./shared";

const { Context } = await vi.hoisted(async () => {
  const { createContext } = await import("react");
  return { Context: createContext<Record<string, unknown>>({}) };
});
vi.mock("./day-provider", async () => {
  const { useContext } = await import("react");
  return { useDay: () => useContext(Context) };
});
function Harness() {
  const [date, setDate] = useState("2026-12-28");
  return <Context.Provider value={{ data: emptyData(), date, setDate, ready: true }}><WeekStrip/><output>{date}</output></Context.Provider>;
}
afterEach(cleanup);

it("selects and focuses dates with arrow keys across the year boundary", async () => {
  render(<Harness/>);
  const monday = screen.getByRole("button", { name: "понедельник, 28 декабря" });
  monday.focus();
  await userEvent.keyboard("{End}");
  expect(screen.getByRole("status").textContent).toBe("2027-01-03");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "воскресенье, 3 января" }));
  await userEvent.keyboard("{ArrowLeft}");
  expect(screen.getByRole("status").textContent).toBe("2027-01-02");
});
