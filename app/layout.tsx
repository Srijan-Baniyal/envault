import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ShareEnv — Zero-Knowledge Environment Sharing",
  description:
    "Share environment variables securely with client-side AES-256-GCM encryption, Argon2id key derivation, and HMAC-SHA-256 integrity. Your secrets never leave your browser.",
  keywords: [
    "environment variables",
    "zero-knowledge",
    "encryption",
    "AES-256-GCM",
    "secret sharing",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${dmSans.variable} ${jetBrainsMono.variable} dark h-full antialiased`}
      lang="en"
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
