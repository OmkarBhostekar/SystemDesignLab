import type { Metadata, Viewport } from "next";

import { AppShell } from "@/components/layout/AppShell";
import { SkipLink } from "@/components/layout/SkipLink";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "System Design Lab",
    template: "%s | System Design Lab",
  },
  description: "A calm, visual-first theory reader for backend system-design interviews.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <SkipLink />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
