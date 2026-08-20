import type { Metadata, Viewport } from "next";
import {
  OG_IMAGE,
  SITE_AUTHOR,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
  absoluteUrl,
} from "@/features/seo/site";
import "./globals.css";
import "./seo.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_AUTHOR, url: "https://anuluca.com" }],
  creator: SITE_AUTHOR,
  publisher: SITE_AUTHOR,
  category: "在线游戏",
  classification: "免费网页游戏",
  referrer: "origin-when-cross-origin",
  keywords: [
    "花花 vs 路卡",
    "花花vs路卡",
    "免费网页游戏",
    "在线小游戏",
    "猫咪游戏",
    "塔防游戏",
    "跑道防守游戏",
    "浏览器游戏",
    "Anuluca",
  ],
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    locale: "zh_CN",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, type: "image/png", alt: "花花 vs 路卡免费在线网页游戏主菜单" }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: OG_IMAGE, alt: "花花 vs 路卡免费在线网页游戏主菜单" }],
  },
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "black-translucent" },
  formatDetection: { email: false, address: false, telephone: false },
  icons: {
    icon: [{ url: "/hua-bowl-favicon-v3.png", type: "image/png", sizes: "512x512" }],
    shortcut: "/hua-bowl-favicon-v3.png",
    apple: [{ url: "/hua-bowl-favicon-v3.png", type: "image/png", sizes: "512x512" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#e7dfcb",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const structuredData = [
    {
      "@type": "WebSite",
      "@id": `${absoluteUrl("/")}#website`,
      url: absoluteUrl("/"),
      name: SITE_NAME,
      alternateName: ["花花vs路卡", "Flora vs Luca"],
      description: SITE_DESCRIPTION,
      inLanguage: "zh-CN",
      publisher: { "@id": `${absoluteUrl("/")}#creator` },
    },
    {
      "@type": "VideoGame",
      "@id": `${absoluteUrl("/")}#game`,
      name: SITE_NAME,
      alternateName: "Flora vs Luca",
      url: absoluteUrl("/"),
      description: SITE_DESCRIPTION,
      image: absoluteUrl(OG_IMAGE),
      screenshot: absoluteUrl(OG_IMAGE),
      inLanguage: ["zh-CN", "en"],
      genre: ["休闲游戏", "动作游戏", "防守游戏"],
      applicationCategory: "BrowserGame",
      gamePlatform: ["Web Browser", "Desktop", "Mobile"],
      operatingSystem: "Any operating system with a modern web browser",
      isAccessibleForFree: true,
      playMode: "SinglePlayer",
      author: { "@id": `${absoluteUrl("/")}#creator` },
      publisher: { "@id": `${absoluteUrl("/")}#creator` },
      mainEntityOfPage: { "@id": `${absoluteUrl("/")}#website` },
    },
    {
      "@type": "Person",
      "@id": `${absoluteUrl("/")}#creator`,
      name: SITE_AUTHOR,
      url: "https://anuluca.com/",
      sameAs: ["https://github.com/Anuluca"],
    },
  ];
  const jsonLd = { "@context": "https://schema.org", "@graph": structuredData };

  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://assets.anuluca.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://assets.anuluca.com" />
        <link rel="preload" href="https://assets.anuluca.com/fonts/unboundedsans.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      </body>
    </html>
  );
}
