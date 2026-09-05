"use client";

import { useEffect, useRef, useState } from "react";
import { pipeline } from "@huggingface/transformers";

type Mode = "chat" | "recon" | "analyze" | "code" | "explain" | "knowledge";
type Message = { id: number; role: "user" | "assistant"; text: string };

const modes: { id: Mode; label: string; icon: string; hint: string }[] = [
  { id: "chat", label: "Command", icon: "⌘", hint: "Ask Twilight anything." },
  { id: "recon", label: "Recon Lab", icon: "◎", hint: "Plan authorized reconnaissance." },
  { id: "analyze", label: "Security Audit", icon: "◈", hint: "Review code and configs for weaknesses." },
  { id: "code", label: "Code", icon: "</>", hint: "Write defensive security tooling." },
  { id: "explain", label: "Explain", icon: "?", hint: "Break down security concepts." },
  { id: "knowledge", label: "Knowledge", icon: "✚", hint: "Feed your local knowledge base." },
];

const MODEL = "onnx-community/Qwen2.5-Coder-0.5B-Instruct";
const KNOWLEDGE_KEY = "twilight-pentest-knowledge";

const systemFor = (mode: Mode, knowledge: string) => `You are TWILIGHT PENTEST KI, a local security and development assistant.
You are designed for authorized security testing, CTFs, labs, code review, hardening and learning.
Never claim you performed a network action when you did not. You have no network access from the browser model.
For security requests, first clarify scope mentally and keep guidance authorized and defensive.
You can help analyze code, configs, logs, architecture, vulnerabilities, mitigations, detection and safe lab exercises.
When a request asks for harmful real-world intrusion, credential theft, malware, persistence, evasion, destructive actions or unauthorized access, refuse that part and redirect to a safe lab or defensive equivalent.
Mode: ${mode.toUpperCase()}.
${mode === "recon" ? "Focus on passive/authorized reconnaissance plans, asset inventories, attack-surface checklists and lab-safe commands." : ""}
${mode === "analyze" ? "Focus on finding security issues, severity, evidence, remediation and secure alternatives." : ""}
${mode === "code" ? "Produce complete, readable defensive code and explain important security decisions." : ""}
${mode === "explain" ? "Explain from beginner to advanced with practical defensive examples." : ""}
${knowledge.trim() ? `\nLOCAL USER KNOWLEDGE:\n${knowledge.slice(0, 12000)}` : ""}`;

export default function Home() {
  const [mode, setMode] = useState<Mode>("chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("LOCAL ENGINE · READY");
  const [knowledge, setKnowledge] = useState("");
  const [modelReady, setModelReady] = useState(false);
  const generator = useRef<any>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KNOWLEDGE_KEY);
      if (saved) setKnowledge(saved);
    } catch {}
  }, []);

  async function loadModel() {
    if (generator.current) return generator.current;
    setProgress("LOADING LOCAL MODEL · FIRST RUN");
    const device = typeof navigator !== "undefined" && "gpu" in navigator ? "webgpu" : "wasm";
    generator.current = await pipeline("text-generation", MODEL, {
      device: device as any,
      dtype: "q4",
      progress_callback: (p: any) => {
        if (p?.status === "progress" && typeof p.progress === "number") {
          setProgress(`MODEL DOWNLOAD · ${Math.round(p.progress)}%`);
        } else if (p?.status) setProgress(String(p.status).toUpperCase());
      },
    });
    setModelReady(true);
    setProgress(device === "webgpu" ? "LOCAL ENGINE · WEBGPU" : "LOCAL ENGINE · WASM CPU");
    return generator.current;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((x) => [...x, { id: Date.now(), role: "user", text }]);
    setBusy(true);
    try {
      const gen = await loadModel();
      const prompt = `<|im_start|>system\n${systemFor(mode, knowledge)}<|im_end|>\n<|im_start|>user\n${text}<|im_end|>\n<|im_start|>assistant\n`;
      const result = await gen(prompt, {
        max_new_tokens: 700,
        temperature: 0.55,
        do_sample: true,
        return_full_text: false,
      });
      const generated = result?.[0]?.generated_text ?? "No response generated.";
      setMessages((x) => [...x, { id: Date.now() + 1, role: "assistant", text: String(generated).trim() }]);
    } catch (err) {
      setMessages((x) => [...x, { id: Date.now() + 1, role: "assistant", text: `LOCAL ENGINE ERROR\n${err instanceof Error ? err.message : String(err)}` }]);
      setProgress("ENGINE ERROR · CHECK BROWSER CONSOLE");
    } finally {
      setBusy(false);
    }
  }

  function saveKnowledge() {
    localStorage.setItem(KNOWLEDGE_KEY, knowledge);
    setProgress("KNOWLEDGE SAVED · LOCAL ONLY");
  }

  function clearKnowledge() {
    localStorage.removeItem(KNOWLEDGE_KEY);
    setKnowledge("");
    setProgress("KNOWLEDGE CLEARED");
  }

  function newChat() {
    setMessages([]);
    setInput("");
  }

  const quick = [
    "Review this Python code for security issues and explain every finding.",
    "Build a safe reconnaissance checklist for my own CTF lab.",
    "Explain SSRF, XSS and SQL injection with vulnerable vs secure examples.",
    "Create a defensive Python log analyzer for suspicious authentication events.",
  ];

  return (
    <main className="appShell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">T</div>
          <div><strong>TWILIGHT</strong><span>PENTEST KI</span></div>
        </div>
        <button className="newChat" onClick={newChat}>＋ New session</button>
        <div className="sectionTitle">Security workspace</div>
        <nav>{modes.map((m) => <button key={m.id} className={`navItem ${mode === m.id ? "active" : ""}`} onClick={() => setMode(m.id)}><span className="navIcon">{m.icon}</span><span>{m.label}</span></button>)}</nav>
        <div className="sideBottom">
          <div className="status"><i className={modelReady ? "ready" : ""} />{modelReady ? "ENGINE ONLINE" : "ENGINE STANDBY"}</div>
          <small>{progress}</small>
          <small className="localOnly">● NO API KEY · LOCAL INFERENCE</small>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><div className="eyebrow">TWILIGHT SECURITY SYSTEM · LOCAL MODE</div><h1>Twilight Pentest KI</h1></div>
          <div className="topStatus"><span />AUTHORIZED LAB MODE</div>
        </header>

        <div className="chatArea">
          {messages.length === 0 ? (
            <div className="hero">
              <div className="heroMark"><span>✦</span></div>
              <div className="kicker">PRIVATE SECURITY ASSISTANT</div>
              <h2>Think. Analyze. Build.</h2>
              <p>Eine lokale Security-KI für Code-Reviews, CTFs, Labs, Hardening und Entwickler-Workflows.</p>
              <div className="capabilities">
                <div><b>01</b><span>Code &amp; Config Audits</span></div>
                <div><b>02</b><span>Recon Planning</span></div>
                <div><b>03</b><span>Secure Coding</span></div>
                <div><b>04</b><span>Local Knowledge</span></div>
              </div>
              <div className="quickGrid">{quick.map((q) => <button key={q} onClick={() => setInput(q)}>{q}<span>↗</span></button>)}</div>
              <div className="knowledgePanel">
                <div className="panelHead"><div><b>LOCAL KNOWLEDGE CORE</b><span> Feed your own notes, docs, rules or project context.</span></div><span className="localBadge">ON DEVICE</span></div>
                <textarea value={knowledge} onChange={(e) => setKnowledge(e.target.value)} placeholder="Paste your security notes, project architecture, coding rules, CTF notes, etc. …" />
                <div className="knowledgeActions"><button onClick={saveKnowledge}>Save knowledge</button><button className="ghost" onClick={clearKnowledge}>Clear</button></div>
              </div>
            </div>
          ) : (
            <div className="messages">{messages.map((m) => <div key={m.id} className={`message ${m.role}`}><div className="avatar">{m.role === "user" ? "YOU" : "T"}</div><div className="messageMeta"><span>{m.role === "user" ? "OPERATOR" : "TWILIGHT"}</span><div className="bubble"><pre>{m.text}</pre></div></div></div>)}{busy && <div className="typing"><span /><span /><span /></div>}</div>
          )}
        </div>

        <form className="composer" onSubmit={submit}>
          <div className="composerLabel"><span>TWILIGHT INPUT</span><span>{modes.find((x) => x.id === mode)?.label.toUpperCase()}</span></div>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(e); } }} placeholder="Enter command, code, logs or security question…" rows={3} />
          <div className="composerBottom"><span>{progress}</span><button disabled={busy || !input.trim()}>{busy ? "PROCESSING" : "EXECUTE ↗"}</button></div>
        </form>
      </section>
    </main>
  );
}
