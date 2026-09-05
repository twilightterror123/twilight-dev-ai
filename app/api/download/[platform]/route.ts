const REPO = "twilightterror123/twilight-dev-ai";

const FILES: Record<string, string> = {
  windows: "Twilight-latest-windows.exe",
  linux: "Twilight-latest-linux.deb",
  android: "Twilight-latest-android.apk",
};

const RELEASE_PREFIXES: Record<string, string> = {
  windows: "twilight-desktop-",
  linux: "twilight-desktop-",
  android: "twilight-android-",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ platform: string }> }) {
  const { platform: rawPlatform } = await context.params;
  const platform = rawPlatform.toLowerCase();
  const file = FILES[platform];
  const prefix = RELEASE_PREFIXES[platform];

  if (!file || !prefix) {
    return Response.json({ error: "Unsupported platform." }, { status: 404 });
  }

  try {
    const releasesResponse = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "TWILIGHT-App-Downloader",
      },
      cache: "no-store",
    });

    if (!releasesResponse.ok) {
      return Response.json({ error: "TWILIGHT downloads are temporarily unavailable." }, { status: 503 });
    }

    const releases = await releasesResponse.json();
    const release = Array.isArray(releases)
      ? releases.find(
          (item: { draft?: boolean; prerelease?: boolean; tag_name?: string }) =>
            item?.draft === false && item?.prerelease === false && item?.tag_name?.startsWith(prefix),
        )
      : null;

    if (!release) {
      return Response.json({ error: `The ${platform} installer is not published yet.` }, { status: 404 });
    }

    const asset = Array.isArray(release.assets)
      ? release.assets.find((item: { name?: string; browser_download_url?: string }) => item?.name === file)
      : null;

    if (!asset?.browser_download_url) {
      return Response.json({ error: `The ${platform} installer is not available in the latest build.` }, { status: 404 });
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
    headers.set("Cache-Control", "no-store, max-age=0");

    return new Response(assetResponse.body, { status: 200, headers });
  } catch (error) {
    console.error("Installer download error:", error);
    return Response.json({ error: "The installer download failed." }, { status: 502 });
  }
}
