import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "花花 vs 路卡｜猫窝保卫战",
  description: "像素纸片风网页保龄游戏：滚动花花，弹射连撞，守住猫窝。",
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
