import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const publishRoot = join(projectRoot, "dist", "netlify");
const siteUrl = "https://flora-ball.anuluca.com";
const pages = [
  ["/", "花花 vs 路卡：免费在线猫咪防守网页游戏", "花花 vs 路卡：免费在线猫咪防守网页游戏"],
  ["/guide", "玩法指南 | 花花 vs 路卡", "基本操作"],
  ["/bestiary", "猫咪与敌人图鉴 | 花花 vs 路卡", "牛马路卡"],
  ["/levels", "关卡资料 | 花花 vs 路卡", "魔丸降世"],
  ["/about", "关于游戏 | 花花 vs 路卡", "制作人"],
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

for (const [route, title, visibleText] of pages) {
  const htmlPath = route === "/" ? join(publishRoot, "index.html") : join(publishRoot, route.slice(1), "index.html");
  const html = await readFile(htmlPath, "utf8");
  const canonical = `${siteUrl}${route === "/" ? "" : route}`;
  assert.match(html, new RegExp(`<title>${escapeRegExp(title)}<\\/title>`), `${route}: title`);
  assert.ok(html.includes(`<link rel="canonical" href="${canonical}"`), `${route}: canonical`);
  assert.match(html, /<meta name="description" content="[^"]{50,}"/, `${route}: description`);
  assert.ok(html.includes(visibleText), `${route}: visible copy`);
  assert.match(html, /<meta property="og:image" content="https:\/\/flora-ball\.anuluca\.com\/og\.png"/, `${route}: OG image`);
}

for (const file of [
  "robots.txt",
  "sitemap.xml",
  "manifest.webmanifest",
  "og.png",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png",
  "404.html",
]) {
  await access(join(publishRoot, file));
}

const [robots, sitemap] = await Promise.all([
  readFile(join(publishRoot, "robots.txt"), "utf8"),
  readFile(join(publishRoot, "sitemap.xml"), "utf8"),
]);
assert.match(robots, /Sitemap: https:\/\/flora-ball\.anuluca\.com\/sitemap\.xml/);
for (const [route] of pages) assert.ok(sitemap.includes(`<loc>${siteUrl}${route}</loc>`), `sitemap: ${route}`);

console.log(`SEO audit passed: ${pages.length} indexable pages and all crawler assets verified.`);
