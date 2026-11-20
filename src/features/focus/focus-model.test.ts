import { describe, expect, it } from "vitest";
import type { Task } from "@/lib/domain";
import { createFocusSession, focusRemaining, pauseFocusSession, restoreFocusSession, resumeFocusSession, settleFocusSession } from "./focus-model";

const now = new Date(2026, 10, 8, 10).getTime();
const date = "2026-11-08";
const task: Task = { id:"one", title:"Подготовить проект", description:"", date, time:"11:00", priority:"normal", category:"Работа", repeat:"none", completedDates:[] };
const make = (mode:"now"|"wait"="now") => createFocusSession({scope:"guest",task,occurrenceDate:date,minutes:25,now,mode});

describe("focus timestamps", () => {
  it("derives elapsed work from timestamps after backgrounding instead of timer ticks", () => {
    const session = make();
    expect(focusRemaining(session, now+7*60_000+999)).toBe(18*60_000-999);
    expect(focusRemaining(session, now+30*60_000)).toBe(0);
    expect(settleFocusSession(session, now+30*60_000).phase).toBe("finished");
    expect(task.completedDates).toEqual([]);
  });
  it("freezes the remaining time on pause and resumes from that remainder", () => {
    const paused=pauseFocusSession(make(),now+5*60_000);
    expect(paused.phase).toBe("paused");
    expect(focusRemaining(paused,now+90*60_000)).toBe(20*60_000);
    const resumed=resumeFocusSession(paused,now+90*60_000);
    expect(focusRemaining(resumed,now+93*60_000)).toBe(17*60_000);
  });
  it("counts down to a local task time but requires an explicit start after reaching it", () => {
    const waiting=make("wait");
    expect(focusRemaining(waiting,now)).toBe(60*60_000);
    expect(settleFocusSession(waiting,now+61*60_000).phase).toBe("waiting");
    expect(focusRemaining(waiting,now+61*60_000)).toBe(0);
    expect(focusRemaining(resumeFocusSession(waiting,now+61*60_000),now+62*60_000)).toBe(24*60_000);
  });
  it("does not gain time when the system clock moves backwards", () => {
    expect(focusRemaining(make(),now-60_000)).toBe(25*60_000);
  });
  it("rejects out of range durations, finished occurrences and non-today starts", () => {
    expect(()=>createFocusSession({scope:"guest",task,occurrenceDate:date,minutes:1,now,mode:"now"})).toThrow();
    expect(()=>createFocusSession({scope:"guest",task:{...task,completedDates:[date]},occurrenceDate:date,minutes:25,now,mode:"now"})).toThrow();
    expect(()=>createFocusSession({scope:"guest",task:{...task,date:"2026-11-09"},occurrenceDate:"2026-11-09",minutes:25,now,mode:"now"})).toThrow();
  });
});

describe("restoring a focus session", () => {
  it("restores a paused session and settles elapsed running sessions without completing a task", () => {
    const paused=pauseFocusSession(make(),now+2*60_000);
    expect(restoreFocusSession(JSON.stringify(paused),"guest",[task],now+40*60_000)?.remainingMs).toBe(23*60_000);
    expect(restoreFocusSession(JSON.stringify(make()),"guest",[task],now+40*60_000)?.phase).toBe("finished");
    expect(task.completedDates).toEqual([]);
  });
  it("isolates accounts and rejects malformed, removed, completed or rescheduled tasks", () => {
    const raw=JSON.stringify(make());
    expect(restoreFocusSession(raw,"account-2",[task],now)).toBeNull();
    expect(restoreFocusSession("not-json","guest",[task],now)).toBeNull();
    expect(restoreFocusSession(raw,"guest",[],now)).toBeNull();
    expect(restoreFocusSession(raw,"guest",[{...task,completedDates:[date]}],now)).toBeNull();
    expect(restoreFocusSession(raw,"guest",[{...task,date:"2026-11-09"}],now)).toBeNull();
    expect(restoreFocusSession(JSON.stringify({...make(),remainingMs:99_999_999}),"guest",[task],now)).toBeNull();
  });
  it("invalidates a waiting countdown when the scheduled task time changes", () => {
    expect(restoreFocusSession(JSON.stringify(make("wait")),"guest",[{...task,time:"12:00"}],now)).toBeNull();
  });
  it("keeps the recurring occurrence across midnight without moving completion to the new day", () => {
    const late=new Date(2026,10,8,23,55).getTime();
    const recurring={...task,repeat:"daily" as const,date:"2026-11-01"};
    const session=createFocusSession({scope:"guest",task:recurring,occurrenceDate:date,minutes:25,now:late,mode:"now"});
    const restored=restoreFocusSession(JSON.stringify(session),"guest",[recurring],late+10*60_000);
    expect(restored?.occurrenceDate).toBe(date);
    expect(restored && focusRemaining(restored,late+10*60_000)).toBe(15*60_000);
  });
  it("expires abandoned sessions after 24 hours and rejects impossible future creation times", () => {
    expect(restoreFocusSession(JSON.stringify(make()),"guest",[task],now+24*60*60_000+1)).toBeNull();
    expect(restoreFocusSession(JSON.stringify({...make(),createdAt:now+60_000}),"guest",[task],now)).toBeNull();
  });
});
