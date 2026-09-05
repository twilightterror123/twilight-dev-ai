import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Twilight Dev AI", description: "Developer AI assistant" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
