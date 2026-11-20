import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { boundedFetch } from "@/lib/network-deadline";
export async function serverSupabase(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!key)return null;const store=await cookies();return createServerClient(url,key,{global:{fetch:boundedFetch},cookies:{getAll(){return store.getAll();},setAll(values){for(const {name,value,options} of values)store.set(name,value,options);}}});}
