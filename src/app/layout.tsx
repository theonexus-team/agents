import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Theonexus Trading Oracle",
  description: "Paper-trading algo desk — live signal feed, trade log, and engine controls.",
  manifest: "/manifest.json",
  appleWebApp: {
    // Required for iOS Safari to allow Web Push at all — it only works from a
    // site that's been added to the home screen as a standalone app, not a
    // regular browser tab. This is what makes "Add to Home Screen" register as
    // that kind of app instead of a plain bookmark.
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Theonexus",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
