// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BasicRating from "./rating-group";

afterEach(cleanup);

function ControlledRating() {
  const [value, setValue] = useState(0);
  return <><BasicRating value={value} onValueChange={setValue} /><output>{value}</output></>;
}

describe("day rating", () => {
  it("selects half ratings with the actual Ark keyboard control", async () => {
    render(<ControlledRating />);
    const user = userEvent.setup();
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("status").textContent).toBe("0.5");
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("status").textContent).toBe("1.5");
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("status").textContent).toBe("1");
  });

  it("keeps its controlled value and describes a half star in Russian", async () => {
    const onValueChange = vi.fn();
    render(<BasicRating value={2.5} onValueChange={onValueChange} label="Как прошёл день?" />);
    const group = screen.getByRole("radiogroup", { name: "Как прошёл день?" });
    expect(group.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByRole("radio", { checked: true }).getAttribute("aria-label")).toBe("2,5 из 5 звёзд");
    const user = userEvent.setup();
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenCalledWith(3);
    expect(screen.getByRole("radio", { checked: true }).getAttribute("aria-label")).toBe("2,5 из 5 звёзд");
  });

  it.each(["disabled", "readOnly"] as const)("does not change when %s", async flag => {
    const onValueChange = vi.fn();
    render(<BasicRating value={3} onValueChange={onValueChange} {...{ [flag]: true }} />);
    fireEvent.keyDown(screen.getByRole("radio", { checked: true }), { key: "ArrowRight" });
    await userEvent.click(screen.getAllByRole("radio")[4]);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
