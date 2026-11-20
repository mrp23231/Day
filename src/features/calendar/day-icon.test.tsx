// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyData } from "@/lib/domain";
import { DayIcon, DayIconButton, DayIconEditor } from "./day-icon";

const state=vi.hoisted(()=>({data:null as ReturnType<typeof emptyData>|null,photos:null as null|{busy:null;dayUrlFor:ReturnType<typeof vi.fn>;dayMissingFor:ReturnType<typeof vi.fn>;saveDayIcon:ReturnType<typeof vi.fn>;removeDayIcon:ReturnType<typeof vi.fn>}}));
vi.mock("@/components/day-provider",()=>({useDay:()=>({data:state.data,ready:true})}));
vi.mock("@/features/appearance/personal-photos",()=>({useOptionalPersonalPhotos:()=>state.photos}));
beforeEach(()=>{state.data=emptyData();state.photos={busy:null,dayUrlFor:vi.fn(()=>undefined),dayMissingFor:vi.fn(()=>false),saveDayIcon:vi.fn().mockResolvedValue(true),removeDayIcon:vi.fn()};});
afterEach(cleanup);

it("renders a decorative fallback when no photo provider is mounted",()=>{
  state.photos=null;
  const {container}=render(<DayIcon date="2026-11-20"/>);
  expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  expect(container.querySelector("img")).toBeNull();
});

it("reveals a local day photo after load and keeps it decorative",()=>{
  state.photos!.dayUrlFor.mockReturnValue("blob:day");
  const {container}=render(<DayIcon date="2026-11-20"/>);
  const image=container.querySelector("img")!;
  expect(image.getAttribute("alt")).toBe("");
  expect(image.dataset.loaded).toBe("false");
  fireEvent.load(image);
  expect(image.dataset.loaded).toBe("true");
});

it("opens the photo editor from a date-labelled button and uploads to that date",async()=>{
  render(<DayIconButton date="2026-11-20"/>);
  await userEvent.click(screen.getByRole("button",{name:/Фото дня.*20 ноября 2026/}));
  expect(screen.getByRole("dialog")).toBeTruthy();
  const file=new File(["photo"],"day.png",{type:"image/png"});
  await userEvent.upload(screen.getByLabelText("Картинка для дня"),file);
  await waitFor(()=>expect(state.photos!.saveDayIcon).toHaveBeenCalledWith("2026-11-20",file));
  expect(screen.queryByRole("button",{name:"Убрать фото дня"})).toBeNull();
});

it("lets a selected day photo be removed and reports a missing local image",async()=>{
  state.data!.preferences.dayIcons={"2026-11-20":"11111111-1111-4111-8111-111111111111"};
  state.photos!.dayMissingFor.mockReturnValue(true);
  render(<DayIconEditor date="2026-11-20" onClose={()=>{}}/>);
  expect(screen.getByText("Это фото недоступно в текущем браузере. Выберите его снова.")).toBeTruthy();
  await userEvent.click(screen.getByRole("button",{name:"Убрать фото дня"}));
  expect(state.photos!.removeDayIcon).toHaveBeenCalledWith("2026-11-20");
});
