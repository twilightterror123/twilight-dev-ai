"use client";

import { useEffect, useRef, useState } from "react";

type Message = { id: number; role: "user" | "assistant"; text?: string; image?: string };
type Mode = "chat" | "image";
type Platform = "windows" | "macos" | "linux" | "android" | "ios" | "unknown";

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
  macos: "macOS",
  linux: "Linux",
  android: "Android",
  ios: "iOS",
  unknown: "your device",
};

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("chat");
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [showAppPrompt, setShowAppPrompt] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const detected = detectPlatform();
    setPlatform(detected);
    const key = "twilight-app-prompt-seen";
    if (!localStorage.getItem(key)) {
      const timer = window.setTimeout(() => setShowAppPrompt(true), 900);
      localStorage.setItem(key, "1");
      return () => window.clearTimeout(timer);
    }
  }, []);

  function readImage(file: File) {
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) return;
    const reader = new FileReader(); reader.onload = () => setImage(String(reader.result)); reader.readAsDataURL(file);
  }
  async function generateImage(prompt: string) {
    const response = await fetch("/api/generate-image", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({prompt}) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "Image generation failed."); return data.image as string;
  }
  async function submit(e?: React.FormEvent) {
    e?.preventDefault(); const text=input.trim(); if ((!text && !image)||busy) return;
    const attached=image; const userMessage:Message={id:Date.now(),role:"user",text,image:attached??undefined}; setInput(""); setImage(null); setMessages(c=>[...c,userMessage]); setBusy(true);
    try {
      if(mode==="image") { const result=await generateImage(text||"Create an image based on the attached reference image."); setMessages(c=>[...c,{id:Date.now()+1,role:"assistant",text:"Here is your image.",image:result}]); }
      else { const response=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:[...messages,userMessage]})}); const data=await response.json(); if(!response.ok) throw new Error(data.error||"Request failed"); setMessages(c=>[...c,{id:Date.now()+1,role:"assistant",text:data.text}]); }
    } catch(error) { setMessages(c=>[...c,{id:Date.now()+1,role:"assistant",text:error instanceof Error?error.message:"Something went wrong."}]); } finally { setBusy(false); }
  }
  function newChat(){setMessages([]);setInput("");setImage(null);setMode("chat");}

  return <main className="chatApp">
    {showAppPrompt && <div className="appPromptOverlay" role="dialog" aria-modal="true" aria-label="Download Twilight app">
      <div className="appPrompt">
        <button className="appPromptClose" onClick={()=>setShowAppPrompt(false)} aria-label="Close">×</button>
        <div className="appPromptLogo"><TwilightMark/></div>
        <h2>Get Twilight for {platformNames[platform]}</h2>
        <p>Use TWILIGHT as a native app on your device for a faster, dedicated experience.</p>
        <a className="appPromptDownload" href={`/downloads?platform=${platform}`}>Download app</a>
        <button className="appPromptLater" onClick={()=>setShowAppPrompt(false)}>Continue in browser</button>
      </div>
    </div>}
    <aside className="chatSidebar">
      <button className="logoButton" onClick={newChat} aria-label="New chat"><span className="logoMark"><TwilightMark/></span><span>TWILIGHT</span></button>
      <button className="newChat" onClick={newChat}><span className="newChatPlus">+</span><span>New chat</span></button>
      <a className="downloadApp" href={`/downloads?platform=${platform}`}><span>↓</span><span>Download app</span></a>
    </aside>
    <section className="chatMain">
      <header className="chatHeader"><div className="headerBrand"><span className="headerMark"><TwilightMark/></span><span>TWILIGHT</span></div></header>
      <div className="chatContent">{messages.length===0?<div className="welcome"><div className="welcomeLogo"><TwilightMark/></div><h1>{mode==="image"?"Create an image":"How can I help?"}</h1></div>:<div className="messages">{messages.map(m=><article key={m.id} className={`message ${m.role}`}>{m.role==="assistant"&&<div className="messageLogo"><TwilightMark/></div>}<div className="messageBody">{m.text&&<div className="messageText">{m.text}</div>}{m.image&&<img src={m.image} alt="Generated or attached" className="messageImage"/>}</div></article>)}{busy&&<article className="message assistant"><div className="messageLogo"><TwilightMark/></div><div className="typing"><i/><i/><i/></div></article>}</div>}</div>
      <form className="composer" onSubmit={submit}>{image&&<div className="attachment"><img src={image} alt="Preview"/><button type="button" onClick={()=>setImage(null)}>×</button></div>}<textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void submit(e)}}} placeholder={mode==="image"?"Describe the image...":"Message Twilight..."} rows={1}/><div className="composerBottom"><button type="button" className={`modeButton ${mode==="image"?"active":""}`} onClick={()=>setMode(mode==="image"?"chat":"image")}>Image</button><button type="button" className="iconButton" onClick={()=>fileRef.current?.click()} aria-label="Attach image">+</button><button className="sendButton" disabled={busy||(!input.trim()&&!image)} aria-label="Send">↑</button></div><input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>e.target.files?.[0]&&readImage(e.target.files[0])}/></form>
    </section>
  </main>;
}
