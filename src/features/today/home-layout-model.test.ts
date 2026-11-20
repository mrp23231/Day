import { expect, it } from "vitest";
import { reorderVisibleCards } from "./home-layout-model";

it("moves a card through the visible order while retaining hidden slots",()=>{
  const order=["plan","next","habits","water","food","review"] as const;
  expect(reorderVisibleCards([...order],["next","food"],"plan","water")).toEqual(["habits","next","water","plan","food","review"]);
  expect(order).toEqual(["plan","next","habits","water","food","review"]);
});
it("leaves invalid, hidden or stationary drops unchanged",()=>{
  const order=["plan","next","habits","water","food","review"] as const;
  const current=[...order];
  expect(reorderVisibleCards(current,["water"],"plan","water")).toBe(current);
  expect(reorderVisibleCards(current,[],"plan","plan")).toBe(current);
  expect(reorderVisibleCards(current,[],"missing","plan")).toBe(current);
});
