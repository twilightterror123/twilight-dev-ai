export const runtime = "nodejs";
export const maxDuration = 60;

const API = "https://api.x.ai/v1";
const MODEL = "grok-imagine-image-2.0";

const GENERATION_RULES = `You are Twilight's image-generation engine. Follow the user's request as literally and completely as possible. Preserve every explicit subject, object, person, clothing detail, setting, action, composition, camera direction, mood, color, text requirement, aspect ratio, and style requirement. Do not silently replace, omit, invent, or reinterpret requested details. If web research is supplied, use it only to identify real-world subjects accurately; do not copy protected artwork or reproduce a source image. Prefer natural, polished, believable visual quality with coherent anatomy, lighting, perspective, materials, and readable text. Never add watermarks or unrelated elements.`;

function apiKey() {
  const value = process.env.XAI_API_KEY;
  if (!value) throw new Error("XAI_API_KEY is not configured. Add it to your Vercel Environment Variables.");
  return value;
}

async function xai(path: string, init?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
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
      input: `Research the real-world subject(s) in this image request before generation. Search the web when a name, company, product, place, brand, or unfamiliar term appears. Return concise factual visual/context notes only. Do not turn them into a creative prompt. User request: ${prompt}`,
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
    if (!prompt && !image) return Response.json({ error: "Please describe the image." }, { status: 400 });

    const userRequest = prompt || "Create an image based on the attached reference image.";
    const researchNotes = await research(userRequest);
    const finalPrompt = `${GENERATION_RULES}\n\nUSER REQUEST (follow exactly):\n${userRequest}\n\nWEB RESEARCH / SUBJECT CONTEXT (use only for factual identification):\n${researchNotes}`;

    const payload: Record<string, unknown> = {
      model: MODEL,
      prompt: finalPrompt,
      n: 1,
      response_format: "url",
    };
    if (image) payload.image = { url: image };

    const response = await xai("/images/generations", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("xAI image generation error:", data?.error?.message || response.status);
      return Response.json({ error: data?.error?.message || "Image generation failed." }, { status: 502 });
    }

    const result = data?.data?.[0];
    const output = result?.url || result?.b64_json;
    if (typeof output !== "string" || !output) return Response.json({ error: "Image generation returned no image." }, { status: 502 });
    return Response.json({ image: output.startsWith("data:") || output.startsWith("http") ? output : `data:image/png;base64,${output}` });
  } catch (error) {
    console.error("Image generation error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Image generation failed." }, { status: 500 });
  }
}
