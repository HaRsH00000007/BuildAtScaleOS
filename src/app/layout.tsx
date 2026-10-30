import type { Metadata } from "next";
import { Lato, Titillium_Web } from "next/font/google";
import "./globals.css";

// Same type as buildatscale.com: Lato for text, Titillium Web for display headings.
const lato = Lato({ subsets: ["latin"], weight: ["400", "700", "900"], variable: "--font-lato" });
const titillium = Titillium_Web({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-titillium" });

export const metadata: Metadata = {
  title: "BuildAtScaleOS",
  description: "BuildAtScaleOS: projects, tasks and delivery in one place",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lato.variable} ${titillium.variable}`}>
      <body>{children}</body>
    </html>
  );
}
