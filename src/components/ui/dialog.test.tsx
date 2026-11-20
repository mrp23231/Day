// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog } from "./dialog";

afterEach(cleanup);
function Harness(){
  const [open,setOpen]=useState(false);
  return <><button onClick={()=>setOpen(true)}>Добавить дело</button>{open&&<Dialog open onClose={()=>setOpen(false)} title="Новая задача"><label>Название<input autoFocus/></label></Dialog>}</>;
}
it("restores focus to the opening control when an editor closes with Escape",async()=>{
  render(<Harness/>);
  const trigger=screen.getByRole("button",{name:"Добавить дело"});
  await userEvent.click(trigger);
  const input=screen.getByRole("textbox",{name:"Название"});
  expect(document.activeElement).toBe(input);
  await userEvent.keyboard("{Escape}");
  await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(()=>expect(document.activeElement).toBe(trigger));
});
