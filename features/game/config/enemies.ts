import type { EnemySpeed, EnemyTypeConfig } from "../domain/config-types";

/**
 * 所有敌人共用同一套速度档位，关卡与无尽模式不再覆写基础速度。
 * 红温状态和玩家加速只在战斗期间叠加临时倍率。
 */
export const ENEMY_SPEED_MULTIPLIERS = {
  slow: 1,
  medium: 2,
  fast: 3,
  extreme: 4,
} as const satisfies Record<EnemySpeed, number>;

export const BASE_ENEMY_SPEED = 3.6;

/** 敌人图鉴、外观与战斗属性的唯一数据源。 */
export const ENEMY_TYPES = {
  luca: {
    id: "luca",
    name: { zh: "路卡", en: "Luca" },
    description: { zh: "这个路卡就是逊啦。", en: "This Luca is such a loser." },
    traitDescription: { zh: "只会慢慢得走。", en: "All Luca can do is walk slowly." },
    strength: "C",
    avatar: "luca",
    imageAssets: ["https://assets.anuluca.com/otherWebsites/flora-vs-luca/enemies/luca/head.webp"],
    headAsset: "https://assets.anuluca.com/otherWebsites/flora-vs-luca/enemies/luca/head.webp",
    partAssets: {
      body: "https://assets.anuluca.com/otherWebsites/flora-vs-luca/enemies/luca/body.webp",
      hand: "https://assets.anuluca.com/otherWebsites/flora-vs-luca/enemies/luca/hand.webp",
      leg: "https://assets.anuluca.com/otherWebsites/flora-vs-luca/enemies/luca/leg.webp",
      tail: "https://assets.anuluca.com/otherWebsites/flora-vs-luca/enemies/luca/tail.webp",
    },
    soundEffects: {
      death: { src: "https://assets.anuluca.com/otherWebsites/flora-vs-luca/audio/enemy-death-rizz.mp3", volumeMultiplier: 0.667 },
    },
    bodyColor: "#D4C892",
    armColor: "#D4C892",
    speed: "slow",
    maxHealth: 1,
    killScore: 100,
  },
  "work-luca": {
    id: "work-luca",
    name: { zh: "牛马路卡", en: "Workhorse Luca" },
    description: { zh: "请不要打扰他工作。", en: "Please do not disturb him while he works." },
    traitDescription: { zh: "承受一次攻击后会加速", en: "Speeds up after taking one hit." },
    strength: "B",
    avatar: "work-luca",
    imageAssets: [
      "https://assets.anuluca.com/otherWebsites/flora-vs-luca/enemies/luca/head.webp",
      "https://assets.anuluca.com/otherWebsites/flora-vs-luca/enemies/work-luca/laptop.webp",
      "https://assets.anuluca.com/otherWebsites/flora-vs-luca/enemies/work-luca/glasses.webp",
      "https://assets.anuluca.com/otherWebsites/flora-vs-luca/enemies/work-luca/glasses-broken.webp",
    ],
    headAsset: "https://assets.anuluca.com/otherWebsites/flora-vs-luca/enemies/luca/head.webp",
    partAssets: {
      body: "https://assets.anuluca.com/otherWebsites/flora-vs-luca/enemies/luca/body.webp",
      hand: "https://assets.anuluca.com/otherWebsites/flora-vs-luca/enemies/luca/hand.webp",
      leg: "https://assets.anuluca.com/otherWebsites/flora-vs-luca/enemies/luca/leg.webp",
      tail: "https://assets.anuluca.com/otherWebsites/flora-vs-luca/enemies/luca/tail.webp",
    },
    equipmentAssets: {
      laptop: "https://assets.anuluca.com/otherWebsites/flora-vs-luca/enemies/work-luca/laptop.webp",
      glasses: "https://assets.anuluca.com/otherWebsites/flora-vs-luca/enemies/work-luca/glasses.webp",
      brokenGlasses: "https://assets.anuluca.com/otherWebsites/flora-vs-luca/enemies/work-luca/glasses-broken.webp",
    },
    soundEffects: {
      death: { src: "https://assets.anuluca.com/otherWebsites/flora-vs-luca/audio/enemy-death-rizz.mp3", volumeMultiplier: 0.667 },
    },
    bodyColor: "#D4C892",
    armColor: "#D4C892",
    speed: "slow",
    maxHealth: 2,
    damagedSpeedMultiplier: 2,
    killScore: 200,
  },
} as const satisfies Record<string, EnemyTypeConfig>;

export type EnemyTypeId = keyof typeof ENEMY_TYPES;
