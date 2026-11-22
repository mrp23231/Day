import { NextResponse } from "next/server";
import { serverSupabase } from "./supabase/server";
import { getTranslator, type Locale } from "./i18n";
import { withNetworkDeadline } from "./network-deadline";

export function apiError(message:string,status=400,locale:Locale="ru") {
  return NextResponse.json({error:getTranslator(locale)(message)},{status,headers:{"Cache-Control":"no-store"}});
}

export async function authorizeAI(locale:Locale="ru",configuration?:{configured:boolean;unavailableMessage:string}) {
  const configured=configuration?.configured??Boolean(process.env.OPENAI_API_KEY);
  if(!configured)return {error:apiError(configuration?.unavailableMessage??"Day AI пока не подключён. Для работы нужен ключ OpenAI на сервере. Остальные функции Day доступны.",503,locale)};
  try {
    const client=await withNetworkDeadline(serverSupabase());
    if(!client)return {error:apiError("Сначала нужно подключить облачный аккаунт Day.",503,locale)};
    const {data:{user},error}=await withNetworkDeadline(client.auth.getUser());
    if(error||!user)return {error:apiError("Войдите в аккаунт, чтобы использовать Day AI.",401,locale)};
    const limit=await withNetworkDeadline(client.rpc("consume_ai_request"));
    if(limit.error)return {error:apiError("Сервис временно недоступен. Попробуйте позже.",503,locale)};
    if(!limit.data)return {error:apiError("Слишком много запросов. Сделайте небольшую паузу и попробуйте через 10 минут.",429,locale)};
    return {user};
  } catch {
    return {error:apiError("Сервис временно недоступен. Попробуйте позже.",503,locale)};
  }
}
export async function limitedJson(request:Request,maxBytes:number):Promise<unknown>{const length=Number(request.headers.get("content-length")||0);if(length>maxBytes)throw new Error("size");if(!request.body)throw new Error("empty");const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new Error("size");}chunks.push(value);}}finally{reader.releaseLock();}return JSON.parse(Buffer.concat(chunks).toString("utf8"));}
export async function openAIResponse(body:Record<string,unknown>):Promise<string>{const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4.1-mini",store:false,...body}),signal:AbortSignal.timeout(35000),cache:"no-store"});if(!response.ok)throw new Error("AI service unavailable");const result=await response.json();const text=(result.output||[]).flatMap((item:{content?:{type:string;text?:string}[]})=>item.content||[]).filter((content:{type:string})=>content.type==="output_text").map((content:{text:string})=>content.text).join("\n");if(!text)throw new Error("Empty AI response");return text;}
