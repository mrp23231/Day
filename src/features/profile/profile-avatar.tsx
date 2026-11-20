"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useDay } from "@/components/day-provider";
import { useOptionalPersonalPhotos } from "@/features/appearance/personal-photos";
import styles from "./profile-avatar.module.css";

function reducedMotion(){return typeof matchMedia!=="undefined"&&matchMedia("(prefers-reduced-motion: reduce)").matches;}
function subscribe(listener:()=>void){if(typeof matchMedia==="undefined")return ()=>{};const query=matchMedia("(prefers-reduced-motion: reduce)");query.addEventListener("change",listener);return()=>query.removeEventListener("change",listener);}

export function ProfileAvatar({className="",name}:{className?:string;name?:string}) {
  const {data}=useDay();
  const photos=useOptionalPersonalPhotos();
  const url=photos?.urlFor("avatar");
  const reduce=useSyncExternalStore(subscribe,reducedMotion,()=>false);
  const initial=Array.from((name??data.preferences.name).trim())[0]?.toUpperCase()||"D";
  return <span className={`${styles.avatar} ${className}`} aria-hidden="true">{initial}{url&&<AvatarImage key={`${url}:${reduce}`} src={url} freeze={reduce}/>}</span>;
}

function AvatarImage({src,freeze}:{src:string;freeze:boolean}) {
  const [poster,setPoster]=useState<string>();
  const processed=useRef(false);
  // Local object URLs intentionally bypass the server image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={poster||src} alt="" draggable={false} decoding="async" onLoad={event=>{
    if(!freeze||processed.current)return;
    processed.current=true;
    try{
      const image=event.currentTarget,canvas=document.createElement("canvas");
      canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
      const context=canvas.getContext("2d");if(!context)return;
      context.drawImage(image,0,0);setPoster(canvas.toDataURL("image/png"));
    }catch{/* Keep the local preview if a browser cannot create a frozen poster. */}
  }}/>;
}
