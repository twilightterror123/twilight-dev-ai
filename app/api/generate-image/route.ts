export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "qwen/qwen3.6-27b";
const RULES = "Create exactly what the user asks for. Preserve the explicit subject, objects, setting, action, composition, camera direction, mood, colors, style, and visible text. Use research only to improve factual detail. Prefer a clean, polished, coherent result with natural lighting and believable details. No unrelated objects, captions, borders, UI or watermark unless explicitly requested.";

async function improvePrompt(prompt: string, research: string) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return prompt;
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.25,
        max_tokens: 900,
        messages: [{
          role: "system",
          content: "You improve prompts for a general image generator. Do not change the user's requested subject or intent. Return only one polished image prompt, no preamble.",
        }, {
          role: "user",
          content: `${RULES}\n\nUSER REQUEST:\n${prompt}\n\nWEB RESEARCH:\n${research || "None"}`,
        }],
      }),
    });
    const data = await response.json().catch(() => ({}));
    const text = data?.choices?.[0]?.message?.content;
    return response.ok && typeof text === "string" && text.trim() ? text.trim() : prompt;
  } catch {
    return prompt;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const research = typeof body?.research === "string" ? body.research.slice(0, 6000) : "";
    if (!prompt) return Response.json({ error: "Please describe the image." }, { status: 400 });

    const enhancedPrompt = await improvePrompt(prompt, research);
    const apiKey = process.env.POLLINATIONS_API_KEY;
    if (apiKey) {
      const url = `https://gen.pollinations.ai/image/${encodeURIComponent(enhancedPrompt)}?model=flux&width=1024&height=1024&safe=true&seed=${Date.now()}`;
      const upstream = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}`, Accept: "image/*" }, cache: "no-store" });
      if (!upstream.ok) {
        const detail = await upstream.text().catch(() => "");
        return Response.json({ error: detail || `Image generation failed (${upstream.status}).` }, { status: 502 });
      }
      const buffer = await upstream.arrayBuffer();
      return new Response(buffer, { headers: { "Content-Type": upstream.headers.get("content-type") || "image/png", "Cache-Control": "no-store" } });
    }

    const legacyUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(`${RULES}\n\n${enhancedPrompt}`)}?width=1024&height=1024&model=flux&safe=true&nologo=false&seed=${Date.now()}`;
    return Response.json({ image: legacyUrl });
  } catch (error) {
    console.error("Image generation error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Image generation failed." }, { status: 500 });
  }
}
