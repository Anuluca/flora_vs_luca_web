import type { LevelConfig } from "../domain/config-types";
import type { CatTypeId } from "./cats";
import type { EnemyTypeId } from "./enemies";

/**
 * 关卡展示与战斗参数的唯一数据源。
 * catTypeIds / enemyTypeIds 会在编译时校验是否存在对应类型。
 */
export const LEVELS = [
  {
    id: "1-1", name: { zh: "出租屋", en: "Rental Room" }, difficulty: 1, totalEnemies: 6, enemySpeed: 3.4, lanes: 1,
    catInventory: { "ball-hua": 10 }, ratingThresholds: { twoStars: 500, threeStars: 1100 },
    tips: [{ zh: "拖动猫咪到跑道发射！", en: "Drag a cat onto the lane to launch!" }], catTypeIds: ["ball-hua"], enemyTypeIds: ["luca"],
  },
  {
    id: "1-2", name: { zh: "猫窝前院", en: "Cat Nest Yard" }, difficulty: 1, totalEnemies: 18, enemySpeed: 3.6, lanes: 5,
    catInventory: { "ball-hua": 20 }, ratingThresholds: { twoStars: 2000, threeStars: 2500 },
    tips: [{ zh: "拖动猫咪到跑道发射！", en: "Drag a cat onto the lane to launch!" }], catTypeIds: ["ball-hua"], enemyTypeIds: ["luca"],
  },
  {
    id: "1-3", name: { zh: "客厅防线", en: "Living Room Defense" }, difficulty: 2, totalEnemies: 20, enemySpeed: 3.85, lanes: 5,
    catInventory: { "ball-hua": 22 }, ratingThresholds: { twoStars: 2400, threeStars: 3000 },
    tips: [{ zh: "拖动猫咪到跑道发射！", en: "Drag a cat onto the lane to launch!" }, { zh: "观察路卡出现的位置", en: "Watch where Luca appears" }], catTypeIds: ["ball-hua"], enemyTypeIds: ["luca"],
  },
  {
    id: "1-4", name: { zh: "走廊追击", en: "Hallway Chase" }, difficulty: 3, totalEnemies: 22, enemySpeed: 4.1, lanes: 5,
    catInventory: { "ball-hua": 24 }, ratingThresholds: { twoStars: 2700, threeStars: 3400 },
    tips: [{ zh: "拖动猫咪到跑道发射！", en: "Drag a cat onto the lane to launch!" }, { zh: "尽量让花花连续撞击", en: "Chain as many hits as possible" }], catTypeIds: ["ball-hua"], enemyTypeIds: ["luca"],
  },
  {
    id: "1-5", name: { zh: "阳台乱斗", en: "Balcony Brawl" }, difficulty: 5, totalEnemies: 24, enemySpeed: 4.35, lanes: 5,
    catInventory: { "ball-hua": 26 }, ratingThresholds: { twoStars: 3000, threeStars: 3800 },
    tips: [{ zh: "拖动猫咪到跑道发射！", en: "Drag a cat onto the lane to launch!" }, { zh: "保留猫咪可获得结算奖励", en: "Unused cats grant a score bonus" }], catTypeIds: ["ball-hua"], enemyTypeIds: ["luca"],
  },
] as const satisfies readonly LevelConfig<CatTypeId, EnemyTypeId>[];

export type Level = (typeof LEVELS)[number];
export type LevelId = Level["id"];

export function getLevel(levelId: LevelId): Level {
  return LEVELS.find((level) => level.id === levelId) ?? LEVELS[0];
}
