import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { withNetworkDeadline } from "@/lib/network-deadline";

export async function GET(request: Request) {
  const url = new URL(request.url);
  let destination = "/settings?auth_error=1";
  try {
    const code = url.searchParams.get("code");
    const client = await serverSupabase();
    if (code && client) {
      const { error } = await withNetworkDeadline(client.auth.exchangeCodeForSession(code));
      if (!error) destination = url.searchParams.get("recovery") === "1" ? "/settings?recovery=1" : "/settings";
    }
  } catch {
    // Failed or timed-out exchanges must leave the user a usable retry path.
  }
  const response = NextResponse.redirect(new URL(destination, url.origin));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
