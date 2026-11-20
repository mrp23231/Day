import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { connection, exchangeCodeForSession } = vi.hoisted(() => ({
  connection: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ serverSupabase: connection }));

beforeEach(() => {
  connection.mockReset().mockResolvedValue({ auth: { exchangeCodeForSession } });
  exchangeCodeForSession.mockReset().mockResolvedValue({ data: { session: null, user: null }, error: null });
});
afterEach(() => vi.useRealTimers());

describe("authentication callback", () => {
  it("returns failed code exchanges to a retryable settings page", async () => {
    exchangeCodeForSession.mockRejectedValue(new TypeError("Network unavailable"));
    const response = await GET(new Request("https://day.example/auth/callback?code=one-use-code"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://day.example/settings?auth_error=1");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("bounds a stalled exchange instead of leaving the login page loading", async () => {
    vi.useFakeTimers();
    exchangeCodeForSession.mockReturnValue(new Promise(() => {}));
    const pending = GET(new Request("https://day.example/auth/callback?code=one-use-code"));
    await vi.advanceTimersByTimeAsync(15000);
    const response = await pending;
    expect(response.headers.get("location")).toBe("https://day.example/settings?auth_error=1");
  });

  it("preserves recovery after successful code exchange without caching the redirect", async () => {
    const response = await GET(new Request("https://day.example/auth/callback?code=one-use-code&recovery=1"));
    expect(response.headers.get("location")).toBe("https://day.example/settings?recovery=1");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("reports missing cloud configuration without attempting an exchange", async () => {
    connection.mockResolvedValue(null);
    const response = await GET(new Request("https://day.example/auth/callback?code=one-use-code"));
    expect(response.headers.get("location")).toBe("https://day.example/settings?auth_error=1");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
