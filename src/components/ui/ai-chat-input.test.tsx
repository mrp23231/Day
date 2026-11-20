// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PromptInput } from "./ai-chat-input";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function Composer({ onSubmit, disabled = false, busy = false }: { onSubmit: (message: string) => void; disabled?: boolean; busy?: boolean }) {
  const [value, setValue] = useState("");
  return <PromptInput value={value} onValueChange={setValue} onSubmit={onSubmit} disabled={disabled} busy={busy} />;
}

describe("expanding AI composer", () => {
  it("submits Enter, keeps Shift+Enter as a newline, and ignores IME composition", async () => {
    const submit = vi.fn();
    render(<Composer onSubmit={submit} />);
    const textarea = screen.getByRole("textbox", { name: "Сообщение Day AI" });
    await userEvent.type(textarea, "Первая строка");
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}Вторая");
    expect((textarea as HTMLTextAreaElement).value).toBe("Первая строка\nВторая");
    fireEvent.keyDown(textarea, { key: "Enter", isComposing: true });
    fireEvent.keyDown(textarea, { key: "Enter", keyCode: 229 });
    expect(submit).not.toHaveBeenCalled();
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(submit).toHaveBeenCalledWith("Первая строка\nВторая");
  });

  it("does not submit empty or whitespace-only messages", async () => {
    const submit = vi.fn();
    render(<Composer onSubmit={submit} />);
    await userEvent.type(screen.getByRole("textbox"), "   ");
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    expect(submit).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Отправить сообщение" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["busy", "disabled"] as const)("blocks typing and form submission while %s", flag => {
    const submit = vi.fn();
    render(<PromptInput value="Черновик" onValueChange={vi.fn()} onSubmit={submit} {...{ [flag]: true }} />);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(true);
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    expect(submit).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Отправить сообщение" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("clears a draft with a named control and keeps the text area focused", async () => {
    render(<Composer onSubmit={vi.fn()} />);
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "Черновик");
    await userEvent.click(screen.getByRole("button", { name: "Очистить сообщение" }));
    expect((textarea as HTMLTextAreaElement).value).toBe("");
    expect(document.activeElement).toBe(textarea);
    expect(screen.queryByRole("button", { name: "Очистить сообщение" })).toBeNull();
  });

  it("grows for multiline content but bounds the text area and enables scrolling", () => {
    vi.spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get").mockReturnValue(275);
    const view = render(<PromptInput value="Много строк" onValueChange={vi.fn()} onSubmit={vi.fn()} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.style.height).toBe("192px");
    expect(textarea.style.overflowY).toBe("auto");
    vi.spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get").mockReturnValue(40);
    view.rerender(<PromptInput value="" onValueChange={vi.fn()} onSubmit={vi.fn()} />);
    expect(textarea.style.height).toBe("52px");
    expect(textarea.style.overflowY).toBe("hidden");
  });
});
