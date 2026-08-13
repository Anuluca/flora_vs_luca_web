import type { Metadata } from "next";

export const SITE_URL = "https://flora-ball.anuluca.com";
export const SITE_NAME = "花花 vs 路卡";
export const SITE_TITLE = "花花 vs 路卡：免费在线猫咪防守网页游戏";
export const SITE_DESCRIPTION = "免费在线游玩《花花 vs 路卡》：拖动球形花花和车轮花花进入跑道，撞飞路卡与牛马路卡，守住猫窝最后的防线。无需安装，支持电脑和手机浏览器。";
export const SITE_AUTHOR = "Anuluca";
export const SITE_VERSION = "0.1_demo";
export const SITE_LAST_UPDATED = "2026-08-14";
export const OG_IMAGE = "/og.png";

export const SEO_PAGES = [
  { href: "/guide", label: "玩法指南", description: "操作方式、得分规则、红温状态和通关技巧" },
  { href: "/bestiary", label: "猫咪与敌人图鉴", description: "球形花花、车轮花花、路卡与牛马路卡资料" },
  { href: "/levels", label: "关卡资料", description: "魔丸降世、隐藏关和第二章现有配置" },
  { href: "/about", label: "关于游戏", description: "世界观、制作人、版本信息与项目链接" },
] as const;

export function absoluteUrl(path = "/") {
  return new URL(path, SITE_URL).toString();
}

/** 静态内容页共用的搜索和社交分享元数据，防止标题、摘要与 canonical 分叉。 */
export function createSeoMetadata(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      type: "website",
      url: path,
      siteName: SITE_NAME,
      locale: "zh_CN",
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: `${SITE_NAME}网页游戏画面` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [OG_IMAGE],
    },
  };
}
