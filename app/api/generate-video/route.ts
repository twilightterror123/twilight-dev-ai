import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "grok-imagine-video-1.5";
const API = "https://api.x.ai/v1";

const GENERATION_RULES = `You are Twilight's video-generation engine. Follow the user's request as literally and completely as possible. Preserve every explicit subject, object, person, clothing detail, setting, action, dialogue or text requirement, camera movement, timing, mood, color, composition, aspect ratio, and style requirement. Do not silently replace, omit, invent, or reinterpret requested details. Keep motion physically coherent, characters consistent, anatomy stable, lighting consistent, and transitions natural. If web research is supplied, use it only to identify real-world subjects accurately. Never add watermarks or unrelated elements.`;

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

async function research(prompt: string) {
  const response = await xai("/responses", {
    method: "POST",
    body: JSON.stringify({
      model: "grok-4.6",
      input: `Research the real-world subject(s) in this video request before generation. Search the web when a name, company, product, place, brand, or unfamiliar term appears. Return concise factual visual/context notes only. Do not turn them into a creative prompt. User request: ${prompt}`,
      tools: [{ type: "web_search" }],
      store: false,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("xAI web research error:", data?.error?.message || response.status);
    return "No web research was available. Rely on the user's explicit request.";
  }

  const texts: string[] = [];
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    if (item?.type !== "message") continue;
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === "output_text" && typeof content.text === "string") texts.push(content.text);
    }
  }
  return texts.join("\n").slice(0, 12000) || "No web research was available. Rely on the user's explicit request.";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const image = typeof body.image === "string" && body.image ? body.image : undefined;
    if (!prompt && !image) return Response.json({ error: "Please describe the video." }, { status: 400 });

    const userRequest = prompt || "Animate the attached image naturally with subtle camera movement.";
    const researchNotes = await research(userRequest);
    const finalPrompt = `${GENERATION_RULES}\n\nUSER REQUEST (follow exactly):\n${userRequest}\n\nWEB RESEARCH / SUBJECT CONTEXT (use only for factual identification):\n${researchNotes}`;

    const payload: Record<string, unknown> = {
      model: MODEL,
      prompt: finalPrompt,
      duration: 6,
      aspect_ratio: "16:9",
      resolution: "720p",
      generate_audio: true,
    };
    if (image) payload.image = { url: image };

    const response = await xai("/videos/generations", { method: "POST", body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
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
    const data = await response.json().catch(() => ({}));
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
    if (status === "failed" || status === "expired") return Response.json({ status, error: data?.error?.message || `Video generation ${status}.` }, { status: 502 });
    return Response.json({ status: status || "processing" });
  } catch (error) {
    console.error("Video generation poll error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Could not check video generation." }, { status: 500 });
  }
}
