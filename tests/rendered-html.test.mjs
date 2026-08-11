import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the complete Hua vs Luca game shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]+lang="zh-CN"/i);
  assert.match(html, /<title>花花 vs 路卡｜猫咪保龄战<\/title>/i);
  assert.match(html, /资源准备中/);
  assert.match(html, /正在提前加载并解码全部游戏图片/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|SkeletonPreview/);
});

test("keeps the game configuration and starter cleanup verifiable", async () => {
  const [game, page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/HuaVsLucaGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(game, /totalEnemies:\s*18/);
  assert.match(game, /lanes:\s*5/);
  assert.match(game, /requestAnimationFrame/);
  assert.match(game, /localStorage\.setItem\("hua-vs-luca-best"/);
  assert.match(game, /hua-bowl-\$\{ball\.skin\}/);
  assert.match(game, /type Screen = "loading" \| "main-menu" \| "level-select" \| "game"/);
  assert.match(game, /className="level-card is-open"/);
  assert.match(game, /Promise\.all\(GAME_ASSET_URLS\.map\(loadAsset\)\)/);
  assert.doesNotMatch(game, /addEventListener\("keydown"/);
  assert.match(page, /<HuaVsLucaGame \/>/);
  assert.match(layout, /lang="zh-CN"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("app\/_sites-preview", projectRoot)));
});
