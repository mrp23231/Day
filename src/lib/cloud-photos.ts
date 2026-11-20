import { z } from "zod";
import { getSupabase } from "@/lib/supabase/client";
import { withNetworkDeadline } from "@/lib/network-deadline";

export const CLOUD_PHOTOS_BUCKET="day-photos";
const uuid=z.uuid();

export function photoStorageMessage(authenticated:boolean,status?:string,hasLocalPhoto=false) {
  if(!authenticated)return "Фото хранится на этом устройстве. Войдите, чтобы оно появилось на других устройствах.";
  if(status==="syncing")return "Синхронизируем фото с аккаунтом…";
  if(status==="pending")return hasLocalPhoto?"Фото пока на этом устройстве. Синхронизация повторится автоматически.":"Фото из аккаунта пока недоступно. Повторим загрузку при подключении.";
  if(status==="unavailable")return "Фото не найдено в аккаунте или на устройстве. Выберите его снова.";
  if(status==="synced")return "Фото загружено в аккаунт и доступно на других устройствах после синхронизации записей.";
  return "Фото синхронизируются приватно с вашим аккаунтом. JSON-экспорт не содержит изображения.";
}

/** IDs, never user filenames, form the private immutable Storage address. */
export function cloudPhotoPath(userId:string,photoId:string) {
  return `${uuid.parse(userId)}/${uuid.parse(photoId)}`;
}

function validateCloudPhoto(blob:Blob) {
  if(!blob.size||blob.size>5*1024*1024||!["image/jpeg","image/gif"].includes(blob.type))throw new Error("Не удалось синхронизировать фото: неподдерживаемый файл.");
}

function bucket() {
  const client=getSupabase();
  if(!client)throw new Error("Облако фото пока недоступно.");
  return client.storage.from(CLOUD_PHOTOS_BUCKET);
}

export async function downloadCloudPhoto(userId:string,photoId:string,signal?:AbortSignal):Promise<Blob> {
  const path=cloudPhotoPath(userId,photoId);
  signal?.throwIfAborted();
  const {data,error}=await withNetworkDeadline(bucket().download(path,{},signal?{signal}:undefined));
  signal?.throwIfAborted();
  if(error||!data)throw new Error("Не удалось загрузить фото из аккаунта.");
  validateCloudPhoto(data);
  return data;
}

export async function uploadCloudPhoto(userId:string,photoId:string,blob:Blob):Promise<void> {
  const path=cloudPhotoPath(userId,photoId);
  validateCloudPhoto(blob);
  // This SDK's upload API has no per-call AbortSignal. Its shared fetch and this
  // complete SDK operation both have a 15 s deadline; callers also guard scope.
  const {error}=await withNetworkDeadline(bucket().upload(path,blob,{contentType:blob.type,cacheControl:"31536000",upsert:false}));
  if(!error)return;
  // A timed-out upload can have reached Storage. Verify that immutable object
  // privately before publishing its ID, instead of overwriting it with upsert.
  if("statusCode" in error&&String(error.statusCode)==="409"){
    await downloadCloudPhoto(userId,photoId);
    return;
  }
  throw new Error("Не удалось сохранить фото в аккаунте.");
}
