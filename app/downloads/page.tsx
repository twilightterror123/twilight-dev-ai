"use client";

import { useEffect, useState } from "react";

type Platform = "windows" | "linux" | "android";

type AppInfo = { name: string; file: string; note: string; icon: string };

const apps: Record<Platform, AppInfo> = {
  windows: { name: "Windows", file: "Twilight-latest-windows.exe", note: "Windows 10 / 11 · 64-bit", icon: "⊞" },
  linux: { name: "Linux", file: "Twilight-latest-linux.deb", note: "Debian / Ubuntu · 64-bit", icon: "◆" },
  android: { name: "Android", file: "Twilight-latest-android.apk", note: "Android · APK", icon: "▣" },
};

function detectPlatform(): Platform | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return "android";
  if (/windows/.test(ua)) return "windows";
  if (/linux/.test(ua)) return "linux";
  return "other";
}

function hrefFor(platform: Platform) {
  return `/api/download/${platform}`;
}

export default function DownloadsPage() {
  const [platform, setPlatform] = useState<Platform | "other">("other");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("platform");
    if (requested === "windows" || requested === "linux" || requested === "android") setPlatform(requested);
    else setPlatform(detectPlatform());
  }, []);

  const recommended = platform === "other" ? null : apps[platform];

  return <main className="downloadsPage">
    <div className="downloadsShell">
      <a className="backLink" href="/">← Back to Twilight</a>
      <div className="downloadsHero">
        <div className="downloadsLogo">T</div>
        <div><div className="eyebrow">TWILIGHT APP</div><h1>Download Twilight</h1><p>Official TWILIGHT desktop and mobile installers.</p></div>
      </div>

      {recommended && <section className="recommendedCard">
        <div className="recommendedLabel">RECOMMENDED FOR YOUR DEVICE</div>
        <div className="recommendedMain"><div className="bigAppIcon">{recommended.icon}</div><div><h2>{recommended.name}</h2><p>{recommended.file} · {recommended.note}</p></div></div>
        <a className="primaryDownload" href={hrefFor(platform)}>↓ Download and install</a>
        <div className="downloadHint">The button downloads the installer directly. Your operating system may ask you to confirm the installation.</div>
      </section>}

      <div className="downloadSectionTitle">All apps</div>
      <div className="appGrid">
        {(Object.entries(apps) as [Platform, AppInfo][]).map(([key, app]) => <article className={`appCard ${key === platform ? "selected" : ""}`} key={key}>
          <div className="appIcon">{app.icon}</div>
          <div className="appCardTop"><h3>{app.name}</h3>{key === platform && <span>Recommended</span>}</div>
          <p>{app.note}</p><code>{app.file}</code>
          <a href={hrefFor(key)}>Download</a>
        </article>)}
      </div>

      <div className="downloadInfo"><strong>Direct installer downloads.</strong><span>Windows: EXE installer · Linux: DEB package · Android: APK. A website cannot silently install desktop/mobile software; the operating system still requires the normal user confirmation.</span></div>
    </div>
  </main>;
}
