import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const VIDEO_API = "https://video.pollinations.ai/generate";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) return Response.json({ error: "Please describe the video." }, { status: 400 });

    const response = await fetch(VIDEO_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: `${prompt}. Clean professional result, coherent motion and lighting, no unrelated elements.`,
        model: "video-gen",
        duration: 4,
        resolution: "360p",
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return Response.json({ error: detail || `Video generation failed (${response.status}).` }, { status: 502 });
    }

    const buffer = await response.arrayBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type": response.headers.get("content-type") || "video/mp4",
        "Cache-Control": "no-store",
        "Content-Disposition": "inline; filename=twilight-video.mp4",
      },
    });
  } catch (error) {
    console.error("Video generation error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Video generation failed." }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  return Response.json({
    error: "Video generation is started from the client using the public legacy endpoint.",
    request: req.nextUrl.pathname,
  }, { status: 405 });
}
