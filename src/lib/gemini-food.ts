import { z } from "zod";

// These are estimates for the entire visible ingredient portion, never per 100 g.
const nutrient = z.number().min(0).max(50000).optional();
export const foodEstimateSchema = z.object({
  ingredients: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    grams: z.number().min(1).max(10000),
    confidence: z.enum(["низкая", "средняя", "высокая"]),
    calories: nutrient, protein: nutrient, fat: nutrient, carbs: nutrient,
  })).max(20),
});

export const foodEstimateJsonSchema = {
  type: "object",
  properties: {
    ingredients: {
      // Keep the provider grammar compact. Gemini rejects nested bounded optional
      // values as too many constraint states; foodEstimateSchema enforces bounds.
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          grams: { type: "number" },
          confidence: { type: "string", enum: ["низкая", "средняя", "высокая"] },
          ...Object.fromEntries(["calories", "protein", "fat", "carbs"].map((key) => [key, { type: "number" }])),
        },
        required: ["name", "grams", "confidence"], additionalProperties: false,
      },
    },
  },
  required: ["ingredients"], additionalProperties: false,
};

export class GeminiFoodError extends Error {
  constructor(readonly status: 429 | 503) {
    super(status === 429 ? "Food recognition quota exceeded" : "Food recognition unavailable");
  }
}

const geminiEnvelope = z.object({
  candidates: z.array(z.object({
    finishReason: z.literal("STOP"),
    content: z.object({ parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional() })) }),
  })).min(1),
});

export async function geminiFoodResponse(input: {
  key: string; model: string; mime: string; base64: string; instructions: string; prompt: string;
}): Promise<string> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${input.model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": input.key, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.instructions }] },
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: input.mime, data: input.base64 } }, { text: input.prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseJsonSchema: foodEstimateJsonSchema, maxOutputTokens: 4096 },
    }),
    signal: AbortSignal.timeout(35000), cache: "no-store",
  });
  if (!response.ok) throw new GeminiFoodError(response.status === 429 ? 429 : 503);
  const parsed = geminiEnvelope.safeParse(await response.json());
  if (!parsed.success) throw new GeminiFoodError(503);
  const text = parsed.data.candidates[0].content.parts.filter((part) => !part.thought && part.text).map((part) => part.text).join("\n").trim();
  if (!text) throw new GeminiFoodError(503);
  return text;
}
