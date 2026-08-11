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
  assert.match(html, /<title>花花 vs 路卡｜<\/title>/i);
  assert.match(html, /等一下!/);
  assert.match(html, /花花正在睡觉/);
  assert.match(html, /https:\/\/flora-ball\.anuluca\.com/);
  assert.match(html, /application\/ld\+json/);
  assert.doesNotMatch(html, /资源准备中|正在提前加载并解码全部游戏图片/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|SkeletonPreview/);
});

test("keeps the game configuration and project boundaries verifiable", async () => {
  const [game, cats, enemies, levels, model, storage, configTypes, page, layout, vite, packageJson] = await Promise.all([
    readFile(new URL("../app/HuaVsLucaGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../features/game/config/cats.ts", import.meta.url), "utf8"),
    readFile(new URL("../features/game/config/enemies.ts", import.meta.url), "utf8"),
    readFile(new URL("../features/game/config/levels.ts", import.meta.url), "utf8"),
    readFile(new URL("../features/game/domain/model.ts", import.meta.url), "utf8"),
    readFile(new URL("../features/game/infrastructure/progress-storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../features/game/domain/config-types.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(levels, /export const LEVELS = \[/);
  assert.equal((levels.match(/id: "1-[1-5]"/g) ?? []).length, 5);
  assert.match(levels, /difficulty:\s*1/);
  assert.match(levels, /difficulty:\s*5/);
  assert.match(model, /lanes:\s*5/);
  assert.match(model, /endlessEnemySpeedMultiplier:\s*4/);
  assert.match(game, /requestAnimationFrame/);
  assert.match(storage, /LEVEL_PROGRESS_STORAGE_KEY = "hua-vs-luca-level-progress-v1"/);
  assert.match(storage, /loadLevelProgress/);
  assert.match(storage, /saveLevelProgress/);
  assert.match(game, /completed:\s*true/);
  assert.match(game, /src=\{ball\.asset\}/);
  assert.match(game, /type Screen =/);
  assert.match(game, /\| "level-briefing"/);
  assert.match(game, /\| "about"/);
  assert.match(game, /\| "bestiary"/);
  assert.match(game, /const isOpen = levelIndex === 0/);
  assert.match(game, /disabled=\{!isOpen\}/);
  const levelConfig = configTypes.match(/type LevelConfig[^=]*= \{([\s\S]*?)\};/)?.[1] ?? "";
  assert.doesNotMatch(levelConfig, /description/);
  assert.match(cats, /export const CAT_TYPES/);
  assert.match(cats, /projectileAssets/);
  assert.match(cats, /previewAssets/);
  assert.match(cats, /不知道为什么，花花从出生起就掌握了变成球的能力。/);
  assert.equal((cats.match(/hua-bowl-[12]\.png/g) ?? []).length, 6);
  assert.match(enemies, /export const ENEMY_TYPES/);
  assert.match(enemies, /这个路卡就是逊啦。/);
  assert.equal((enemies.match(/#D4C892/g) ?? []).length, 2);
  assert.match(levels, /catTypeIds/);
  assert.match(levels, /enemyTypeIds/);
  assert.match(game, /completion-label/);
  assert.match(game, /Promise\.all\(GAME_ASSET_URLS\.map\(loadAsset\)\)/);
  assert.doesNotMatch(game, /addEventListener\("keydown"/);
  assert.match(page, /<HuaVsLucaGame \/>/);
  assert.match(layout, /lang="zh-CN"/);
  assert.match(layout, /https:\/\/flora-ball\.anuluca\.com/);
  assert.match(layout, /\/assets\/hua-bowl-1\.png/);
  assert.match(vite, /port:\s*3002/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("app/_sites-preview", projectRoot)));
});
