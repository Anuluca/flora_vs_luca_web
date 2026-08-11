import { LEVELS, type LevelId } from "../config";

export type LevelProgress = Record<LevelId, { bestScore: number; completed: boolean }>;

export const LEVEL_PROGRESS_STORAGE_KEY = "hua-vs-luca-level-progress-v2";
const PREVIOUS_LEVEL_PROGRESS_STORAGE_KEY = "hua-vs-luca-level-progress-v1";
const LEGACY_BEST_SCORE_STORAGE_KEY = "hua-vs-luca-best";

export function createEmptyLevelProgress(): LevelProgress {
  return Object.fromEntries(
    LEVELS.map((level) => [level.id, { bestScore: 0, completed: false }]),
  ) as LevelProgress;
}

export function loadLevelProgress(storage: Storage): LevelProgress {
  const legacyBestScore = Number(storage.getItem(LEGACY_BEST_SCORE_STORAGE_KEY) ?? 0);
  const saved = storage.getItem(LEVEL_PROGRESS_STORAGE_KEY);
  const parsed = saved ? JSON.parse(saved) as Partial<LevelProgress> : {};
  const previousSaved = storage.getItem(PREVIOUS_LEVEL_PROGRESS_STORAGE_KEY);
  const previous = previousSaved ? JSON.parse(previousSaved) as Partial<LevelProgress> : {};

  return Object.fromEntries(
    LEVELS.map((level) => {
      // 原 1-1 已整体顺延为 1-2，因此旧版本的成绩也随关卡迁移。
      const levelData = parsed[level.id] ?? (level.id === "1-2" ? previous["1-1"] : undefined);
      const migratedBest = level.id === "1-2" && Number.isFinite(legacyBestScore)
        ? legacyBestScore
        : 0;

      return [
        level.id,
        {
          bestScore: Math.max(0, Number(levelData?.bestScore ?? migratedBest) || 0),
          completed: Boolean(levelData?.completed),
        },
      ];
    }),
  ) as LevelProgress;
}

export function saveLevelProgress(storage: Storage, progress: LevelProgress) {
  storage.setItem(LEVEL_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
}
