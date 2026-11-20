import { todayCards, type PhotoTarget, type TodayCard } from "./domain";

export const personalTargets: {id:PhotoTarget;label:string;description:string}[] = [
  {id:"space",label:"Фон пространства",description:"Фотография за основными блоками"},
  {id:"navigation",label:"Навигация",description:"Боковое меню и нижняя панель на телефоне"},
  {id:"next",label:"Дальше по плану",description:"Ближайшая задача и фокус"},
  {id:"plan",label:"План на день",description:"Задачи и календарная неделя"},
  {id:"habits",label:"Привычки",description:"Маленькие действия каждый день"},
  {id:"water",label:"Вода",description:"Ваш водный баланс"},
  {id:"food",label:"Питание",description:"Приёмы пищи за день"},
  {id:"review",label:"Итоги дня",description:"Результаты и личная заметка"},
];

export function validatePhotoFile(file:Pick<File,"type"|"size">) {
  if(!file.size)throw new Error("Файл пуст. Выберите другую фотографию.");
  if(file.size>20*1024*1024)throw new Error("Выберите фотографию до 20 МБ.");
  if(!["image/jpeg","image/png","image/webp","image/avif"].includes(file.type))throw new Error("Подойдёт JPEG, PNG, WebP или AVIF. Сохраните фото в одном из этих форматов.");
}

export function scaledPhotoSize(width:number,height:number,maxSide=2000) {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width*height>60_000_000||!Number.isInteger(maxSide)||maxSide<=0||maxSide>2000)throw new Error("Не удалось открыть фото: слишком большой или повреждённый файл.");
  const scale=Math.min(1,maxSide/Math.max(width,height));
  return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}

/** Rasterize locally to resize and discard source metadata. No network request. */
export async function preparePhoto(file:File,maxSide=2000):Promise<Blob> {
  validatePhotoFile(file);
  const source=URL.createObjectURL(file);
  try {
    const image=new Image();
    await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error("Не удалось открыть фото. Попробуйте другой файл."));image.src=source;});
    const {width,height}=scaledPhotoSize(image.naturalWidth,image.naturalHeight,maxSide);
    const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
    const context=canvas.getContext("2d");
    if(!context)throw new Error("Обработка фото недоступна в этом браузере.");
    context.fillStyle="#ffffff";context.fillRect(0,0,width,height);context.drawImage(image,0,0,width,height);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error("Не удалось обработать фото.")),"image/jpeg",.86));
    if(blob.size>4*1024*1024)throw new Error("После обработки фото слишком большое. Выберите более простое изображение.");
    return blob;
  } finally { URL.revokeObjectURL(source); }
}

const database="day-personal-photos-v1";
function openPhotos():Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==="undefined"){reject(new Error("Хранилище фото недоступно в этом браузере."));return;}
    const request=indexedDB.open(database,1);
    request.onupgradeneeded=()=>request.result.createObjectStore("photos",{keyPath:["scope","id"]});
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db);};
    request.onerror=()=>reject(request.error||new Error("Не удалось открыть хранилище фото."));
    request.onblocked=()=>reject(new Error("Закройте другие вкладки Day и повторите загрузку фото."));
  });
}

async function photoTransaction<T>(mode:IDBTransactionMode,operation:(store:IDBObjectStore,setValue:(value:T)=>void)=>void):Promise<T> {
  const db=await openPhotos();
  return new Promise<T>((resolve,reject)=>{
    const tx=db.transaction("photos",mode);let value:T;
    tx.oncomplete=()=>{db.close();resolve(value);};
    tx.onabort=tx.onerror=()=>{db.close();reject(tx.error||new Error("Не хватает места для фотографии. Освободите место и повторите."));};
    try{operation(tx.objectStore("photos"),next=>{value=next;});}catch(error){db.close();reject(error);}
  });
}

export function putPhoto(scope:string,id:string,blob:Blob):Promise<void> {return photoTransaction("readwrite",store=>{store.put({scope,id,blob});});}
export function getPhoto(scope:string,id:string):Promise<Blob|undefined> {return photoTransaction("readonly",(store,setValue)=>{const request=store.get([scope,id]);request.onsuccess=()=>setValue(request.result?.blob);});}
export function deletePhoto(scope:string,id:string):Promise<void> {return photoTransaction("readwrite",store=>{store.delete([scope,id]);});}
export function clearPhotoScope(scope:string):Promise<void> {return photoTransaction("readwrite",store=>{const request=store.openCursor(IDBKeyRange.bound([scope,""],[scope,"\uffff"]));request.onsuccess=()=>{const cursor=request.result;if(cursor){cursor.delete();cursor.continue();}};});}

export function moveCard(order:TodayCard[],card:TodayCard,direction:-1|1):TodayCard[] {
  const from=order.indexOf(card),to=from+direction;
  if(from<0||to<0||to>=order.length)return order;
  const result=[...order];[result[from],result[to]]=[result[to],result[from]];return result;
}
export function toggleCardVisibility(hidden:TodayCard[],card:TodayCard):TodayCard[] {
  return hidden.includes(card)?hidden.filter(item=>item!==card):hidden.length>=todayCards.length-1?hidden:[...hidden,card];
}
