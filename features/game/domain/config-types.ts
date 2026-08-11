export type Difficulty = 1 | 2 | 3 | 4 | 5;

export type CatTypeConfig = {
  id: string;
  name: string;
  description: string;
  position: string;
  imageAssets: readonly string[];
  projectileAssets: readonly string[];
  previewAssets: readonly string[];
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
};

export type LevelConfig<CatId extends string = string, EnemyId extends string = string> = {
  id: string;
  name: string;
  difficulty: Difficulty;
  totalEnemies: number;
  enemySpeed: number;
  catTypeIds: readonly CatId[];
  enemyTypeIds: readonly EnemyId[];
};
