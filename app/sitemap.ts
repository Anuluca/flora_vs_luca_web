import type { MetadataRoute } from "next";
import { SEO_PAGES, SITE_LAST_UPDATED, absoluteUrl } from "@/features/seo/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(SITE_LAST_UPDATED);
  return [
    {
      url: absoluteUrl("/"),
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...SEO_PAGES.map((page) => ({
      url: absoluteUrl(page.href),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
