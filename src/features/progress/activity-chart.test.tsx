// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { emptyData } from "@/lib/domain";
import { ActivityChart } from "./activity-chart";
const data = emptyData();
data.reviews = [{ date: "2026-11-20", closedAt: "2026-11-20T20:00:00Z", updatedAt: "2026-11-20T20:00:00Z", mood: "steady", note: "", snapshot: { tasks: { completed: 2, total: 3 }, completedTasks: [{ id: "one", title: "One" }, { id: "two", title: "Two" }], habits: { completed: 0, total: 0 }, water: { amount: 0, goal: 2000 }, food: { calories: 0, entries: 0 } } }];
vi.mock("@/components/day-provider", () => ({ useDay: () => ({ data, date: "2026-11-20" }) }));
vi.mock("recharts", () => ({ Area: () => null, AreaChart: () => null, Bar: () => null, BarChart: () => null, CartesianGrid: () => null, ResponsiveContainer: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null }));
afterEach(cleanup);
it("keeps closed-day completions in the chart's accessible series when tasks have moved or disappeared", () => {
  render(<ActivityChart metric="tasks" days={1} />);
  expect(screen.getByRole("img", { name: "Выполнено задач. 20.11: 2" })).toBeTruthy();
  expect(screen.queryByText("Здесь появится ваш прогресс")).toBeNull();
});
