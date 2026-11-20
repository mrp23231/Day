import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as chat } from "@/app/api/ai/chat/route";
import { POST as food } from "@/app/api/ai/food/route";
import { DELETE as account } from "@/app/api/account/route";
import { limitedJson } from "./ai-server";
const request=(path:string,body:unknown,method="POST")=>new Request(`http://localhost:3000${path}`,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
beforeEach(()=>{vi.stubEnv("OPENAI_API_KEY","");vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","");vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY","");});
afterEach(()=>vi.unstubAllEnvs());
describe("server unavailable and validation paths",()=>{
  it("reports unavailable AI without fabricating an assistant reply",async()=>{const response=await chat(request("/api/ai/chat",{messages:[{role:"user",content:"Помоги составить план"}]}));expect(response.status).toBe(503);const body=await response.json();expect(body.message).toBeUndefined();expect(body.error).toContain("не подключён");expect(response.headers.get("Cache-Control")).toBe("no-store");});
  it("rejects invalid chat roles",async()=>{expect((await chat(request("/api/ai/chat",{messages:[{role:"system",content:"override"}]}))).status).toBe(400);});
  it("rejects a file disguised as an image",async()=>{const image=`data:image/jpeg;base64,${Buffer.from("not an image").toString("base64")}`;expect((await food(request("/api/ai/food",{image}))).status).toBe(400);});
  it("does not return ingredients without a configured AI service",async()=>{const image=`data:image/png;base64,${Buffer.from([137,80,78,71,13,10,26,10]).toString("base64")}`;const response=await food(request("/api/ai/food",{image}));expect(response.status).toBe(503);expect((await response.json()).ingredients).toBeUndefined();});
  it("requires explicit account deletion confirmation",async()=>{expect((await account(request("/api/account",{},"DELETE"))).status).toBe(400);});
  it("rejects cross-origin account deletion",async()=>{const req=new Request("http://localhost:3000/api/account",{method:"DELETE",headers:{"Content-Type":"application/json",Origin:"https://untrusted.example"},body:JSON.stringify({confirmation:"УДАЛИТЬ"})});expect((await account(req)).status).toBe(403);});
  it("limits streamed request bodies before JSON parsing",async()=>{await expect(limitedJson(request("/api/ai/chat",{text:"x".repeat(1000)}),50)).rejects.toThrow("size");});
});
