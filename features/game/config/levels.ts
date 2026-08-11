import type { LevelConfig } from "../domain/config-types";
import type { CatTypeId } from "./cats";
import type { EnemyTypeId } from "./enemies";

/**
 * 关卡展示与战斗参数的唯一数据源。
 * catTypeIds / enemyTypeIds 会在编译时校验是否存在对应类型。
 */
export const LEVELS = [
  { id: "1-1", name: "猫窝前院", difficulty: 1, totalEnemies: 18, enemySpeed: 3.6, catTypeIds: ["ball-hua"], enemyTypeIds: ["luca"] },
  { id: "1-2", name: "客厅防线", difficulty: 2, totalEnemies: 20, enemySpeed: 3.85, catTypeIds: ["ball-hua"], enemyTypeIds: ["luca"] },
  { id: "1-3", name: "走廊追击", difficulty: 3, totalEnemies: 22, enemySpeed: 4.1, catTypeIds: ["ball-hua"], enemyTypeIds: ["luca"] },
  { id: "1-4", name: "阳台乱斗", difficulty: 4, totalEnemies: 24, enemySpeed: 4.35, catTypeIds: ["ball-hua"], enemyTypeIds: ["luca"] },
  { id: "1-5", name: "终极守卫", difficulty: 5, totalEnemies: 26, enemySpeed: 4.6, catTypeIds: ["ball-hua"], enemyTypeIds: ["luca"] },
] as const satisfies readonly LevelConfig<CatTypeId, EnemyTypeId>[];

export type Level = (typeof LEVELS)[number];
export type LevelId = Level["id"];

export function getLevel(levelId: LevelId): Level {
  return LEVELS.find((level) => level.id === levelId) ?? LEVELS[0];
}
