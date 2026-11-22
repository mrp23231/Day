import { describe, expect, it } from "vitest";
import { estimatePortionGrams, scaleFoodNutrition } from "./food-portions";

describe("food portion calculations", () => {
  it("converts package values per 100 g into whole-portion nutrition", () => {
    expect(scaleFoodNutrition({calories:140,protein:12,fat:4,carbs:14},100,150)).toEqual({calories:210,protein:18,fat:6,carbs:21});
  });
  it("uses the food and measure together when estimating weight", () => {
    expect(estimatePortionGrams("rice-spoon",2.5)).toBe(25);
    expect(estimatePortionGrams("rice-cup",1)).toBe(134);
    expect(estimatePortionGrams("milk-glass",1)).toBe(258);
    expect(estimatePortionGrams("bread-slice",2)).toBe(60);
    expect(estimatePortionGrams("egg",0.5)).toBe(25);
  });
  it("keeps the rice cup and level tablespoon estimates consistent with their volumes",()=>{
    expect(Math.abs(estimatePortionGrams("rice-spoon",200/15)-estimatePortionGrams("rice-cup",1))).toBeLessThanOrEqual(2);
  });
  it("rejects unsupported measures, invalid quantities and excessive portions", () => {
    for (const [preset,quantity] of [["unknown",1],["egg",0],["egg",NaN],["egg",Infinity],["egg",201]] as const) expect(()=>estimatePortionGrams(preset,quantity)).toThrow();
    for(const grams of [0,-1,NaN,Infinity,10001]) expect(()=>scaleFoodNutrition({calories:100,protein:1,fat:1,carbs:1},100,grams)).toThrow();
  });
  it("preserves zero nutrition and scales from a stable original rather than rounded intermediate results", () => {
    const original={calories:0,protein:7.1,fat:0,carbs:4.2};
    expect(scaleFoodNutrition(original,230,460)).toEqual({calories:0,protein:14.2,fat:0,carbs:8.4});
    expect(scaleFoodNutrition(original,230,115)).toEqual({calories:0,protein:3.6,fat:0,carbs:2.1});
    expect(original.protein).toBe(7.1);
  });
  it("keeps the original precision when returning to the original portion",()=>{
    expect(scaleFoodNutrition({calories:130.55,protein:7.13,fat:3.65,carbs:17.42},230,230)).toEqual({calories:130.55,protein:7.13,fat:3.65,carbs:17.42});
  });
});
