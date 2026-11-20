import { expect, it } from "vitest";
import { appDataSchema, dayReviewSchema, emptyData, readSavedData } from "./domain";

it("migrates old v1 records with defaults without losing tasks or water",()=>{
  const old=JSON.parse(JSON.stringify(emptyData()));
  delete old.reviews;
  for(const field of ["personalPhotos","photoTone","todayOrder","todayHidden"])delete old.preferences[field];
  old.water=[{id:"water",date:"2026-11-08",time:"10:00",amount:250}];
  const loaded=readSavedData(JSON.stringify(old));
  expect(loaded.reviews).toEqual([]);
  expect(loaded.preferences.personalPhotos).toEqual({});
  expect(loaded.preferences.todayOrder).toEqual(["plan","next","habits","water","food","review"]);
  expect(loaded.preferences.todayHidden).toEqual([]);
  expect(loaded.water).toEqual(old.water);
});

it("keeps photo references and reviews in validated exports",()=>{
  const data=emptyData();
  data.preferences.personalPhotos={space:"9daf3dd3-64c2-4a3c-a12a-c63175ec6dd8"};
  data.reviews=[{date:"2026-11-08",note:"Доволен прогулкой",mood:"great",updatedAt:"2026-11-08T20:00:00.000Z"}];
  expect(readSavedData(JSON.stringify(data))).toEqual(data);
});

it("rejects embedded images and invalid block layouts",()=>{
  const data=emptyData();
  expect(appDataSchema.safeParse({...data,preferences:{...data.preferences,personalPhotos:{space:"data:image/png;base64,123"}}}).success).toBe(false);
  expect(appDataSchema.safeParse({...data,preferences:{...data.preferences,todayOrder:["plan","plan","habits","water","food","review"]}}).success).toBe(false);
  expect(appDataSchema.safeParse({...data,preferences:{...data.preferences,todayHidden:["plan","next","habits","water","food","review"]}}).success).toBe(false);
});

it("bounds review text and validates dates",()=>{
  const review={date:"2026-11-08",note:"",mood:"steady",updatedAt:"2026-11-08T20:00:00.000Z"};
  expect(dayReviewSchema.safeParse(review).success).toBe(true);
  expect(dayReviewSchema.safeParse({...review,note:"a".repeat(2001)}).success).toBe(false);
  expect(dayReviewSchema.safeParse({...review,date:"2026-11-31"}).success).toBe(false);
});

it("defaults day icons in old records and validates bounded date-to-UUID references",()=>{
  const old=JSON.parse(JSON.stringify(emptyData()));delete old.preferences.dayIcons;
  expect(readSavedData(JSON.stringify(old)).preferences.dayIcons).toEqual({});
  const data=emptyData();
  data.preferences.dayIcons={"2028-02-29":"9daf3dd3-64c2-4a3c-a12a-c63175ec6dd8"};
  expect(readSavedData(JSON.stringify(data)).preferences.dayIcons).toEqual(data.preferences.dayIcons);
  for(const dayIcons of [{"2027-02-29":"9daf3dd3-64c2-4a3c-a12a-c63175ec6dd8"},{"2028-02-29":"https://example.com/photo.jpg"}]) {
    expect(appDataSchema.safeParse({...data,preferences:{...data.preferences,dayIcons}}).success).toBe(false);
  }
  const dayIcons=Object.fromEntries(Array.from({length:3661},(_,index)=>[`${1000+index}-01-01`,"9daf3dd3-64c2-4a3c-a12a-c63175ec6dd8"]));
  expect(appDataSchema.safeParse({...data,preferences:{...data.preferences,dayIcons}}).success).toBe(false);
});
