import { CAT_TYPES } from "./cats";
import { ENEMY_TYPES } from "./enemies";

/** 首屏进入前统一预加载，防止首局临时出现透明贴图。 */
export const GAME_ASSET_URLS = Array.from(new Set([
  ...Object.values(CAT_TYPES).flatMap((cat) => [
    ...cat.imageAssets,
    ...cat.projectileAssets,
    ...cat.previewAssets,
  ]),
  ...Object.values(ENEMY_TYPES).flatMap((enemy) => [
    ...enemy.imageAssets,
    enemy.headAsset,
  ]),
  "/assets/scratcher-house.png",
  "/assets/treat.png",
]));
