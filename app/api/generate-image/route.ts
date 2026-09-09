export const runtime = "nodejs";
export const maxDuration = 30;

const RULES = "Create exactly what the user asks for. Preserve the explicit subject, objects, setting, action, composition, camera direction, mood, colors, style, and text. Use web context only to improve factual detail. Prefer clean, polished, coherent results with natural lighting and believable details. Do not add unrelated elements or watermarks.";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const research = typeof body?.research === "string" ? body.research.slice(0, 6000) : "";
    if (!prompt) return Response.json({ error: "Please describe the image." }, { status: 400 });
    const finalPrompt = `${RULES}\n\nUSER REQUEST:\n${prompt}\n\nWEB RESEARCH:\n${research || "No web results available."}`;
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=1024&height=1024&model=flux&safe=true&nologo=false&seed=${Date.now()}`;
    return Response.json({ image: url });
  } catch (error) {
    console.error("Image generation error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Image generation failed." }, { status: 500 });
  }
}
