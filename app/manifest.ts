import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/features/seo/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "花花vs路卡",
    description: SITE_DESCRIPTION,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#e7dfcb",
    theme_color: "#e7dfcb",
    lang: "zh-CN",
    orientation: "any",
    categories: ["games", "entertainment"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
