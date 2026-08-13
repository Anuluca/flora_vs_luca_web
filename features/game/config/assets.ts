import { CAT_TYPES } from "./cats";
import { ENEMY_TYPES } from "./enemies";

export const GAME_ASSET_BASE_URL = "https://assets.anuluca.com/otherWebsites/flora-vs-luca";

/** 文件音效集中维护，避免组件散落硬编码路径。 */
export const GAME_AUDIO_URLS = {
  gameBgm: `${GAME_ASSET_BASE_URL}/audio/game-bgm.mp3`,
  victory: `${GAME_ASSET_BASE_URL}/audio/victory.mp3`,
  defeatBgm: `${GAME_ASSET_BASE_URL}/audio/defeat-bgm.mp3`,
  defeatStinger: `${GAME_ASSET_BASE_URL}/audio/defeat-stinger.mp3`,
  catDrop: `${GAME_ASSET_BASE_URL}/audio/cat-drop.mp3`,
  /** 主菜单与准备防守的开始操作共用同一段即时音效。 */
  gameStart: `${GAME_ASSET_BASE_URL}/audio/game-start.mp3`,
} as const;

/** 需要零等待触发的短音效会在资源页预下载并解码到内存。 */
export const GAME_INSTANT_AUDIO_URLS = Array.from(new Set([
  GAME_AUDIO_URLS.catDrop,
  GAME_AUDIO_URLS.victory,
  GAME_AUDIO_URLS.gameStart,
  GAME_AUDIO_URLS.defeatStinger,
  ...Object.values(ENEMY_TYPES).flatMap((enemy) => (
    enemy.soundEffects?.death ? [enemy.soundEffects.death.src] : []
  )),
]));

/** 首屏进入前统一预加载，防止首局临时出现透明贴图。 */
export const GAME_IMAGE_URLS = Array.from(new Set([
  ...Object.values(CAT_TYPES).flatMap((cat) => [
    ...cat.imageAssets,
    ...cat.projectileAssets,
    ...cat.previewAssets,
  ]),
  ...Object.values(ENEMY_TYPES).flatMap((enemy) => [
    ...enemy.imageAssets,
    enemy.headAsset,
    ...Object.values(enemy.partAssets),
    ...Object.values("equipmentAssets" in enemy ? enemy.equipmentAssets : {}),
  ]),
  `${GAME_ASSET_BASE_URL}/scratcher-house.webp`,
  `${GAME_ASSET_BASE_URL}/treat.webp`,
  `${GAME_ASSET_BASE_URL}/anutrium-logo.webp`,
  `${GAME_ASSET_BASE_URL}/hua-bowl-icon.png`,
  `${GAME_ASSET_BASE_URL}/cats/victory-cat-nest.webp`,
  `${GAME_ASSET_BASE_URL}/cats/defeat-cat.webp`,
]));

/**
 * 加载页的完整资源来源：类型配置内新增的图片/音效会自动汇总，公共 UI 资源也集中登记。
 * 字体由加载页单独等待 document.fonts，网页 favicon 保留在 public 根目录且不计入游戏资源。
 */
export const GAME_ASSET_URLS = Array.from(new Set([
  ...GAME_IMAGE_URLS,
  ...Object.values(GAME_AUDIO_URLS),
  ...Object.values(ENEMY_TYPES).flatMap((enemy) => (
    enemy.soundEffects?.death ? [enemy.soundEffects.death.src] : []
  )),
]));
