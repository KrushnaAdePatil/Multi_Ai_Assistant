import type { Metadata, Viewport } from "next";
import { Instrument_Serif, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
  display: "swap",
});

const serifItalic = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif-i",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ORCHESTRA — Multi-AI Agent Orchestrator",
  description:
    "Ask once. DeepSeek, GPT-4o and Gemini reason in parallel — then an orchestrator fuses their answers into one definitive response.",
};

export const viewport: Viewport = {
  themeColor: "#05060a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${grotesk.variable} ${serifItalic.variable} ${mono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
