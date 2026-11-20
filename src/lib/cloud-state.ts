import { appDataSchema, type AppData } from "./domain";

/** Existing RPCs preserve preferences JSON verbatim but enumerate record groups. */
export function encodeCloudState(data:AppData) {
  const validated=appDataSchema.parse(data);
  const uploaded=new Set(validated.preferences.cloudPhotoIds);
  const personalPhotos=Object.fromEntries(Object.entries(validated.preferences.personalPhotos).filter(([,id])=>uploaded.has(id)));
  const dayIcons=Object.fromEntries(Object.entries(validated.preferences.dayIcons).filter(([,id])=>uploaded.has(id)));
  const referenced=new Set([...Object.values(personalPhotos),...Object.values(dayIcons)]);
  return {...validated,preferences:{...validated.preferences,personalPhotos,dayIcons,cloudPhotoIds:[...referenced],dayReviews:validated.reviews}};
}

/** Cloud photos are account-owned; a JSON import uses the separate device-local policy. */
export function prepareCloudRestoreData(incoming:AppData,current:AppData):AppData {
  return {...incoming,preferences:{...incoming.preferences,onboardingDone:current.preferences.onboardingDone,accountOnboardingDone:current.preferences.accountOnboardingDone}};
}

export function decodeCloudState(raw:unknown):AppData {
  if(typeof raw!=="object"||raw===null||Array.isArray(raw))return appDataSchema.parse(raw);
  const source=raw as Record<string,unknown>;
  const preferences=source.preferences;
  const envelope=typeof preferences==="object"&&preferences!==null&&!Array.isArray(preferences)?preferences as Record<string,unknown>:{};
  return appDataSchema.parse({...source,reviews:Object.hasOwn(source,"reviews")?source.reviews:envelope.dayReviews});
}
