import { LEVELS, type LevelId } from "../config";

export type LevelProgress = Record<LevelId, { bestScore: number; completed: boolean }>;

export const LEVEL_PROGRESS_STORAGE_KEY = "hua-vs-luca-level-progress-v1";
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

  return Object.fromEntries(
    LEVELS.map((level) => {
      const levelData = parsed[level.id];
      const migratedBest = level.id === "1-1" && Number.isFinite(legacyBestScore)
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
