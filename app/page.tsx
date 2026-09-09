"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type Role = "user" | "assistant";
type Message = { id: string; role: Role; text?: string; image?: string; video?: string };
type Chat = { id: string; title: string; updatedAt: number; messages: Message[] };
type Mode = "chat" | "image" | "video";
type Platform = "windows" | "linux" | "android" | "macos" | "ios" | "unknown";

type InputImage = { data: string; name: string };

const STORAGE_KEY = "twilight-chats-v9";
const POLLINATIONS_IMAGE = "https://image.pollinations.ai/prompt/";

function TwilightMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M5 7.5h22v5H18.5V25h-5V12.5H5z" fill="currentColor" />
      <path d="M21 17.5h6v5h-6z" fill="currentColor" opacity=".4" />
    </svg>
  );
}

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return "android";
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/windows/.test(ua)) return "windows";
  if (/macintosh|mac os x/.test(ua)) return "macos";
  if (/linux/.test(ua)) return "linux";
  return "unknown";
}

const platformNames: Record<Platform, string> = {
  windows: "Windows",
  linux: "Linux",
  android: "Android",
  macos: "macOS",
  ios: "iOS",
  unknown: "your device",
};

const downloadPlatforms: Record<Platform, string> = {
  windows: "windows",
  linux: "linux",
  android: "android",
  macos: "unknown",
  ios: "unknown",
  unknown: "unknown",
};

function createChat(): Chat {
  return { id: crypto.randomUUID(), title: "New chat", updatedAt: Date.now(), messages: [] };
}

function safeLoadChats(): Chat[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((chat) => chat && typeof chat.id === "string" && Array.isArray(chat.messages))
      : [];
  } catch {
    return [];
  }
}

function safeSaveChats(chats: Chat[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  } catch {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          chats.map((chat) => ({
            ...chat,
            messages: chat.messages.map(({ id, role, text }) => ({ id, role, text })),
          })),
        ),
      );
    } catch {}
  }
}

function extensionFor(language: string) {
  const map: Record<string, string> = {
    html: "html",
    htm: "html",
    css: "css",
    javascript: "js",
    js: "js",
    typescript: "ts",
    ts: "ts",
    jsx: "jsx",
    tsx: "tsx",
    python: "py",
    py: "py",
    json: "json",
    bash: "sh",
    sh: "sh",
    shell: "sh",
    powershell: "ps1",
    ps1: "ps1",
    java: "java",
    c: "c",
    cpp: "cpp",
    csharp: "cs",
    cs: "cs",
    php: "php",
    sql: "sql",
    yaml: "yml",
    yml: "yml",
    markdown: "md",
    md: "md",
    rust: "rs",
    go: "go",
  };
  return map[language.toLowerCase()] || "txt";
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const normalized = language.toLowerCase();
  const canRun = normalized === "html" || normalized === "htm";
  const previewId = useRef(`preview-${crypto.randomUUID()}`).current;

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {}
  }

  function download() {
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `twilight-code.${extensionFor(normalized)}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function run() {
    document.getElementById(previewId)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <div className="codeArtifact">
      <div className="codeHeader">
        <span className="codeLanguage">{normalized || "code"}</span>
        <div className="codeActions">
          {canRun && <button type="button" onClick={run}>Run</button>}
          <button type="button" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
          <button type="button" onClick={download}>Download</button>
        </div>
      </div>
      <pre className="codeBody"><code>{code}</code></pre>
      {canRun && (
        <div id={previewId} className="htmlPreviewWrap">
          <div className="htmlPreviewHeader"><span>Preview</span><span>Sandboxed</span></div>
          <iframe className="htmlPreview" title="HTML preview" sandbox="allow-scripts" srcDoc={code} />
        </div>
      )}
    </div>
  );
}

function renderTextWithCode(text: string) {
  const parts = text.split(/```([\w+#.-]*)\n([\s\S]*?)```/g);
  const output: React.ReactNode[] = [];
  for (let index = 0; index < parts.length; index += 1) {
    if (index % 3 === 0) {
      if (parts[index]) output.push(<span key={`text-${index}`}>{parts[index]}</span>);
    } else {
      output.push(
        <CodeBlock
          key={`code-${index}`}
          code={(parts[index + 1] || "").replace(/\n$/, "")}
          language={parts[index] || "text"}
        />,
      );
      index += 1;
    }
  }
  return output;
}

function buildFreeImageUrl(prompt: string) {
  const enhanced = `${prompt}. Clean professional result, accurate composition, natural lighting, coherent details, no watermark.`;
  return `${POLLINATIONS_IMAGE}${encodeURIComponent(enhanced)}?width=1024&height=1024&model=flux&safe=true&nologo=false`;
}

async function generateFreeVideo(prompt: string) {
  const response = await fetch("https://video.pollinations.ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: `${prompt}. Clean professional result, coherent motion and lighting, no unrelated elements.`,
      model: "video-gen",
      duration: 4,
      resolution: "360p",
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `Video generation failed (${response.status}).`);
  }
  const blob = await response.blob();
  if (!blob.size) throw new Error("Video generation returned an empty file.");
  return URL.createObjectURL(blob);
}

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [attachment, setAttachment] = useState<InputImage | null>(null);
  const [mode, setMode] = useState<Mode>("chat");
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [chatStatus, setChatStatus] = useState("Ready");
  const fileRef = useRef<HTMLInputElement>(null);

  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? null;
  const messages = activeChat?.messages ?? [];

  useEffect(() => {
    const loaded = safeLoadChats();
    setChats(loaded);
    if (loaded[0]) setActiveChatId(loaded[0].id);
    setPlatform(detectPlatform());
  }, []);

  useEffect(() => safeSaveChats(chats), [chats]);

  useEffect(() => {
    if (!busy) {
      setChatStatus("Ready");
      return;
    }
    const labels = mode === "image"
      ? ["Creating", "Rendering", "Finishing"]
      : mode === "video"
        ? ["Creating", "Rendering", "Finishing"]
        : ["Thinking", "Checking", "Finishing"];
    let index = 0;
    setChatStatus(labels[0]);
    const timer = window.setInterval(() => {
      index = (index + 1) % labels.length;
      setChatStatus(labels[index]);
    }, 900);
    return () => window.clearInterval(timer);
  }, [busy, mode]);

  function ensureChat() {
    if (activeChat) return activeChat;
    const chat = createChat();
    setChats((current) => [chat, ...current]);
    setActiveChatId(chat.id);
    return chat;
  }

  function updateChat(id: string, updater: (chat: Chat) => Chat) {
    setChats((current) => current.map((chat) => (chat.id === id ? updater(chat) : chat)));
  }

  function newChat() {
    const chat = createChat();
    setChats((current) => [chat, ...current]);
    setActiveChatId(chat.id);
    setInput("");
    setAttachment(null);
    setMode("chat");
  }

  function selectChat(id: string) {
    setActiveChatId(id);
    setInput("");
    setAttachment(null);
    setMode("chat");
  }

  function deleteChat(id: string) {
    setChats((current) => {
      const next = current.filter((chat) => chat.id !== id);
      if (activeChatId === id) setActiveChatId(next[0]?.id ?? null);
      return next;
    });
  }

  function readImage(file: File) {
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => setAttachment({ data: String(reader.result), name: file.name });
    reader.readAsDataURL(file);
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if ((!text && !attachment) || busy) return;

    const chat = ensureChat();
    const attached = attachment;
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      image: attached?.data,
    };
    const title = chat.title === "New chat"
      ? (text.slice(0, 48) || (mode === "video" ? "Video request" : mode === "image" ? "Image request" : "New chat"))
      : chat.title;

    const withUser: Chat = {
      ...chat,
      title,
      updatedAt: Date.now(),
      messages: [...chat.messages, userMessage],
    };
    setChats((current) => [withUser, ...current.filter((item) => item.id !== chat.id)]);
    setActiveChatId(chat.id);
    setInput("");
    setAttachment(null);
    setBusy(true);

    try {
      if (mode === "image") {
        if (attached) {
          const note = "The attached image is available for analysis in chat mode. Image generation currently uses a public text-to-image endpoint.";
          const url = buildFreeImageUrl(text || "A polished version of the provided image subject");
          updateChat(chat.id, (current) => ({
            ...current,
            updatedAt: Date.now(),
            messages: [...current.messages, { id: crypto.randomUUID(), role: "assistant", text: note, image: url }],
          }));
        } else {
          const url = buildFreeImageUrl(text);
          updateChat(chat.id, (current) => ({
            ...current,
            updatedAt: Date.now(),
            messages: [...current.messages, { id: crypto.randomUUID(), role: "assistant", text: "Image ready.", image: url }],
          }));
        }
      } else if (mode === "video") {
        const url = await generateFreeVideo(text || "A clean cinematic scene with subtle camera movement");
        updateChat(chat.id, (current) => ({
          ...current,
          updatedAt: Date.now(),
          messages: [...current.messages, { id: crypto.randomUUID(), role: "assistant", text: "Video ready.", video: url }],
        }));
      } else {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: withUser.messages.map((message) => ({
              role: message.role,
              content: message.text || "",
              image: message.image,
            })),
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || "The assistant could not answer right now.");
        if (typeof data?.text !== "string" || !data.text.trim()) throw new Error("The assistant returned an empty response.");
        updateChat(chat.id, (current) => ({
          ...current,
          updatedAt: Date.now(),
          messages: [...current.messages, { id: crypto.randomUUID(), role: "assistant", text: data.text }],
        }));
      }
    } catch (error) {
      updateChat(chat.id, (current) => ({
        ...current,
        updatedAt: Date.now(),
        messages: [...current.messages, {
          id: crypto.randomUUID(),
          role: "assistant",
          text: error instanceof Error ? error.message : "Something went wrong.",
        }],
      }));
    } finally {
      setBusy(false);
    }
  }

  const downloadHref = downloadPlatforms[platform] === "unknown" ? "/downloads" : `/api/download/${downloadPlatforms[platform]}`;
  const sortedChats = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
  const placeholder = mode === "image" ? "Describe the image…" : mode === "video" ? "Describe the video…" : "Message Twilight…";

  return (
    <main className="chatApp">
      <aside className="chatSidebar">
        <div className="sidebarTop">
          <button className="brandButton" onClick={newChat} aria-label="New chat">
            <span className="brandIcon"><TwilightMark /></span>
            <span>TWILIGHT</span>
          </button>
          <button className="newChat" onClick={newChat}>
            <span className="newChatPlus">+</span>
            <span>New chat</span>
            <kbd>⌘K</kbd>
          </button>
        </div>

        <div className="historyLabel">Recent</div>
        <div className="chatHistory">
          {sortedChats.length === 0 ? (
            <div className="emptyHistory">No chats yet</div>
          ) : sortedChats.map((chat) => (
            <div className={`historyItem ${chat.id === activeChatId ? "active" : ""}`} key={chat.id}>
              <button className="historyOpen" onClick={() => selectChat(chat.id)} title={chat.title}>
                <span className="historyText">{chat.title}</span>
              </button>
              <button className="historyDelete" onClick={() => deleteChat(chat.id)} aria-label={`Delete ${chat.title}`}>×</button>
            </div>
          ))}
        </div>

        <div className="sidebarBottom">
          <a className="downloadApp" href={downloadHref}>
            <span className="downloadIcon">↓</span>
            <span><strong>Get the app</strong><small>{platformNames[platform]}</small></span>
          </a>
          <div className="sidebarFoot">TWILIGHT AI</div>
        </div>
      </aside>

      <section className="chatMain">
        <header className="chatHeader">
          <div className="mobileBrand"><span className="headerMark"><TwilightMark /></span>TWILIGHT</div>
          <div className={`headerStatus ${busy ? "busy" : ""}`}><span className="statusDot" />{chatStatus}</div>
        </header>

        <div className="chatContent">
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="welcomeIcon"><TwilightMark /></div>
              <p className="welcomeEyebrow">TWILIGHT AI</p>
              <h1>What can I help with?</h1>
              <p className="welcomeText">Chat, code, understand images, create images, or make short videos.</p>
              <div className="suggestions">
                <button onClick={() => setInput("Explain this code step by step")}>Explain code</button>
                <button onClick={() => setInput("Build a clean landing page in HTML")}>Build a site</button>
                <button onClick={() => setMode("image")}>Create an image</button>
                <button onClick={() => setMode("video")}>Create a video</button>
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((message) => (
                <article key={message.id} className={`message ${message.role}`}>
                  {message.role === "assistant" ? <div className="messageLogo"><TwilightMark /></div> : null}
                  <div className="messageBody">
                    {message.role === "user" && <div className="userLabel">You</div>}
                    {message.text && <div className="messageText">{message.role === "assistant" ? renderTextWithCode(message.text) : message.text}</div>}
                    {message.image && <img src={message.image} alt="Attached or generated" className="messageImage" />}
                    {message.video && (
                      <div className="messageVideoWrap">
                        <video className="messageVideo" src={message.video} controls playsInline preload="metadata" />
                        <a className="videoDownload" href={message.video} target="_blank" rel="noreferrer" download>Download video</a>
                      </div>
                    )}
                  </div>
                </article>
              ))}
              {busy && (
                <article className="message assistant">
                  <div className="messageLogo"><TwilightMark /></div>
                  <div className="thinkBox"><span className="thinkDot" /><span>{chatStatus}</span></div>
                </article>
              )}
            </div>
          )}
        </div>

        <div className="composerWrap">
          <form className="composer" onSubmit={submit}>
            {attachment && (
              <div className="attachment">
                <img src={attachment.data} alt="Preview" />
                <div><strong>{attachment.name}</strong><span>Image attached</span></div>
                <button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment">×</button>
              </div>
            )}
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submit(event);
                }
              }}
              placeholder={placeholder}
              rows={1}
            />
            <div className="composerBottom">
              <div className="composerLeft">
                <button type="button" className={`toolButton ${mode === "image" ? "active" : ""}`} onClick={() => setMode(mode === "image" ? "chat" : "image")}><span>✦</span> Image</button>
                <button type="button" className={`toolButton ${mode === "video" ? "active" : ""}`} onClick={() => setMode(mode === "video" ? "chat" : "video")}><span>▶</span> Video</button>
                <button type="button" className="toolButton" onClick={() => fileRef.current?.click()}><span>＋</span> Attach</button>
              </div>
              <button className="sendButton" disabled={busy || (!input.trim() && !attachment)} aria-label="Send"><span>↑</span></button>
            </div>
            <input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => event.target.files?.[0] && readImage(event.target.files[0])} />
          </form>
          <div className="composerHint">Enter to send · Shift + Enter for a new line</div>
        </div>
      </section>
    </main>
  );
}
