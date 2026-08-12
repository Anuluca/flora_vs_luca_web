import type { CatTypeConfig } from "../domain/config-types";

/**
 * 猫咪图鉴与战斗资源的唯一数据源。
 * 新增猫咪时只需在此增加一个配置项，再在关卡配置中引用对应 id。
 */
export const CAT_TYPES = {
  "ball-hua": {
    id: "ball-hua",
    name: { zh: "球形花花", en: "Ball Flora" },
    description: {
      zh: "不知道为什么，花花从出生起就掌握了变成球的能力。",
      en: "No one knows why, but Flora has been able to turn into a ball since birth.",
    },
    position: { zh: "跑道", en: "Lane" },
    imageAssets: ["/assets/hua-bowl-1.png", "/assets/hua-bowl-2.png"],
    projectileAssets: ["/assets/hua-bowl-1.png", "/assets/hua-bowl-2.png"],
    previewAssets: ["/assets/hua-bowl-1.png", "/assets/hua-bowl-2.png"],
    unusedBonusScore: 300,
  },
} as const satisfies Record<string, CatTypeConfig>;

export type CatTypeId = keyof typeof CAT_TYPES;
