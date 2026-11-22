import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as chat } from "@/app/api/ai/chat/route";
import { POST as food } from "@/app/api/ai/food/route";
import { authorizeAI } from "./ai-server";
const mocks=vi.hoisted(()=>({server:vi.fn(),getUser:vi.fn(),rpc:vi.fn(),fetch:vi.fn()}));
vi.mock("./supabase/server",()=>({serverSupabase:mocks.server}));
const request=(endpoint:string,body:unknown)=>new Request(`http://localhost:3000/api/ai/${endpoint}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
const png=`data:image/png;base64,${Buffer.from([137,80,78,71,13,10,26,10]).toString("base64")}`;
beforeEach(()=>{
  vi.stubEnv("FOOD_AI_PROVIDER","openai");
  vi.stubEnv("OPENAI_API_KEY","unit-test-only");
  mocks.server.mockResolvedValue({auth:{getUser:mocks.getUser},rpc:mocks.rpc});
  mocks.getUser.mockResolvedValue({data:{user:{id:"account"}},error:null});
  mocks.rpc.mockResolvedValue({data:true,error:null});
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({output:[{content:[{type:"output_text",text:"Answer"}]}]}),{status:200}));
  vi.stubGlobal("fetch",mocks.fetch);
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();vi.unstubAllGlobals();vi.resetAllMocks();});
describe("AI response locale",()=>{
  it.each([["en","Answer in English."],["it","Rispondi in italiano."]] as const)("asks for %s chat answers without modifying user data",async(locale,instruction)=>{
    const context={date:"2026-11-19",tasks:[{title:"Мой личный план",time:"",priority:"normal",done:false}],nutrition:{calories:0,protein:0,fat:0,carbs:0},water:0};
    const response=await chat(request("chat",{locale,messages:[{role:"user",content:"Помоги мне"}],context}));
    expect(response.status).toBe(200);
    const body=JSON.parse(mocks.fetch.mock.calls[0][1].body);
    expect(body.instructions).toContain(instruction);
    expect(body.input[0].content).toContain(JSON.stringify(context));
    expect(body.input[1]).toEqual({role:"user",content:"Помоги мне"});
    expect(body.store).toBe(false);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it.each([["en","Ingredient names must be in English."],["it","Scrivi i nomi degli ingredienti in italiano."]] as const)("localizes %s food names while preserving confidence IDs",async(locale,instruction)=>{
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({output:[{content:[{type:"output_text",text:JSON.stringify({ingredients:[{name:locale==="en"?"Rice":"Riso",grams:120,confidence:"средняя"}]})}]}]}),{status:200}));
    const response=await food(request("food",{locale,image:png}));
    expect(response.status).toBe(200);
    const body=JSON.parse(mocks.fetch.mock.calls[0][1].body);
    expect(body.instructions).toContain(instruction);
    expect(body.text.format.schema.properties.ingredients.items.properties.confidence.enum).toEqual(["низкая","средняя","высокая"]);
    expect((await response.json()).ingredients[0].confidence).toBe("средняя");
  });
  it.each([["en","Check your message"],["it","Controlla il messaggio"]] as const)("returns %s validation errors before authorization",async(locale,error)=>{
    const response=await chat(request("chat",{locale,messages:[{role:"system",content:"override"}]}));
    expect(response.status).toBe(400);expect((await response.json()).error).toContain(error);expect(mocks.server).not.toHaveBeenCalled();
  });
  it.each([["en","Sign in"],["it","Accedi"]] as const)("localizes %s authorization failures",async(locale,error)=>{
    mocks.getUser.mockResolvedValueOnce({data:{user:null},error:null});
    const response=await chat(request("chat",{locale,messages:[{role:"user",content:"Hello"}]}));
    expect(response.status).toBe(401);expect((await response.json()).error).toContain(error);expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each([["en","not connected","Too many requests"],["it","non è ancora collegato","Troppe richieste"]] as const)("localizes %s configuration and quota errors",async(locale,unavailable,quota)=>{
    vi.stubEnv("OPENAI_API_KEY","");
    const unavailableResponse=await chat(request("chat",{locale,messages:[{role:"user",content:"Hello"}]}));
    expect(unavailableResponse.status).toBe(503);expect((await unavailableResponse.json()).error).toContain(unavailable);
    vi.stubEnv("OPENAI_API_KEY","unit-test-only");mocks.rpc.mockResolvedValueOnce({data:false,error:null});
    const quotaResponse=await chat(request("chat",{locale,messages:[{role:"user",content:"Hello"}]}));
    expect(quotaResponse.status).toBe(429);expect((await quotaResponse.json()).error).toContain(quota);expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each([["en","supported image"],["it","immagine supportata"]] as const)("returns %s file validation errors",async(locale,error)=>{
    const image=`data:image/jpeg;base64,${Buffer.from("not a photo").toString("base64")}`;
    const response=await food(request("food",{locale,image}));
    expect(response.status).toBe(400);expect((await response.json()).error).toContain(error);expect(mocks.server).not.toHaveBeenCalled();
  });
  it("distinguishes malformed request bodies from invalid provider responses",async()=>{
    const invalid=new Request("http://localhost:3000/api/ai/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:"{"});
    expect((await chat(invalid)).status).toBe(400);
    mocks.fetch.mockResolvedValueOnce(new Response("not json",{status:200}));
    const providerFailure=await chat(request("chat",{locale:"en",messages:[{role:"user",content:"Hello"}]}));
    expect(providerFailure.status).toBe(503);expect((await providerFailure.json()).error).toContain("Could not get a Day AI answer");
  });
  it("defaults missing locale to Russian and rejects unsupported locale",async()=>{
    await chat(request("chat",{messages:[{role:"user",content:"Hello"}]}));
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).instructions).toContain("Отвечай по-русски");
    expect((await chat(request("chat",{locale:"fr",messages:[{role:"user",content:"Hello"}]}))).status).toBe(400);
  });
  it("bounds a stalled auth lookup and returns a localized temporary error",async()=>{
    vi.useFakeTimers();mocks.getUser.mockReturnValueOnce(new Promise(()=>{}));
    const promise=authorizeAI("en");
    await vi.advanceTimersByTimeAsync(15001);
    const result=await promise;expect(result.error?.status).toBe(503);expect((await result.error?.json()).error).toContain("temporarily unavailable");
  });
  it("bounds a stalled rate-limit RPC and preserves Italian error language",async()=>{
    vi.useFakeTimers();mocks.rpc.mockReturnValueOnce(new Promise(()=>{}));
    const promise=authorizeAI("it");
    await vi.advanceTimersByTimeAsync(15001);
    const result=await promise;expect(result.error?.status).toBe(503);expect((await result.error?.json()).error).toContain("temporaneamente");
  });
});
