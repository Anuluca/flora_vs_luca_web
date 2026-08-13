import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distRoot = join(projectRoot, "dist");
const publishRoot = join(distRoot, "netlify");
const prerenderRoot = join(distRoot, "server", "prerendered-routes");
const siteUrl = "https://flora-ball.anuluca.com";
const updatedAt = "2026-08-14";
const routes = ["/", "/guide", "/bestiary", "/levels", "/about"];

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: projectRoot, stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

await run("npx", ["vinext", "build", "--", "--prerender-all"]);
await mkdir(publishRoot, { recursive: true });
await cp(join(distRoot, "client"), publishRoot, { recursive: true, force: true });

for (const route of routes) {
  const sourceName = route === "/" ? "index.html" : `${route.slice(1)}.html`;
  const destination = route === "/" ? join(publishRoot, "index.html") : join(publishRoot, route.slice(1), "index.html");
  await mkdir(dirname(destination), { recursive: true });
  await cp(join(prerenderRoot, sourceName), destination, { force: true });
}

await cp(join(prerenderRoot, "404.html"), join(publishRoot, "404.html"), { force: true });

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map((route, index) => `  <url>
    <loc>${siteUrl}${route}</loc>
    <lastmod>${updatedAt}</lastmod>
    <changefreq>${index === 0 ? "weekly" : "monthly"}</changefreq>
    <priority>${index === 0 ? "1.0" : "0.7"}</priority>
  </url>`).join("\n")}
</urlset>
`;

const robots = `User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

Host: ${siteUrl}
Sitemap: ${siteUrl}/sitemap.xml
`;

const manifest = {
  name: "花花 vs 路卡",
  short_name: "花花vs路卡",
  description: "免费在线游玩《花花 vs 路卡》：拖动猫咪进入跑道，撞飞路卡并守住猫窝。",
  start_url: "/",
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

await Promise.all([
  writeFile(join(publishRoot, "sitemap.xml"), sitemap),
  writeFile(join(publishRoot, "robots.txt"), robots),
  writeFile(join(publishRoot, "manifest.webmanifest"), `${JSON.stringify(manifest, null, 2)}\n`),
]);

// 确认所有 canonical 页面都已真实进入静态发布目录，避免构建成功但线上返回 404。
await Promise.all(routes.map(async (route) => {
  const path = route === "/" ? join(publishRoot, "index.html") : join(publishRoot, route.slice(1), "index.html");
  const html = await readFile(path, "utf8");
  if (!html.includes(`<link rel="canonical" href="${siteUrl}${route === "/" ? "" : route}"`)) {
    throw new Error(`Missing canonical metadata in ${route}`);
  }
}));
