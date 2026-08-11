import { CAT_TYPES, LEVELS, type CatTypeId, type EnemyTypeId, type Level, type LevelId } from "../config";

export const GAME = {
  ballSpeed: 39,
  ballLaneSpeed: 4.5,
  cooldown: 0.62,
  homeLine: 18.5,
  endlessEnemySpeedMultiplier: 4,
} as const;

export type Phase = "menu" | "playing" | "paused" | "victory" | "defeat";
export type GameMode = "level" | "endless";
export type StarRating = 0 | 1 | 2 | 3;

export type Enemy = {
  id: number;
  typeId: EnemyTypeId;
  lane: number;
  x: number;
  spawnAt: number;
  spawned: boolean;
  defeated: boolean;
};

export type Ball = {
  id: number;
  catTypeId: CatTypeId;
  lane: number;
  targetLane: number;
  x: number;
  asset: string;
  hitIds: number[];
};

export type HitEffect = {
  id: number;
  lane: number;
  x: number;
  label: string;
  expiresAt: number;
};

export type GameModel = {
  levelId: LevelId;
  mode: GameMode;
  phase: Phase;
  elapsed: number;
  score: number;
  unusedCatBonus: number;
  combo: number;
  bestCombo: number;
  defeated: number;
  shots: number;
  nextShotAt: number;
  lastHitAt: number;
  enemies: Enemy[];
  balls: Ball[];
  effects: HitEffect[];
  nextEnemyId: number;
  nextEndlessSpawnAt: number;
  laneCount: number;
  remainingCats: Record<CatTypeId, number>;
};

export type Decoration = {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
};

export const INITIAL_DECORATIONS: Decoration[] = [
  { id: 1, x: 8, y: 10, rotation: -12, scale: 0.92 },
  { id: 2, x: 35, y: 5, rotation: 8, scale: 1.03 },
  { id: 3, x: 62, y: 14, rotation: -4, scale: 0.88 },
  { id: 4, x: 18, y: 43, rotation: 11, scale: 0.96 },
  { id: 5, x: 49, y: 47, rotation: -9, scale: 1.05 },
  { id: 6, x: 72, y: 37, rotation: 5, scale: 0.86 },
];

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function createEnemySchedule(level: Level): Enemy[] {
  let previousLane = -1;
  let repeated = 0;

  return Array.from({ length: level.totalEnemies }, (_, index) => {
    let lane = Math.floor(Math.random() * level.lanes);

    if (lane === previousLane) repeated += 1;
    else repeated = 0;

    if (repeated > 1 && level.lanes > 1) {
      lane = (lane + 1 + Math.floor(Math.random() * (level.lanes - 1))) % level.lanes;
      repeated = 0;
    }

    previousLane = lane;

    return {
      id: index + 1,
      typeId: level.enemyTypeIds[index % level.enemyTypeIds.length],
      lane,
      x: 103 + (index % 3) * 2.2,
      spawnAt: 0.75 + index * 1.08 + Math.random() * 0.32,
      spawned: false,
      defeated: false,
    };
  });
}

export function createGameModel(
  level: Level = LEVELS[0],
  phase: Phase = "menu",
  mode: GameMode = "level",
): GameModel {
  const enemies = mode === "endless" ? [] : createEnemySchedule(level);
  const remainingCats = Object.fromEntries(
    level.catTypeIds.map((catTypeId) => [catTypeId, level.catInventory[catTypeId] ?? 0]),
  ) as Record<CatTypeId, number>;

  return {
    levelId: level.id,
    mode,
    phase,
    elapsed: 0,
    score: 0,
    unusedCatBonus: 0,
    combo: 0,
    bestCombo: 0,
    defeated: 0,
    shots: 0,
    nextShotAt: 0,
    lastHitAt: -10,
    enemies,
    balls: [],
    effects: [],
    nextEnemyId: enemies.length + 1,
    nextEndlessSpawnAt: 0.75,
    laneCount: level.lanes,
    remainingCats,
  };
}

export function createDecorations(): Decoration[] {
  const count = Math.random() > 0.5 ? 6 : 5;
  const clusteredSlots = [
    { x: 29, y: 15 },
    { x: 46, y: 9 },
    { x: 62, y: 17 },
    { x: 34, y: 39 },
    { x: 51, y: 34 },
    { x: 66, y: 42 },
  ];

  return clusteredSlots.slice(0, count).map((slot, index) => ({
    id: index + 1,
    x: slot.x + Math.random() * 3,
    y: slot.y + Math.random() * 3,
    rotation: -18 + Math.random() * 36,
    scale: 0.9 + Math.random() * 0.16,
  }));
}

export function chooseRicochetLane(ball: Ball, enemies: Enemy[], laneCount: number) {
  if (laneCount <= 1) return 0;

  const currentLane = Math.round(ball.lane);
  const liveTargets = enemies
    .filter(
      (enemy) =>
        enemy.spawned &&
        !enemy.defeated &&
        enemy.x > ball.x + 2 &&
        Math.abs(enemy.lane - currentLane) === 1,
    )
    .sort((a, b) => a.x - b.x);

  if (liveTargets[0]) return liveTargets[0].lane;
  if (currentLane === 0) return 1;
  if (currentLane === laneCount - 1) return laneCount - 2;
  return currentLane + (Math.random() > 0.5 ? 1 : -1);
}

/** 完成关卡即至少一星，其余星级只由该关卡的两条分数线决定。 */
export function getLevelRating(level: Level, score: number, completed: boolean): StarRating {
  if (!completed) return 0;
  if (score >= level.ratingThresholds.threeStars) return 3;
  if (score >= level.ratingThresholds.twoStars) return 2;
  return 1;
}

/** 同一只猫咪连续击中的第 N 个敌人，倍率依次为 1、1.2、1.4…… */
export function getChainMultiplier(chainCount: number) {
  return 1 + Math.max(0, chainCount - 1) * 0.2;
}

export function getUnusedCatBonus(remainingCats: Partial<Record<CatTypeId, number>>) {
  return Object.entries(remainingCats).reduce((total, [catTypeId, count]) => {
    const catType = CAT_TYPES[catTypeId as CatTypeId];
    return total + (catType?.unusedBonusScore ?? 0) * Math.max(0, count ?? 0);
  }, 0);
}
