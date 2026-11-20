import { describe, expect, it } from "vitest";
import { shouldCelebrateTasks, taskCompletionHistory } from "./completion";
import type { Task } from "./domain";

const today = "2026-11-06";
const task: Task = {id:"a",title:"Прогулка",description:"",date:today,time:"",priority:"normal",category:"Личное",repeat:"none",completedDates:[]};

describe("completion celebration policy", () => {
  it("celebrates completing the final task scheduled today", () => {
    expect(shouldCelebrateTasks([task, {...task,id:"b",completedDates:[today]}],"a",today,today)).toBe(true);
  });
  it("does not celebrate while another task remains", () => {
    expect(shouldCelebrateTasks([task,{...task,id:"b"}],"a",today,today)).toBe(false);
  });
  it("does not celebrate undo, missing tasks or an empty day", () => {
    expect(shouldCelebrateTasks([{...task,completedDates:[today]}],"a",today,today)).toBe(false);
    expect(shouldCelebrateTasks([task],"missing",today,today)).toBe(false);
    expect(shouldCelebrateTasks([],"a",today,today)).toBe(false);
  });
  it("does not celebrate changes in the past or future", () => {
    expect(shouldCelebrateTasks([{...task,repeat:"daily",date:"2026-11-01"}],"a","2026-11-05",today)).toBe(false);
    expect(shouldCelebrateTasks([{...task,repeat:"daily"}],"a","2026-11-07",today)).toBe(false);
  });
  it("counts recurrence today and ignores tasks from another date", () => {
    expect(shouldCelebrateTasks([{...task,repeat:"daily",date:"2026-11-01",completedDates:["2026-11-05"]},{...task,id:"b",date:"2026-11-07"}],"a",today,today)).toBe(true);
    expect(shouldCelebrateTasks([{...task,date:"2026-11-07"}],"a",today,today)).toBe(false);
  });
});

describe("daily task history", () => {
  it("shows seven zero days when no records exist", () => {
    const history = taskCompletionHistory([],today);
    expect(history.map(d=>d.date)).toEqual(["2026-10-31","2026-11-01","2026-11-02","2026-11-03","2026-11-04","2026-11-05","2026-11-06"]);
    expect(history.every(d=>d.total===0&&d.completed===0&&d.percent===0)).toBe(true);
  });
  it("keeps recurring completion dates separate and ends on the selected day", () => {
    const history=taskCompletionHistory([{...task,date:"2026-11-04",repeat:"daily",completedDates:["2026-11-05","2026-11-07"]},{...task,id:"b",date:"2026-11-05",completedDates:[]}],today);
    expect(history.slice(-3)).toEqual([
      {date:"2026-11-04",total:1,completed:0,percent:0},
      {date:"2026-11-05",total:2,completed:1,percent:50},
      {date:"2026-11-06",total:1,completed:0,percent:0}
    ]);
  });
});
