import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://flora-ball.anuluca.com/sitemap.xml",
    host: "https://flora-ball.anuluca.com",
  };
}
