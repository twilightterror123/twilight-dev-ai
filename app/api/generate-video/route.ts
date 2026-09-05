export const runtime = "nodejs";

const MODEL = "veo-3.1-generate-preview";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "GEMINI_API_KEY is not configured." }, { status: 500 });
    }

    const body = await req.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) return Response.json({ error: "Please describe the video." }, { status: 400 });

    const start = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:predictLongRunning`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({ instances: [{ prompt }], parameters: { numberOfVideos: 1, resolution: "720p" } }),
    });

    const operation = await start.json();
    if (!start.ok || !operation?.name) {
      console.error("Video start error:", operation?.error?.message || start.status);
      return Response.json({ error: "Video generation could not be started." }, { status: 502 });
    }

    for (let i = 0; i < 36; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const statusResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${operation.name}`, {
        headers: { "x-goog-api-key": apiKey },
      });
      const status = await statusResponse.json();

      if (status.done) {
        if (status.error) {
          console.error("Video generation error:", status.error.message || status.error);
          return Response.json({ error: "Video generation failed." }, { status: 502 });
        }
        const video = status?.response?.generateVideoResponse?.generatedSamples?.[0]?.video;
        if (!video?.uri) return Response.json({ error: "No video was returned." }, { status: 502 });

        const videoResponse = await fetch(video.uri, { headers: { "x-goog-api-key": apiKey } });
        if (!videoResponse.ok) return Response.json({ error: "Generated video could not be downloaded." }, { status: 502 });
        const bytes = await videoResponse.arrayBuffer();
        const base64 = Buffer.from(bytes).toString("base64");
        return Response.json({ video: `data:video/mp4;base64,${base64}` });
      }
    }

    return Response.json({ error: "Video generation is taking too long. Please try again." }, { status: 504 });
  } catch (error) {
    console.error("Video route error:", error);
    return Response.json({ error: "Something went wrong while generating the video." }, { status: 500 });
  }
}
