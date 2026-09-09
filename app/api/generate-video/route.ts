export const runtime = "nodejs";
export const maxDuration = 60;

const VIDEO_API = "https://video.pollinations.ai/generate";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const research = typeof body?.research === "string" ? body.research.slice(0, 6000) : "";
    if (!prompt) return Response.json({ error: "Please describe the video." }, { status: 400 });

    const finalPrompt = `${prompt}. Use this web research only where relevant: ${research}. Clean professional result, coherent motion and lighting, no unrelated elements.`;
    const upstream = await fetch(VIDEO_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "video/mp4,video/*,*/*" },
      body: JSON.stringify({ prompt: finalPrompt, model: "video-gen", duration: 4, resolution: "360p" }),
      cache: "no-store",
    });

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
