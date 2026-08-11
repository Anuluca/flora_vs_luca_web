export type Difficulty = 1 | 2 | 3 | 4 | 5;

export type CatTypeConfig = {
  id: string;
  name: string;
  description: string;
  position: string;
  imageAssets: readonly string[];
  projectileAssets: readonly string[];
  previewAssets: readonly string[];
  /** 结算时每只未使用猫咪可兑换的分数。 */
  unusedBonusScore: number;
};

export type EnemyTypeConfig = {
  id: string;
  name: string;
  description: string;
  strength: Difficulty;
  imageAssets: readonly string[];
  headAsset: string;
  bodyColor: string;
  armColor: string;
  emblem: string;
  /** 击败该敌人的基础分，连撞倍率会在此基础上计算。 */
  killScore: number;
};

export type RatingThresholds = {
  twoStars: number;
  threeStars: number;
};

export type LevelConfig<CatId extends string = string, EnemyId extends string = string> = {
  id: string;
  name: string;
  difficulty: Difficulty;
  totalEnemies: number;
  enemySpeed: number;
  lanes: number;
  catInventory: Readonly<Partial<Record<CatId, number>>>;
  ratingThresholds: RatingThresholds;
  catTypeIds: readonly CatId[];
  enemyTypeIds: readonly EnemyId[];
};
