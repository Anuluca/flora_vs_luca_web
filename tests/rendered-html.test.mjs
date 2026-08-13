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
  assert.match(html, /<title>花花 vs 路卡：免费在线猫咪防守网页游戏<\/title>/i);
  assert.match(html, /正在把花花运过来\.\.\./);
  assert.match(html, /花花正在睡觉/);
  assert.match(html, /https:\/\/flora-ball\.anuluca\.com/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /花花 vs 路卡：免费在线猫咪防守网页游戏/);
  assert.match(html, /href="\/guide"/);
  assert.match(html, /href="\/bestiary"/);
  assert.match(html, /href="\/levels"/);
  assert.match(html, /href="\/about"/);
  assert.match(html, /"@type":"WebSite"/);
  assert.match(html, /"@type":"VideoGame"/);
  assert.doesNotMatch(html, /资源准备中|正在提前加载并解码全部游戏图片/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|SkeletonPreview/);
});

test("renders crawlable SEO content pages with unique metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("seo-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const pages = [
    ["/guide", "玩法指南", "基本操作"],
    ["/bestiary", "猫咪与敌人图鉴", "牛马路卡"],
    ["/levels", "关卡资料", "魔丸降世"],
    ["/about", "关于游戏", "制作人"],
  ];

  for (const [path, title, content] of pages) {
    const response = await worker.fetch(
      new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
      { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
      { waitUntil() {}, passThroughOnException() {} },
    );
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, new RegExp(`<title>${title} \\| 花花 vs 路卡<\\/title>`));
    assert.match(html, new RegExp(`rel="canonical" href="https://flora-ball\\.anuluca\\.com${path}"`));
    assert.match(html, new RegExp(content));
    assert.match(html, /href="\/"/);
  }
});

test("keeps the game configuration and project boundaries verifiable", async () => {
  const [game, globals, cats, enemies, levels, gameAssets, model, storage, configTypes, i18n, confirmDialog, enemyAvatar, lucaAvatar, enemyModel, gameBrand, kineticBackdrop, balloonBackdrop, page, layout, vite, packageJson] = await Promise.all([
    readFile(new URL("../app/HuaVsLucaGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../features/game/config/cats.ts", import.meta.url), "utf8"),
    readFile(new URL("../features/game/config/enemies.ts", import.meta.url), "utf8"),
    readFile(new URL("../features/game/config/levels.ts", import.meta.url), "utf8"),
    readFile(new URL("../features/game/config/assets.ts", import.meta.url), "utf8"),
    readFile(new URL("../features/game/domain/model.ts", import.meta.url), "utf8"),
    readFile(new URL("../features/game/infrastructure/progress-storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../features/game/domain/config-types.ts", import.meta.url), "utf8"),
    readFile(new URL("../features/game/i18n.ts", import.meta.url), "utf8"),
    readFile(new URL("../features/game/components/ConfirmDialog.tsx", import.meta.url), "utf8"),
    readFile(new URL("../features/game/components/EnemyAvatar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../features/game/components/avatars/LucaAvatar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../features/game/components/EnemyModel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../features/game/components/GameBrand.tsx", import.meta.url), "utf8"),
    readFile(new URL("../features/game/components/KineticBackdrop.tsx", import.meta.url), "utf8"),
    readFile(new URL("../features/game/components/BalloonBackdrop.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(levels, /export const LEVELS = \[/);
  assert.equal((levels.match(/^ {4}id: "1-(?:[1-5]|EX)"/gm) ?? []).length, 6);
  assert.match(levels, /difficulty:\s*1/);
  assert.match(levels, /difficulty:\s*3/);
  assert.match(levels, /lanes:\s*5/);
  assert.doesNotMatch(model, /endlessEnemySpeedMultiplier/);
  assert.match(model, /endlessLaneCount:\s*7/);
  assert.match(model, /MIN_SAME_LANE_SPAWN_INTERVAL = 2/);
  assert.match(model, /lastSpawnAtByLane\[lane\] \+ MIN_SAME_LANE_SPAWN_INTERVAL/);
  assert.match(model, /perCat:\s*420/);
  assert.match(model, /x:\s*103,/);
  assert.match(model, /export function chooseEnemySpawnLane/);
  assert.match(game, /chooseEnemySpawnLane\(model\.lastEnemySpawnAtByLane, model\.elapsed\)/);
  assert.match(game, /requestAnimationFrame/);
  assert.match(storage, /LEVEL_PROGRESS_STORAGE_KEY = "hua-vs-luca-level-progress-v2"/);
  assert.match(storage, /level\.id === "1-2" \? previous\["1-1"\]/);
  assert.match(storage, /loadLevelProgress/);
  assert.match(storage, /saveLevelProgress/);
  assert.match(game, /completed:\s*true/);
  assert.match(game, /src=\{ball\.asset\}/);
  assert.match(game, /type Screen =/);
  assert.match(game, /\| "level-briefing"/);
  assert.match(game, /\| "about"/);
  assert.match(game, /\| "bestiary"/);
  assert.match(game, /className="chapter-track"/);
  assert.match(game, /"--chapter-offset": `\$\{selectedChapterIndex \* \(-100 \/ LEVEL_CHAPTERS\.length\)\}%`/);
  assert.match(game, /LEVEL_CHAPTERS\.map\(\(chapter\) =>/);
  assert.match(game, /disabled=\{!isLevelAvailable\}/);
  assert.match(levels, /title: \{ zh: "花前乱语", en: "Flora's Ramblings" \}/);
  assert.match(levels, /\{ id: "2-1", levelId: "2-1" \}/);
  assert.match(levels, /\["2-2", "2-3", "2-4", "2-5"\]/);
  assert.match(levels, /\{ id: "2-EX", kind: "hidden" \}/);
  const levelConfig = configTypes.match(/type LevelConfig[^=]*= \{([\s\S]*?)\};/)?.[1] ?? "";
  assert.doesNotMatch(levelConfig, /description/);
  assert.match(cats, /export const CAT_TYPES/);
  assert.match(cats, /projectileAssets/);
  assert.match(cats, /previewAssets/);
  assert.match(cats, /ability: "ricochet"/);
  assert.match(cats, /unusedBonusScore:\s*300/);
  assert.match(cats, /不知道为什么，花花从出生起就掌握了变成球的能力。/);
  assert.match(cats, /en: "Ball Flora"/);
  assert.equal((cats.match(/https:\/\/assets\.anuluca\.com\/otherWebsites\/flora-vs-luca\/cats\/ball-hua\/projectile-0[1-5]\.webp/g) ?? []).length, 11);
  assert.match(cats, /previewAssets:\s*\["https:\/\/assets\.anuluca\.com\/otherWebsites\/flora-vs-luca\/cats\/ball-hua\/projectile-01\.webp"\]/);
  assert.match(cats, /id: "wheel-hua"/);
  assert.match(cats, /name: \{ zh: "车轮花花", en: "Wheel Flora" \}/);
  assert.match(cats, /ability: "lane-runner"/);
  assert.match(cats, /damage:\s*1/);
  assert.equal((cats.match(/https:\/\/assets\.anuluca\.com\/otherWebsites\/flora-vs-luca\/cats\/wheel-hua\/projectile-0[2-3]\.webp/g) ?? []).length, 5);
  assert.doesNotMatch(cats, /https:\/\/assets\.anuluca\.com\/otherWebsites\/flora-vs-luca\/cats\/wheel-hua\/projectile-01\.webp/);
  assert.match(cats, /imageAssets: \[\s*"https:\/\/assets\.anuluca\.com\/otherWebsites\/flora-vs-luca\/cats\/wheel-hua\/projectile-02\.webp",\s*"https:\/\/assets\.anuluca\.com\/otherWebsites\/flora-vs-luca\/cats\/wheel-hua\/projectile-03\.webp"/);
  assert.match(cats, /previewAssets: \[\s*"https:\/\/assets\.anuluca\.com\/otherWebsites\/flora-vs-luca\/cats\/wheel-hua\/projectile-03\.webp"/);
  assert.match(enemies, /export const ENEMY_TYPES/);
  assert.match(enemies, /这个路卡就是逊啦。/);
  assert.match(enemies, /en: "Luca"/);
  assert.match(enemies, /avatar: "luca"/);
  assert.match(configTypes, /avatar:\s*string/);
  assert.match(enemies, /killScore:\s*100/);
  assert.match(enemies, /speed:\s*"slow"/);
  assert.match(enemies, /export const ENEMY_SPEED_MULTIPLIERS = \{[\s\S]*?slow: 1,[\s\S]*?medium: 2,[\s\S]*?fast: 3,[\s\S]*?extreme: 4/);
  assert.match(enemies, /export const BASE_ENEMY_SPEED = 3\.6/);
  assert.match(enemies, /maxHealth:\s*1/);
  assert.match(configTypes, /type StrengthRank = "R" \| "S" \| "A" \| "B" \| "C"/);
  assert.match(cats, /strength:\s*"C"/);
  assert.match(cats, /strength:\s*"B"/);
  assert.match(cats, /id:\s*"hehe-hua"/);
  assert.match(cats, /name:\s*\{ zh: "嘻嘻", en: "Hehe" \}/);
  assert.match(cats, /zh:\s*"为什么我会出现在这里"/);
  assert.match(cats, /zh:\s*"嘲讽你一下"/);
  assert.match(cats, /tag:\s*\{ zh: "嘲讽", en: "Taunt" \}/);
  assert.match(cats, /strength:\s*"R"/);
  assert.match(cats, /traitDescription/);
  assert.match(enemies, /traitDescription/);
  assert.equal((enemies.match(/death: \{ src: "https:\/\/assets\.anuluca\.com\/otherWebsites\/flora-vs-luca\/audio\/enemy-death-rizz\.mp3", volumeMultiplier: 0\.5 \}/g) ?? []).length, 2);
  assert.match(configTypes, /soundEffects\?:[\s\S]*?death\?:[\s\S]*?volumeMultiplier:\s*number/);
  assert.match(game, /playEnemyDeathSound\(enemy\.typeId\)/);
  assert.match(enemies, /https:\/\/assets\.anuluca\.com\/otherWebsites\/flora-vs-luca\/enemies\/luca\/head\.webp/);
  assert.match(enemies, /partAssets:[\s\S]*?body: "https:\/\/assets\.anuluca\.com\/otherWebsites\/flora-vs-luca\/enemies\/luca\/body\.webp"[\s\S]*?hand: "https:\/\/assets\.anuluca\.com\/otherWebsites\/flora-vs-luca\/enemies\/luca\/hand\.webp"[\s\S]*?leg: "https:\/\/assets\.anuluca\.com\/otherWebsites\/flora-vs-luca\/enemies\/luca\/leg\.webp"[\s\S]*?tail: "https:\/\/assets\.anuluca\.com\/otherWebsites\/flora-vs-luca\/enemies\/luca\/tail\.webp"/);
  assert.equal((enemies.match(/#D4C892/g) ?? []).length, 4);
  assert.match(levels, /catTypeIds/);
  assert.match(levels, /enemyTypeIds/);
  assert.match(levels, /id: "1-1"[\s\S]*?totalEnemies: 6[\s\S]*?lanes: 1/);
  assert.match(levels, /id: "1-1"[\s\S]*?name: \{ zh: "出租屋", en: "Rental Room" \}/);
  assert.match(levels, /zh: "拖动猫咪到跑道发射！", en: "Drag a cat onto the lane to launch!"/);
  assert.match(levels, /id: "1-1"[\s\S]*?"ball-hua": 10[\s\S]*?twoStars: 500, threeStars: 1100/);
  assert.match(levels, /id: "1-2"[\s\S]*?"ball-hua": 8[\s\S]*?twoStars: 1200, threeStars: 1600/);
  assert.match(levels, /id: "1-3"[\s\S]*?totalEnemies: 18[\s\S]*?redHeatRanges: \[\]/);
  assert.match(levels, /id: "1-4"[\s\S]*?totalEnemies: 30[\s\S]*?redHeatRanges: \[\{ start: 0\.75, end: 1 \}\]/);
  assert.match(levels, /id: "1-4"[\s\S]*?catInventory: \{ "ball-hua": 22 \}[\s\S]*?catTypeIds: \["ball-hua"\]/);
  assert.match(levels, /id: "1-5"[\s\S]*?totalEnemies: 50[\s\S]*?lanes: 5[\s\S]*?catInventory: \{ "ball-hua": 24, "wheel-hua": 1 \}[\s\S]*?catTypeIds: \["ball-hua", "wheel-hua"\][\s\S]*?redHeatRanges: \[\{ start: 0\.35, end: 0\.55 \}, \{ start: 0\.75, end: 1 \}\]/);
  assert.equal((levels.match(/matchupPreview:/g) ?? []).length, 7);
  assert.match(levels, /id: "1-EX"[\s\S]*?totalEnemies: 50[\s\S]*?redHeatRanges: \[\{ start: 0\.35, end: 1 \}\]/);
  assert.match(game, /const hiddenLevelUnlocked = standardSlots\.length > 0 && standardSlots\.every/);
  assert.match(levels, /id: "1-4"[\s\S]*?matchupPreview: \{ catTypeIds: \["ball-hua"\], enemyTypeIds: \["luca"\] \}/);
  assert.doesNotMatch(levels, /enemySpeed/);
  assert.match(configTypes, /export type CatAbility = "ricochet" \| "lane-runner"/);
  assert.match(configTypes, /ability:\s*CatAbility/);
  assert.match(configTypes, /damage:\s*number/);
  assert.match(configTypes, /maxHealth:\s*number/);
  assert.match(configTypes, /matchupPreview:\s*MatchupPreviewConfig/);
  assert.match(configTypes, /export type EnemySpeed = "slow" \| "medium" \| "fast" \| "extreme"/);
  assert.match(configTypes, /speed:\s*EnemySpeed/);
  assert.match(configTypes, /redHeatRanges\?: readonly RedHeatRange\[\]/);
  assert.match(model, /getChainMultiplier/);
  assert.match(model, /export function applyEnemyDamage/);
  assert.match(model, /enemy\.health = Math\.max\(0, \(enemy\.health \?\? maxHealth\) - safeDamage\)/);
  assert.match(model, /getUnusedCatBonus/);
  assert.match(model, /getLevelRating/);
  assert.match(game, /className="victory-rating"/);
  assert.match(game, /className="victory-cat-nest"[\s\S]*?src=\{GAME_UI_ASSETS\.victoryCatNest\}/);
  assert.match(game, /className="defeat-cat-art"[\s\S]*?src=\{GAME_UI_ASSETS\.defeatCat\}/);
  assert.match(globals, /\.victory-cat-nest\s*\{[\s\S]*?top:\s*0;[\s\S]*?width:\s*min\(250px, 62%\);[\s\S]*?translate\(-50%, -50%\)/);
  assert.match(globals, /\.victory-overlay \.result-card\s*\{[\s\S]*?padding:\s*96px 28px 20px;[\s\S]*?overflow:\s*visible/);
  assert.match(gameAssets, /GAME_ASSET_BASE_URL\}\/cats\/victory-cat-nest\.webp/);
  assert.match(gameAssets, /GAME_ASSET_BASE_URL\}\/cats\/defeat-cat\.webp/);
  assert.match(globals, /\.defeat-cat-art\s*\{[\s\S]*?top:\s*0;[\s\S]*?width:\s*min\(260px, 64%\)/);
  assert.match(globals, /\.defeat-cat-art\s*\{[\s\S]*?translate\(-50%, -68%\)/);
  assert.match(game, /className="victory-level-tag"/);
  assert.match(game, /snapshot\.phase === "settling"/);
  assert.match(game, /className="settlement-inventory-card"/);
  assert.match(game, /className="briefing-type-category is-cats"/);
  assert.match(game, /className="briefing-type-category is-enemies"/);
  assert.match(game, /className="briefing-individual-grid"/);
  assert.match(game, /<h2>\{copy\.cats\}<\/h2>/);
  assert.match(game, /<h2>\{copy\.enemies\}<\/h2>/);
  assert.match(game, /`×\$\{selectedLevel\.catInventory\[catTypeId\] \?\? 0\}`/);
  assert.doesNotMatch(game, /className="briefing-score-note">\{copy\.defeatScore\}/);
  assert.match(globals, /\.briefing-type-category\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none/);
  assert.match(globals, /\.briefing-individual-grid\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-wrap:\s*wrap/);
  assert.match(globals, /\.briefing-types \.briefing-type-card\s*\{[\s\S]*?width:\s*132px/);
  assert.match(globals, /\.briefing-sheet\s*\{[\s\S]*?width:\s*min\(920px, calc\(100% - 42px\)\);[\s\S]*?max-width:\s*920px/);
  assert.match(globals, /\.briefing-type-category\s*\{[\s\S]*?width:\s*max-content;[\s\S]*?max-width:\s*100%/);
  assert.match(globals, /\.briefing-overlay\s*\{[\s\S]*?background:\s*rgba\(45, 36, 31, \.48\)/);
  assert.match(globals, /\.briefing-types \.briefing-type-card > strong\s*\{[\s\S]*?text-align:\s*center/);
  assert.match(game, /settlementCatsCounted/);
  assert.match(globals, /@keyframes settlementInventoryArrive[\s\S]*?translate\(-250%, -230%\)/);
  assert.match(game, /selectedAsset \?\? catType\.projectileAssets/);
  assert.match(game, /<Image src=\{catType\.previewAssets\[0\]\} alt="" width=\{900\} height=\{900\} unoptimized \/>/);
  assert.doesNotMatch(game, /catType\.imageAssets\.map/);
  assert.match(game, /catType\.ability === "lane-runner"/);
  assert.match(game, /const defeated = applyEnemyDamage\(enemy, catType\.damage, enemyType\.maxHealth\)/);
  assert.match(game, /ball\.hitEnemyIds\.push\(enemy\.id\)/);
  assert.match(game, /ball\.fallingAt = model\.elapsed/);
  assert.match(game, /src=\{dragState\.asset\}/);
  assert.match(game, /createSettlementQueue/);
  assert.match(game, /getSettlementState/);
  assert.doesNotMatch(game, /setDragPosition/);
  assert.doesNotMatch(model, /\.sort\(/);
  assert.match(game, /ball\.fallingAt !== undefined/);
  assert.match(game, /playSound\("star"\)/);
  assert.match(game, /createLoadedAudio\(GAME_AUDIO_URLS\.victory\)/);
  assert.match(game, /audio\.volume = soundVolumeRef\.current \* 0\.5/);
  assert.match(gameAssets, /victory: `\$\{GAME_ASSET_BASE_URL\}\/audio\/victory\.mp3`/);
  assert.match(game, /createLoadedAudio\(GAME_AUDIO_URLS\.gameBgm\)/);
  assert.match(game, /soundVolumeRef\.current \* 0\.2/);
  assert.match(game, /window\.addEventListener\("pointerdown", startBgm, \{ once: true \}\)/);
  assert.match(gameAssets, /gameBgm: `\$\{GAME_ASSET_BASE_URL\}\/audio\/game-bgm\.mp3`/);
  assert.match(game, /audio\.loop = true/);
  assert.doesNotMatch(game, /resultMusicActive/);
  assert.doesNotMatch(game, /victoryBgm|victory-bgm/);
  assert.doesNotMatch(gameAssets, /victoryBgm|victory-bgm/);
  assert.match(game, /createLoadedAudio\(GAME_AUDIO_URLS\.defeatBgm\)/);
  assert.match(game, /playOneShotAudio\(audio, soundVolumeRef\.current \* 0\.4, true\)/);
  assert.match(gameAssets, /defeatBgm: `\$\{GAME_ASSET_BASE_URL\}\/audio\/defeat-bgm\.mp3`/);
  assert.match(gameAssets, /defeatStinger: `\$\{GAME_ASSET_BASE_URL\}\/audio\/defeat-stinger\.mp3`/);
  assert.match(game, /playInstantAudio\(GAME_AUDIO_URLS\.defeatStinger, 0\.125\)/);
  assert.match(game, /className="sound-inline-control"/);
  assert.doesNotMatch(game, /soundPanelOpen|sound-popover/);
  assert.match(game, /playInstantAudio\(GAME_AUDIO_URLS\.catDrop, 0\.5\)/);
  assert.match(game, /playInstantAudio\(GAME_AUDIO_URLS\.victory, 0\.25, 0\.257\)/);
  assert.match(globals, /\.hua-ball\s*\{[\s\S]*?width:\s*83px;[\s\S]*?height:\s*104px;/);
  assert.match(gameAssets, /gameStart: `\$\{GAME_ASSET_BASE_URL\}\/audio\/game-start\.mp3`/);
  assert.match(game, /const playStartActionSound = useCallback/);
  assert.match(game, /playInstantAudio\(GAME_AUDIO_URLS\.gameStart, 0\.35\)/);
  assert.match(game, /onClick=\{startFromMainMenu\}/);
  assert.match(game, /playStartActionSound\(\);[\s\S]*?setBriefingExiting\(true\)/);
  assert.match(game, /placedAt: model\.elapsed/);
  assert.match(game, /snapshot\.elapsed - ball\.placedAt < CAT_DROP_DUST_DURATION/);
  assert.doesNotMatch(game, /model\.elapsed - ball\.placedAt < CAT_DROP_DURATION\) continue/);
  assert.match(game, /className="hua-drop-dust"/);
  assert.doesNotMatch(globals, /@keyframes huaHeavyDrop/);
  assert.match(globals, /@keyframes huaDustBurst/);
  assert.match(game, /context\.decodeAudioData/);
  assert.match(game, /source\.start\(0, startOffsetSeconds\)/);
  assert.match(gameAssets, /catDrop: `\$\{GAME_ASSET_BASE_URL\}\/audio\/cat-drop\.mp3`/);
  assert.match(game, /isRedHeatProgress/);
  assert.match(game, /redHeatMultiplier = model\.redHeatActive \? 3 : 1/);
  assert.match(game, /type EnemySpeedMultiplier = 1 \| 2 \| 3/);
  assert.match(game, /enemySpeedMultiplierRef\.current % 3 \+ 1/);
  assert.match(game, /enemy-speed-button is-speed-\$\{enemySpeedMultiplier\}/);
  assert.match(game, /<footer className="game-controls">[\s\S]*?enemy-speed-button/);
  assert.match(game, /enemySpeedMultiplier > 1 && <strong>×\{enemySpeedMultiplier\}<\/strong>/);
  assert.match(game, /\* enemySpeedMultiplierRef\.current/);
  assert.match(game, /BASE_ENEMY_SPEED[\s\S]*?\* ENEMY_SPEED_MULTIPLIERS\[enemyType\.speed\][\s\S]*?\* redHeatMultiplier[\s\S]*?\* enemySpeedMultiplierRef\.current/);
  assert.doesNotMatch(game, /endlessMultiplier|endlessEnemySpeedMultiplier/);
  assert.match(i18n, /enemySpeed: "敌人速度"/);
  assert.match(i18n, /speedTiers: \{ slow: "慢", medium: "中等", fast: "快", extreme: "极快" \}/);
  assert.match(game, /function EnemyCatalogProperties/);
  assert.match(game, /copy\.speedTiers\[enemyType\.speed\]/);
  assert.equal((game.match(/<EnemyCatalogProperties typeId=/g) ?? []).length, 2);
  assert.match(game, /<Image src=\{catType\.previewAssets\[0\]\}/);
  assert.doesNotMatch(game, /catalogType\.imageAssets\.map/);
  assert.match(game, /className="catalog-trait"/);
  assert.match(game, /<CatCatalogProperties/);
  assert.match(game, /https:\/\/github\.com\/Anuluca\/flora_vs_luca_web/);
  assert.doesNotMatch(game, /space\.bilibili\.com|FaBilibili/);
  assert.match(i18n, /给这个项目一个 Star/);
  assert.match(globals, /\.enemy-speed-button\s*\{/);
  assert.match(globals, /\.enemy-speed-button\.is-speed-2\s*\{[\s\S]*?background:\s*#e5a14e/);
  assert.match(globals, /\.enemy-speed-button\.is-speed-3\s*\{[\s\S]*?background:\s*#b84239/);
  assert.match(game, /className=\{`red-heat-notice/);
  assert.match(game, /className="progress-red-heat-range"/);
  assert.match(game, /activeLevel\.redHeatRanges\?\.map/);
  assert.match(globals, /\.progress-red-heat-range\s*\{/);
  assert.doesNotMatch(globals, /\.progress-red-heat-range\.is-active|progressRedHeatPulse/);
  assert.doesNotMatch(game, /isCurrentRange|progress-red-heat-range\$\{/);
  assert.match(globals, /\.progress-fill\s*\{[\s\S]*?z-index:\s*2/);
  assert.match(globals, /\.progress-red-heat-range\s*\{[\s\S]*?z-index:\s*1/);
  assert.match(globals, /\.red-heat-notice\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*rgba\(20, 18, 17, \.94\)/);
  assert.match(globals, /\.settlement-cat-stage b\s*\{[\s\S]*?top:\s*-18px;[\s\S]*?font-size:\s*32px/);
  assert.match(game, /className="level-rating-stickers"/);
  assert.match(globals, /\.level-rating-stickers i\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?font-size:\s*43px/);
  assert.match(globals, /\.victory-overlay \.victory-rating i:nth-child\(2\)\s*\{[\s\S]*?top:\s*-17px;[\s\S]*?font-size:\s*118px/);
  assert.match(game, /navigateTo\("catalog-detail", "fade"\)/);
  assert.match(game, /className="position-property"/);
  assert.match(globals, /\.catalog-detail-sheet/);
  assert.match(globals, /@keyframes huaBallDropOut/);
  assert.match(game, /rating === 3 \? " is-three-star"/);
  assert.match(game, /className=\{`cat-inventory/);
  assert.match(game, /activeLevel\.tips\.map/);
  assert.match(game, /className="site-utility-area"/);
  assert.match(game, /className="site-utility-button language-switch-button"/);
  assert.match(game, /copy\.restartQuestion/);
  assert.match(game, /requestConfirmation\("level-select"\)/);
  assert.match(game, /confirmationActionRef\.current !== null/);
  assert.match(game, /disabled=\{screen === "level-briefing" \|\| confirmationAction !== null \|\|/);
  assert.match(game, /<ConfirmDialog/);
  assert.match(confirmDialog, /export function ConfirmDialog/);
  assert.match(globals, /\.pause-message-overlay\s*\{[\s\S]*?background:\s*rgba\([^;]+\);[\s\S]*?backdrop-filter:\s*none;/);
  assert.match(game, /onClick=\{togglePause\}[\s\S]*?copy\.tapToResume/);
  assert.match(game, /className="pause-exit-button"[\s\S]*?goToLevelSelect\(\)/);
  assert.match(game, /className="pause-exit-button"[\s\S]*?<FaSignOutAlt/);
  assert.match(game, /const nextModel = createGameModel\(level, "paused", mode\)/);
  assert.match(game, /if \(action === "restart"\) openLevelBriefing/);
  assert.match(game, /screen === "game" \|\| screen === "level-briefing"/);
  assert.match(game, /className=\{`game-overlay briefing-overlay\$\{briefingExiting \? " is-exiting" : ""\}`\}/);
  assert.match(game, /role="dialog" aria-modal="true"/);
  assert.match(globals, /\.pause-exit-button\s*\{[\s\S]*?border:\s*2px solid rgba\(68, 57, 49, \.66\);[\s\S]*?background:\s*rgba\(234, 220, 186, \.92\)/);
  assert.match(globals, /\.front-page \.versus-artwork:not\(\.is-compact\) \.versus-luca\s*\{[\s\S]*?right:\s*17%;[\s\S]*?bottom:\s*7%;/);
  assert.match(globals, /\.front-page \.versus-artwork:not\(\.is-compact\) \.versus-hua\s*\{[\s\S]*?bottom:\s*-4%;/);
  assert.doesNotMatch(globals, /\.front-page \.versus-artwork:not\(\.is-compact\) \.versus-luca\s*\{[^}]*hue-rotate/);
  assert.match(globals, /\.main-menu-wordmark \.game-wordmark span:last-child\s*\{[\s\S]*?#6f9eaf/);
  assert.match(globals, /\.main-menu-wordmark \.game-wordmark span:first-child\s*\{[\s\S]*?matrix3d\([\s\S]*?\.0014/);
  assert.match(globals, /\.main-menu-wordmark \.game-wordmark span:last-child\s*\{[\s\S]*?matrix3d\([\s\S]*?-\.0028/);
  assert.match(globals, /\.main-menu-wordmark \.game-wordmark em\s*\{[\s\S]*?font-size:\s*\.72em;[\s\S]*?#e2bd4f[\s\S]*?-webkit-text-stroke:\s*1\.1px rgba\(39, 34, 31, \.68\)/);
  assert.match(globals, /filter:\s*drop-shadow\(4px 5px 0 rgba\(31, 27, 25, \.72\)\)/);
  assert.match(globals, /@font-face\s*\{[\s\S]*?font-family:\s*"cn-custom";[\s\S]*?unboundedsans\.ttf[\s\S]*?font-display:\s*swap/);
  assert.match(globals, /\.screen-topbar,[\s\S]*?\.main-menu-wordmark,[\s\S]*?\.front-page \.main-menu-actions button,[\s\S]*?\.menu-corner-tabs\.is-visible \.info-button,[\s\S]*?\.level-board h1,[\s\S]*?\.bestiary-module > strong,[\s\S]*?\.briefing-sheet > h1,[\s\S]*?\.red-heat-notice\s*\{[\s\S]*?font-family:\s*"cn-custom"/);
  assert.doesNotMatch(globals, /\/\* 严格限定定制字体范围[\s\S]*?\*\/\s*button,/);
  assert.match(globals, /@keyframes menuFloraIdleSpin[\s\S]*?rotate:\s*360deg/);
  assert.match(globals, /\.main-menu-wordmark\s*\{[\s\S]*?left:\s*34\.5%/);
  assert.match(globals, /品牌标题最终使用实心字色[\s\S]*?span:first-child\s*\{[\s\S]*?background:\s*#d47800;[\s\S]*?span:last-child\s*\{[\s\S]*?background:\s*#006989;/);
  assert.match(game, /className="pause-state-icon"[\s\S]*?pause-icon-pause[\s\S]*?pause-icon-play/);
  assert.match(globals, /\.game-page:hover \.pause-icon-pause[\s\S]*?opacity:\s*0/);
  assert.match(globals, /\.game-page:hover \.pause-icon-play[\s\S]*?opacity:\s*1/);
  assert.match(i18n, /tapToResume: "点击屏幕继续"/);
  assert.match(model, /type EnemyDeathEffect/);
  assert.match(game, /className="enemy-death-effect"/);
  assert.match(globals, /@keyframes enemyPartScatter/);
  assert.match(globals, /@keyframes reachGrabUpper\s*\{[\s\S]*?rotate\(-7deg\)[\s\S]*?rotate\(8deg\)/);
  assert.match(globals, /\.enemy-arm::before\s*\{\s*content:\s*none/);
  assert.match(game, /<EnemyModel typeId=\{enemy\.typeId\}/);
  assert.match(game, /<EnemyModel typeId=\{effect\.typeId\} damaged=\{effect\.damaged\} death/);
  assert.match(game, /<EnemyAvatar typeId=\{enemyTypeId\} \/>/);
  assert.match(game, /<EnemyAvatar typeId=\{enemyType\.id\} \/>/);
  assert.match(game, /catalog-detail-enemy-model"><EnemyModel typeId=\{catalogDetail\.typeId as EnemyTypeId\}/);
  assert.match(globals, /\.catalog-detail-enemy-model\s*\{[\s\S]*?animation:\s*catalogEnemyIdle \.72s ease-in-out infinite alternate/);
  assert.match(globals, /@keyframes catalogEnemyIdle/);
  assert.doesNotMatch(globals, /\.catalog-detail-enemy-model \.enemy-arm,[\s\S]*?animation:\s*none/);
  assert.match(enemyAvatar, /const AVATAR_COMPONENTS = \{[\s\S]*?luca: LucaAvatar/);
  assert.match(enemyAvatar, /AVATAR_COMPONENTS\[enemyType\.avatar\]/);
  assert.match(lucaAvatar, /export function LucaAvatar/);
  assert.match(lucaAvatar, /src=\{ENEMY_TYPES\.luca\.headAsset\}/);
  assert.match(gameBrand, /<EnemyModel typeId="luca" priority=\{!compact\}/);
  assert.match(gameBrand, /level\.matchupPreview\.catTypeIds/);
  assert.match(gameBrand, /level\.matchupPreview\.enemyTypeIds/);
  assert.match(gameBrand, /className="matchup-enemy-group"/);
  assert.match(gameBrand, /<EnemyAvatar key=\{enemyType\.id\} typeId=\{enemyType\.id\} \/>/);
  assert.match(gameBrand, /src=\{catType\.previewAssets\[0\]\}/);
  assert.doesNotMatch(gameBrand, /catType\.previewAssets\.map/);
  assert.doesNotMatch(gameBrand, /versus-arm|versus-tail/);
  assert.match(enemyModel, /className="enemy-part enemy-tail"/);
  assert.match(enemyModel, /className="enemy-part enemy-body"/);
  assert.match(enemyModel, /className="enemy-part enemy-arm enemy-arm-left"/);
  assert.match(enemyModel, /className="enemy-part enemy-leg enemy-leg-left"/);
  assert.match(globals, /\.enemy-part\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent/);
  assert.match(globals, /\.enemy-head\s*\{[\s\S]*?width:\s*72px;[\s\S]*?height:\s*60px;[\s\S]*?animation:\s*none/);
  assert.match(globals, /\.enemy-body\s*\{[\s\S]*?left:\s*24px;[\s\S]*?top:\s*42px;[\s\S]*?width:\s*28px;[\s\S]*?height:\s*42px/);
  assert.match(globals, /\.enemy-arm-left \{ left: -3px; top: 47px; animation: reachGrabLower/);
  assert.match(globals, /\.enemy-arm-right \{ top: 41px; animation: reachGrabUpper/);
  assert.match(globals, /\.enemy-leg\s*\{[\s\S]*?top:\s*75px;[\s\S]*?height:\s*25px/);
  assert.match(globals, /\.enemy-part\.enemy-body\s*\{\s*object-fit:\s*fill/);
  assert.match(globals, /\.versus-artwork:not\(\.is-compact\) \.versus-luca\s*\{[\s\S]*?transform:\s*scale\(3\.35\) rotate\(2deg\)/);
  assert.doesNotMatch(game, /data-emblem/);
  assert.match(game, /className="cat-drag-ghost"/);
  assert.match(game, /document\.body\.classList\.add\("is-dragging-cat"\)/);
  assert.match(game, /document\.body\.classList\.remove\("is-dragging-cat"\)/);
  assert.match(globals, /body\.is-dragging-cat,[\s\S]*?cursor:\s*grabbing !important/);
  assert.match(globals, /\.main-menu-card \.main-menu-actions\s*\{[\s\S]*?transform:\s*scale\(1\.16\)/);
  assert.match(globals, /\.lane-field\s*\{[\s\S]*?cursor:\s*default/);
  assert.match(game, /getLaneFromClientPoint/);
  assert.match(game, /createPortal/);
  assert.match(game, /completion-label/);
  assert.match(game, /const audioAssetUrls = GAME_ASSET_URLS\.filter/);
  assert.match(game, /Promise\.all\(\[[\s\S]*?GAME_IMAGE_URLS\.map\(loadAsset\)[\s\S]*?audioAssetUrls\.map\(loadAudio\)[\s\S]*?loadFonts\(\)/);
  assert.match(game, /document\.fonts\.load\('1em "cn-custom"'\)/);
  assert.match(game, /navigateTo\("game", "fade"\)/);
  assert.match(game, /const startGameFromBriefing = useCallback/);
  assert.match(game, /startGame\(selectedLevelId, briefingMode, false\)/);
  assert.match(game, /briefingExitTimerRef\.current = window\.setTimeout/);
  assert.match(game, /briefing-overlay\$\{briefingExiting \? " is-exiting" : ""\}/);
  assert.match(globals, /@keyframes briefingSheetExit[\s\S]*?translateX\(calc\(-100% - 48vw\)\)/);
  assert.match(globals, /@keyframes briefingBackdropExit/);
  assert.match(globals, /@keyframes briefingBattlefieldReveal/);
  assert.match(game, /--mobile-shell-scale/);
  assert.match(game, /isLandscapePhone/);
  assert.match(globals, /width:\s*1200px;[\s\S]*?height:\s*760px;/);
  assert.match(game, /className="incomplete-label">\{copy\.notStarted\}/);
  assert.match(configTypes, /type LocalizedText/);
  assert.match(i18n, /LOCALE_STORAGE_KEY/);
  assert.match(i18n, /documentTitle: "Flora vs Luca: Free Online Cat Defense Game"/);
  assert.match(i18n, /switchEnglish: "切换为中文"/);
  assert.match(game, /<MainMenuHero locale=\{locale\} size="large" \/>/);
  assert.match(game, /<MainMenuHero locale=\{locale\} size="small" \/>/);
  assert.match(globals, /\.about-page \.info-sheet > \.main-menu-hero\.is-small \.small-brand-stage > \.versus-artwork\s*\{[\s\S]*?translateY\(-13px\)/);
  assert.match(globals, /@keyframes aboutBrandReveal[\s\S]*?scale\(1\.22\)/);
  assert.match(globals, /\.game-hud \.level-progress\s*\{[^}]*gap:\s*11px/);
  assert.match(globals, /\.game-hud \.progress-percentage\s*\{[^}]*margin-top:\s*10px/);
  assert.match(gameBrand, /export function MainMenuHero/);
  assert.match(gameBrand, /size: "large" \| "small"/);
  assert.match(gameBrand, /className="main-menu-hero is-small"[\s\S]*?className="small-brand-stage"[\s\S]*?<VersusArtwork \/>[\s\S]*?<GameWordmark locale=\{locale\} \/>/);
  assert.match(globals, /\.main-menu-hero\.is-small\s*\{[\s\S]*?width:\s*240px;[\s\S]*?height:\s*100px/);
  assert.match(game, /persistent-game-brand\$\{screen === "main-menu" \|\| screen === "about" \? " is-hidden" : " is-visible"\}[\s\S]*?<MainMenuHero locale=\{locale\} size="small" \/>/);
  assert.match(globals, /\.main-menu-hero\.is-small \.versus-hua,[\s\S]*?\.main-menu-hero\.is-small \.enemy-head\s*\{[\s\S]*?animation:\s*none !important/);
  assert.match(globals, /\.main-menu-wordmark \.game-wordmark em\s*\{[\s\S]*?background:\s*#e23456;[\s\S]*?transform:\s*rotate\(4deg\)/);
  assert.match(globals, /\.main-menu-wordmark \.game-wordmark span\s*\{[\s\S]*?font-size:\s*2em;[\s\S]*?font-weight:\s*400;[\s\S]*?white-space:\s*nowrap/);
  assert.match(globals, /\.main-menu-wordmark\s*\{[\s\S]*?width:\s*clamp\(280px, 25vw, 430px\)/);
  assert.match(globals, /\.front-page \.main-menu-actions > \.primary-button\s*\{[\s\S]*?font-size:\s*26px/);
  assert.match(globals, /\.front-page \.main-menu-actions \.menu-secondary-button\s*\{[\s\S]*?font-size:\s*20px/);
  assert.doesNotMatch(game, /<KineticBackdrop \/>|<BalloonBackdrop \/>/);
  assert.match(page, /<KineticBackdrop \/>/);
  assert.match(page, /<BalloonBackdrop \/>/);
  assert.match(kineticBackdrop, /export function KineticBackdrop/);
  assert.match(kineticBackdrop, /prefers-reduced-motion/);
  assert.match(kineticBackdrop, /Math\.min\(window\.devicePixelRatio \|\| 1, 2\)/);
  assert.match(kineticBackdrop, /needsPointerAnimation \|\| ripples\.length > 0/);
  assert.match(kineticBackdrop, /new Float32Array/);
  assert.match(kineticBackdrop, /const MAX_RIPPLES = 4/);
  assert.match(kineticBackdrop, /const age = Math\.max\(0, \(now - ripple\.bornAt\) \/ 1000\)/);
  assert.match(kineticBackdrop, /context\.arc\(ripple\.x, ripple\.y, Math\.max\(0, ripple\.radius\)/);
  assert.match(kineticBackdrop, /document\.createElement\("canvas"\)/);
  assert.match(kineticBackdrop, /reducedMotion\.addEventListener\("change"/);
  assert.match(globals, /\.kinetic-backdrop\s*\{/);
  assert.match(balloonBackdrop, /const BALLOON_COUNT = 15/);
  assert.match(balloonBackdrop, /const FRAME_DURATION = 1000 \/ 60/);
  assert.doesNotMatch(balloonBackdrop, /now - previousPaintAt/);
  assert.match(balloonBackdrop, /Math\.random\(\) \* 0\.5 \+ 0\.2/);
  assert.match(balloonBackdrop, /prefers-reduced-motion/);
  assert.doesNotMatch(balloonBackdrop, /createRadialGradient/);
  assert.match(balloonBackdrop, /reducedMotion\.addEventListener\("change"/);
  assert.match(globals, /\.balloon-backdrop\s*\{/);
  assert.match(globals, /body\s*\{\s*background:\s*#e7dfcb/);
  assert.match(globals, /html\[data-page-transition="fade"\]/);
  assert.match(globals, /\.treats-on-house img\s*\{[\s\S]*?animation:\s*none;/);
  assert.doesNotMatch(game, /copy\.dangerLine/);
  assert.match(globals, /\.changelog-sheet\s*\{\s*border:\s*0;\s*background:\s*transparent/);
  assert.match(page, /<HuaVsLucaGame \/>/);
  assert.match(layout, /lang="zh-CN"/);
  assert.match(layout, /title: \{ default: SITE_TITLE, template: `%s \| \$\{SITE_NAME\}` \}/);
  assert.match(layout, /metadataBase: new URL\(SITE_URL\)/);
  assert.match(layout, /\/hua-bowl-favicon-v3\.png/);
  assert.match(vite, /port:\s*3002/);
  assert.doesNotMatch(vite, /hosting\.json|sites-vite-plugin|sites\(\)/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("app/_sites-preview", projectRoot)));
  await assert.rejects(access(new URL(".openai/hosting.json", projectRoot)));
  await assert.rejects(access(new URL("build/sites-vite-plugin.ts", projectRoot)));
  assert.match(gameAssets, /GAME_ASSET_BASE_URL = "https:\/\/assets\.anuluca\.com\/otherWebsites\/flora-vs-luca"/);
  assert.match(gameAssets, /export const GAME_IMAGE_URLS/);
  assert.match(gameAssets, /export const GAME_ASSET_URLS(?:: string\[\])? = Array\.from\(new Set/);
  assert.doesNotMatch(`${game}\n${gameAssets}\n${cats}\n${enemies}\n${gameBrand}\n${enemyAvatar}\n${lucaAvatar}`, /["']\/assets\//);
  await access(new URL("../public/hua-bowl-favicon-v3.png", import.meta.url));
  await assert.rejects(access(new URL("../public/assets/hua-bowl-favicon-v3.png", import.meta.url)));
});
