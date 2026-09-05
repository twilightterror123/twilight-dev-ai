import { streamText } from "ai";

export const runtime = "nodejs";

const systemPrompt = `You are Twilight Dev AI, a senior software engineer. Help with Python, JavaScript/TypeScript, React, Next.js, APIs, Git, Linux, Discord bots, debugging and architecture. Give practical answers and complete code when requested. Never claim code was executed or tested when it was not. Never ask users to expose API keys, passwords, cookies or tokens. For DEBUG mode diagnose the cause and provide a fix. For EXPLAIN mode explain clearly from simple to advanced. For IMPROVE mode refactor while preserving behavior. For CREATE mode provide a clean runnable implementation and setup steps.`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const model = process.env.AI_MODEL || "openai/gpt-5.5";
    const result = streamText({ model, system: systemPrompt, messages });
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Twilight Dev AI error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "AI request failed" }, { status: 500 });
  }
}
