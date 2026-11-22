import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ai/food/route";

const mocks = vi.hoisted(() => ({ server: vi.fn(), getUser: vi.fn(), rpc: vi.fn(), fetch: vi.fn() }));
vi.mock("./supabase/server", () => ({ serverSupabase: mocks.server }));

const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const image = `data:image/png;base64,${bytes.toString("base64")}`;
const rice = { name: "Rice", grams: 150, confidence: "средняя", calories: 195, protein: 4, fat: 0.5, carbs: 42 };
const request = (body: unknown) => new Request("http://localhost:3000/api/ai/food", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const geminiResponse = (value: unknown) => new Response(JSON.stringify({
  candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(value) }] } }],
}), { status: 200 });

beforeEach(() => {
  vi.stubEnv("FOOD_AI_PROVIDER", "");
  vi.stubEnv("GEMINI_API_KEY", "server-test-only");
  vi.stubEnv("GEMINI_FOOD_MODEL", "");
  vi.stubEnv("OPENAI_API_KEY", "");
  mocks.server.mockResolvedValue({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc });
  mocks.getUser.mockResolvedValue({ data: { user: { id: "current-account" } }, error: null });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.fetch.mockResolvedValue(geminiResponse({ ingredients: [rice] }));
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetAllMocks(); });

describe("food photo recognition with Gemini", () => {
  it("uses server-only Gemini by default without an OpenAI key and returns reviewable portion estimates", async () => {
    const response = await POST(request({ image, locale: "en" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ingredients: [rice] });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const [url, options] = mocks.fetch.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent");
    expect(url).not.toContain("server-test-only");
    expect(options.headers).toMatchObject({ "x-goog-api-key": "server-test-only" });
    expect(options.cache).toBe("no-store");
    expect(options.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(options.body);
    expect(body.contents[0].parts).toContainEqual({ inlineData: { mimeType: "image/png", data: bytes.toString("base64") } });
    expect(body.systemInstruction.parts[0].text).toContain("Ingredient names must be in English.");
    expect(body.systemInstruction.parts[0].text).toContain("visible ingredient portion");
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseJsonSchema.properties.ingredients.items.properties.confidence.enum).toEqual(["низкая", "средняя", "высокая"]);
    expect(mocks.rpc).toHaveBeenCalledWith("consume_ai_request");
  });

  it("includes a bounded user hint as data while keeping the image and instructions separate", async () => {
    const response = await POST(request({ image, locale: "it", hint: "  Una ciotola, circa 250 ml  " }));
    expect(response.status).toBe(200);
    const body = JSON.parse(mocks.fetch.mock.calls[0][1].body);
    expect(body.contents[0].parts.find((part: { text?: string }) => part.text)?.text).toContain(JSON.stringify("Una ciotola, circa 250 ml"));
    expect(body.systemInstruction.parts[0].text).toContain("Scrivi i nomi degli ingredienti in italiano.");
    expect(body.systemInstruction.parts[0].text).toContain("not instructions");
  });

  it("keeps the provider schema compact to avoid Gemini constraint-state rejection", async () => {
    const response=await POST(request({image}));
    expect(response.status).toBe(200);
    const schema=JSON.stringify(JSON.parse(mocks.fetch.mock.calls[0][1].body).generationConfig.responseJsonSchema);
    // A live image request rejects the combined optional fields and nested bounded values.
    // Response bounds remain enforced by foodEstimateSchema after parsing, tested below.
    expect(schema).not.toMatch(/"(?:minimum|maximum|minLength|maxLength|maxItems)"/);
  });

  it("rejects an overlong hint before accessing auth or the provider", async () => {
    const response = await POST(request({ image, locale: "en", hint: "x".repeat(501) }));
    expect(response.status).toBe(400);
    expect(mocks.server).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("does not silently fall back to a configured paid provider when Gemini is missing", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "present-but-not-selected");
    const response = await POST(request({ image, locale: "en" }));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("Photo recognition is not available yet. Add food manually or try again later.");
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.server).not.toHaveBeenCalled();
  });

  it("does not send any photo to Gemini before successful authentication", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await POST(request({ image, locale: "en" }));
    expect(response.status).toBe(401);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("enforces the existing account quota before contacting Gemini", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    const response = await POST(request({ image }));
    expect(response.status).toBe(429);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("returns a localized free-quota error for Gemini 429 without a second provider call", async () => {
    mocks.fetch.mockResolvedValue(new Response("quota", { status: 429 }));
    vi.stubEnv("OPENAI_API_KEY", "present-but-not-selected");
    const response = await POST(request({ image, locale: "en" }));
    expect(response.status).toBe(429);
    expect((await response.json()).error).toContain("quota");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it.each(["unknown", "gemini/../../other"])("rejects unsupported provider configuration %s", async (provider) => {
    vi.stubEnv("FOOD_AI_PROVIDER", provider);
    const response = await POST(request({ image }));
    expect(response.status).toBe(503);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects a model name containing path injection", async () => {
    vi.stubEnv("GEMINI_FOOD_MODEL", "../arbitrary-endpoint");
    const response = await POST(request({ image }));
    expect(response.status).toBe(503);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each([
    { ingredients: [{ ...rice, grams: 0 }] },
    { ingredients: [{ ...rice, calories: -1 }] },
    { ingredients: [{ ...rice, protein: 50001 }] },
    { ingredients: [{ ...rice, carbs: "42" }] },
    { ingredients: [{ ...rice, confidence: "certain" }] },
    { ingredients: [] },
  ])("rejects unreviewable or out-of-bounds estimates %#", async (value) => {
    mocks.fetch.mockResolvedValue(geminiResponse(value));
    const response = await POST(request({ image }));
    expect(response.status).toBe(422);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("keeps legacy ingredient-only estimates valid without inventing missing macros", async () => {
    const ingredient = { name: "Rice", grams: 150, confidence: "низкая" };
    mocks.fetch.mockResolvedValue(geminiResponse({ ingredients: [ingredient] }));
    const response = await POST(request({ image }));
    expect(response.status).toBe(200);
    expect((await response.json()).ingredients).toEqual([ingredient]);
  });

  it.each([
    new Response("not json", { status: 200 }),
    new Response(JSON.stringify({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: JSON.stringify({ ingredients: [rice] }) }] } }] }), { status: 200 }),
    new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ thought: true, text: "private reasoning" }] } }] }), { status: 200 }),
    new Response("service error", { status: 500 }),
  ])("returns an honest temporary error for invalid provider response %#", async (response) => {
    mocks.fetch.mockResolvedValue(response);
    const result = await POST(request({ image }));
    expect(result.status).toBe(503);
    expect((await result.json()).error).not.toContain("private reasoning");
  });

  it("keeps OpenAI an explicit opt-in for existing installations", async () => {
    vi.stubEnv("FOOD_AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "openai-test-only");
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: JSON.stringify({ ingredients: [rice] }) }] }] }), { status: 200 }));
    const response = await POST(request({ image }));
    expect(response.status).toBe(200);
    expect(mocks.fetch.mock.calls[0][0]).toBe("https://api.openai.com/v1/responses");
  });

  it("preserves image magic-byte validation before configuration and authentication", async () => {
    const response = await POST(request({ image: `data:image/jpeg;base64,${Buffer.from("fake").toString("base64")}` }));
    expect(response.status).toBe(400);
    expect(mocks.server).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects decoded photos above 5 MB without sending them anywhere", async () => {
    const large = Buffer.alloc(5 * 1024 * 1024 + 1);
    bytes.copy(large);
    const response = await POST(request({ image: `data:image/png;base64,${large.toString("base64")}` }));
    expect(response.status).toBe(413);
    expect(mocks.server).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
