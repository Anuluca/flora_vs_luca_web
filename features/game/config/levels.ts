import type { LevelConfig } from "../domain/config-types";
import type { CatTypeId } from "./cats";
import type { EnemyTypeId } from "./enemies";

/**
 * 关卡展示与战斗参数的唯一数据源。
 * catTypeIds / enemyTypeIds 会在编译时校验是否存在对应类型。
 */
export const LEVELS = [
  {
    id: "1-1",
    name: { zh: "出租屋", en: "Rental Room" },
    difficulty: 1,
    totalEnemies: 6,
    lanes: 1,
    catInventory: { "ball-hua": 10 },
    ratingThresholds: { twoStars: 500, threeStars: 1100 },
    tips: [
      { zh: "拖动猫咪到跑道发射！", en: "Drag a cat onto the lane to launch!" },
    ],
    catTypeIds: ["ball-hua"],
    enemyTypeIds: ["luca"],
    matchupPreview: { catTypeIds: ["ball-hua"], enemyTypeIds: ["luca"] },
    redHeatRanges: [],
  },
  {
    id: "1-2",
    name: { zh: "猫窝前院", en: "Cat Nest Yard" },
    difficulty: 1,
    totalEnemies: 12,
    lanes: 3,
    catInventory: { "ball-hua": 8 },
    ratingThresholds: { twoStars: 1200, threeStars: 1600 },
    tips: [
      { zh: "拖动猫咪到跑道发射！", en: "Drag a cat onto the lane to launch!" },
      { zh: "最后阶段小心红温路卡", en: "Beware of red-hot Luca near the end" },
    ],
    catTypeIds: ["ball-hua"],
    enemyTypeIds: ["luca"],
    matchupPreview: { catTypeIds: ["ball-hua"], enemyTypeIds: ["luca"] },
    redHeatRanges: [{ start: 0.8, end: 1 }],
  },
  {
    id: "1-3",
    name: { zh: "客厅防线", en: "Living Room Defense" },
    difficulty: 1,
    totalEnemies: 18,
    lanes: 5,
    catInventory: { "ball-hua": 20 },
    ratingThresholds: { twoStars: 2000, threeStars: 2500 },
    tips: [
      { zh: "拖动猫咪到跑道发射！", en: "Drag a cat onto the lane to launch!" },
    ],
    catTypeIds: ["ball-hua"],
    enemyTypeIds: ["luca"],
    matchupPreview: { catTypeIds: ["ball-hua"], enemyTypeIds: ["luca"] },
    redHeatRanges: [],
  },
  {
    id: "1-4",
    name: { zh: "走廊追击", en: "Hallway Chase" },
    difficulty: 2,
    totalEnemies: 30,
    lanes: 5,
    catInventory: { "ball-hua": 22 },
    ratingThresholds: { twoStars: 2400, threeStars: 3000 },
    tips: [
      { zh: "拖动猫咪到跑道发射！", en: "Drag a cat onto the lane to launch!" },
      { zh: "最后阶段小心红温路卡", en: "Beware of red-hot Luca near the end" },
    ],
    catTypeIds: ["ball-hua"],
    enemyTypeIds: ["luca"],
    matchupPreview: { catTypeIds: ["ball-hua"], enemyTypeIds: ["luca"] },
    redHeatRanges: [{ start: 0.75, end: 1 }],
  },
  {
    id: "1-5",
    name: { zh: "阳台乱斗", en: "Balcony Brawl" },
    difficulty: 3,
    totalEnemies: 50,
    lanes: 5,
    catInventory: { "ball-hua": 24, "wheel-hua": 1 },
    ratingThresholds: { twoStars: 2700, threeStars: 3400 },
    tips: [
      { zh: "拖动猫咪到跑道发射！", en: "Drag a cat onto the lane to launch!" },
      { zh: "尽量让花花连续撞击", en: "Chain as many hits as possible" },
    ],
    catTypeIds: ["ball-hua", "wheel-hua"],
    enemyTypeIds: ["luca"],
    matchupPreview: { catTypeIds: ["ball-hua", "wheel-hua"], enemyTypeIds: ["luca"] },
    redHeatRanges: [{ start: 0.35, end: 0.55 }, { start: 0.75, end: 1 }],
  },
  {
    id: "1-EX",
    name: { zh: "红温禁区", en: "Red-Heat Zone" },
    difficulty: 4,
    totalEnemies: 50,
    lanes: 5,
    catInventory: { "ball-hua": 2, "wheel-hua": 17 },
    ratingThresholds: { twoStars: 2700, threeStars: 3400 },
    tips: [
      { zh: "拖动猫咪到跑道发射！", en: "Drag a cat onto the lane to launch!" },
      { zh: "35% 进度后敌人会持续红温", en: "Enemies stay red-hot after 35% progress" },
      { zh: "谨慎使用球形花花", en: "" },
    ],
    catTypeIds: ["ball-hua", "wheel-hua"],
    enemyTypeIds: ["luca"],
    matchupPreview: { catTypeIds: ["ball-hua", "wheel-hua"], enemyTypeIds: ["luca"] },
    redHeatRanges: [{ start: 0.35, end: 1 }],
  },
  {
    id: "2-1",
    name: { zh: "牛马登场", en: "Workhorse Arrival" },
    difficulty: 2,
    totalEnemies: 15,
    lanes: 5,
    catInventory: { "ball-hua": 5, "wheel-hua": 5 },
    ratingThresholds: { twoStars: 1800, threeStars: 2400 },
    tips: [
      { zh: "牛马路卡承受一次攻击后会加速", en: "Workhorse Luca speeds up after taking one hit." }
    ],
    catTypeIds: ["ball-hua", "wheel-hua"],
    enemyTypeIds: ["luca", "work-luca"],
    enemyInventory: { luca: 10, "work-luca": 5 },
    matchupPreview: { catTypeIds: ["ball-hua", "wheel-hua"], enemyTypeIds: ["luca", "work-luca"] },
    redHeatRanges: [{ start: 0.75, end: 1 }],
  },
] as const satisfies readonly LevelConfig<CatTypeId, EnemyTypeId>[];

type LevelDefinition = (typeof LEVELS)[number];
export type LevelId = LevelDefinition["id"];
/** 对外暴露稳定结构，避免调用方被各关卡对象的字面量差异污染。 */
export type Level = LevelConfig<CatTypeId, EnemyTypeId> & { id: LevelId };

export type LevelChapter = {
  id: "chapter-1" | "chapter-2";
  label: { zh: string; en: string };
  title: { zh: string; en: string };
  /**
   * 只有已完成玩法配置的槽位才关联 levelId；空槽位仅用于选关页预览。
   * hidden 槽位不会参与本章通关判定，避免隐藏关形成自我依赖。
   */
  slots: readonly { id: string; levelId?: LevelId; kind?: "hidden" }[];
};

/**
 * 章节展示数据与战斗关卡分离。
 * 这样可以预先展示尚未制作的章节，同时避免空关卡进入战斗与进度计算。
 */
export const LEVEL_CHAPTERS: readonly LevelChapter[] = [
  {
    id: "chapter-1",
    label: { zh: "EPISODE 1", en: "EPISODE 1" },
    title: { zh: "魔丸降世", en: "The Ball Awakens" },
    slots: [
      { id: "1-1", levelId: "1-1" },
      { id: "1-2", levelId: "1-2" },
      { id: "1-3", levelId: "1-3" },
      { id: "1-4", levelId: "1-4" },
      { id: "1-5", levelId: "1-5" },
      { id: "1-EX", levelId: "1-EX", kind: "hidden" },
    ],
  },
  {
    id: "chapter-2",
    label: { zh: "EPISODE 2", en: "EPISODE 2" },
    title: { zh: "花前乱语", en: "Flora's Ramblings" },
    slots: [
      { id: "2-1", levelId: "2-1" },
      ...["2-2", "2-3", "2-4", "2-5"].map((id) => ({ id })),
      { id: "2-EX", kind: "hidden" },
    ],
  },
];

export function getLevel(levelId: LevelId): Level {
  return LEVELS.find((level) => level.id === levelId) ?? LEVELS[0];
}
