export const runtime = "nodejs";

const knowledge = [
  { keys: ["python", "pip", "venv"], answer: "Python: Nutze eine virtuelle Umgebung mit `python -m venv .venv` und aktiviere sie mit `source .venv/bin/activate`. Installiere Pakete danach mit `pip install ...`." },
  { keys: ["next.js", "nextjs"], answer: "Next.js: App Router liegt unter `app/`. API-Endpunkte gehören z.B. nach `app/api/name/route.ts`. Server Components sind standardmäßig aktiv; für Browser-State brauchst du `\"use client\"`." },
  { keys: ["javascript", "typescript", "async", "await"], answer: "async/await macht Promise-Code lesbarer: `const data = await fetch(url)` wartet innerhalb einer async-Funktion auf das Ergebnis. Fehler kannst du mit `try/catch` behandeln." },
  { keys: ["git", "github"], answer: "Git-Grundablauf: `git add .` → `git commit -m \"Änderung\"` → `git push`. Mit `git status` prüfst du vorher den Zustand." },
  { keys: ["linux", "debian", "ubuntu"], answer: "Linux-Tipp: `pwd` zeigt den Ordner, `ls` Dateien, `cd` wechselt den Ordner, `df -h` zeigt Speicher und `free -h` RAM." },
  { keys: ["discord", "discord bot"], answer: "Für einen Discord-Bot brauchst du einen Bot-Account im Discord Developer Portal und eine Bot-Bibliothek wie discord.py oder discord.js. Tokens gehören niemals in den Quellcode." }
];

function answer(input: string) {
  const text = input.toLowerCase();
  const hit = knowledge.find(item => item.keys.some(key => text.includes(key)));
  if (hit) return `Twilight Dev AI\n\n${hit.answer}\n\nHinweis: Ich laufe hier ohne externe KI-API. Meine eingebaute Wissensbasis kann über den Code erweitert werden.`;
  if (text.includes("hallo") || text.includes("hi")) return "Twilight Dev AI\n\nHey! Ich bin deine lokale Dev-KI. Frag mich etwas zu Python, JavaScript/TypeScript, Next.js, Git, Linux oder Discord-Bots.";
  if (text.includes("debug") || text.includes("fehler") || text.includes("error")) return "Twilight Dev AI\n\nSchick mir den Fehler und den relevanten Code. Ich zerlege ihn in Ursache → Fix → Erklärung. Für bessere Antworten kannst du die betroffene Datei bzw. den Stacktrace einfügen.";
  return "Twilight Dev AI\n\nIch bin aktuell die API-freie lokale Basisversion. Deine Nachricht wurde empfangen. Erweitere `knowledge` in `app/api/chat/route.ts`, um eigenes Wissen hinzuzufügen. Für ein echtes trainierbares Sprachmodell brauchen wir anschließend einen Modell-Runner auf einem eigenen Server.";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const last = messages[messages.length - 1];
    const text = typeof last?.content === "string" ? last.content : typeof last?.text === "string" ? last.text : "";
    return Response.json({ text: answer(text) });
  } catch {
    return Response.json({ text: "Twilight Dev AI: Ungültige Anfrage." }, { status: 400 });
  }
}
