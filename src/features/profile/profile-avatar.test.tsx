// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProfileAvatar } from "./profile-avatar";
const mocks=vi.hoisted(()=>({url:undefined as string|undefined}));
vi.mock("@/components/day-provider",()=>({useDay:()=>({data:{preferences:{name:"Andrea"}}})}));
vi.mock("@/features/appearance/personal-photos",()=>({useOptionalPersonalPhotos:()=>({urlFor:()=>mocks.url})}));
afterEach(()=>{cleanup();mocks.url=undefined;vi.unstubAllGlobals();vi.restoreAllMocks();});
it("shows an initial until a local avatar is available",()=>{
  const view=render(<ProfileAvatar/>);expect(view.container.textContent).toBe("A");
  mocks.url="blob:animated-avatar";view.rerender(<ProfileAvatar/>);
  expect(view.container.querySelector("img")?.getAttribute("src")).toBe("blob:animated-avatar");
});
it("freezes the local image when the user requests reduced motion",()=>{
  mocks.url="blob:animated-avatar";
  vi.stubGlobal("matchMedia",()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
  const drawImage=vi.fn();vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({drawImage} as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype,"toDataURL").mockReturnValue("data:image/png;base64,poster");
  const {container}=render(<ProfileAvatar/>);const image=container.querySelector("img")!;
  Object.defineProperties(image,{naturalWidth:{value:20},naturalHeight:{value:20}});
  fireEvent.load(image);
  expect(drawImage).toHaveBeenCalledWith(image,0,0);
  expect(image.getAttribute("src")).toBe("data:image/png;base64,poster");
});
