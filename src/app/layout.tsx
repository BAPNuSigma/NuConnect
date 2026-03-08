import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import TestModeBanner from "./components/TestModeBanner";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NuConnect CRM",
  description: "Speaker invites, eligibility & speaker logs for chapter events",
};

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/firms", label: "Firms" },
  { href: "/invites", label: "Invites" },
  { href: "/speaker-logs", label: "Speaker logs" },
  { href: "/scheduling", label: "Scheduling form" },
  { href: "/settings", label: "Settings" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased min-h-screen`}
        suppressHydrationWarning
      ><div className="min-h-screen flex flex-col">
          <TestModeBanner />
          <header className="border-b border-zinc-800 bg-[var(--card)]">
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
              <Link href="/" className="text-lg font-semibold text-[var(--accent)]">
                NuConnect CRM
              </Link>
              <nav className="flex gap-6">
                {nav.map(({ href, label }) =>
                  href === "/settings" ? (
                    <a key={href} href={href} className="text-zinc-400 hover:text-white transition">
                      {label}
                    </a>
                  ) : (
                    <Link key={href} href={href} className="text-zinc-400 hover:text-white transition">
                      {label}
                    </Link>
                  )
                )}
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-8 flex-1 w-full">{children}</main>
        </div>
      </body>
    </html>
  );
}
