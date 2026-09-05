export const runtime = "nodejs";

const MODEL = "gpt-image-2";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "OPENAI_API_KEY is not configured." }, { status: 500 });
    }

    const body = await req.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return Response.json({ error: "Please describe the image." }, { status: 400 });
    }

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        size: "1024x1024",
        quality: "auto",
        output_format: "png",
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Image provider error:", data?.error?.message || response.status);
      return Response.json({ error: data?.error?.message || "Image generation failed." }, { status: 502 });
    }

    const base64 = data?.data?.[0]?.b64_json;
    if (!base64) {
      return Response.json({ error: "No image was returned." }, { status: 502 });
    }

    return Response.json({ image: `data:image/png;base64,${base64}` });
  } catch (error) {
    console.error("Image route error:", error);
    return Response.json({ error: "Something went wrong while generating the image." }, { status: 500 });
  }
}
