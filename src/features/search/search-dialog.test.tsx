// @vitest-environment jsdom
import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyData } from "@/lib/domain";
import { createSearchIndex, type SearchResult } from "@/lib/search";
import { SearchDialog } from "./search-dialog";

afterEach(cleanup);
function show(onSelect:(result:SearchResult)=>void=()=>{}){
  return render(<Dialog.Root defaultOpen><Dialog.Trigger>Открыть поиск</Dialog.Trigger><SearchDialog index={createSearchIndex(emptyData(),"2026-11-07")} onSelect={onSelect}/></Dialog.Root>);
}

describe("search dialog",()=>{
  it("focuses the combobox and selects a quick action with arrows and Enter",async()=>{
    const selected:SearchResult[]=[];show(result=>selected.push(result));
    const input=screen.getByRole("combobox",{name:"Найти в Day"});
    expect(document.activeElement).toBe(input);
    await userEvent.keyboard("{ArrowDown}{ArrowUp}{ArrowDown}{Enter}");
    expect(selected[0]).toMatchObject({kind:"action",modal:{type:"food"}});
    expect(input.getAttribute("aria-activedescendant")).toBe(screen.getByRole("option",{name:/Добавить приём пищи/}).id);
  });
  it("resets selection after typing and searches existing section aliases",async()=>{
    const selected:SearchResult[]=[];show(result=>selected.push(result));
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    await userEvent.type(screen.getByRole("combobox"),"настройки{Enter}");
    expect(selected[0]).toMatchObject({kind:"page",href:"/settings"});
  });
  it("shows an empty state and Enter does nothing when no result matches",async()=>{
    const selected:SearchResult[]=[];show(result=>selected.push(result));
    await userEvent.type(screen.getByRole("combobox"),"такой записи нет{Enter}");
    expect(screen.getByText("Ничего не найдено")).toBeTruthy();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(selected).toHaveLength(0);
  });
  it("does not submit an input-method composition and closes on Escape",async()=>{
    const selected:SearchResult[]=[];show(result=>selected.push(result));
    fireEvent.keyDown(screen.getByRole("combobox"),{key:"Enter",isComposing:true});
    expect(selected).toHaveLength(0);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("keeps the palette and query when Escape cancels an IME conversion",async()=>{
    show();
    const input=screen.getByRole("combobox") as HTMLInputElement;
    await userEvent.type(input,"вода");
    fireEvent.keyDown(input,{key:"Escape",isComposing:true});
    expect(screen.queryByRole("dialog",{name:"Поиск в Day"})).not.toBeNull();
    expect(input.value).toBe("вода");
  });

});
