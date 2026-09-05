"use client";

import { useRef, useState } from "react";

type Message = { id: number; role: "user" | "assistant"; text?: string; image?: string; video?: string };
type Mode = "chat" | "image" | "video";

function TwilightMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M5 7.5h22v5H18.5V25h-5V12.5H5z" fill="currentColor" />
      <path d="M21 17.5h6v5h-6z" fill="currentColor" opacity=".45" />
    </svg>
  );
}

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("chat");
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function generateVideo(prompt: string) {
    const response = await fetch("/api/generate-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Video generation failed.");
    return data.video as string;
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if ((!text && !image) || busy) return;

    const attached = image;
    const userMessage: Message = { id: Date.now(), role: "user", text, image: attached ?? undefined };
    setInput("");
    setImage(null);
    setMessages((current) => [...current, userMessage]);
    setBusy(true);

    try {
      if (mode === "image") {
        const result = await generateImage(text || "Create an image based on the attached reference image.");
        setMessages((current) => [...current, { id: Date.now() + 1, role: "assistant", text: "Here is your image.", image: result }]);
      } else if (mode === "video") {
        const result = await generateVideo(text || "Create a cinematic video based on the attached reference image.");
        setMessages((current) => [...current, { id: Date.now() + 1, role: "assistant", text: "Here is your video.", video: result }]);
      } else {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [...messages, userMessage] }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Request failed");
        setMessages((current) => [...current, { id: Date.now() + 1, role: "assistant", text: data.text }]);
      }
    } catch (error) {
      setMessages((current) => [...current, { id: Date.now() + 1, role: "assistant", text: error instanceof Error ? error.message : "Something went wrong." }]);
    } finally {
      setBusy(false);
    }
  }

  function newChat() {
    setMessages([]);
    setInput("");
    setImage(null);
    setMode("chat");
  }

  return (
    <main className="chatApp">
      <aside className="chatSidebar">
        <button className="logoButton" onClick={newChat} aria-label="New chat">
          <span className="logoMark"><TwilightMark /></span>
          <span>TWILIGHT</span>
        </button>
        <button className="newChat" onClick={newChat}>
          <span className="newChatPlus">+</span>
          <span>New chat</span>
        </button>
      </aside>

      <section className="chatMain">
        <header className="chatHeader">
          <div className="headerBrand"><span className="headerMark"><TwilightMark /></span><span>TWILIGHT</span></div>
        </header>

        <div className="chatContent">
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="welcomeLogo"><TwilightMark /></div>
              <h1>How can I help?</h1>
            </div>
          ) : (
            <div className="messages">
              {messages.map((message) => (
                <article key={message.id} className={`message ${message.role}`}>
                  {message.role === "assistant" && <div className="messageLogo"><TwilightMark /></div>}
                  <div className="messageBody">
                    {message.text && <div className="messageText">{message.text}</div>}
                    {message.image && <img src={message.image} alt="Generated or attached" className="messageImage" />}
                    {message.video && <video src={message.video} controls className="messageVideo" />}
                  </div>
                </article>
              ))}
              {busy && (
                <article className="message assistant">
                  <div className="messageLogo"><TwilightMark /></div>
                  <div className="typing"><i/><i/><i/></div>
                </article>
              )}
            </div>
          )}
        </div>

        <form className="composer" onSubmit={submit}>
          {image && <div className="attachment"><img src={image} alt="Preview"/><button type="button" onClick={() => setImage(null)}>×</button></div>}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(e); } }}
            placeholder={mode === "image" ? "Describe the image..." : mode === "video" ? "Describe the video..." : "Message Twilight..."}
            rows={1}
          />
          <div className="composerBottom">
            <button type="button" className={`modeButton ${mode === "image" ? "active" : ""}`} onClick={() => setMode(mode === "image" ? "chat" : "image")}>Image</button>
            <button type="button" className={`modeButton ${mode === "video" ? "active" : ""}`} onClick={() => setMode(mode === "video" ? "chat" : "video")}>Video</button>
            <button type="button" className="iconButton" onClick={() => fileRef.current?.click()} aria-label="Attach image">+</button>
            <button className="sendButton" disabled={busy || (!input.trim() && !image)} aria-label="Send">↑</button>
          </div>
          <input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && readImage(e.target.files[0])}/>
        </form>
      </section>
    </main>
  );
}
