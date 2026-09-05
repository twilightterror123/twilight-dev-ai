import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TWILIGHT PENTEST KI",
  description: "Private local security assistant for authorized labs, CTFs, code analysis and defensive security work.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}</body></html>;
}
