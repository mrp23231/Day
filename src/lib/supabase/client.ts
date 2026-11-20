"use client";
import { createBrowserClient } from "@supabase/ssr";
import { boundedFetch } from "@/lib/network-deadline";
let client: ReturnType<typeof createBrowserClient> | null = null;
export function getSupabase() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return null;
  if(!client)client=createBrowserClient(url,key,{global:{fetch:boundedFetch}});
  return client;
}
