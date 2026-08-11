import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://hua-vs-luca.reltilucario.chatgpt.site"),
  title: "花花 vs 路卡｜猫咪保龄战",
  description: "像素纸片风网页保龄游戏：滚动花花，弹射连撞，守住猫窝。",
  openGraph: {
    title: "花花 vs 路卡｜猫咪保龄战",
    description: "滚动花花，弹飞路卡，守住猫窝。",
    type: "website",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "花花 vs 路卡" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "花花 vs 路卡｜猫咪保龄战",
    description: "滚动花花，弹飞路卡，守住猫窝。",
    images: ["/og.png"],
  },
  icons: {
    icon: "/assets/luca-head.png",
    shortcut: "/assets/luca-head.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
