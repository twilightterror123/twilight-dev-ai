"use client";

import { useEffect, useRef, useState } from "react";

type Role = "user" | "assistant";
type Message = { id: string; role: Role; text?: string; image?: string };
type Chat = { id: string; title: string; updatedAt: number; messages: Message[] };
type Mode = "chat" | "image";
type Platform = "windows" | "linux" | "android" | "macos" | "ios" | "unknown";
type ThinkingPhase = { title: string; detail: string };

const STORAGE_KEY = "twilight-chats-v3";

function TwilightMark({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><path d="M5 7.5h22v5H18.5V25h-5V12.5H5z" fill="currentColor" /><path d="M21 17.5h6v5h-6z" fill="currentColor" opacity=".45" /></svg>;
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
  const id = crypto.randomUUID();
  return { id, title: "New chat", updatedAt: Date.now(), messages: [] };
}

function safeLoadChats(): Chat[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((chat) => chat && typeof chat.id === "string" && Array.isArray(chat.messages));
  } catch {
    return [];
  }
}

function safeSaveChats(chats: Chat[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  } catch {
    const textOnly = chats.map((chat) => ({
      ...chat,
      messages: chat.messages.map((message) => ({ id: message.id, role: message.role, text: message.text })),
    }));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(textOnly));
    } catch {
      // Ignore storage failures; the current in-memory chat still works.
    }
  }
}

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("chat");
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [showAppPrompt, setShowAppPrompt] = useState(false);
  const [thinkingPhase, setThinkingPhase] = useState<ThinkingPhase>({
    title: "Analyzing",
    detail: "Reading your message…",
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? null;
  const messages = activeChat?.messages ?? [];

  useEffect(() => {
    const loaded = safeLoadChats();
    setChats(loaded);
    if (loaded[0]) setActiveChatId(loaded[0].id);

    const detected = detectPlatform();
    setPlatform(detected);
    const timer = window.setTimeout(() => setShowAppPrompt(true), 900);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    safeSaveChats(chats);
  }, [chats]);

  useEffect(() => {
    if (!busy) return;
    const phases: ThinkingPhase[] = [
      { title: "Analyzing", detail: "Reading your message…" },
      { title: "Thinking", detail: "Working through the request…" },
      { title: "Checking", detail: "Checking the answer for mistakes…" },
      { title: "Finalizing", detail: "Preparing the response…" },
    ];
    let index = 0;
    setThinkingPhase(phases[0]);
    const timer = window.setInterval(() => {
      index = (index + 1) % phases.length;
      setThinkingPhase(phases[index]);
    }, 850);
    return () => window.clearInterval(timer);
  }, [busy]);

  function ensureChat(): Chat {
    if (activeChat) return activeChat;
    const chat = createChat();
    setChats((current) => [chat, ...current]);
    setActiveChatId(chat.id);
    return chat;
  }

  function updateChat(chatId: string, updater: (chat: Chat) => Chat) {
    setChats((current) => current.map((chat) => chat.id === chatId ? updater(chat) : chat));
  }

  function selectChat(chatId: string) {
    setActiveChatId(chatId);
    setInput("");
    setImage(null);
    setMode("chat");
  }

  function newChat() {
    const chat = createChat();
    setChats((current) => [chat, ...current]);
    setActiveChatId(chat.id);
    setInput("");
    setImage(null);
    setMode("chat");
  }

  function deleteChat(chatId: string) {
    setChats((current) => {
      const next = current.filter((chat) => chat.id !== chatId);
      if (activeChatId === chatId) setActiveChatId(next[0]?.id ?? null);
      return next;
    });
  }

  function readImage(file: File) {
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function generateImage(prompt: string) {
    const response = await fetch("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Image generation failed.");
    return data.image as string;
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if ((!text && !image) || busy) return;

    const chat = ensureChat();
    const attached = image;
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      image: attached ?? undefined,
    };

    const title = chat.title === "New chat" ? (text.slice(0, 44) || "Image request") : chat.title;
    const withUser = { ...chat, title, updatedAt: Date.now(), messages: [...chat.messages, userMessage] };
    setChats((current) => [withUser, ...current.filter((item) => item.id !== chat.id)]);
    setActiveChatId(chat.id);
    setInput("");
    setImage(null);
    setBusy(true);

    try {
      if (mode === "image") {
        const result = await generateImage(text || "Create an image based on the attached reference image.");
        const assistant: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "Image ready.",
          image: result,
        };
        updateChat(chat.id, (current) => ({ ...current, updatedAt: Date.now(), messages: [...current.messages, assistant] }));
      } else {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [...withUser.messages] }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Request failed");
        const assistant: Message = { id: crypto.randomUUID(), role: "assistant", text: data.text };
        updateChat(chat.id, (current) => ({ ...current, updatedAt: Date.now(), messages: [...current.messages, assistant] }));
      }
    } catch (error) {
      const assistant: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: error instanceof Error ? error.message : "Something went wrong.",
      };
      updateChat(chat.id, (current) => ({ ...current, updatedAt: Date.now(), messages: [...current.messages, assistant] }));
    } finally {
      setBusy(false);
    }
  }

  function downloadHref(target: Platform) {
    const mapped = downloadPlatforms[target];
    return mapped === "unknown" ? "/downloads" : `/api/download/${mapped}`;
  }

  const sortedChats = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);

  return <main className="chatApp">
    {showAppPrompt && <div className="appPromptOverlay" role="dialog" aria-modal="true" aria-label="Download Twilight app">
      <div className="appPrompt">
        <button className="appPromptClose" onClick={() => setShowAppPrompt(false)} aria-label="Close">×</button>
        <div className="appPromptLogo"><TwilightMark /></div>
        <div className="appPromptEyebrow">TWILIGHT APP</div>
        <h2>Get Twilight for {platformNames[platform]}</h2>
        <p>Install the real TWILIGHT client for your device. The button opens the installer download directly.</p>
        <a className="appPromptDownload" href={downloadHref(platform)}>Download app</a>
        <button className="appPromptLater" onClick={() => setShowAppPrompt(false)}>Continue in browser</button>
      </div>
    </div>}

    <aside className="chatSidebar">
      <button className="logoButton" onClick={newChat} aria-label="New chat">
        <span className="logoMark"><TwilightMark /></span><span>TWILIGHT</span>
      </button>
      <button className="newChat" onClick={newChat}><span className="newChatPlus">+</span><span>New chat</span></button>
      {sortedChats.length > 0 && <>
        <div className="historyLabel">Recent chats</div>
        <div className="chatHistory">
          {sortedChats.map((chat) => <div className={`historyItem ${chat.id === activeChatId ? "active" : ""}`} key={chat.id}>
            <button className="historyOpen" onClick={() => selectChat(chat.id)} title={chat.title}>{chat.title}</button>
            <button className="historyDelete" onClick={() => deleteChat(chat.id)} aria-label={`Delete ${chat.title}`}>×</button>
          </div>)}
        </div>
      </>}
      <a className="downloadApp" href={downloadHref(platform)}><span>↓</span><span>Download app</span></a>
    </aside>

    <section className="chatMain">
      <header className="chatHeader"><div className="headerBrand"><span className="headerMark"><TwilightMark /></span><span>TWILIGHT</span></div></header>

      <div className="chatContent">
        {messages.length === 0 ? <div className="welcome">
          <div className="welcomeLogo"><TwilightMark /></div>
          <h1>{mode === "image" ? "Create an image" : "How can I help?"}</h1>
        </div> : <div className="messages">
          {messages.map((message) => <article key={message.id} className={`message ${message.role}`}>
            {message.role === "assistant" && <div className="messageLogo"><TwilightMark /></div>}
            <div className="messageBody">
              {message.text && <div className="messageText">{message.text}</div>}
              {message.image && <img src={message.image} alt="Generated or attached" className="messageImage" />}
            </div>
          </article>)}

          {busy && <article className="message assistant">
            <div className="messageLogo"><TwilightMark /></div>
            <div className="thinkBox" aria-live="polite">
              <span className="thinkDot" />
              <span className="thinkTitle">{thinkingPhase.title}</span>
              <span>{thinkingPhase.detail}</span>
            </div>
          </article>}
        </div>}
      </div>

      <form className="composer" onSubmit={submit}>
        {image && <div className="attachment"><img src={image} alt="Preview" /><button type="button" onClick={() => setImage(null)}>×</button></div>}
        <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(e); } }} placeholder={mode === "image" ? "Describe the image..." : "Message Twilight..."} rows={1} />
        <div className="composerBottom">
          <button type="button" className={`modeButton ${mode === "image" ? "active" : ""}`} onClick={() => setMode(mode === "image" ? "chat" : "image")}>Image</button>
          <button type="button" className="iconButton" onClick={() => fileRef.current?.click()} aria-label="Attach image">+</button>
          <button className="sendButton" disabled={busy || (!input.trim() && !image)} aria-label="Send">↑</button>
        </div>
        <input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && readImage(e.target.files[0])} />
      </form>
    </section>
  </main>;
}
