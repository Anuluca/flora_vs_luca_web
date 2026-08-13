import { CAT_TYPES, ENEMY_TYPES, LEVELS, type CatTypeId, type EnemyTypeId, type Level, type LevelId } from "../config";

export const GAME = {
  ballSpeed: 39,
  ballLaneSpeed: 4.5,
  cooldown: 0.62,
  homeLine: 18.5,
  endlessLaneCount: 7,
} as const;

/**
 * 同一跑道保留两秒出生间隔。
 * 一秒虽满足时间约束，但路卡按当前速度只能移动约半个身位，视觉上仍像同时冒出。
 */
export const MIN_SAME_LANE_SPAWN_INTERVAL = 2;

/** 结算节奏统一放在领域层，避免视图和循环分别维护魔法数字。 */
export const SETTLEMENT_TIMING = {
  intro: 650,
  perCat: 420,
  outro: 520,
} as const;

export type Phase = "menu" | "playing" | "paused" | "settling" | "victory" | "defeat";
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
  health: number;
};

export type Ball = {
  id: number;
  catTypeId: CatTypeId;
  lane: number;
  targetLane: number;
  x: number;
  asset: string;
  hitCount: number;
  /** 放置时间，仅供界面控制短暂的烟尘显示，不参与移动或碰撞。 */
  placedAt?: number;
  /** 已经造成过伤害的敌人，避免持续重叠时逐帧重复扣血。 */
  hitEnemyIds: number[];
  /** 单跑道命中后保留短暂时间，供界面播放向下掉出动画。 */
  fallingAt?: number;
};

export type HitEffect = {
  id: number;
  lane: number;
  x: number;
  label: string;
  expiresAt: number;
};

/** 敌人被击中后保留片刻的位置与外观，用于播放身体零件散落动画。 */
export type EnemyDeathEffect = {
  id: number;
  typeId: EnemyTypeId;
  lane: number;
  x: number;
  damaged: boolean;
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
  settlementStartedAt: number;
  settlementBonusAdded: number;
  settlementCatsCounted: number;
  settlementQueue: CatTypeId[];
  redHeatActive: boolean;
  redHeatNotice: "entered" | "ended" | null;
  redHeatNoticeExpiresAt: number;
  enemies: Enemy[];
  balls: Ball[];
  effects: HitEffect[];
  deathEffects: EnemyDeathEffect[];
  nextEnemyId: number;
  nextEndlessSpawnAt: number;
  lastEnemySpawnAtByLane: number[];
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

/** 原地 Fisher–Yates 洗牌，保持各敌人精确数量不变，仅随机化出场顺序。 */
function shuffleEnemyTypes<T>(items: T[]) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
  }
  return items;
}

export function createEnemySchedule(level: Level): Enemy[] {
  let previousLane = -1;
  let repeated = 0;
  const lastSpawnAtByLane = Array.from({ length: level.lanes }, () => Number.NEGATIVE_INFINITY);
  const configuredEnemyIds = "enemyInventory" in level
    ? level.enemyTypeIds.flatMap((typeId) => (
      Array.from({ length: level.enemyInventory[typeId] ?? 0 }, () => typeId)
    ))
    : [];
  const enemyTypeSchedule = configuredEnemyIds.length === level.totalEnemies
    ? shuffleEnemyTypes(configuredEnemyIds)
    : Array.from(
      { length: level.totalEnemies },
      (_, index) => level.enemyTypeIds[index % level.enemyTypeIds.length],
    );

  return enemyTypeSchedule.map((typeId, index) => {
    let lane = Math.floor(Math.random() * level.lanes);

    if (lane === previousLane) repeated += 1;
    else repeated = 0;

    if (repeated > 1 && level.lanes > 1) {
      lane = (lane + 1 + Math.floor(Math.random() * (level.lanes - 1))) % level.lanes;
      repeated = 0;
    }

    previousLane = lane;
    const candidateSpawnAt = 0.75 + index * 1.08 + Math.random() * 0.32;
    const spawnAt = Math.max(
      candidateSpawnAt,
      lastSpawnAtByLane[lane] + MIN_SAME_LANE_SPAWN_INTERVAL,
    );
    lastSpawnAtByLane[lane] = spawnAt;

    return {
      id: index + 1,
      typeId,
      lane,
      // 所有敌人从同一出生线进入，避免靠后的初始偏移抵消时间间隔。
      x: 103,
      spawnAt,
      spawned: false,
      defeated: false,
      health: ENEMY_TYPES[typeId].maxHealth,
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
    settlementStartedAt: 0,
    settlementBonusAdded: 0,
    settlementCatsCounted: 0,
    settlementQueue: [],
    redHeatActive: false,
    redHeatNotice: null,
    redHeatNoticeExpiresAt: 0,
    enemies,
    balls: [],
    effects: [],
    deathEffects: [],
    nextEnemyId: enemies.length + 1,
    nextEndlessSpawnAt: 0.75,
    lastEnemySpawnAtByLane: Array.from(
      { length: mode === "endless" ? GAME.endlessLaneCount : level.lanes },
      () => Number.NEGATIVE_INFINITY,
    ),
    laneCount: mode === "endless" ? GAME.endlessLaneCount : level.lanes,
    remainingCats,
  };
}

/**
 * 从已结束冷却的跑道中随机选择一个；若全部仍在冷却则返回 null，调用方延后出怪。
 * 该函数只读取时间表，便于普通关卡与无尽模式共享同一条间隔规则。
 */
export function chooseEnemySpawnLane(
  lastSpawnAtByLane: readonly number[],
  now: number,
): number | null {
  const availableLanes: number[] = [];
  for (let lane = 0; lane < lastSpawnAtByLane.length; lane += 1) {
    if (now - lastSpawnAtByLane[lane] >= MIN_SAME_LANE_SPAWN_INTERVAL) {
      availableLanes.push(lane);
    }
  }

  if (availableLanes.length === 0) return null;
  return availableLanes[Math.floor(Math.random() * availableLanes.length)];
}

/**
 * 对敌人结算一次伤害并返回是否死亡。
 * maxHealth 仅用于兼容本地热更新前已生成、尚未携带 health 字段的旧敌人。
 */
export function applyEnemyDamage(enemy: Enemy, damage: number, maxHealth: number) {
  const safeDamage = Math.max(0, damage);
  enemy.health = Math.max(0, (enemy.health ?? maxHealth) - safeDamage);
  return enemy.health === 0;
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
  // 只需要最近目标，无需先分配数组再执行 O(n log n) 排序。
  let nearestTarget: Enemy | undefined;
  for (const enemy of enemies) {
    const canRicochet =
      enemy.spawned &&
      !enemy.defeated &&
      enemy.x > ball.x + 2 &&
      Math.abs(enemy.lane - currentLane) === 1;
    if (canRicochet && (!nearestTarget || enemy.x < nearestTarget.x)) nearestTarget = enemy;
  }

  if (nearestTarget) return nearestTarget.lane;
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

/** 将剩余数量转换成一次性结算队列；战斗循环后续只移动游标，不再每帧展开数组。 */
export function createSettlementQueue(remainingCats: Partial<Record<CatTypeId, number>>) {
  return Object.entries(remainingCats).flatMap(([catTypeId, count]) =>
    Array.from({ length: Math.max(0, count ?? 0) }, () => catTypeId as CatTypeId),
  );
}

export function getSettlementState(elapsed: number, totalCats: number) {
  const catsCounted = Math.min(
    totalCats,
    Math.max(0, Math.floor((elapsed - SETTLEMENT_TIMING.intro) / SETTLEMENT_TIMING.perCat)),
  );
  const completeAt =
    SETTLEMENT_TIMING.intro + totalCats * SETTLEMENT_TIMING.perCat + SETTLEMENT_TIMING.outro;
  return { catsCounted, complete: elapsed >= completeAt };
}

/** 红温区间统一由关卡配置驱动；结束值不包含在区间内，1 表示直到关卡完成。 */
export function isRedHeatProgress(level: Level, progress: number) {
  return (level.redHeatRanges ?? []).some(({ start, end }) =>
    progress >= start && (end >= 1 ? progress <= end : progress < end),
  );
}
