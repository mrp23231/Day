import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { withNetworkDeadline } from "@/lib/network-deadline";
import { authCallbackFailure } from "@/features/auth/callback-errors";

export async function GET(request: Request) {
  const url = new URL(request.url);
  let destination = "/settings?auth_error=1";
  try {
    const failure = authCallbackFailure(url.searchParams);
    if (failure) {
      destination = `/settings?auth_error=${failure}`;
    } else {
      const code = url.searchParams.get("code");
      const client = code ? await serverSupabase() : null;
      if (code && client) {
        const { error } = await withNetworkDeadline(client.auth.exchangeCodeForSession(code));
        if (!error) destination = url.searchParams.get("recovery") === "1" ? "/settings?recovery=1" : "/settings";
      }
    }
  } catch {
    // Failed or timed-out exchanges must leave the user a usable retry path.
  }
  const response = NextResponse.redirect(new URL(destination, url.origin));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
