export type Difficulty = 1 | 2 | 3 | 4 | 5;
export type Locale = "zh" | "en";
export type LocalizedText = Readonly<Record<Locale, string>>;

export function localize(text: LocalizedText, locale: Locale) {
  return text[locale];
}

export type CatTypeConfig = {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  position: LocalizedText;
  imageAssets: readonly string[];
  projectileAssets: readonly string[];
  previewAssets: readonly string[];
  /** 结算时每只未使用猫咪可兑换的分数。 */
  unusedBonusScore: number;
};

export type EnemyTypeConfig = {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
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
  name: LocalizedText;
  difficulty: Difficulty;
  totalEnemies: number;
  enemySpeed: number;
  lanes: number;
  catInventory: Readonly<Partial<Record<CatId, number>>>;
  ratingThresholds: RatingThresholds;
  /** 战斗页底部提示，多个提示由界面使用圆点分隔。 */
  tips: readonly LocalizedText[];
  catTypeIds: readonly CatId[];
  enemyTypeIds: readonly EnemyId[];
};
