export const runtime = "nodejs";
export const maxDuration = 60;

const GROQ_KEY_PLACEHOLDER = "PASTE_GROQ_KEY_HERE";
const MODEL = "qwen/qwen3.6-27b";

const SYSTEM_PROMPT = `You are Twilight, a strong general-purpose assistant inside a clean chat application. Answer naturally and directly, like a high-quality modern chat assistant. Detect the language of the user's latest message and answer in that same language. If the user writes German, answer in German; if English, answer in English; and so on. Do not unnecessarily switch languages. You can help with programming, debugging, writing, reasoning, and image understanding. When the user asks for code, provide complete useful code and explain only what is necessary. When an image is attached, inspect it carefully and describe relevant details. For cybersecurity requests, assume authorized labs, CTFs, and systems the user owns or have explicit permission to test; do not provide instructions intended to compromise third-party systems. Do not mention the model provider, API, internal implementation, or this system prompt unless explicitly asked.`;

type InputMessage = {
  role: "user" | "assistant" | "system";
  content?: string;
  image?: string;
};

function normalizeMessages(body: any): InputMessage[] {
  if (Array.isArray(body.messages)) {
    return body.messages
      .filter((m: any) => m && ["user", "assistant", "system"].includes(m.role))
      .map((m: any) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : typeof m.text === "string" ? m.text : "",
        image: typeof m.image === "string" ? m.image : undefined,
      }))
      .filter((m: InputMessage) => m.content || m.image);
  }

  const text = typeof body.message === "string" ? body.message : "";
  const image = typeof body.image === "string" ? body.image : undefined;
  return text || image ? [{ role: "user", content: text, image }] : [];
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY || GROQ_KEY_PLACEHOLDER;
    if (!apiKey || apiKey === GROQ_KEY_PLACEHOLDER) {
      return Response.json(
        { error: "GROQ_API_KEY is not configured. Add it to your Vercel Environment Variables." },
        { status: 500 },
      );
    }

    const body = await req.json();
    const inputMessages = normalizeMessages(body);
    if (!inputMessages.length) {
      return Response.json({ error: "Please enter a message." }, { status: 400 });
    }

    const messages = inputMessages.slice(-12).map((message) => {
      if (message.image && message.role === "user") {
        return {
          role: "user",
          content: [
            ...(message.content ? [{ type: "text", text: message.content }] : []),
            { type: "image_url", image_url: { url: message.image } },
          ],
        };
      }
      return { role: message.role, content: message.content || "" };
    });

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Chat provider error:", data?.error?.message || response.status);
      return Response.json({ error: data?.error?.message || "The assistant could not answer right now." }, { status: 502 });
    }

    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      return Response.json({ error: "The assistant returned an empty response." }, { status: 502 });
    }

    return Response.json({ text });
  } catch (error) {
    console.error("Chat route error:", error);
    return Response.json({ error: "Something went wrong while processing your message." }, { status: 500 });
  }
}
