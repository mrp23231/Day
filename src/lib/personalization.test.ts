import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import { todayCards } from "./domain";
import { clearPhotoScope, deletePhoto, getPhoto, moveCard, putPhoto, scaledPhotoSize, toggleCardVisibility, validatePhotoFile } from "./personalization";

afterEach(async()=>{await clearPhotoScope("guest-test");await clearPhotoScope("account-test");});

it("rejects oversized, empty and non-raster photo files",()=>{
  expect(()=>validatePhotoFile({size:100,type:"image/jpeg"})).not.toThrow();
  expect(()=>validatePhotoFile({size:0,type:"image/jpeg"})).toThrow(/пуст/);
  expect(()=>validatePhotoFile({size:21*1024*1024,type:"image/jpeg"})).toThrow(/20/);
  expect(()=>validatePhotoFile({size:100,type:"image/svg+xml"})).toThrow(/JPEG/);
});

it("keeps aspect ratio and does not enlarge small photos",()=>{
  expect(scaledPhotoSize(4000,3000)).toEqual({width:2000,height:1500});
  expect(scaledPhotoSize(600,900)).toEqual({width:600,height:900});
  expect(()=>scaledPhotoSize(0,400)).toThrow();
  expect(()=>scaledPhotoSize(100000,100000)).toThrow();
});

it("limits calendar photo thumbnails to 512 pixels without enlarging small files",()=>{
  expect(scaledPhotoSize(4000,3000,512)).toEqual({width:512,height:384});
  expect(scaledPhotoSize(200,400,512)).toEqual({width:200,height:400});
  expect(()=>scaledPhotoSize(100,100,0)).toThrow();
});

it("stores image blobs independently for each account and removes only that scope",async()=>{
  await putPhoto("guest-test","same-id",new Blob(["guest"],{type:"image/jpeg"}));
  await putPhoto("account-test","same-id",new Blob(["account"],{type:"image/jpeg"}));
  expect(await (await getPhoto("guest-test","same-id"))?.text()).toBe("guest");
  expect(await (await getPhoto("account-test","same-id"))?.text()).toBe("account");
  await clearPhotoScope("guest-test");
  expect(await getPhoto("guest-test","same-id")).toBeUndefined();
  expect(await (await getPhoto("account-test","same-id"))?.text()).toBe("account");
  await deletePhoto("account-test","same-id");
  expect(await getPhoto("account-test","same-id")).toBeUndefined();
});

it("reorders cards without duplicates and keeps at least one visible",()=>{
  expect(moveCard([...todayCards],"water",-1)).toEqual(["plan","next","water","habits","food","review"]);
  expect(moveCard([...todayCards],"plan",-1)).toEqual([...todayCards]);
  const hidden=["next","plan","habits","water","food"] as const;
  expect(toggleCardVisibility([...hidden],"review")).toEqual(hidden);
  expect(toggleCardVisibility([...hidden],"water")).toEqual(["next","plan","habits","food"]);
});
