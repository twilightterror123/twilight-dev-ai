export const runtime = "nodejs";
export const maxDuration = 15;

function clean(value: string, max = 600) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    if (!query) return Response.json({ error: "Missing search query." }, { status: 400 });
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=de-de`;
    const upstream = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 Zyntra/1.0" }, cache: "no-store" });
    if (!upstream.ok) return Response.json({ context: "Web search unavailable." });
    const html = await upstream.text();
    const results: string[] = [];
    const re = /<a[^>]+class="result__a"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) && results.length < 6) {
      const title = clean(match[1], 180);
      const snippet = clean(match[2], 520);
      if (title && snippet) results.push(`${title}: ${snippet}`);
    }
    return Response.json({ context: results.join("\n") || "No useful web results were returned." });
  } catch {
    return Response.json({ context: "Web search unavailable." });
  }
}
