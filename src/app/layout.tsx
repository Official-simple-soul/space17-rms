import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Backdrop } from "@/components/layout/backdrop";
import { Spotlight } from "@/components/ui/spotlight";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "space17 RMS", template: "%s · space17 RMS" },
  description: "Requests, approvals and departmental reports in one place.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.variable}>
      {/* Browser extensions (such as ColorZilla) add attributes to <body> before React loads. */}
      <body className="relative isolate min-h-dvh antialiased" suppressHydrationWarning>
        <Backdrop />
        {children}
        <Spotlight />
        <Toaster />
      </body>
    </html>
  );
}
