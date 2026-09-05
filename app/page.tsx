"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMemo, useState } from "react";

type Mode = "chat" | "debug" | "explain" | "improve" | "create";
const modes: {id:Mode;label:string;icon:string;hint:string}[] = [
 {id:"chat",label:"Chat",icon:"✦",hint:"Ask anything about development."},
 {id:"debug",label:"Debug",icon:"⌁",hint:"Find bugs and explain the fix."},
 {id:"explain",label:"Explain",icon:"?",hint:"Explain code clearly."},
 {id:"improve",label:"Improve",icon:"↗",hint:"Refactor code and improve quality."},
 {id:"create",label:"Create",icon:"+",hint:"Generate clean, working code."}
];

export default function Home(){
 const [mode,setMode]=useState<Mode>("chat"); const [input,setInput]=useState("");
 const transport=useMemo(()=>new DefaultChatTransport({api:"/api/chat"}),[]);
 const {messages,sendMessage,status,error}=useChat({transport});
 const busy=status==="streaming"||status==="submitted";
 async function submit(e:React.FormEvent){e.preventDefault();const text=input.trim();if(!text||busy)return;setInput("");await sendMessage({text:`[MODE: ${mode}]\n${text}`});}
 return <main className="shell"><aside className="sidebar"><div className="brand"><div className="logo">T</div><div><strong>TWILIGHT</strong><span>DEV AI</span></div></div><button className="newChat" onClick={()=>location.reload()}>＋ New chat</button><div className="sectionTitle">Developer tools</div><nav>{modes.map(m=><button key={m.id} className={`navItem ${mode===m.id?"active":""}`} onClick={()=>setMode(m.id)}><span className="navIcon">{m.icon}</span>{m.label}</button>)}</nav><div className="sideBottom"><div className="statusDot"><i/> AI online</div><small>Twilight Dev AI · v1.0</small></div></aside><section className="workspace"><header className="topbar"><div><div className="eyebrow">DEVELOPER ASSISTANT</div><h1>Twilight Dev AI</h1></div><div className="modeBadge">{modes.find(x=>x.id===mode)?.label}</div></header><div className="chat">{messages.length===0?<div className="hero"><div className="orb">✦</div><h2>Build faster. Debug smarter.</h2><p>{modes.find(x=>x.id===mode)?.hint}</p><div className="quickGrid">{["Find the bug in this Python code","Explain async/await like I’m new","Improve this React component","Create a Discord bot command"].map(q=><button key={q} onClick={()=>setInput(q)}>{q}<span>→</span></button>)}</div></div>:<div className="messages">{messages.map(m=><div key={m.id} className={`message ${m.role}`}><div className="avatar">{m.role==="user"?"YOU":"T"}</div><div className="bubble">{m.parts.map((p,i)=>p.type==="text"?<pre key={i}>{p.text}</pre>:null)}</div></div>)}{busy&&<div className="typing"><span/><span/><span/></div>}</div>}</div><form className="composer" onSubmit={submit}><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void submit(e)}}} placeholder="Ask Twilight Dev AI..." rows={3}/><div className="composerBottom"><span>Enter to send · Shift + Enter for new line</span><button disabled={busy||!input.trim()}>{busy?"...":"Send ↗"}</button></div></form>{error&&<div className="error">AI error: {error.message}</div>}</section></main>;
}
