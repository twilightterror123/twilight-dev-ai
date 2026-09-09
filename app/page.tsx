"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type Role = "user" | "assistant";
type Message = { id: string; role: Role; text?: string; image?: string; video?: string };
type Chat = { id: string; title: string; updatedAt: number; messages: Message[] };
type Mode = "chat" | "image" | "video";
type Platform = "windows" | "linux" | "android" | "macos" | "ios" | "unknown";
type ThinkingPhase = { title: string; detail: string };

const STORAGE_KEY = "twilight-chats-v6";

function TwilightMark({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><path d="M5 7.5h22v5H18.5V25h-5V12.5H5z" fill="currentColor" /><path d="M21 17.5h6v5h-6z" fill="currentColor" opacity=".4" /></svg>;
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

const platformNames: Record<Platform, string> = { windows: "Windows", linux: "Linux", android: "Android", macos: "macOS", ios: "iOS", unknown: "your device" };
const downloadPlatforms: Record<Platform, string> = { windows: "windows", linux: "linux", android: "android", macos: "unknown", ios: "unknown", unknown: "unknown" };
function createChat(): Chat { return { id: crypto.randomUUID(), title: "New chat", updatedAt: Date.now(), messages: [] }; }
function safeLoadChats(): Chat[] { try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); return Array.isArray(parsed) ? parsed.filter((chat) => chat && typeof chat.id === "string" && Array.isArray(chat.messages)) : []; } catch { return []; } }
function safeSaveChats(chats: Chat[]) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chats)); } catch { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.map((chat) => ({ ...chat, messages: chat.messages.map(({ id, role, text }) => ({ id, role, text })) })))); } catch {} } }

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("chat");
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [thinkingPhase, setThinkingPhase] = useState<ThinkingPhase>({ title: "Thinking", detail: "Working on your request…" });
  const fileRef = useRef<HTMLInputElement>(null);

  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? null;
  const messages = activeChat?.messages ?? [];

  useEffect(() => { const loaded = safeLoadChats(); setChats(loaded); if (loaded[0]) setActiveChatId(loaded[0].id); setPlatform(detectPlatform()); }, []);
  useEffect(() => safeSaveChats(chats), [chats]);
  useEffect(() => { if (!busy) return; const phases = [{ title: "Searching", detail: "Checking useful context…" }, { title: "Thinking", detail: mode === "video" ? "Planning the video…" : mode === "image" ? "Planning the image…" : "Working on the request…" }, { title: "Checking", detail: "Checking the result…" }, { title: "Finishing", detail: "Preparing it for you…" }]; let index = 0; setThinkingPhase(phases[0]); const timer = window.setInterval(() => { index = (index + 1) % phases.length; setThinkingPhase(phases[index]); }, 900); return () => window.clearInterval(timer); }, [busy, mode]);

  function ensureChat() { if (activeChat) return activeChat; const chat = createChat(); setChats((current) => [chat, ...current]); setActiveChatId(chat.id); return chat; }
  function updateChat(chatId: string, updater: (chat: Chat) => Chat) { setChats((current) => current.map((chat) => chat.id === chatId ? updater(chat) : chat)); }
  function newChat() { const chat = createChat(); setChats((current) => [chat, ...current]); setActiveChatId(chat.id); setInput(""); setImage(null); setMode("chat"); }
  function selectChat(chatId: string) { setActiveChatId(chatId); setInput(""); setImage(null); setMode("chat"); }
  function deleteChat(chatId: string) { setChats((current) => { const next = current.filter((chat) => chat.id !== chatId); if (activeChatId === chatId) setActiveChatId(next[0]?.id ?? null); return next; }); }
  function readImage(file: File) { if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) return; const reader = new FileReader(); reader.onload = () => setImage(String(reader.result)); reader.readAsDataURL(file); }

  async function generateImage(prompt: string, sourceImage?: string) { const response = await fetch("/api/generate-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, image: sourceImage }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Image generation failed."); return data.image as string; }
  async function generateVideo(prompt: string, sourceImage?: string) { const start = await fetch("/api/generate-video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, image: sourceImage }) }); const started = await start.json(); if (!start.ok) throw new Error(started.error || "Video generation could not be started."); const requestId = started.requestId as string; for (let attempt = 0; attempt < 40; attempt += 1) { await new Promise((resolve) => window.setTimeout(resolve, 3000)); const poll = await fetch(`/api/generate-video?id=${encodeURIComponent(requestId)}`, { cache: "no-store" }); const result = await poll.json(); if (!poll.ok) throw new Error(result.error || "Could not check video status."); if (result.status === "done" && typeof result.video === "string") return result.video as string; if (result.status === "failed" || result.status === "expired") throw new Error(result.error || `Video generation ${result.status}.`); } throw new Error("Video generation is taking too long. Please try again."); }

  async function submit(e?: FormEvent) {
    e?.preventDefault(); const text = input.trim(); if ((!text && !image) || busy) return;
    const chat = ensureChat(); const attached = image; const userMessage: Message = { id: crypto.randomUUID(), role: "user", text, image: attached ?? undefined }; const defaultTitle = mode === "video" ? "Video request" : mode === "image" ? "Image request" : "New chat"; const title = chat.title === "New chat" ? (text.slice(0, 48) || defaultTitle) : chat.title; const withUser: Chat = { ...chat, title, updatedAt: Date.now(), messages: [...chat.messages, userMessage] };
    setChats((current) => [withUser, ...current.filter((item) => item.id !== chat.id)]); setActiveChatId(chat.id); setInput(""); setImage(null); setBusy(true);
    try {
      if (mode === "image") {
        const result = await generateImage(text || "Create an image based on the attached reference image.", attached ?? undefined);
        updateChat(chat.id, (current) => ({ ...current, updatedAt: Date.now(), messages: [...current.messages, { id: crypto.randomUUID(), role: "assistant", text: "Image ready.", image: result }] }));
      } else if (mode === "video") {
        const result = await generateVideo(text || "Animate the attached image naturally with subtle camera movement.", attached ?? undefined);
        updateChat(chat.id, (current) => ({ ...current, updatedAt: Date.now(), messages: [...current.messages, { id: crypto.randomUUID(), role: "assistant", text: "Video ready.", video: result }] }));
      } else {
        const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: withUser.messages }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || "The assistant could not answer right now.");
        updateChat(chat.id, (current) => ({ ...current, updatedAt: Date.now(), messages: [...current.messages, { id: crypto.randomUUID(), role: "assistant", text: data.text }] }));
      }
    } catch (error) { updateChat(chat.id, (current) => ({ ...current, updatedAt: Date.now(), messages: [...current.messages, { id: crypto.randomUUID(), role: "assistant", text: error instanceof Error ? error.message : "Something went wrong." }] })); }
    finally { setBusy(false); }
  }

  const downloadHref = downloadPlatforms[platform] === "unknown" ? "/downloads" : `/api/download/${downloadPlatforms[platform]}`;
  const sortedChats = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
  const placeholder = mode === "image" ? "Describe what you want to create…" : mode === "video" ? "Describe the video you want…" : "Message Twilight…";

  return <main className="chatApp">
    <aside className="chatSidebar"><div className="sidebarTop"><button className="brandButton" onClick={newChat} aria-label="New chat"><span className="brandIcon"><TwilightMark /></span><span>TWILIGHT</span></button><button className="newChat" onClick={newChat}><span>+</span><span>New chat</span><kbd>⌘ K</kbd></button></div><div className="historyLabel">Chats</div><div className="chatHistory">{sortedChats.length === 0 ? <div className="emptyHistory">Your conversations will appear here.</div> : sortedChats.map((chat) => <div className={`historyItem ${chat.id === activeChatId ? "active" : ""}`} key={chat.id}><button className="historyOpen" onClick={() => selectChat(chat.id)} title={chat.title}><span className="historyDot" />{chat.title}</button><button className="historyDelete" onClick={() => deleteChat(chat.id)} aria-label={`Delete ${chat.title}`}>×</button></div>)}</div><div className="sidebarBottom"><a className="downloadApp" href={downloadHref}><span className="downloadIcon">↓</span><span><strong>Get the app</strong><small>{platformNames[platform]}</small></span></a><div className="sidebarFoot">TWILIGHT AI · v2</div></div></aside>
    <section className="chatMain"><header className="chatHeader"><div className="mobileBrand"><span className="headerMark"><TwilightMark /></span>TWILIGHT</div><div className="headerStatus"><span className="statusDot" />Online</div></header><div className="chatContent">{messages.length === 0 ? <div className="welcome"><div className="welcomeIcon"><TwilightMark /></div><div className="welcomeEyebrow">TWILIGHT AI</div><h1>{mode === "video" ? "Make a video." : mode === "image" ? "Create something." : "What are we working on?"}</h1><p>Chat, write code, analyze images, generate images, or turn an idea into a video.</p><div className="suggestions"><button onClick={() => setInput("Improve this code")}>Improve code</button><button onClick={() => setInput("Help me build a clean website")}>Build a website</button><button onClick={() => setInput("Analyze this image")}>Analyze an image</button></div></div> : <div className="messages">{messages.map((message) => <article key={message.id} className={`message ${message.role}`}>{message.role === "assistant" ? <div className="messageLogo"><TwilightMark /></div> : <div className="userLabel">You</div>}<div className="messageBody">{message.text && <div className="messageText">{message.text}</div>}{message.image && <img src={message.image} alt="Generated or attached" className="messageImage" />}{message.video && <video className="messageVideo" src={message.video} controls playsInline preload="metadata" />} </div></article>)}{busy && <article className="message assistant"><div className="messageLogo"><TwilightMark /></div><div className="thinkBox"><span className="thinkDot" /><span className="thinkTitle">{thinkingPhase.title}</span><span>{thinkingPhase.detail}</span></div></article>}</div>}</div><div className="composerWrap"><form className="composer" onSubmit={submit}>{image && <div className="attachment"><img src={image} alt="Preview" /><button type="button" onClick={() => setImage(null)}>×</button></div>}<textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(e); } }} placeholder={placeholder} rows={1} /><div className="composerBottom"><div className="composerLeft"><button type="button" className={`toolButton ${mode === "image" ? "active" : ""}`} onClick={() => setMode(mode === "image" ? "chat" : "image")}><span>✦</span> Image</button><button type="button" className={`toolButton ${mode === "video" ? "active" : ""}`} onClick={() => setMode(mode === "video" ? "chat" : "video")}><span>▶</span> Video</button><button type="button" className="toolButton attachButton" onClick={() => fileRef.current?.click()}><span>＋</span> Attach</button></div><button className="sendButton" disabled={busy || (!input.trim() && !image)} aria-label="Send"><span>↑</span></button></div><input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && readImage(e.target.files[0])} /></form><div className="composerHint">Enter to send · Shift + Enter for a new line</div></div></section>
  </main>;
}
