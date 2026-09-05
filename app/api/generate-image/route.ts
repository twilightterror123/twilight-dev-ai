export const runtime = "nodejs";

const MODEL = "gemini-3-pro-image";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "GEMINI_API_KEY is not configured." }, { status: 500 });
    }

    const body = await req.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) return Response.json({ error: "Please describe the image." }, { status: 400 });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Image provider error:", data?.error?.message || response.status);
      return Response.json({ error: "Image generation failed." }, { status: 502 });
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((part: any) => part?.inlineData?.data);
    if (!imagePart?.inlineData?.data) {
      return Response.json({ error: "No image was returned." }, { status: 502 });
    }

    const mime = imagePart.inlineData.mimeType || "image/png";
    return Response.json({ image: `data:${mime};base64,${imagePart.inlineData.data}` });
  } catch (error) {
    console.error("Image route error:", error);
    return Response.json({ error: "Something went wrong while generating the image." }, { status: 500 });
  }
}
