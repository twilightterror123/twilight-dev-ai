"use client";

import { useEffect, useState } from "react";

type Platform = "windows" | "linux" | "android";

const releases = "https://github.com/twilightterror123/twilight-dev-ai/releases/latest/download";

const apps: Record<Platform, { name: string; file: string; note: string; icon: string }> = {
  windows: { name: "Windows", file: "Twilight-latest-windows.exe", note: "Windows 10 / 11 · 64-bit", icon: "⊞" },
  linux: { name: "Linux", file: "Twilight-latest-linux.deb", note: "Debian / Ubuntu · 64-bit", icon: "◆" },
  android: { name: "Android", file: "Twilight-latest-android.apk", note: "Android · APK", icon: "▣" },
};

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "windows";
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return "android";
  if (/windows/.test(ua)) return "windows";
  return "linux";
}

export default function DownloadsPage() {
  const [platform, setPlatform] = useState<Platform>("windows");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("platform");
    if (requested === "windows" || requested === "linux" || requested === "android") setPlatform(requested);
    else setPlatform(detectPlatform());
  }, []);

  const recommended = apps[platform];

  return <main className="downloadsPage">
    <div className="downloadsShell">
      <a className="backLink" href="/">← Back to Twilight</a>
      <div className="downloadsHero">
        <div className="downloadsLogo">T</div>
        <div><div className="eyebrow">TWILIGHT APPS</div><h1>Download Twilight</h1><p>Real desktop and mobile builds of the TWILIGHT AI client.</p></div>
      </div>

      <section className="recommendedCard">
        <div className="recommendedLabel">RECOMMENDED FOR YOUR DEVICE</div>
        <div className="recommendedMain"><div className="bigAppIcon">{recommended.icon}</div><div><h2>{recommended.name}</h2><p>{recommended.file} · {recommended.note}</p></div></div>
        <a className="primaryDownload" href={`${releases}/${recommended.file}`}>↓ Download {recommended.name}</a>
      </section>

      <div className="downloadSectionTitle">All apps</div>
      <div className="appGrid">
        {(Object.entries(apps) as [Platform, typeof apps[Platform]][]).map(([key, app]) => <article className={`appCard ${key === platform ? "selected" : ""}`} key={key}>
          <div className="appIcon">{app.icon}</div><div className="appCardTop"><h3>{app.name}</h3>{key === platform && <span>Recommended</span>}</div><p>{app.note}</p><code>{app.file}</code><a href={`${releases}/${app.file}`}>Download</a>
        </article>)}
      </div>

      <div className="downloadInfo"><strong>These are installers, not website shortcuts.</strong><span>Windows uses an EXE installer, Linux uses a DEB package, and Android uses an APK. Builds are generated automatically from the TWILIGHT source.</span></div>
    </div>
  </main>;
}
