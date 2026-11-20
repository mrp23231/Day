import { closestCenter, pointerWithin, type CollisionDetection } from "@dnd-kit/core";

/** A compact preview must target the pointer even if its original card was tall. */
export const homeCardCollision:CollisionDetection=args=>{
  const underPointer=pointerWithin(args);
  if(underPointer.length)return underPointer;
  const pointer=args.pointerCoordinates;
  if(!pointer)return closestCenter(args);
  const {width,height}=args.collisionRect;
  return closestCenter({...args,collisionRect:{...args.collisionRect,left:pointer.x-width/2,right:pointer.x+width/2,top:pointer.y-height/2,bottom:pointer.y+height/2}});
};
