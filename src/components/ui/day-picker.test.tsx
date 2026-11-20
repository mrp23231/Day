// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DayPicker, type CalendarView } from "./day-picker";

afterEach(cleanup);

function ControlledPicker() {
  const [view, setView] = useState<CalendarView>("day");
  return <DayPicker value={view} onValueChange={setView} />;
}

describe("calendar view selector", () => {
  it("offers four controlled views with a single keyboard stop", () => {
    render(<ControlledPicker />);
    const day = screen.getByRole("radio", { name: "День" });
    const year = screen.getByRole("radio", { name: "Год" });
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(day.getAttribute("aria-checked")).toBe("true");
    expect(year.tabIndex).toBe(-1);
    fireEvent.click(year);
    expect(year.getAttribute("aria-checked")).toBe("true");
    expect(day.tabIndex).toBe(-1);
  });

  it("moves focus and selection with arrows, Home, and End", () => {
    render(<ControlledPicker />);
    const day = screen.getByRole("radio", { name: "День" });
    const week = screen.getByRole("radio", { name: "Неделя" });
    const year = screen.getByRole("radio", { name: "Год" });
    day.focus();
    fireEvent.keyDown(day, { key: "ArrowRight" });
    expect(document.activeElement).toBe(week);
    expect(week.getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(week, { key: "End" });
    expect(document.activeElement).toBe(year);
    fireEvent.keyDown(year, { key: "ArrowRight" });
    expect(document.activeElement).toBe(day);
    fireEvent.keyDown(day, { key: "Home" });
    expect(document.activeElement).toBe(day);
  });
});
