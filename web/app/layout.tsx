import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

const apercu = localFont({
  variable: "--font-apercu",
  src: [
    { path: "./fonts/apercu_light.otf", weight: "300", style: "normal" },
    { path: "./fonts/apercu_light_italic.otf", weight: "300", style: "italic" },
    { path: "./fonts/apercu_regular.otf", weight: "400", style: "normal" },
    {
      path: "./fonts/apercu_regular_italic.otf",
      weight: "400",
      style: "italic",
    },
    { path: "./fonts/apercu_medium.otf", weight: "500", style: "normal" },
    {
      path: "./fonts/apercu_medium_italic.otf",
      weight: "500",
      style: "italic",
    },
    { path: "./fonts/apercu_bold.otf", weight: "700", style: "normal" },
    { path: "./fonts/apercu_bold_italic.otf", weight: "700", style: "italic" },
  ],
});

const apercuMono = localFont({
  variable: "--font-apercu-mono",
  src: [{ path: "./fonts/apercu_mono.otf", weight: "400", style: "normal" }],
});

const signifier = localFont({
  variable: "--font-signifier",
  src: [
    { path: "./fonts/TestSignifier-Regular.otf", weight: "400", style: "normal" },
    { path: "./fonts/TestSignifier-Medium.otf", weight: "500", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "whoami.wiki",
  description: "your personal encyclopedia, written by agents",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${apercu.variable} ${apercuMono.variable} ${signifier.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Navbar />
          {children}
          <Footer />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
