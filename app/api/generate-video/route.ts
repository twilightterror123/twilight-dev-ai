import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = "grok-imagine-video-1.5";
const API = "https://api.x.ai/v1";

function key() {
  const value = process.env.XAI_API_KEY;
  if (!value) throw new Error("XAI_API_KEY is not configured. Add it to your Vercel Environment Variables.");
  return value;
}

async function xai(path: string, init?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key()}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const image = typeof body.image === "string" && body.image ? body.image : undefined;

    if (!prompt && !image) {
      return Response.json({ error: "Please describe the video." }, { status: 400 });
    }

    const payload: Record<string, unknown> = {
      model: MODEL,
      prompt: prompt || "Animate this image naturally with subtle camera movement.",
      duration: 6,
      aspect_ratio: "16:9",
      resolution: "720p",
      generate_audio: true,
    };

    if (image) payload.image = { url: image };

    const response = await xai("/videos/generations", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok || typeof data?.request_id !== "string") {
      console.error("xAI video start error:", data?.error?.message || response.status);
      return Response.json({ error: data?.error?.message || "Video generation could not be started." }, { status: 502 });
    }

    return Response.json({ requestId: data.request_id, status: "processing" });
  } catch (error) {
    console.error("Video generation start error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Video generation failed." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const requestId = req.nextUrl.searchParams.get("id");
    if (!requestId) return Response.json({ error: "Missing video request id." }, { status: 400 });

    const response = await xai(`/videos/${encodeURIComponent(requestId)}`);
    const data = await response.json();

    if (!response.ok) {
      console.error("xAI video poll error:", data?.error?.message || response.status);
      return Response.json({ error: data?.error?.message || "Could not check video generation status." }, { status: 502 });
    }

    const status = data?.status;
    if (status === "done") {
      const url = data?.video?.url || data?.output?.video?.url || data?.result?.video?.url;
      if (typeof url !== "string") return Response.json({ error: "Video finished but no video URL was returned." }, { status: 502 });
      return Response.json({ status: "done", video: url });
    }

    if (status === "failed" || status === "expired") {
      return Response.json({ status, error: data?.error?.message || `Video generation ${status}.` }, { status: 502 });
    }

    return Response.json({ status: status || "processing" });
  } catch (error) {
    console.error("Video generation poll error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Could not check video generation." }, { status: 500 });
  }
}
