// @vitest-environment jsdom
import React, { useState } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyData, type AppData } from "@/lib/domain";
import { PersonalPhotosProvider, PhotoSurface, usePersonalPhotos } from "./personal-photos";
const {TestContext,media,cloud}=await vi.hoisted(async()=>({TestContext:(await import("react")).createContext<Record<string,unknown>>({}),media:{preparePhoto:vi.fn(),prepareAvatar:vi.fn(),putPhoto:vi.fn(),getPhoto:vi.fn(),deletePhoto:vi.fn()},cloud:{uploadCloudPhoto:vi.fn(),downloadCloudPhoto:vi.fn()}}));
vi.mock("@/components/day-provider",async()=>{const {useContext}=await import("react");return {useDay:()=>useContext(TestContext)};});
vi.mock("@/lib/personalization",()=>media);
vi.mock("@/lib/avatar",()=>({prepareAvatar:media.prepareAvatar}));
vi.mock("@/lib/cloud-photos",()=>cloud);
const notify=vi.fn();
beforeEach(()=>{vi.clearAllMocks();media.getPhoto.mockResolvedValue(undefined);media.putPhoto.mockResolvedValue(undefined);media.deletePhoto.mockResolvedValue(undefined);cloud.uploadCloudPhoto.mockResolvedValue(undefined);cloud.downloadCloudPhoto.mockResolvedValue(new Blob(["cloud"],{type:"image/jpeg"}));vi.stubGlobal("URL",{createObjectURL:vi.fn(()=>"blob:test"),revokeObjectURL:vi.fn()});});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
function Controls(){const {savePhoto,urlFor,busy}=usePersonalPhotos();return <><button disabled={!!busy} onClick={()=>void savePhoto("space",new File(["image"],"photo.jpg",{type:"image/jpeg"}))}>Upload</button><button disabled={!!busy} onClick={()=>void savePhoto("avatar",new File(["GIF89a"],"portrait.gif",{type:"image/gif"}))}>Upload avatar</button><output>{urlFor("space")||"empty"}</output></>;}
function FailedCommitControls(){const {savePhoto,removePhoto}=usePersonalPhotos();return <><button onClick={()=>void savePhoto("avatar",new File(["gif"],"portrait.gif",{type:"image/gif"}))}>Replace avatar</button><button onClick={()=>removePhoto("avatar")}>Remove avatar</button></>;}
it("retains the old avatar blob if its new reference cannot be committed durably",async()=>{
  const data=emptyData();const oldId="11111111-1111-4111-8111-111111111111";data.preferences.personalPhotos.avatar=oldId;
  const update=vi.fn(()=>{throw new DOMException("full","QuotaExceededError");});
  media.prepareAvatar.mockResolvedValue(new Blob(["prepared"],{type:"image/gif"}));
  render(<TestContext.Provider value={{data,user:null,ready:true,resetVersion:0,update,notify}}><PersonalPhotosProvider><FailedCommitControls/></PersonalPhotosProvider></TestContext.Provider>);
  await userEvent.click(screen.getByText("Replace avatar"));
  await waitFor(()=>expect(update).toHaveBeenCalledWith(expect.any(Function),{persist:true,scope:"day-data-v1",resetVersion:0}));
  expect(media.deletePhoto).not.toHaveBeenCalledWith("day-data-v1",oldId);
  expect(data.preferences.personalPhotos.avatar).toBe(oldId);
});
it("does not delete an avatar when removing its reference cannot be saved",async()=>{
  const data=emptyData();data.preferences.personalPhotos.avatar="11111111-1111-4111-8111-111111111111";
  const update=vi.fn(()=>{throw new DOMException("full","QuotaExceededError");});
  render(<TestContext.Provider value={{data,user:null,ready:true,resetVersion:0,update,notify}}><PersonalPhotosProvider><FailedCommitControls/></PersonalPhotosProvider></TestContext.Provider>);
  await userEvent.click(screen.getByText("Remove avatar"));
  expect(update).toHaveBeenCalledWith(expect.any(Function),{persist:true,scope:"day-data-v1",resetVersion:0});
  expect(media.deletePhoto).not.toHaveBeenCalled();
});
function Harness(){const [user,setUser]=useState<{id:string}|null>(null);const [data,setData]=useState(emptyData());return <TestContext.Provider value={{data,user,ready:true,resetVersion:0,update:(fn:(d:AppData)=>AppData)=>setData(fn),notify}}><button onClick={()=>{setUser({id:"account"});setData(emptyData());}}>Switch account</button><PersonalPhotosProvider><Controls/></PersonalPhotosProvider><output aria-label="Photo id">{data.preferences.personalPhotos.space||"none"}</output></TestContext.Provider>;}
it("never assigns an unfinished upload to a newly selected account",async()=>{
  let finish!:(blob:Blob)=>void;media.preparePhoto.mockReturnValue(new Promise<Blob>(resolve=>{finish=resolve;}));
  render(<Harness/>);await userEvent.click(screen.getByText("Upload"));await userEvent.click(screen.getByText("Switch account"));
  await act(async()=>finish(new Blob(["prepared"],{type:"image/jpeg"})));
  expect(screen.getByLabelText("Photo id").textContent).toBe("none");expect(media.putPhoto).not.toHaveBeenCalled();
});
it("never stores an avatar prepared for a previous account",async()=>{
  let finish!:(blob:Blob)=>void;media.prepareAvatar.mockReturnValue(new Promise<Blob>(resolve=>{finish=resolve;}));
  render(<Harness/>);await userEvent.click(screen.getByText("Upload avatar"));await userEvent.click(screen.getByText("Switch account"));
  await act(async()=>finish(new Blob(["animated"],{type:"image/gif"})));
  expect(media.preparePhoto).not.toHaveBeenCalled();expect(media.putPhoto).not.toHaveBeenCalled();
});
it("preserves previous preferences if processing or storage fails",async()=>{
  media.preparePhoto.mockRejectedValue(new Error("Не удалось открыть фото"));render(<Harness/>);
  await userEvent.click(screen.getByText("Upload"));await waitFor(()=>expect(notify).toHaveBeenCalledWith("Фото не загружено",expect.objectContaining({kind:"error"})));
  expect(screen.getByLabelText("Photo id").textContent).toBe("none");
  expect(media.putPhoto).not.toHaveBeenCalled();
});
it("updates the preference only after the prepared blob is stored",async()=>{
  const blob=new Blob(["prepared"],{type:"image/jpeg"});media.preparePhoto.mockResolvedValue(blob);media.getPhoto.mockResolvedValue(blob);
  render(<Harness/>);await userEvent.click(screen.getByText("Upload"));
  await waitFor(()=>expect(screen.getByLabelText("Photo id").textContent).not.toBe("none"));
  expect(media.putPhoto).toHaveBeenCalledWith("day-data-v1",expect.any(String),blob);
  await waitFor(()=>expect(screen.getByText("blob:test")).toBeTruthy());
});

function SurfaceHarness() {
  const [data,setData]=useState(()=>{const initial=emptyData();initial.preferences.personalPhotos={space:"space-id",water:"water-id"};return initial;});
  return <TestContext.Provider value={{data,user:null,ready:true,resetVersion:0,update:(fn:(d:AppData)=>AppData)=>setData(fn),notify}}><PersonalPhotosProvider><SurfaceControls/><PhotoSurface target="water"><span>Water content</span></PhotoSurface></PersonalPhotosProvider></TestContext.Provider>;
}
function SurfaceControls(){const {urlFor,savePhoto}=usePersonalPhotos();return <><output aria-label="Space image">{urlFor("space")}</output><output aria-label="Water image">{urlFor("water")}</output><button onClick={()=>void savePhoto("water",new File(["new"],"water.jpg",{type:"image/jpeg"}))}>Replace water</button></>;}

it("keeps unchanged image URLs alive when another card photo is replaced",async()=>{
  let next=0;vi.mocked(URL.createObjectURL).mockImplementation(()=>`blob:image-${++next}`);
  media.getPhoto.mockResolvedValue(new Blob(["old"],{type:"image/jpeg"}));
  media.preparePhoto.mockResolvedValue(new Blob(["new"],{type:"image/jpeg"}));
  render(<SurfaceHarness/>);
  await waitFor(()=>expect(screen.getByLabelText("Space image").textContent).toBeTruthy());
  const original=screen.getByLabelText("Space image").textContent;
  const water=screen.getByLabelText("Water image").textContent;
  await userEvent.click(screen.getByText("Replace water"));
  await waitFor(()=>expect(screen.getByLabelText("Water image").textContent).not.toBe(water));
  expect(screen.getByLabelText("Space image").textContent).toBe(original);
  expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(original);
});

it("reveals a card photo only after loading while preserving its content",async()=>{
  media.getPhoto.mockResolvedValue(new Blob(["photo"],{type:"image/jpeg"}));
  const {container}=render(<SurfaceHarness/>);
  await waitFor(()=>expect(container.querySelector('[data-photo-target="water"] img')).toBeTruthy());
  const image=container.querySelector('[data-photo-target="water"] img') as HTMLImageElement;
  expect(image.dataset.photoState).toBe("loading");
  expect(screen.getByText("Water content")).toBeTruthy();
  await act(async()=>{image.dispatchEvent(new Event("load"));});
  await waitFor(()=>expect(image.dataset.photoState).toBe("visible"));
});

it("keeps the displayed photo while its replacement URL is still loading",async()=>{
  let next=0;vi.mocked(URL.createObjectURL).mockImplementation(()=>`blob:image-${++next}`);
  media.getPhoto.mockResolvedValue(new Blob(["old"],{type:"image/jpeg"}));
  media.preparePhoto.mockResolvedValue(new Blob(["new"],{type:"image/jpeg"}));
  const {container}=render(<SurfaceHarness/>);
  await waitFor(()=>expect(container.querySelector('[data-photo-target="water"] img')).toBeTruthy());
  const original=container.querySelector('[data-photo-target="water"] img') as HTMLImageElement;
  await act(async()=>{original.dispatchEvent(new Event("load"));});
  let finish:((blob:Blob)=>void)|undefined;
  media.getPhoto.mockImplementation(()=>new Promise<Blob>(resolve=>{finish=resolve;}));
  await userEvent.click(screen.getByText("Replace water"));
  await waitFor(()=>expect(finish).toBeTypeOf("function"));
  expect(original.isConnected).toBe(true);
  expect(original.dataset.photoState).toBe("visible");
  await act(async()=>{finish?.(new Blob(["new"],{type:"image/jpeg"}));});
});

const iconDate="2026-11-20", oldIconId="11111111-1111-4111-8111-111111111111";
function DayControls(){const {saveDayIcon,removeDayIcon,dayUrlFor,dayMissingFor,busy}=usePersonalPhotos();return <><button disabled={!!busy} onClick={()=>void saveDayIcon(iconDate,new File(["image"],"day.jpg",{type:"image/jpeg"}))}>Upload day</button><button disabled={!!busy} onClick={()=>removeDayIcon(iconDate)}>Remove day</button><output aria-label="Day image">{dayUrlFor(iconDate)||"empty"}</output><output aria-label="Missing day">{String(dayMissingFor(iconDate))}</output></>;}
function DayHarness({initial=emptyData()}:{initial?:AppData}){const [user,setUser]=useState<{id:string}|null>(null),[data,setData]=useState(initial),[resetVersion,setResetVersion]=useState(0);return <TestContext.Provider value={{data,user,ready:true,resetVersion,update:(fn:(d:AppData)=>AppData)=>setData(fn),notify}}><button onClick={()=>{setUser({id:"new-account"});setData(emptyData());}}>Switch account</button><button onClick={()=>{setResetVersion(version=>version+1);setData(emptyData());}}>Reset</button><PersonalPhotosProvider><DayControls/></PersonalPhotosProvider><output aria-label="Day photo id">{data.preferences.dayIcons[iconDate]||"none"}</output></TestContext.Provider>;}

it("loads day icons from the same scoped store and removes their references",async()=>{
  const data=emptyData();data.preferences.dayIcons={[iconDate]:oldIconId};media.getPhoto.mockResolvedValue(new Blob(["old"]));
  render(<DayHarness initial={data}/>);
  await waitFor(()=>expect(screen.getByLabelText("Day image").textContent).toBe("blob:test"));
  expect(media.getPhoto).toHaveBeenCalledWith("day-data-v1",oldIconId);
  await userEvent.click(screen.getByText("Remove day"));
  expect(screen.getByLabelText("Day photo id").textContent).toBe("none");
  expect(media.deletePhoto).toHaveBeenCalledWith("day-data-v1",oldIconId);
});

it("commits a day photo before retiring its previous blob",async()=>{
  const data=emptyData();data.preferences.dayIcons={[iconDate]:oldIconId};
  media.preparePhoto.mockResolvedValue(new Blob(["new"]));
  let commitOptions:unknown;
  const update=vi.fn((fn:(current:AppData)=>AppData,options:unknown)=>{expect(media.putPhoto).toHaveBeenCalled();expect(media.deletePhoto).not.toHaveBeenCalledWith("day-data-v1",oldIconId);commitOptions=options;const next=fn(data);expect(next.preferences.dayIcons[iconDate]).not.toBe(oldIconId);return next;});
  render(<TestContext.Provider value={{data,user:null,ready:true,resetVersion:0,update,notify}}><PersonalPhotosProvider><DayControls/></PersonalPhotosProvider></TestContext.Provider>);
  await userEvent.click(screen.getByText("Upload day"));
  await waitFor(()=>expect(media.deletePhoto).toHaveBeenCalledWith("day-data-v1",oldIconId));
  expect(media.preparePhoto).toHaveBeenCalledWith(expect.any(File),512);
  expect(commitOptions).toEqual({persist:true,scope:"day-data-v1",resetVersion:0});
});

it("keeps the old day photo if saving or removing its reference fails",async()=>{
  const data=emptyData();data.preferences.dayIcons={[iconDate]:oldIconId};media.preparePhoto.mockResolvedValue(new Blob(["new"]));
  const update=vi.fn(()=>{throw new DOMException("full","QuotaExceededError");});
  render(<TestContext.Provider value={{data,user:null,ready:true,resetVersion:0,update,notify}}><PersonalPhotosProvider><DayControls/></PersonalPhotosProvider></TestContext.Provider>);
  await userEvent.click(screen.getByText("Upload day"));
  await waitFor(()=>expect(notify).toHaveBeenCalledWith("Фото не загружено",expect.objectContaining({kind:"error"})));
  await userEvent.click(screen.getByText("Remove day"));
  expect(data.preferences.dayIcons[iconDate]).toBe(oldIconId);
  expect(media.deletePhoto).not.toHaveBeenCalledWith("day-data-v1",oldIconId);
});

it.each(["Switch account","Reset"])("discards a day upload when %s happens during processing",async action=>{
  let finish!:(blob:Blob)=>void;media.preparePhoto.mockReturnValue(new Promise<Blob>(resolve=>{finish=resolve;}));
  render(<DayHarness/>);await userEvent.click(screen.getByText("Upload day"));await userEvent.click(screen.getByText(action));
  await act(async()=>finish(new Blob(["prepared"])));
  expect(screen.getByLabelText("Day photo id").textContent).toBe("none");expect(media.putPhoto).not.toHaveBeenCalled();
});

it.each(["Switch account","Reset"])("cleans up an orphan day blob when %s happens while IndexedDB writes",async action=>{
  media.preparePhoto.mockResolvedValue(new Blob(["prepared"]));
  let finish!:()=>void;media.putPhoto.mockReturnValue(new Promise<void>(resolve=>{finish=resolve;}));
  render(<DayHarness/>);await userEvent.click(screen.getByText("Upload day"));
  await waitFor(()=>expect(media.putPhoto).toHaveBeenCalled());
  const storedId=media.putPhoto.mock.calls[0][1];
  await userEvent.click(screen.getByText(action));
  await act(async()=>finish());
  expect(screen.getByLabelText("Day photo id").textContent).toBe("none");
  expect(media.deletePhoto).toHaveBeenCalledWith("day-data-v1",storedId);
  expect(notify).not.toHaveBeenCalledWith("Фотография добавлена",expect.anything());
});

it("reports a missing day icon without borrowing a different scope's photo",async()=>{
  const data=emptyData();data.preferences.dayIcons={[iconDate]:oldIconId};
  render(<DayHarness initial={data}/>);
  await waitFor(()=>expect(screen.getByLabelText("Missing day").textContent).toBe("true"));
  expect(screen.getByLabelText("Day image").textContent).toBe("empty");
});

const cloudUserId="33333333-3333-4333-8333-333333333333";
function CloudControls(){const photos=usePersonalPhotos();return <><output aria-label="Avatar image">{photos.urlFor("avatar")||"empty"}</output><output aria-label="Photo sync">{photos.statusFor("avatar")}</output></>;}
function CloudHarness({initial}:{initial:AppData}) {
  const [data,setData]=useState(initial),[user,setUser]=useState<{id:string}|null>({id:cloudUserId}),[resetVersion,setResetVersion]=useState(0);
  return <TestContext.Provider value={{data,user,ready:true,resetVersion,update:(fn:(d:AppData)=>AppData)=>setData(fn),notify}}><button onClick={()=>{setUser({id:"44444444-4444-4444-8444-444444444444"});setData(emptyData());}}>Switch cloud account</button><button onClick={()=>{setData(emptyData());setResetVersion(value=>value+1);}}>Reset cloud photos</button><PersonalPhotosProvider><CloudControls/></PersonalPhotosProvider><output aria-label="Cloud photo IDs">{JSON.stringify(data.preferences.cloudPhotoIds)}</output></TestContext.Provider>;
}

it("publishes a photo ID only after the private upload succeeds",async()=>{
  const data=emptyData();data.preferences.personalPhotos.avatar=oldIconId;
  media.getPhoto.mockResolvedValue(new Blob(["local"],{type:"image/jpeg"}));
  let finish!:()=>void;cloud.uploadCloudPhoto.mockReturnValue(new Promise<void>(resolve=>{finish=resolve;}));
  render(<CloudHarness initial={data}/>);
  await waitFor(()=>expect(cloud.uploadCloudPhoto).toHaveBeenCalledWith(cloudUserId,oldIconId,expect.any(Blob)));
  expect(screen.getByLabelText("Cloud photo IDs").textContent).toBe("[]");
  expect(screen.getByLabelText("Avatar image").textContent).toBe("blob:test");
  await act(async()=>finish());
  await waitFor(()=>expect(screen.getByLabelText("Cloud photo IDs").textContent).toContain(oldIconId));
  expect(screen.getByLabelText("Photo sync").textContent).toBe("synced");
});

it("downloads missing cloud images into the account's local cache",async()=>{
  const data=emptyData();data.preferences.personalPhotos.avatar=oldIconId;data.preferences.cloudPhotoIds=[oldIconId];
  const blob=new Blob(["remote"],{type:"image/jpeg"});cloud.downloadCloudPhoto.mockResolvedValue(blob);
  render(<CloudHarness initial={data}/>);
  await waitFor(()=>expect(screen.getByLabelText("Avatar image").textContent).toBe("blob:test"));
  expect(cloud.downloadCloudPhoto).toHaveBeenCalledWith(cloudUserId,oldIconId,expect.any(AbortSignal));
  expect(media.putPhoto).toHaveBeenCalledWith(`day-user-${cloudUserId}`,oldIconId,blob);
  expect(cloud.uploadCloudPhoto).not.toHaveBeenCalled();
});

it("drops an upload result from the account that was left",async()=>{
  const data=emptyData();data.preferences.personalPhotos.avatar=oldIconId;media.getPhoto.mockResolvedValue(new Blob(["local"],{type:"image/jpeg"}));
  let finish!:()=>void;cloud.uploadCloudPhoto.mockReturnValue(new Promise<void>(resolve=>{finish=resolve;}));
  render(<CloudHarness initial={data}/>);
  await waitFor(()=>expect(cloud.uploadCloudPhoto).toHaveBeenCalled());
  await userEvent.click(screen.getByText("Switch cloud account"));
  await act(async()=>finish());
  expect(screen.getByLabelText("Cloud photo IDs").textContent).toBe("[]");
});

it("keeps an offline photo local and retries when connectivity returns",async()=>{
  const online=vi.spyOn(navigator,"onLine","get").mockReturnValue(false);
  const data=emptyData();data.preferences.personalPhotos.avatar=oldIconId;media.getPhoto.mockResolvedValue(new Blob(["local"],{type:"image/jpeg"}));
  render(<CloudHarness initial={data}/>);
  await waitFor(()=>expect(screen.getByLabelText("Avatar image").textContent).toBe("blob:test"));
  expect(screen.getByLabelText("Photo sync").textContent).toBe("pending");
  expect(cloud.uploadCloudPhoto).not.toHaveBeenCalled();
  online.mockReturnValue(true);await act(async()=>window.dispatchEvent(new Event("online")));
  await waitFor(()=>expect(screen.getByLabelText("Cloud photo IDs").textContent).toContain(oldIconId));
});

it("does not advertise failed uploads as cloud-saved",async()=>{
  const data=emptyData();data.preferences.personalPhotos.avatar=oldIconId;media.getPhoto.mockResolvedValue(new Blob(["local"],{type:"image/jpeg"}));cloud.uploadCloudPhoto.mockRejectedValue(new Error("offline"));
  render(<CloudHarness initial={data}/>);
  await waitFor(()=>expect(cloud.uploadCloudPhoto).toHaveBeenCalled());
  await waitFor(()=>expect(screen.getByLabelText("Photo sync").textContent).toBe("pending"));
  expect(screen.getByLabelText("Cloud photo IDs").textContent).toBe("[]");
  expect(screen.getByLabelText("Avatar image").textContent).toBe("blob:test");
});

it("bounds cloud transfers to two and drains queued photos",async()=>{
  const data=emptyData(),second="22222222-2222-4222-8222-222222222222",third="55555555-5555-4555-8555-555555555555";
  data.preferences.personalPhotos={avatar:oldIconId,space:second,navigation:third};media.getPhoto.mockResolvedValue(new Blob(["local"],{type:"image/jpeg"}));
  const finishes:(()=>void)[]=[];cloud.uploadCloudPhoto.mockImplementation(()=>new Promise<void>(resolve=>finishes.push(resolve)));
  render(<CloudHarness initial={data}/>);
  await waitFor(()=>expect(cloud.uploadCloudPhoto).toHaveBeenCalledTimes(2));
  await act(async()=>finishes[0]());
  await waitFor(()=>expect(cloud.uploadCloudPhoto).toHaveBeenCalledTimes(3));
  expect(screen.getByLabelText("Cloud photo IDs").textContent).toContain(oldIconId);
  await act(async()=>{finishes[1]();finishes[2]();});
  await waitFor(()=>expect(JSON.parse(screen.getByLabelText("Cloud photo IDs").textContent!)).toHaveLength(3));
});

it.each(["Switch cloud account","Reset cloud photos"])("does not cache a stale cloud download after %s",async action=>{
  const data=emptyData();data.preferences.personalPhotos.avatar=oldIconId;data.preferences.cloudPhotoIds=[oldIconId];
  let finish!:(blob:Blob)=>void;cloud.downloadCloudPhoto.mockReturnValue(new Promise<Blob>(resolve=>{finish=resolve;}));
  render(<CloudHarness initial={data}/>);
  await waitFor(()=>expect(cloud.downloadCloudPhoto).toHaveBeenCalled());
  const signal=cloud.downloadCloudPhoto.mock.calls[0][2] as AbortSignal;
  await userEvent.click(screen.getByText(action));
  expect(signal.aborted).toBe(true);
  await act(async()=>finish(new Blob(["remote"],{type:"image/jpeg"})));
  expect(media.putPhoto).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Avatar image").textContent).toBe("empty");
});

it("restarts the cloud queue after a Strict Mode effect cleanup",async()=>{
  const data=emptyData();data.preferences.personalPhotos.avatar=oldIconId;media.getPhoto.mockResolvedValue(new Blob(["local"],{type:"image/jpeg"}));
  render(<React.StrictMode><CloudHarness initial={data}/></React.StrictMode>);
  await waitFor(()=>expect(screen.getByLabelText("Cloud photo IDs").textContent).toContain(oldIconId));
});
