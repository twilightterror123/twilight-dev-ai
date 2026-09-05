import { InferenceClient } from "@huggingface/inference";

export const runtime = "nodejs";

const MODEL = "black-forest-labs/FLUX.1-schnell";

export async function POST(req: Request) {
  try {
    const token = process.env.HF_TOKEN;
    if (!token) {
      return Response.json(
        { error: "HF_TOKEN is not configured. Add your Hugging Face token in Vercel Environment Variables." },
        { status: 500 },
      );
    }

    const body = await req.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return Response.json({ error: "Please describe the image." }, { status: 400 });
    }

    const client = new InferenceClient(token);
    const image = await client.textToImage({
      model: MODEL,
      provider: "fal-ai",
      inputs: prompt,
      parameters: {
        width: 1024,
        height: 1024,
      },
    });

    const buffer = Buffer.from(await image.arrayBuffer());
    const base64 = buffer.toString("base64");
    const contentType = image.type || "image/png";

    return Response.json({ image: `data:${contentType};base64,${base64}` });
  } catch (error) {
    console.error("Image generation error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Image generation failed." },
      { status: 502 },
    );
  }
}
