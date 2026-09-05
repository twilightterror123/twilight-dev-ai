"use client";

import { useEffect, useRef, useState } from "react";
import { pipeline, type TextGenerationPipeline } from "@huggingface/transformers";

type Mode = "chat" | "debug" | "explain" | "improve" | "create";
type Message = { id:number; role:"user"|"assistant"; text:string };

const modes: {id:Mode;label:string;icon:string;hint:string}[] = [
 {id:"chat",label:"Chat",icon:"✦",hint:"Ask anything about development."},
 {id:"debug",label:"Debug",icon:"⌁",hint:"Find bugs and explain the fix."},
 {id:"explain",label:"Explain",icon:"?",hint:"Explain code clearly."},
 {id:"improve",label:"Improve",icon:"↗",hint:"Refactor code and improve quality."},
 {id:"create",label:"Create",icon:"+",hint:"Generate clean code."}
];

const MODEL = "onnx-community/Qwen2.5-Coder-0.5B-Instruct";

export default function Home(){
 const [mode,setMode]=useState<Mode>("chat");
 const [input,setInput]=useState("");
 const [messages,setMessages]=useState<Message[]>([]);
 const [busy,setBusy]=useState(false);
 const [progress,setProgress]=useState("Local AI bereit");
 const [knowledge,setKnowledge]=useState("");
 const generator=useRef<TextGenerationPipeline|null>(null);

 useEffect(()=>{
   const saved=localStorage.getItem("twilight-knowledge");
   if(saved) setKnowledge(saved);
 },[]);

 async function loadModel(){
   if(generator.current) return generator.current;
   setProgress("KI wird lokal geladen … (beim ersten Start dauert es länger)");
   const device = typeof navigator !== "undefined" && "gpu" in navigator ? "webgpu" : "wasm";
   generator.current = await pipeline("text-generation", MODEL, { device, dtype:"q4", progress_callback:(p:any)=>{
     if(p?.status === "progress" && typeof p.progress === "number") setProgress(`KI-Modell ${Math.round(p.progress)}% geladen`);
     else if(p?.status) setProgress(String(p.status));
   }}) as TextGenerationPipeline;
   setProgress(device === "webgpu" ? "Twilight AI · WebGPU lokal" : "Twilight AI · CPU lokal");
   return generator.current;
 }

 async function submit(e:React.FormEvent){
   e.preventDefault();
   const text=input.trim();
   if(!text||busy)return;
   setInput("");
   const user:Message={id:Date.now(),role:"user",text};
   setMessages(x=>[...x,user]);
   setBusy(true);
   try{
     const gen=await loadModel();
     const context=knowledge.trim()?`\n\nEIGENE WISSENSBASIS:\n${knowledge.slice(0,6000)}`:"";
     const system=`Du bist Twilight Dev AI, eine lokale Entwickler-KI. Antworte praktisch, korrekt und kompakt. Modus: ${mode.toUpperCase()}. ${mode==="debug"?"Diagnose zuerst die Ursache und zeige dann die Reparatur.":""}${mode==="explain"?"Erkläre von einfach nach fortgeschritten.":""}${mode==="improve"?"Verbessere den Code ohne unnötig das Verhalten zu ändern.":""}${mode==="create"?"Liefere eine saubere vollständige Implementierung.":""}${context}`;
     const prompt=`<|im_start|>system\n${system}<|im_end|>\n<|im_start|>user\n${text}<|im_end|>\n<|im_start|>assistant\n`;
     const result=await gen(prompt,{max_new_tokens:400,temperature:0.7,do_sample:true,return_full_text:false});
     const generated=(result as any)?.[0]?.generated_text ?? "Keine Antwort erzeugt.";
     setMessages(x=>[...x,{id:Date.now()+1,role:"assistant",text:String(generated).trim()}]);
   }catch(err){
     setMessages(x=>[...x,{id:Date.now()+1,role:"assistant",text:`Lokale KI konnte nicht gestartet werden. ${err instanceof Error?err.message:String(err)}`}]);
     setProgress("Fehler beim Laden der lokalen KI");
   }finally{setBusy(false);}
 }

 function saveKnowledge(){localStorage.setItem("twilight-knowledge",knowledge);setProgress("Eigene Wissensbasis gespeichert · nur auf diesem Gerät");}
 function newChat(){setMessages([]);setInput("");}

 return <main className="shell">
  <aside className="sidebar">
   <div className="brand"><div className="logo">T</div><div><strong>TWILIGHT</strong><span>DEV AI</span></div></div>
   <button className="newChat" onClick={newChat}>＋ New chat</button>
   <div className="sectionTitle">Developer tools</div>
   <nav>{modes.map(m=><button key={m.id} className={`navItem ${mode===m.id?"active":""}`} onClick={()=>setMode(m.id)}><span className="navIcon">{m.icon}</span>{m.label}</button>)}</nav>
   <div className="sideBottom"><div className="statusDot"><i/>{busy?" AI arbeitet lokal":" AI lokal"}</div><small>{progress}</small></div>
  </aside>
  <section className="workspace">
   <header className="topbar"><div><div className="eyebrow">PRIVATE LOCAL INFERENCE</div><h1>Twilight Dev AI</h1></div><div className="modeBadge">{modes.find(x=>x.id===mode)?.label}</div></header>
   <div className="chat">
    {messages.length===0?<div className="hero"><div className="orb">✦</div><h2>Deine eigene lokale KI.</h2><p>Kein OpenAI. Kein Gemini. Kein API-Key. Das Modell läuft direkt im Browser.</p><div className="quickGrid">{["Find the bug in this Python code","Explain async/await like I’m new","Improve this React component","Create a Discord bot command"].map(q=><button key={q} onClick={()=>setInput(q)}>{q}<span>→</span></button>)}</div><div className="knowledge"><div><b>Eigene Wissensbasis</b><span> Füge Regeln, Notizen oder Wissen ein. Es wird lokal gespeichert.</span></div><textarea value={knowledge} onChange={e=>setKnowledge(e.target.value)} placeholder="z.B. Twilight-Projektwissen …"/><button onClick={saveKnowledge}>Wissen speichern</button></div></div>:<div className="messages">{messages.map(m=><div key={m.id} className={`message ${m.role}`}><div className="avatar">{m.role==="user"?"YOU":"T"}</div><div className="bubble"><pre>{m.text}</pre></div></div>)}{busy&&<div className="typing"><span/><span/><span/></div>}</div>}
   </div>
   <form className="composer" onSubmit={submit}><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void submit(e)}}} placeholder="Ask Twilight Dev AI..." rows={3}/><div className="composerBottom"><span>{progress}</span><button disabled={busy||!input.trim()}>{busy?"Lädt …":"Send ↗"}</button></div></form>
  </section>
 </main>;
}
