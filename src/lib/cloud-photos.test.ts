import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cloudPhotoPath, downloadCloudPhoto, uploadCloudPhoto } from "./cloud-photos";

const {storage,from,getSupabase}=vi.hoisted(()=>{
  const storage={upload:vi.fn(),download:vi.fn()};
  const from=vi.fn(()=>storage);
  return {storage,from,getSupabase:vi.fn(()=>({storage:{from}}))};
});
vi.mock("@/lib/supabase/client",()=>({getSupabase}));
const userId="11111111-1111-4111-8111-111111111111", photoId="22222222-2222-4222-8222-222222222222";
beforeEach(()=>{vi.clearAllMocks();storage.upload.mockResolvedValue({data:{path:`${userId}/${photoId}`},error:null});storage.download.mockResolvedValue({data:new Blob(["jpeg"],{type:"image/jpeg"}),error:null});});
afterEach(()=>vi.useRealTimers());

it("uploads immutable processed images inside the current user's private folder",async()=>{
  const blob=new Blob(["jpeg"],{type:"image/jpeg"});
  await uploadCloudPhoto(userId,photoId,blob);
  expect(from).toHaveBeenCalledWith("day-photos");
  expect(storage.upload).toHaveBeenCalledWith(`${userId}/${photoId}`,blob,{contentType:"image/jpeg",cacheControl:"31536000",upsert:false});
});

it("rejects paths, SVGs and oversized images before contacting Storage",async()=>{
  expect(()=>cloudPhotoPath("../other",photoId)).toThrow();
  expect(()=>cloudPhotoPath(userId,"../photo")).toThrow();
  await expect(uploadCloudPhoto(userId,photoId,new Blob(["<svg/>"],{type:"image/svg+xml"}))).rejects.toThrow();
  await expect(uploadCloudPhoto(userId,photoId,new Blob([new Uint8Array(5*1024*1024+1)],{type:"image/jpeg"}))).rejects.toThrow();
  expect(from).not.toHaveBeenCalled();
});

it("verifies a duplicate object before accepting an interrupted immutable upload",async()=>{
  storage.upload.mockResolvedValue({data:null,error:{statusCode:"409",message:"already exists"}});
  await expect(uploadCloudPhoto(userId,photoId,new Blob(["jpeg"],{type:"image/jpeg"}))).resolves.toBeUndefined();
  expect(storage.download).toHaveBeenCalled();
  storage.download.mockResolvedValue({data:null,error:new Error("unavailable")});
  await expect(uploadCloudPhoto(userId,photoId,new Blob(["jpeg"],{type:"image/jpeg"}))).rejects.toThrow();
});

it("downloads privately with cancellation and validates the returned file",async()=>{
  const controller=new AbortController();
  const result=await downloadCloudPhoto(userId,photoId,controller.signal);
  expect(result.type).toBe("image/jpeg");
  expect(storage.download).toHaveBeenCalledWith(`${userId}/${photoId}`,{},expect.objectContaining({signal:controller.signal}));
  storage.download.mockResolvedValue({data:new Blob(["bad"],{type:"text/html"}),error:null});
  await expect(downloadCloudPhoto(userId,photoId)).rejects.toThrow();
});

it("bounds a stalled complete SDK operation",async()=>{
  vi.useFakeTimers();storage.upload.mockReturnValue(new Promise(()=>{}));
  const result=uploadCloudPhoto(userId,photoId,new Blob(["jpeg"],{type:"image/jpeg"}));
  const assertion=expect(result).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(15001);
  await assertion;
});
