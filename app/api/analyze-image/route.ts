export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = "qwen/qwen3.6-27b";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const image = typeof body?.image === "string" ? body.image : "";
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    if (!image.startsWith("data:image/")) {
      return Response.json({ error: "Please attach a valid image." }, { status: 400 });
    }
    const key = process.env.GROQ_API_KEY;
    if (!key) return Response.json({ error: "GROQ_API_KEY is not configured." }, { status: 503 });

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 900,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt || "Analyze this image precisely. Describe the subject, composition, environment, lighting, colors, camera perspective, style and notable details. Return a concise factual description suitable for another image generator." },
            { type: "image_url", image_url: { url: image } },
          ],
        }],
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) return Response.json({ error: data?.error?.message || `Groq image analysis failed (${response.status}).` }, { status: 502 });
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) return Response.json({ error: "Groq returned no image analysis." }, { status: 502 });
    return Response.json({ text: text.trim() });
  } catch (error) {
    console.error("Image analysis error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Image analysis failed." }, { status: 500 });
  }
}
