// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyData, readSavedData } from "./domain";
import { appearanceBootstrapScript, resolveTheme } from "./appearance";

afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();delete document.documentElement.dataset.theme;delete document.documentElement.dataset.mode;delete document.documentElement.dataset.background;vi.unstubAllGlobals();});

describe("backward-compatible appearance preferences",()=>{
  it("loads old records without a background preference",()=>{
    const old=JSON.parse(JSON.stringify(emptyData()));
    delete old.preferences.background;
    old.preferences.name="Анна";
    old.water=[{id:"one",date:"2026-11-07",time:"12:30",amount:250}];
    const loaded=readSavedData(JSON.stringify(old));
    expect(loaded.preferences.background).toBe("classic");
    expect(loaded.preferences.name).toBe("Анна");
    expect(loaded.water).toEqual([{id:"one",date:"2026-11-07",time:"12:30",amount:250}]);
  });
  it("preserves an explicit background across saved-state validation",()=>{
    const data=emptyData();
    data.preferences.background="mountains";
    expect(readSavedData(JSON.stringify(data)).preferences.background).toBe("mountains");
  });
  it("rejects arbitrary background values",()=>{
    const data=JSON.parse(JSON.stringify(emptyData()));
    data.preferences.background="url(https://untrusted.test/image)";
    expect(()=>readSavedData(JSON.stringify(data))).toThrow();
  });
});

describe("theme resolution",()=>{
  it("follows the device only in system mode",()=>{
    expect(resolveTheme("system",true)).toBe("dark");
    expect(resolveTheme("system",false)).toBe("light");
    expect(resolveTheme("light",true)).toBe("light");
    expect(resolveTheme("dark",false)).toBe("dark");
  });
});

describe("prepaint appearance bootstrap",()=>{
  it("paints stored appearance before the provider mounts",()=>{
    localStorage.setItem("day-theme","dark");localStorage.setItem("day-background","architecture");
    vi.stubGlobal("matchMedia",()=>({matches:false}));
    new Function(appearanceBootstrapScript)();
    expect(document.documentElement.dataset).toMatchObject({theme:"dark",mode:"dark",background:"architecture"});
  });
  it("ignores malformed values and resolves the device theme",()=>{
    localStorage.setItem("day-theme","unrecognized");localStorage.setItem("day-background","javascript:bad");
    vi.stubGlobal("matchMedia",()=>({matches:true}));
    new Function(appearanceBootstrapScript)();
    expect(document.documentElement.dataset).toMatchObject({theme:"dark",mode:"dark",background:"classic"});
  });
  it("keeps a usable default when browser storage is unavailable",()=>{
    vi.stubGlobal("localStorage",{getItem(){throw new Error("Blocked");}});
    vi.stubGlobal("matchMedia",()=>({matches:false}));
    expect(()=>new Function(appearanceBootstrapScript)()).not.toThrow();
    expect(document.documentElement.dataset).toMatchObject({theme:"light",background:"classic"});
  });
});
