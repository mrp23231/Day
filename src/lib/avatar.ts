export const MAX_AVATAR_BYTES=5*1024*1024;
const maximumSide=512;

export function validateAvatarFile(file:Pick<File,"size"|"type">) {
  if(!file.size)throw new Error("Файл пуст. Выберите другое изображение.");
  if(file.size>MAX_AVATAR_BYTES)throw new Error("Выберите фото или GIF до 5 МБ.");
  if(!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type))throw new Error("Для аватара подойдёт JPEG, PNG, WebP или GIF.");
}

/** Validate the container before handing animated bytes to the browser decoder. */
export function validateGif(bytes:Uint8Array) {
  const invalid=()=>new Error("Не удалось открыть GIF. Выберите другой файл.");
  const signature=String.fromCharCode(...bytes.slice(0,6));
  if(bytes.length<14||!["GIF87a","GIF89a"].includes(signature))throw invalid();
  const word=(at:number)=>bytes[at]|bytes[at+1]<<8;
  const width=word(6),height=word(8);
  if(!width||!height||width>maximumSide||height>maximumSide)throw new Error("Выберите GIF размером до 512 × 512 пикселей.");
  let offset=13+((bytes[10]&0x80)?3*(2**((bytes[10]&7)+1)):0),frames=0,pixels=0;
  const skipBlocks=()=>{
    let total=0;
    while(offset<bytes.length){const length=bytes[offset++];if(length===0)return total;total+=length;offset+=length;if(offset>bytes.length)throw invalid();}
    throw invalid();
  };
  while(offset<bytes.length){
    const marker=bytes[offset++];
    if(marker===0x3b){if(!frames||offset!==bytes.length)throw invalid();return {width,height,frames};}
    if(marker===0x21){if(offset>=bytes.length)throw invalid();offset++;skipBlocks();continue;}
    if(marker!==0x2c||offset+9>bytes.length)throw invalid();
    const left=word(offset),top=word(offset+2),frameWidth=word(offset+4),frameHeight=word(offset+6),packed=bytes[offset+8];
    if(!frameWidth||!frameHeight||left+frameWidth>width||top+frameHeight>height)throw invalid();
    frames++;pixels+=frameWidth*frameHeight;
    if(frames>120||pixels>16_777_216)throw new Error("Эта анимация слишком тяжёлая. Выберите более короткий GIF.");
    offset+=9+((packed&0x80)?3*(2**((packed&7)+1)):0);
    if(offset>=bytes.length||bytes[offset]<2||bytes[offset]>8)throw invalid();
    offset++;if(skipBlocks()===0)throw invalid();
  }
  throw invalid();
}

/** Confirm actual pixels decode before replacing an existing avatar; retain every original GIF byte. */
async function verifyGifImage(file:File,dimensions:{width:number;height:number}) {
  const source=URL.createObjectURL(file);
  try {
    const image=new Image();
    await new Promise<void>((resolve,reject)=>{
      let settled=false;
      const invalid=()=>new Error("Не удалось открыть GIF. Выберите другой файл.");
      const finish=(error?:Error)=>{
        if(settled)return;
        settled=true;clearTimeout(timer);image.onload=null;image.onerror=null;
        if(error)reject(error);else resolve();
      };
      const timer=setTimeout(()=>finish(invalid()),15000);
      image.onerror=()=>finish(invalid());
      image.onload=()=>{
        void (async()=>{
          try {
            if(typeof image.decode==="function")await image.decode();
            if(image.naturalWidth!==dimensions.width||image.naturalHeight!==dimensions.height)throw invalid();
            finish();
          } catch {finish(invalid());}
        })();
      };
      image.src=source;
    });
  } finally {URL.revokeObjectURL(source);}
}

/** GIFs retain their frames; static pictures are cropped and re-encoded locally. */
export async function prepareAvatar(file:File):Promise<Blob> {
  validateAvatarFile(file);
  if(file.type==="image/gif"){const dimensions=validateGif(new Uint8Array(await file.arrayBuffer()));await verifyGifImage(file,dimensions);return file;}
  const source=URL.createObjectURL(file);
  try {
    const image=new Image();
    await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error("Не удалось открыть фото. Попробуйте другой файл."));image.src=source;});
    const width=image.naturalWidth,height=image.naturalHeight;
    if(!width||!height||width*height>60_000_000)throw new Error("Не удалось открыть фото: слишком большой или повреждённый файл.");
    const crop=Math.min(width,height),side=Math.min(maximumSide,crop);
    const canvas=document.createElement("canvas");canvas.width=side;canvas.height=side;
    const context=canvas.getContext("2d");
    if(!context)throw new Error("Обработка фото недоступна в этом браузере.");
    context.fillStyle="#ffffff";context.fillRect(0,0,side,side);
    context.drawImage(image,(width-crop)/2,(height-crop)/2,crop,crop,0,0,side,side);
    return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Не удалось обработать фото.")),"image/jpeg",.88));
  }finally{URL.revokeObjectURL(source);}
}
