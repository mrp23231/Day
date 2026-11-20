import { describe, expect, it } from "vitest";
import { canRestoreCloud, currentCloudOperation, filterTasksForDate, nutritionTargets, recoveryRequested } from "./state-policy";
import { calculateNutrition, type Task } from "./domain";
describe("cloud result ownership",()=>{
  const start={scope:"user-a",generation:1,mutation:0};
  it("keeps a newer local draft instead of replacing it with a snapshot",()=>{expect(canRestoreCloud(start,start,true)).toBe(false);});
  it("rejects a slow response after local edits",()=>{expect(canRestoreCloud(start,{...start,mutation:1},false)).toBe(false);});
  it("rejects an old response after switching away and back to the same user",()=>{expect(currentCloudOperation(start,{...start,generation:3})).toBe(false);});
  it("restores only an untouched empty account in the same scope",()=>{expect(canRestoreCloud(start,start,false)).toBe(true);expect(currentCloudOperation(start,{...start,scope:"user-b"})).toBe(false);});
});
describe("date-specific planner filters",()=>{
  const task:Task={id:"1",title:"Читать",date:"2026-11-02",time:"",priority:"normal",category:"Личное",description:"",repeat:"daily",completedDates:["2026-11-02"]};
  it("does not hide Tuesday's recurring task because Monday was complete",()=>{expect(filterTasksForDate([task],"2026-11-03","","active")).toHaveLength(1);expect(filterTasksForDate([task],"2026-11-03","","done")).toHaveLength(0);});
});
describe("safe nutrition goal adoption",()=>{
  it("does not allow an out-of-range calculated target to crash preferences",()=>{
    expect(nutritionTargets(calculateNutrition({age:80,sex:"female",weight:35,height:130,activity:1.2,goal:"lose"}))).toBeNull();
    expect(nutritionTargets(calculateNutrition({age:30,sex:"male",weight:200,height:200,activity:1.9,goal:"gain"}))).toBeNull();
  });
  it("maps supported calculated estimates to validated preferences",()=>{expect(nutritionTargets(calculateNutrition({age:30,sex:"male",weight:80,height:180,activity:1.55,goal:"maintain"}))?.calorieGoal).toBe(2759);});
});
describe("password recovery intent",()=>{
  it("opens recovery only with an authenticated session and recovery intent",()=>{expect(recoveryRequested("https://day.test/settings?recovery=1",true)).toBe(true);expect(recoveryRequested("https://day.test/settings?recovery=1",false)).toBe(false);expect(recoveryRequested("https://day.test/settings",true)).toBe(false);});
});
