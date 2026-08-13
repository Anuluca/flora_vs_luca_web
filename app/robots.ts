import type { MetadataRoute } from "next";
import { SITE_URL } from "@/features/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // 不屏蔽构建产物：搜索引擎需要 CSS 与 JavaScript 才能完整渲染游戏页面。
      { userAgent: "*", allow: "/" },
      { userAgent: "GPTBot", allow: "/" },
      { userAgent: "OAI-SearchBot", allow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
