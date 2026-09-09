"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type Role = "user" | "assistant";
type Mode = "chat" | "image" | "video";
type Platform = "windows" | "linux" | "android" | "macos" | "ios" | "unknown";
type Message = { id: string; role: Role; text?: string; image?: string; video?: string };
type Chat = { id: string; title: string; updatedAt: number; messages: Message[] };
type InputImage = { data: string; name: string };

const STORAGE_KEY = "zyntra-chats-v1";

const platformNames: Record<Platform, string> = { windows: "Windows", linux: "Linux", android: "Android", macos: "macOS", ios: "iOS", unknown: "your device" };
const downloadPlatforms: Record<Platform, string> = { windows: "windows", linux: "linux", android: "android", macos: "unknown", ios: "unknown", unknown: "unknown" };

function ZyntraMark() {
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 7.5h22v5H18.5V25h-5V12.5H5z" fill="currentColor"/><path d="M21 17.5h6v5h-6z" fill="currentColor" opacity=".4"/></svg>;
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

function createChat(): Chat { return { id: crypto.randomUUID(), title: "New chat", updatedAt: Date.now(), messages: [] }; }

function loadChats(): Chat[] {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(data) ? data.filter((c) => c && typeof c.id === "string" && Array.isArray(c.messages)) : [];
  } catch { return []; }
}

function saveChats(chats: Chat[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chats)); } catch {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.map(({ id, title, updatedAt, messages }) => ({ id, title, updatedAt, messages: messages.map(({ id: mid, role, text }) => ({ id: mid, role, text })) })))); } catch {}
  }
}

function extensionFor(language: string) {
  const map: Record<string, string> = { html:"html",htm:"html",css:"css",javascript:"js",js:"js",typescript:"ts",ts:"ts",jsx:"jsx",tsx:"tsx",python:"py",py:"py",json:"json",bash:"sh",sh:"sh",shell:"sh",powershell:"ps1",ps1:"ps1",java:"java",c:"c",cpp:"cpp",csharp:"cs",cs:"cs",php:"php",sql:"sql",yaml:"yml",yml:"yml",markdown:"md",md:"md",rust:"rs",go:"go" };
  return map[language.toLowerCase()] || "txt";
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const lang = language.toLowerCase();
  const canRun = lang === "html" || lang === "htm";
  const previewId = useRef(`preview-${crypto.randomUUID()}`).current;
  async function copy() { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch {} }
  function download() { const url = URL.createObjectURL(new Blob([code], { type: "text/plain;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = `zyntra-code.${extensionFor(lang)}`; a.click(); URL.revokeObjectURL(url); }
  return <div className="codeArtifact"><div className="codeHeader"><span className="codeLanguage">{lang || "code"}</span><div className="codeActions">{canRun && <button type="button" onClick={() => document.getElementById(previewId)?.scrollIntoView({ behavior:"smooth", block:"nearest" })}>Run</button>}<button type="button" onClick={copy}>{copied ? "Copied" : "Copy"}</button><button type="button" onClick={download}>Download</button></div></div><pre className="codeBody"><code>{code}</code></pre>{canRun && <div id={previewId} className="htmlPreviewWrap"><div className="htmlPreviewHeader"><span>Preview</span><span>Sandboxed</span></div><iframe className="htmlPreview" title="HTML preview" sandbox="allow-scripts" srcDoc={code}/></div>}</div>;
}

function renderText(text: string) {
  const parts = text.split(/```([\w+#.-]*)\n([\s\S]*?)```/g);
  const out: React.ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) { if (i % 3 === 0) { if (parts[i]) out.push(<span key={`t-${i}`}>{parts[i]}</span>); } else { out.push(<CodeBlock key={`c-${i}`} code={(parts[i + 1] || "").replace(/\n$/, "")} language={parts[i] || "text"}/>); i++; } }
  return out;
}

async function researchWeb(query: string) {
  const r = await fetch("/api/web-research", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ query }) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || "Web research failed.");
  return typeof data.context === "string" ? data.context : "";
}

async function generateImage(prompt: string, research: string) {
  const r = await fetch("/api/generate-image", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ prompt, research }) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.image) throw new Error(data?.error || "Image generation failed.");
  return data.image as string;
}

async function generateVideo(prompt: string, research: string) {
  const r = await fetch("/api/generate-video", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ prompt, research }) });
  if (!r.ok) { const data = await r.json().catch(() => ({})); throw new Error(data?.error || "Video generation failed."); }
  const blob = await r.blob();
  if (!blob.size) throw new Error("Video service returned an empty file.");
  return URL.createObjectURL(blob);
}

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("chat");
  const [attachment, setAttachment] = useState<InputImage | null>(null);
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [status, setStatus] = useState("Ready");
  const fileRef = useRef<HTMLInputElement>(null);
  const active = chats.find((c) => c.id === activeId) || null;
  const messages = active?.messages || [];

  useEffect(() => { const loaded = loadChats(); setChats(loaded); setActiveId(loaded[0]?.id || null); setPlatform(detectPlatform()); }, []);
  useEffect(() => { saveChats(chats); }, [chats]);
  useEffect(() => { if (!busy) { setStatus("Ready"); return; } const labels = mode === "chat" ? ["Thinking","Checking","Finishing"] : mode === "image" ? ["Searching web","Creating","Finishing"] : ["Searching web","Rendering","Finishing"]; let i = 0; setStatus(labels[0]); const t = setInterval(() => { i=(i+1)%labels.length; setStatus(labels[i]); }, 900); return () => clearInterval(t); }, [busy, mode]);

  function ensureChat() { if (active) return active; const c = createChat(); setChats((x) => [c, ...x]); setActiveId(c.id); return c; }
  function updateChat(id: string, fn: (c: Chat) => Chat) { setChats((x) => x.map((c) => c.id === id ? fn(c) : c)); }
  function newChat() { const c = createChat(); setChats((x) => [c, ...x]); setActiveId(c.id); setInput(""); setAttachment(null); setMode("chat"); }
  function selectChat(id: string) { setActiveId(id); setInput(""); setAttachment(null); setMode("chat"); }
  function deleteChat(id: string) { setChats((x) => { const next=x.filter((c)=>c.id!==id); if (id===activeId) setActiveId(next[0]?.id||null); return next; }); }
  function readImage(file: File) { if (!file.type.startsWith("image/") || file.size > 8*1024*1024) return; const reader=new FileReader(); reader.onload=()=>setAttachment({data:String(reader.result),name:file.name}); reader.readAsDataURL(file); }

  async function submit(e?: FormEvent) {
    e?.preventDefault(); const text=input.trim(); if ((!text && !attachment) || busy) return; const chat=ensureChat(); const attached=attachment;
    const user: Message={id:crypto.randomUUID(),role:"user",text,image:attached?.data};
    const nextChat={...chat,title:chat.title === "New chat" ? (text.slice(0,48) || `${mode} request`) : chat.title,updatedAt:Date.now(),messages:[...chat.messages,user]};
    setChats((x)=>[nextChat,...x.filter((c)=>c.id!==chat.id)]); setActiveId(chat.id); setInput(""); setAttachment(null); setBusy(true);
    try {
      if (mode === "chat") {
        const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:nextChat.messages.map((m)=>({role:m.role,content:m.text||"",image:m.image}))})}); const data=await r.json().catch(()=>({})); if(!r.ok) throw new Error(data?.error||"The assistant could not answer right now."); updateChat(chat.id,(c)=>({...c,updatedAt:Date.now(),messages:[...c.messages,{id:crypto.randomUUID(),role:"assistant",text:data.text}]}));
      } else if (mode === "image") {
        const research=await researchWeb(text || "the attached image subject"); const url=await generateImage(text || "Create a polished image based on the attached subject",research); updateChat(chat.id,(c)=>({...c,updatedAt:Date.now(),messages:[...c.messages,{id:crypto.randomUUID(),role:"assistant",text:"Image ready — web context was checked before generation.",image:url}]}));
      } else {
        const research=await researchWeb(text || "the requested video subject"); const url=await generateVideo(text || "A clean cinematic scene with subtle camera movement",research); updateChat(chat.id,(c)=>({...c,updatedAt:Date.now(),messages:[...c.messages,{id:crypto.randomUUID(),role:"assistant",text:"Video ready — web context was checked before generation.",video:url}]}));
      }
    } catch (err) { updateChat(chat.id,(c)=>({...c,updatedAt:Date.now(),messages:[...c.messages,{id:crypto.randomUUID(),role:"assistant",text:err instanceof Error?err.message:"Something went wrong."}]})); } finally { setBusy(false); }
  }

  const sorted=[...chats].sort((a,b)=>b.updatedAt-a.updatedAt); const downloadHref=downloadPlatforms[platform]==="unknown"?"/downloads":`/api/download/${downloadPlatforms[platform]}`; const placeholder=mode==="image"?"Describe the image…":mode==="video"?"Describe the video…":"Message Zyntra…";
  return <main className="chatApp">
    <aside className="chatSidebar"><div className="sidebarTop"><button className="brandButton" onClick={newChat} aria-label="New chat"><span className="brandIcon"><ZyntraMark/></span><span>ZYNTRA</span></button><button className="newChat" onClick={newChat}><span className="newChatPlus">+</span><span>New chat</span><kbd>⌘K</kbd></button></div><div className="historyLabel">Recent</div><div className="chatHistory">{sorted.length===0?<div className="emptyHistory">No chats yet</div>:sorted.map(c=><div className={`historyItem ${c.id===activeId?"active":""}`} key={c.id}><button className="historyOpen" onClick={()=>selectChat(c.id)} title={c.title}>{c.title}</button><button className="historyDelete" onClick={()=>deleteChat(c.id)} aria-label="Delete chat">×</button></div>)}</div><div className="sidebarBottom"><a className="downloadApp" href={downloadHref}><span className="downloadIcon">↓</span><span><strong>Get the app</strong><small>{platformNames[platform]}</small></span></a><div className="sidebarFoot">Made by Twilight Terror</div></div></aside>
    <section className="chatMain"><header className="chatHeader"><div className="mobileBrand"><span className="headerMark"><ZyntraMark/></span>ZYNTRA</div><div className={`headerStatus ${busy?"busy":""}`}><span className="statusDot"/>{status}</div></header>
      <div className="chatContent">{messages.length===0?<div className="welcome"><div className="welcomeIcon"><ZyntraMark/></div><p className="welcomeEyebrow">ZYNTRA</p><h1>What can I help with?</h1><p className="welcomeText">Chat, code, understand images, search the web, create images, or make short videos.</p><div className="suggestions"><button onClick={()=>setInput("Explain this code step by step")}>Explain code</button><button onClick={()=>setInput("Build a clean landing page in HTML")}>Build a site</button><button onClick={()=>setMode("image")}>Create an image</button><button onClick={()=>setMode("video")}>Create a video</button></div></div>:<div className="messages">{messages.map(m=><article className={`message ${m.role}`} key={m.id}>{m.role==="assistant"&&<div className="messageLogo"><ZyntraMark/></div>}<div className="messageBody">{m.role==="user"&&<div className="userLabel">You</div>}{m.text&&<div className="messageText">{m.role==="assistant"?renderText(m.text):m.text}</div>}{m.image&&<img className="messageImage" src={m.image} alt="Generated or attached"/>}{m.video&&<div className="messageVideoWrap"><video className="messageVideo" src={m.video} controls playsInline preload="metadata"/><a className="videoDownload" href={m.video} download="zyntra-video.mp4">Download video</a></div>}</div></article>)}{busy&&<article className="message assistant"><div className="messageLogo"><ZyntraMark/></div><div className="thinkBox"><span className="thinkDot"/><span>{status}</span></div></article>}</div>}</div>
      <div className="composerWrap"><form className="composer" onSubmit={submit}>{attachment&&<div className="attachment"><img src={attachment.data} alt="Preview"/><div><strong>{attachment.name}</strong><span>Image attached</span></div><button type="button" onClick={()=>setAttachment(null)}>×</button></div>}<textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void submit(e);}}} placeholder={placeholder} rows={1}/><div className="composerBottom"><div className="composerLeft"><button type="button" className={`toolButton ${mode==="image"?"active":""}`} onClick={()=>setMode(mode==="image"?"chat":"image")}><span>✦</span> Image</button><button type="button" className={`toolButton ${mode==="video"?"active":""}`} onClick={()=>setMode(mode==="video"?"chat":"video")}><span>▶</span> Video</button><button type="button" className="toolButton" onClick={()=>fileRef.current?.click()}><span>＋</span> Attach</button></div><button className="sendButton" disabled={busy||(!input.trim()&&!attachment)} aria-label="Send"><span>↑</span></button></div><input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>e.target.files?.[0]&&readImage(e.target.files[0])}/></form><div className="composerHint">Enter to send · Shift + Enter for a new line</div></div>
    </section>
  </main>;
}
