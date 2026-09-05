"use client";

import { useEffect, useRef, useState } from "react";

type Message = { id: number; role: "user" | "assistant"; text?: string; image?: string };
type Chat = { id: number; title: string; messages: Message[]; updatedAt: number };
type Mode = "chat" | "image";
type Platform = "windows" | "macos" | "linux" | "android" | "ios" | "unknown";

const STORAGE_KEY = "twilight-chats-v1";

function TwilightMark() {
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 7.5h22v5H18.5V25h-5V12.5H5z" fill="currentColor" /><path d="M21 17.5h6v5h-6z" fill="currentColor" opacity=".45" /></svg>;
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
  windows: "Windows", macos: "macOS", linux: "Linux", android: "Android", ios: "iOS", unknown: "your device",
};

function makeChat(): Chat {
  return { id: Date.now(), title: "New chat", messages: [], updatedAt: Date.now() };
}

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState("Thinking");
  const [image, setImage] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("chat");
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [showAppPrompt, setShowAppPrompt] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const currentChat = chats.find((chat) => chat.id === currentId) ?? null;
  const messages = currentChat?.messages ?? [];

  useEffect(() => {
    const detected = detectPlatform();
    setPlatform(detected);
    setShowAppPrompt(true);
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as Chat[];
      if (Array.isArray(saved) && saved.length) {
        setChats(saved);
        setCurrentId(saved[0].id);
      } else {
        const chat = makeChat();
        setChats([chat]);
        setCurrentId(chat.id);
      }
    } catch {
      const chat = makeChat();
      setChats([chat]);
      setCurrentId(chat.id);
    }
  }, []);

  useEffect(() => {
    if (chats.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.slice(0, 30)));
  }, [chats]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: contentRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, busy]);

  useEffect(() => {
    if (!busy) return;
    const statuses = ["Thinking", "Analyzing", "Working on it"];
    let index = 0;
    const timer = window.setInterval(() => {
      index = (index + 1) % statuses.length;
      setThinkingStatus(statuses[index]);
    }, 900);
    return () => window.clearInterval(timer);
  }, [busy]);

  function updateCurrent(updater: (chat: Chat) => Chat) {
    setChats((all) => all.map((chat) => chat.id === currentId ? updater(chat) : chat));
  }

  function newChat() {
    const chat = makeChat();
    setChats((all) => [chat, ...all]);
    setCurrentId(chat.id);
    setInput("");
    setImage(null);
    setMode("chat");
  }

  function openChat(id: number) {
    setCurrentId(id);
    setInput("");
    setImage(null);
    setMode("chat");
  }

  function deleteChat(id: number) {
    setChats((all) => {
      const next = all.filter((chat) => chat.id !== id);
      if (!next.length) {
        const replacement = makeChat();
        setCurrentId(replacement.id);
        return [replacement];
      }
      if (id === currentId) setCurrentId(next[0].id);
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
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Image generation failed.");
    return data.image as string;
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if ((!text && !image) || busy || !currentId) return;

    const attached = image;
    const userMessage: Message = { id: Date.now(), role: "user", text, image: attached ?? undefined };
    const nextTitle = currentChat?.title === "New chat" ? (text || "Image chat").slice(0, 48) : currentChat?.title || "New chat";
    updateCurrent((chat) => ({ ...chat, title: nextTitle, messages: [...chat.messages, userMessage], updatedAt: Date.now() }));
    setInput("");
    setImage(null);
    setBusy(true);

    try {
      if (mode === "image") {
        const result = await generateImage(text || "Create an image based on the attached reference image.");
        updateCurrent((chat) => ({ ...chat, messages: [...chat.messages, { id: Date.now() + 1, role: "assistant", text: "Here is your image.", image: result }], updatedAt: Date.now() }));
      } else {
        const history = [...messages, userMessage].slice(-12);
        const response = await fetch("/api/chat", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Request failed.");
        updateCurrent((chat) => ({ ...chat, messages: [...chat.messages, { id: Date.now() + 1, role: "assistant", text: data.text }], updatedAt: Date.now() }));
      }
    } catch (error) {
      updateCurrent((chat) => ({ ...chat, messages: [...chat.messages, { id: Date.now() + 1, role: "assistant", text: error instanceof Error ? error.message : "Something went wrong." }], updatedAt: Date.now() }));
    } finally {
      setBusy(false);
    }
  }

  return <main className="chatApp">
    {showAppPrompt && <div className="appPromptOverlay" role="dialog" aria-modal="true" aria-label="Download Twilight app">
      <div className="appPrompt">
        <button className="appPromptClose" onClick={() => setShowAppPrompt(false)} aria-label="Close">×</button>
        <div className="appPromptLogo"><TwilightMark /></div>
        <div className="appPromptEyebrow">TWILIGHT APP</div>
        <h2>Get Twilight for {platformNames[platform]}</h2>
        <p>A dedicated TWILIGHT app is available for your device.</p>
        <a className="appPromptDownload" href={`/downloads?platform=${platform}`}>Download app</a>
        <button className="appPromptLater" onClick={() => setShowAppPrompt(false)}>Continue in browser</button>
      </div>
    </div>}

    <aside className="chatSidebar">
      <button className="logoButton" onClick={newChat} aria-label="New chat"><span className="logoMark"><TwilightMark /></span><span>TWILIGHT</span></button>
      <button className="newChat" onClick={newChat}><span className="newChatPlus">+</span><span>New chat</span></button>
      <div className="historyLabel">Recent chats</div>
      <div className="chatHistory">
        {chats.map((chat) => <div className={`historyItem ${chat.id === currentId ? "active" : ""}`} key={chat.id}>
          <button onClick={() => openChat(chat.id)} className="historyOpen" title={chat.title}>{chat.title}</button>
          <button onClick={() => deleteChat(chat.id)} className="historyDelete" aria-label={`Delete ${chat.title}`}>×</button>
        </div>)}
      </div>
      <a className="downloadApp" href={`/downloads?platform=${platform}`}><span>↓</span><span>Download app</span></a>
    </aside>

    <section className="chatMain">
      <header className="chatHeader"><div className="headerBrand"><span className="headerMark"><TwilightMark /></span><span>TWILIGHT</span></div></header>
      <div className="chatContent" ref={contentRef}>
        {!messages.length && !busy ? <div className="welcome"><div className="welcomeLogo"><TwilightMark /></div><h1>{mode === "image" ? "Create an image" : "How can I help?"}</h1><p>Ask anything, write code, analyze an image or create something new.</p></div> : <div className="messages">
          {messages.map((m) => <article key={m.id} className={`message ${m.role}`}>
            {m.role === "assistant" && <div className="messageLogo"><TwilightMark /></div>}
            <div className="messageBody">{m.text && <div className="messageText">{m.text}</div>}{m.image && <img src={m.image} alt="Attached or generated" className="messageImage" />}</div>
          </article>)}
          {busy && <article className="message assistant"><div className="messageLogo"><TwilightMark /></div><div className="thinkBox"><span className="thinkDot" /><span className="thinkTitle">{thinkingStatus}</span></div></article>}
        </div>}
      </div>
      <form className="composer" onSubmit={submit}>
        {image && <div className="attachment"><img src={image} alt="Preview" /><button type="button" onClick={() => setImage(null)}>×</button></div>}
        <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(e); } }} placeholder={mode === "image" ? "Describe the image..." : "Message Twilight..."} rows={1} />
        <div className="composerBottom"><button type="button" className={`modeButton ${mode === "image" ? "active" : ""}`} onClick={() => setMode(mode === "image" ? "chat" : "image")}>{mode === "image" ? "Image mode" : "Image"}</button><button type="button" className="iconButton" onClick={() => fileRef.current?.click()} aria-label="Attach image">+</button><button className="sendButton" disabled={busy || (!input.trim() && !image)} aria-label="Send">↑</button></div>
        <input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && readImage(e.target.files[0])} />
      </form>
    </section>
  </main>;
}
