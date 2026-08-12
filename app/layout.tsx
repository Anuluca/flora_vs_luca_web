import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://flora-ball.anuluca.com"),
  title: "花花vs路卡 | Anutrium Games",
  description: "花花 vs 路卡是一款像素纸片风网页游戏。选择跑道、发射球形花花、连续撞飞路卡并守住猫窝。",
  applicationName: "花花 vs 路卡",
  authors: [{ name: "Anuluca", url: "https://anuluca.com" }],
  creator: "Anuluca",
  publisher: "Anuluca",
  category: "game",
  keywords: ["花花 vs 路卡", "花花", "路卡", "网页游戏", "猫咪游戏", "保龄球游戏", "像素游戏"],
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    title: "花花vs路卡 | Anutrium Games",
    description: "发射球形花花，连续撞飞路卡，守住猫窝。",
    type: "website",
    url: "/",
    siteName: "花花 vs 路卡",
    locale: "zh_CN",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "花花 vs 路卡" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "花花vs路卡 | Anutrium Games",
    description: "发射球形花花，连续撞飞路卡，守住猫窝。",
    images: ["/og.png"],
  },
  icons: {
    icon: [{ url: "/assets/hua-bowl-icon.png", type: "image/png", sizes: "900x900" }],
    shortcut: "/assets/hua-bowl-icon.png",
    apple: [{ url: "/assets/hua-bowl-icon.png", type: "image/png", sizes: "900x900" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: "花花 vs 路卡",
    url: "https://flora-ball.anuluca.com/",
    description: "发射球形花花，连续撞飞路卡并守住猫窝的像素纸片风网页游戏。",
    image: "https://flora-ball.anuluca.com/og.png",
    inLanguage: "zh-CN",
    genre: ["休闲游戏", "动作游戏"],
    applicationCategory: "Game",
    operatingSystem: "Web Browser",
    author: { "@type": "Person", name: "Anuluca", url: "https://anuluca.com" },
  };

  return (
    <html lang="zh-CN">
      <body>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        />
      </body>
    </html>
  );
}
