import type { Metadata } from "next";
/* 字体自托管（npm 包随构建打包，按 unicode-range 分片加载）——
   jsDelivr 在国内不稳，CDN 挂掉会导致中文回退 SimSun（"干巴巴"的元凶） */
import "@fontsource/noto-sans-sc/index.css";
import "@fontsource/noto-sans-sc/500.css";
import "@fontsource/noto-serif-sc/index.css";
import "@fontsource/noto-serif-sc/500.css";
import "./globals.css";
import { ParsingBadge } from "@/components/parsing/ParsingBadge";
import { JournalDemoSeed } from "@/components/me/JournalDemoSeed";

export const metadata: Metadata = {
  title: "知音",
  description: "内容不再刷完就沉底，而是接进你已有的知识里。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <ParsingBadge />
        <JournalDemoSeed />
      </body>
    </html>
  );
}
