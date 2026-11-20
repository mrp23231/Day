import { expect, it } from "vitest";
import { emptyData } from "./domain";
import { decodeCloudState, encodeCloudState } from "./cloud-state";

it("preserves daily reviews through the existing RPC's preferences JSON envelope",()=>{
  const data=emptyData();data.preferences.name="Анна";
  data.reviews=[{date:"2026-11-12",note:"Прогулка перед работой",mood:"great",updatedAt:"2026-11-12T18:00:00Z"}];
  const payload=encodeCloudState(data);
  // The existing SQL RPC stores prefs.data and enumerates these five groups;
  // it does not return newly added top-level fields automatically.
  const fromRpc={version:1,preferences:payload.preferences,tasks:payload.tasks,foods:payload.foods,water:payload.water,habits:payload.habits};
  expect(decodeCloudState(JSON.parse(JSON.stringify(fromRpc)))).toEqual(data);
});
it("loads older cloud copies with no review envelope",()=>{
  const old=JSON.parse(JSON.stringify(emptyData()));delete old.reviews;
  expect(decodeCloudState(old).reviews).toEqual([]);
});
it("rejects malformed cloud reviews instead of silently erasing them",()=>{
  const data=emptyData();const remote={...data,preferences:{...data.preferences,dayReviews:[{date:"bad"}]}};
  delete (remote as Partial<typeof remote>).reviews;
  expect(()=>decodeCloudState(remote)).toThrow();
});
it("does not send local photo references to Supabase",()=>{
  const data=emptyData();
  data.preferences.personalPhotos={avatar:"9daf3dd3-64c2-4a3c-a12a-c63175ec6dd8"};
  data.preferences.dayIcons={"2026-11-20":"bdc893f4-3372-4512-ae87-2c8db9e9ed2e"};
  const payload=encodeCloudState(data);
  expect(payload.preferences.personalPhotos).toEqual({});
  expect(payload.preferences.dayIcons).toEqual({});
  expect(Object.keys(data.preferences.dayIcons)).toEqual(["2026-11-20"]);
});
it("syncs only successfully uploaded image references and keeps originals intact",()=>{
  const data=emptyData();
  const uploaded="9daf3dd3-64c2-4a3c-a12a-c63175ec6dd8",pending="bdc893f4-3372-4512-ae87-2c8db9e9ed2e";
  data.preferences.personalPhotos={avatar:uploaded,space:pending};
  data.preferences.dayIcons={"2026-11-20":uploaded,"2026-11-21":pending};
  data.preferences.cloudPhotoIds=[uploaded];
  const payload=encodeCloudState(data);
  expect(payload.preferences.personalPhotos).toEqual({avatar:uploaded});
  expect(payload.preferences.dayIcons).toEqual({"2026-11-20":uploaded});
  expect(payload.preferences.cloudPhotoIds).toEqual([uploaded]);
  expect(decodeCloudState(payload).preferences.personalPhotos).toEqual({avatar:uploaded});
  expect(data.preferences.personalPhotos.space).toBe(pending);
});
