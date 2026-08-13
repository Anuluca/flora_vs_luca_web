export type Difficulty = 1 | 2 | 3 | 4 | 5;
export type Locale = "zh" | "en";
export type LocalizedText = Readonly<Record<Locale, string>>;
export type EnemySpeed = "slow" | "medium" | "fast" | "extreme";
export type StrengthRank = "R" | "S" | "A" | "B" | "C";

export function localize(text: LocalizedText, locale: Locale) {
  return text[locale];
}

export type CatAbility = "ricochet" | "lane-runner";

export type CatTypeConfig = {
  id: string;
  name: LocalizedText;
  /** 世界观设定描述；图鉴列表与详情页均展示。 */
  description: LocalizedText;
  /** 实际玩法特性；仅在图鉴详情页展示。 */
  traitDescription: LocalizedText;
  tag: LocalizedText;
  strength: StrengthRank;
  /** 命中后的行为由猫咪类型决定：换道连撞，或沿当前跑道持续造成接触伤害。 */
  ability: CatAbility;
  /** 每次首次接触敌人造成的伤害。 */
  damage: number;
  imageAssets: readonly string[];
  projectileAssets: readonly string[];
  /** 列表、选关和准备阶段只使用这一张示例图，不能混入随机弹丸图库。 */
  previewAssets: readonly [string];
  /** 结算时每只未使用猫咪可兑换的分数。 */
  unusedBonusScore: number;
};

export type EnemyTypeConfig = {
  id: string;
  name: LocalizedText;
  /** 世界观设定描述；图鉴列表与详情页均展示。 */
  description: LocalizedText;
  /** 实际玩法特性；仅在图鉴详情页展示。 */
  traitDescription: LocalizedText;
  strength: StrengthRank;
  /** 轻量展示使用的头像组件 ID；完整造型仍由战斗模型组件负责。 */
  avatar: string;
  imageAssets: readonly string[];
  headAsset: string;
  /** 战斗模型使用的透明部件素材，死亡散落效果复用同一套资源。 */
  partAssets: {
    body: string;
    hand: string;
    leg: string;
    tail: string;
  };
  /** 特殊敌人的叠加装备；未配置时只渲染基础路卡模型。 */
  equipmentAssets?: {
    laptop: string;
    glasses: string;
    brokenGlasses: string;
  };
  /** 敌人专属音效；后续类型可为同一事件配置不同音频与音量。 */
  soundEffects?: {
    death?: {
      src: string;
      volumeMultiplier: number;
    };
  };
  bodyColor: string;
  armColor: string;
  /** 敌人类型自身的速度档位，数值倍率由统一映射维护。 */
  speed: EnemySpeed;
  /** 敌人的最大生命值；当前路卡受到一次 1 点伤害就会死亡。 */
  maxHealth: number;
  /** 首次受伤后的自身速度倍率；不改变图鉴中的基础速度档位。 */
  damagedSpeedMultiplier?: number;
  /** 击败该敌人的基础分，连撞倍率会在此基础上计算。 */
  killScore: number;
};

export type RatingThresholds = {
  twoStars: number;
  threeStars: number;
};

export type RedHeatRange = {
  start: number;
  end: number;
};

export type MatchupPreviewConfig<CatId extends string, EnemyId extends string> = {
  /** 选关卡片每侧最多展示两个类型，不影响实际战斗阵容。 */
  catTypeIds: readonly [CatId] | readonly [CatId, CatId];
  enemyTypeIds: readonly [EnemyId] | readonly [EnemyId, EnemyId];
};

export type LevelConfig<CatId extends string = string, EnemyId extends string = string> = {
  id: string;
  name: LocalizedText;
  difficulty: Difficulty;
  totalEnemies: number;
  lanes: number;
  catInventory: Readonly<Partial<Record<CatId, number>>>;
  ratingThresholds: RatingThresholds;
  /** 战斗页底部提示，多个提示由界面使用圆点分隔。 */
  tips: readonly LocalizedText[];
  catTypeIds: readonly CatId[];
  enemyTypeIds: readonly EnemyId[];
  /** 每种敌人的精确出场数量；未配置时沿用 enemyTypeIds 轮流生成。 */
  enemyInventory?: Readonly<Partial<Record<EnemyId, number>>>;
  matchupPreview: MatchupPreviewConfig<CatId, EnemyId>;
  /** 区间内所有敌人进入三倍速红温状态，比例范围使用 0～1。 */
  redHeatRanges?: readonly RedHeatRange[];
};
