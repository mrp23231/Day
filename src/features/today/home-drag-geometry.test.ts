import { expect, it } from "vitest";
import { type ClientRect } from "@dnd-kit/core";
import { homeCardCollision } from "./home-drag-geometry";
const rect=(top:number,height:number):ClientRect=>({left:0,right:300,top,bottom:top+height,width:300,height});
function fixture(pointer:{x:number;y:number}|null){
  const rectangles=new Map([['plan',rect(0,500)],['next',rect(520,100)],['habits',rect(700,100)]]);
  return {active:{id:"plan",data:{current:{}},rect:{current:{initial:rect(0,500),translated:rect(200,500)}}},collisionRect:rect(200,155),pointerCoordinates:pointer,droppableRects:rectangles,droppableContainers:[...rectangles].map(([id,bounds])=>({id,key:id,data:{current:{}},disabled:false,node:{current:null},rect:{current:bounds}}))};
}
it("targets the nearest block to the pointer when a tall card is dropped in a gap",()=>{
  expect(homeCardCollision(fixture({x:100,y:650}))[0]?.id).toBe("next");
});
it("prefers the block directly under a pointer and preserves keyboard geometry",()=>{
  expect(homeCardCollision(fixture({x:100,y:730}))[0]?.id).toBe("habits");
  expect(homeCardCollision(fixture(null))[0]?.id).toBe("plan");
});
