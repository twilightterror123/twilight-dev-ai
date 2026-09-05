import { NextResponse } from "next/server";

const FILES: Record<string, string> = {
  windows: "Twilight-latest-windows.exe",
  linux: "Twilight-latest-linux.deb",
  android: "Twilight-latest-android.apk",
};

export function GET(_request: Request, context: { params: Promise<{ platform: string }> }) {
  return context.params.then(({ platform }) => {
    const file = FILES[platform.toLowerCase()];
    if (!file) {
      return NextResponse.json({ error: "Unsupported platform." }, { status: 404 });
    }

    const url = `https://github.com/twilightterror123/twilight-dev-ai/releases/latest/download/${file}`;
    return NextResponse.redirect(url, 302);
  });
}
