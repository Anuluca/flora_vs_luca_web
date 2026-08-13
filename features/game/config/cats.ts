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
    traitDescription: {
      zh: "滚动到敌人弹到其他跑道",
      en: "Rolls into an enemy and ricochets to another lane.",
    },
    tag: { zh: "跑道", en: "Lane" },
    strength: "C",
    ability: "ricochet",
    damage: 1,
    imageAssets: [
      "https://assets.anuluca.com/otherWebsites/flora-vs-luca/cats/ball-hua/projectile-01.webp",
      "https://assets.anuluca.com/otherWebsites/flora-vs-luca/cats/ball-hua/projectile-02.webp",
      "https://assets.anuluca.com/otherWebsites/flora-vs-luca/cats/ball-hua/projectile-03.webp",
      "https://assets.anuluca.com/otherWebsites/flora-vs-luca/cats/ball-hua/projectile-04.webp",
      "https://assets.anuluca.com/otherWebsites/flora-vs-luca/cats/ball-hua/projectile-05.webp",
    ],
    projectileAssets: [
      "https://assets.anuluca.com/otherWebsites/flora-vs-luca/cats/ball-hua/projectile-01.webp",
      "https://assets.anuluca.com/otherWebsites/flora-vs-luca/cats/ball-hua/projectile-02.webp",
      "https://assets.anuluca.com/otherWebsites/flora-vs-luca/cats/ball-hua/projectile-03.webp",
      "https://assets.anuluca.com/otherWebsites/flora-vs-luca/cats/ball-hua/projectile-04.webp",
      "https://assets.anuluca.com/otherWebsites/flora-vs-luca/cats/ball-hua/projectile-05.webp",
    ],
    previewAssets: ["https://assets.anuluca.com/otherWebsites/flora-vs-luca/cats/ball-hua/projectile-01.webp"],
    unusedBonusScore: 300,
  },
  "wheel-hua": {
    id: "wheel-hua",
    name: { zh: "车轮花花", en: "Wheel Flora" },
    description: {
      zh: "比起车轮，更像是好吃的瑞士卷",
      en: "It looks less like a wheel and more like a tasty Swiss roll.",
    },
    traitDescription: {
      zh: "蜷成车轮后，会直接清空一整条跑道的敌人。",
      en: "Once curled into a wheel, Flora clears an entire lane of enemies.",
    },
    tag: { zh: "跑道", en: "Lane" },
    strength: "B",
    ability: "lane-runner",
    damage: 1,
    imageAssets: [
      "https://assets.anuluca.com/otherWebsites/flora-vs-luca/cats/wheel-hua/projectile-02.webp",
      "https://assets.anuluca.com/otherWebsites/flora-vs-luca/cats/wheel-hua/projectile-03.webp",
    ],
    projectileAssets: [
      "https://assets.anuluca.com/otherWebsites/flora-vs-luca/cats/wheel-hua/projectile-02.webp",
      "https://assets.anuluca.com/otherWebsites/flora-vs-luca/cats/wheel-hua/projectile-03.webp",
    ],
    // 第三张图同时作为图鉴、准备页和战斗库存的默认展示图。
    previewAssets: [
      "https://assets.anuluca.com/otherWebsites/flora-vs-luca/cats/wheel-hua/projectile-03.webp",
    ],
    unusedBonusScore: 300,
  },
  "hehe-hua": {
    id: "hehe-hua",
    name: { zh: "嘻嘻", en: "Hehe" },
    description: {
      zh: "为什么我会出现在这里",
      en: "Why am I here?",
    },
    traitDescription: {
      zh: "嘲讽你一下",
      en: "Taunts you for a moment.",
    },
    tag: { zh: "嘲讽", en: "Taunt" },
    strength: "R",
    // 彩蛋类型当前不进入任何关卡；补齐战斗字段以保持猫咪配置结构统一。
    ability: "ricochet",
    damage: 1,
    imageAssets: ["https://assets.anuluca.com/otherWebsites/flora-vs-luca/cats/defeat-cat.webp"],
    projectileAssets: ["https://assets.anuluca.com/otherWebsites/flora-vs-luca/cats/defeat-cat.webp"],
    previewAssets: ["https://assets.anuluca.com/otherWebsites/flora-vs-luca/cats/defeat-cat.webp"],
    unusedBonusScore: 0,
  },
} as const satisfies Record<string, CatTypeConfig>;

export type CatTypeId = keyof typeof CAT_TYPES;
