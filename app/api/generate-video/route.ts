export const runtime = "nodejs";
export const maxDuration = 120;

async function callVideo(prompt: string, apiKey: string) {
  const url = `https://gen.pollinations.ai/video/${encodeURIComponent(prompt)}?model=veo&duration=4`;
  return fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "video/mp4,video/*,*/*" },
    cache: "no-store",
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const research = typeof body?.research === "string" ? body.research.slice(0, 5000) : "";
    if (!prompt) return Response.json({ error: "Please describe the video." }, { status: 400 });

    const finalPrompt = `${prompt}. Use relevant web research only for factual detail. Clean professional result, coherent motion, stable camera, natural lighting, consistent subjects, no unrelated elements.` + (research ? `\nResearch: ${research}` : "");
    const key = process.env.POLLINATIONS_API_KEY;

    if (!key) {
      return Response.json({ error: "Video generation needs POLLINATIONS_API_KEY in Vercel Environment Variables." }, { status: 503 });
    }

    const upstream = await callVideo(finalPrompt, key);
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      return Response.json({ error: detail || `Video generation failed (${upstream.status}).` }, { status: 502 });
    }

    const buffer = await upstream.arrayBuffer();
    if (!buffer.byteLength) return Response.json({ error: "Video service returned an empty file." }, { status: 502 });
    return new Response(buffer, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "video/mp4",
        "Cache-Control": "no-store",
        "Content-Disposition": "inline; filename=zyntra-video.mp4",
      },
    });
  } catch (error) {
    console.error("Video generation error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Video generation failed." }, { status: 502 });
  }
}
