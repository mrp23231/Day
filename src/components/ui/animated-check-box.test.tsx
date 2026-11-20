// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NeonCheckbox } from "./animated-check-box";

afterEach(cleanup);

describe("animated completion control", () => {
  it("keeps uncontrolled changes and exposes them through a native form input", async () => {
    render(<form aria-label="Задача"><NeonCheckbox label="Прочитать книгу" name="completed" defaultChecked /></form>);
    const input = screen.getByRole("checkbox", { name: "Прочитать книгу" }) as HTMLInputElement;
    expect(input.checked).toBe(true);
    await userEvent.click(input);
    expect(input.checked).toBe(false);
    expect(new FormData(screen.getByRole("form") as HTMLFormElement).has("completed")).toBe(false);
  });

  it("uses the controlled value until its owner updates it", async () => {
    let requested: boolean | undefined;
    const view = render(<NeonCheckbox aria-label="Задача" checked={false} onChange={event => { requested = event.target.checked; }} />);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(requested).toBe(true);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    view.rerender(<NeonCheckbox aria-label="Задача" checked onChange={() => {}} />);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });

  it("can be focused with Tab and completed with Space", async () => {
    render(<NeonCheckbox label="Прогулка" />);
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("checkbox"));
    await user.keyboard(" ");
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });

  it("does not complete a disabled item", async () => {
    render(<NeonCheckbox label="Завтра" disabled />);
    await userEvent.click(screen.getByRole("checkbox"));
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    await userEvent.tab();
    expect(document.activeElement).not.toBe(screen.getByRole("checkbox"));
  });
});
