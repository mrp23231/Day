import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareAvatar, validateAvatarFile, validateGif } from "./avatar";

// Two complete 1 × 1 image frames: preserves the animation bytes, not a thumbnail.
const frame = [0x2c,0,0,0,0,1,0,1,0,0,2,2,0x44,1,0];
const gif = new Uint8Array([71,73,70,56,57,97,1,0,1,0,0x80,0,0,0,0,0,255,255,255,...frame,...frame,0x3b]);
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
function mockGifDecoder(mode:"load"|"error"|"decode-error"|"stall"="load") {
  const decode=vi.fn().mockImplementation(()=>mode==="decode-error"?Promise.reject(new Error("bad pixels")):Promise.resolve());
  class ImageMock { naturalWidth=1;naturalHeight=1;onload?:()=>void;onerror?:()=>void;decode=decode;set src(_value:string){if(mode!=="stall")queueMicrotask(()=>mode==="error"?this.onerror?.():this.onload?.());} }
  const revokeObjectURL=vi.fn(),createObjectURL=vi.fn(()=>"blob:gif-validation");
  vi.stubGlobal("Image",ImageMock);vi.stubGlobal("URL",{createObjectURL,revokeObjectURL});
  return {decode,revokeObjectURL,createObjectURL};
}

describe("avatar files",()=>{
  it("preserves complete animated GIF bytes without a canvas conversion",async()=>{
    const decoder=mockGifDecoder();
    const file=new File([gif],"portrait.gif",{type:"image/gif"});
    const result=await prepareAvatar(file);
    expect(result).toBe(file);
    expect(new Uint8Array(await result.arrayBuffer())).toEqual(gif);
    expect(decoder.decode).toHaveBeenCalledOnce();
    expect(decoder.revokeObjectURL).toHaveBeenCalledWith("blob:gif-validation");
  });
  it("rejects a GIF frame without compressed pixel data",()=>{
    const frameWithoutPixels=[0x2c,0,0,0,0,1,0,1,0,0,2,0];
    const malformed=new Uint8Array([...gif.slice(0,19),...frameWithoutPixels,0x3b]);
    expect(()=>validateGif(malformed)).toThrow(/GIF/);
  });
  it.each(["error","decode-error"] as const)("rejects GIFs the browser cannot decode (%s) and releases the object URL",async(mode)=>{
    const decoder=mockGifDecoder(mode);
    await expect(prepareAvatar(new File([gif],"bad.gif",{type:"image/gif"}))).rejects.toThrow(/GIF/);
    expect(decoder.revokeObjectURL).toHaveBeenCalledWith("blob:gif-validation");
  });
  it("does not leave the avatar editor busy indefinitely if decoding stalls",async()=>{
    vi.useFakeTimers();const decoder=mockGifDecoder("stall");
    const promise=prepareAvatar(new File([gif],"stalled.gif",{type:"image/gif"}));
    const result=promise.then(()=>null,error=>error);
    await vi.advanceTimersByTimeAsync(15001);
    expect(await result).toBeInstanceOf(Error);expect((await result).message).toContain("GIF");
    expect(decoder.revokeObjectURL).toHaveBeenCalledWith("blob:gif-validation");
  });
  it("rejects empty, oversized and unsupported files before decoding",()=>{
    expect(()=>validateAvatarFile({size:0,type:"image/gif"})).toThrow(/пуст/);
    expect(()=>validateAvatarFile({size:5*1024*1024+1,type:"image/gif"})).toThrow(/5/);
    expect(()=>validateAvatarFile({size:10,type:"image/svg+xml"})).toThrow(/JPEG/);
  });
  it("rejects forged or incomplete GIF containers and excessive dimensions",()=>{
    expect(()=>validateGif(new Uint8Array([71,73,70,56,57,97]))).toThrow();
    expect(()=>validateGif(new TextEncoder().encode("not a gif"))).toThrow();
    expect(()=>validateGif(gif.slice(0,-1))).toThrow();
    const huge=gif.slice();huge[6]=1;huge[7]=4;
    expect(()=>validateGif(huge)).toThrow(/512/);
  });
  it("rejects GIFs with an excessive decoded frame budget",()=>{
    const many=new Uint8Array([...gif.slice(0,19),...Array.from({length:121},()=>frame).flat(),0x3b]);
    expect(()=>validateGif(many)).toThrow(/анимац/);
  });
  it("crops static photos to a metadata-free 512-pixel square",async()=>{
    const drawImage=vi.fn();const output=new Blob(["safe jpeg"],{type:"image/jpeg"});
    const canvas={width:0,height:0,getContext:()=>({drawImage,fillStyle:"",fillRect:vi.fn()}),toBlob:(done:(blob:Blob)=>void)=>done(output)};
    class ImageMock { naturalWidth=1800;naturalHeight=1200;onload?:()=>void;set src(_value:string){queueMicrotask(()=>this.onload?.());} }
    vi.stubGlobal("Image",ImageMock);vi.stubGlobal("document",{createElement:()=>canvas});
    vi.stubGlobal("URL",{createObjectURL:()=>"blob:avatar",revokeObjectURL:vi.fn()});
    const result=await prepareAvatar(new File(["photo"],"portrait.jpg",{type:"image/jpeg"}));
    expect(result).toBe(output);expect(canvas.width).toBe(512);expect(canvas.height).toBe(512);
    expect(drawImage).toHaveBeenCalledWith(expect.any(ImageMock),300,0,1200,1200,0,0,512,512);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:avatar");
  });
});
