import type { EnemyTypeConfig } from "../domain/config-types";

/** 敌人图鉴、外观与战斗属性的唯一数据源。 */
export const ENEMY_TYPES = {
  luca: {
    id: "luca",
    name: "路卡",
    description: "这个路卡就是逊啦。",
    strength: 1,
    imageAssets: ["/assets/luca-head.png"],
    headAsset: "/assets/luca-head.png",
    bodyColor: "#D4C892",
    armColor: "#D4C892",
    emblem: "◀",
  },
} as const satisfies Record<string, EnemyTypeConfig>;

export type EnemyTypeId = keyof typeof ENEMY_TYPES;
