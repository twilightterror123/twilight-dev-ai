export const runtime = "nodejs";
export const maxDuration = 30;

const GENERATION_RULES = `Create exactly what the user asks for. Preserve explicit subjects, objects, setting, action, composition, camera direction, mood, colors, style, and text requirements. Prefer clean, polished, coherent results with natural lighting and believable details. Do not add unrelated elements or watermarks.`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) return Response.json({ error: "Please describe the image." }, { status: 400 });

    const finalPrompt = `${GENERATION_RULES}\n\nUSER REQUEST:\n${prompt}`;
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=1024&height=1024&model=flux&safe=true&nologo=false`;

    return Response.json({ image: url, provider: "public-keyless-image" });
  } catch (error) {
    console.error("Image generation error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Image generation failed." }, { status: 500 });
  }
}
