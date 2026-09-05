const REPO = "twilightterror123/twilight-dev-ai";

const FILES: Record<string, string> = {
  windows: "Twilight-latest-windows.exe",
  linux: "Twilight-latest-linux.deb",
  android: "Twilight-latest-android.apk",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ platform: string }> }) {
  const { platform: rawPlatform } = await context.params;
  const platform = rawPlatform.toLowerCase();
  const file = FILES[platform];

  if (!file) {
    return Response.json({ error: "Unsupported platform." }, { status: 404 });
  }

  try {
    const releaseResponse = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "TWILIGHT-App-Downloader",
      },
      cache: "no-store",
    });

    if (!releaseResponse.ok) {
      return Response.json(
        { error: "The TWILIGHT installer has not been published yet. Please try again shortly." },
        { status: 404 },
      );
    }

    const release = await releaseResponse.json();
    const asset = Array.isArray(release.assets)
      ? release.assets.find((item: { name?: string }) => item?.name === file)
      : null;

    if (!asset?.browser_download_url) {
      return Response.json(
        { error: `The ${platform} installer is not available in the latest TWILIGHT build yet.` },
        { status: 404 },
      );
    }

    const assetResponse = await fetch(asset.browser_download_url, {
      headers: {
        Accept: "application/octet-stream",
        "User-Agent": "TWILIGHT-App-Downloader",
      },
      cache: "no-store",
    });

    if (!assetResponse.ok || !assetResponse.body) {
      return Response.json({ error: "The installer could not be downloaded right now." }, { status: 502 });
    }

    const headers = new Headers();
    headers.set("Content-Type", assetResponse.headers.get("content-type") || "application/octet-stream");
    headers.set("Content-Disposition", `attachment; filename="${file}"`);
    const length = assetResponse.headers.get("content-length");
    if (length) headers.set("Content-Length", length);
    headers.set("Cache-Control", "no-store");

    return new Response(assetResponse.body, { status: 200, headers });
  } catch (error) {
    console.error("Installer download error:", error);
    return Response.json({ error: "The installer download failed." }, { status: 502 });
  }
}
