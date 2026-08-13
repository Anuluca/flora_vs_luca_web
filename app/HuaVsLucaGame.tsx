"use client";

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { createPortal, flushSync } from "react-dom";
import {
  FaBookOpen,
  FaCat,
  FaCheck,
  FaFastForward,
  FaGithub,
  FaHistory,
  FaHome,
  FaInfoCircle,
  FaPause,
  FaPlay,
  FaRedoAlt,
  FaShareAlt,
  FaSignOutAlt,
  FaVolumeMute,
  FaVolumeUp,
} from "react-icons/fa";
import {
  CAT_TYPES,
  BASE_ENEMY_SPEED,
  ENEMY_SPEED_MULTIPLIERS,
  ENEMY_TYPES,
  GAME_ASSET_URLS,
  GAME_AUDIO_URLS,
  GAME_IMAGE_URLS,
  GAME_INSTANT_AUDIO_URLS,
  LEVEL_CHAPTERS,
  LEVELS,
  getLevel,
  localize,
  type CatTypeId,
  type EnemyTypeId,
  type LevelId,
  type Locale,
} from "@/features/game/config";
import { LOADING_MESSAGES, LOCALE_STORAGE_KEY, UI_COPY } from "@/features/game/i18n";
import {
  GAME,
  INITIAL_DECORATIONS,
  MIN_SAME_LANE_SPAWN_INTERVAL,
  applyEnemyDamage,
  chooseRicochetLane,
  chooseEnemySpawnLane,
  clamp,
  createDecorations,
  createGameModel,
  createSettlementQueue,
  getChainMultiplier,
  getLevelRating,
  getSettlementState,
  getUnusedCatBonus,
  isRedHeatProgress,
  type GameMode,
  type GameModel,
  type Phase,
} from "@/features/game/domain/model";
import {
  createEmptyLevelProgress,
  loadLevelProgress,
  saveLevelProgress,
  type LevelProgress,
} from "@/features/game/infrastructure/progress-storage";
import { ConfirmDialog } from "@/features/game/components/ConfirmDialog";
import { EnemyAvatar } from "@/features/game/components/EnemyAvatar";
import { EnemyModel } from "@/features/game/components/EnemyModel";
import {
  BackButton,
  CornerDecorations,
  MainMenuHero,
  MatchupPreview,
} from "@/features/game/components/GameBrand";

type Screen =
  | "loading"
  | "main-menu"
  | "level-select"
  | "level-briefing"
  | "about"
  | "changelog"
  | "bestiary"
  | "cat-catalog"
  | "enemy-catalog"
  | "catalog-detail"
  | "game";

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

type PageTransitionMode = "page" | "fade";
type ConfirmationAction = "restart" | "level-select";
const FIXED_VISUAL_LANE_COUNT = 5;
const CAT_DROP_DUST_DURATION = 0.46;

/**
 * 跑道视觉高度固定为场地的五分之一；关卡跑道不足五条时整体垂直居中。
 * 所有角色、弹道和特效共用此坐标，避免视觉位置与命中判定错位。
 */
function getLaneCenterPercent(lane: number, laneCount: number) {
  const centeredOffset = Math.max(0, (FIXED_VISUAL_LANE_COUNT - laneCount) / 2);
  return ((centeredOffset + lane + 0.5) / FIXED_VISUAL_LANE_COUNT) * 100;
}
type EnemySpeedMultiplier = 1 | 2 | 3;
type DragState = { catTypeId: CatTypeId; asset: string; x: number; y: number } | null;
type CatalogDetail =
  | { section: "cat"; typeId: CatTypeId; index: number }
  | { section: "enemy"; typeId: EnemyTypeId; index: number };

const CATALOG_CAT_TYPES = Object.values(CAT_TYPES);
const CATALOG_ENEMY_TYPES = Object.values(ENEMY_TYPES);
const CATALOG_CAT_SLOTS: Array<(typeof CATALOG_CAT_TYPES)[number] | undefined> = [
  ...CATALOG_CAT_TYPES.filter((catType) => catType.id !== "hehe-hua"),
  ...Array.from({ length: 9 }, () => undefined),
  CAT_TYPES["hehe-hua"],
];

function formatCatalogNumber(index: number) {
  return `No.${String(index + 1).padStart(3, "0")}`;
}

/** 集中修改媒体元素，避免各个 React 副作用分别维护播放状态。 */
function playLoopingAudio(audio: HTMLAudioElement, volume: number, restart = false) {
  audio.loop = true;
  if (restart) audio.currentTime = 0;
  audio.volume = volume;
  void audio.play().catch(() => undefined);
}

/** 弹窗音效只播放一次，避免复用循环 BGM 的播放配置。 */
function playOneShotAudio(audio: HTMLAudioElement, volume: number, restart = false) {
  audio.loop = false;
  if (restart) audio.currentTime = 0;
  audio.volume = volume;
  void audio.play().catch(() => undefined);
}

function stopAndResetAudio(audio: HTMLAudioElement | null) {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}

function setAudioVolume(audio: HTMLAudioElement | null, volume: number) {
  if (audio) audio.volume = volume;
}

function EnemyCatalogProperties({ typeId, locale }: { typeId: EnemyTypeId; locale: Locale }) {
  const enemyType = ENEMY_TYPES[typeId] ?? ENEMY_TYPES.luca;
  const copy = UI_COPY[locale];
  const separator = locale === "zh" ? "：" : ": ";

  return (
    <div className="enemy-catalog-properties">
      <small className={`strength-rank is-${enemyType.strength.toLowerCase()}`} aria-label={`${copy.strength} ${enemyType.strength}`}>
        <span>{copy.strength}{separator}</span><i>{enemyType.strength}</i>
      </small>
      <small className="enemy-speed-property">
        <span>{copy.speed}{separator}</span>
        <i>{copy.speedTiers[enemyType.speed]}</i>
      </small>
    </div>
  );
}

function CatCatalogProperties({ typeId, locale }: { typeId: CatTypeId; locale: Locale }) {
  const catType = CAT_TYPES[typeId];
  const copy = UI_COPY[locale];
  const separator = locale === "zh" ? "：" : ": ";

  return (
    <div className="cat-catalog-properties">
      <small className="position-property"><span>{copy.position}{separator}</span><i>{localize(catType.tag, locale)}</i></small>
      <small className={`strength-rank is-${catType.strength.toLowerCase()}`} aria-label={`${copy.strength} ${catType.strength}`}>
        <span>{copy.strength}{separator}</span><i>{catType.strength}</i>
      </small>
    </div>
  );
}

/**
 * 将屏幕指针坐标转换成跑道索引。
 * 竖屏手机中的游戏画布顺时针旋转了 90°，逻辑纵轴因此对应屏幕上从右向左的横轴。
 */
function getLaneFromClientPoint(
  field: HTMLDivElement,
  clientX: number,
  clientY: number,
  laneCount: number,
) {
  const bounds = field.getBoundingClientRect();
  const isInside =
    clientX >= bounds.left &&
    clientX <= bounds.right &&
    clientY >= bounds.top &&
    clientY <= bounds.bottom;
  if (!isInside) return null;

  const isRotatedPortrait = window.matchMedia("(max-width: 767px) and (orientation: portrait)").matches;
  const fieldProgress = isRotatedPortrait
    ? (bounds.right - clientX) / bounds.width
    : (clientY - bounds.top) / bounds.height;
  const centeredOffset = Math.max(0, (FIXED_VISUAL_LANE_COUNT - laneCount) / 2);
  const visualLane = fieldProgress * FIXED_VISUAL_LANE_COUNT - centeredOffset;
  return clamp(Math.floor(visualLane), 0, laneCount - 1);
}

export default function HuaVsLucaGame() {
  const [initialModel] = useState<GameModel>(() => createGameModel());
  const modelRef = useRef<GameModel>(initialModel);
  const frameRef = useRef<number | null>(null);
  const previousFrameRef = useRef<number | null>(null);
  const syncAtRef = useRef(0);
  const soundEnabledRef = useRef(true);
  const soundVolumeRef = useRef(0.7);
  const audioContextRef = useRef<AudioContext | null>(null);
  const instantAudioBuffersRef = useRef(new Map<string, AudioBuffer>());
  /**
   * 资源页通过 CORS fetch 下载音频后转成本地 Blob URL，播放阶段只复用本地副本。
   * 这样不会让同一 R2 URL 在 fetch(CORS) 与 Audio(no-cors) 两种模式之间污染浏览器缓存。
   */
  const loadedAudioUrlsRef = useRef(new Map<string, string>());
  const gameBgmRef = useRef<HTMLAudioElement | null>(null);
  const victoryAudioRef = useRef<HTMLAudioElement | null>(null);
  const defeatBgmRef = useRef<HTMLAudioElement | null>(null);
  const starSoundTimersRef = useRef<number[]>([]);
  const briefingExitTimerRef = useRef<number | null>(null);
  const enemySpeedMultiplierRef = useRef<EnemySpeedMultiplier>(1);
  const laneFieldRef = useRef<HTMLDivElement | null>(null);
  const confirmationWasPlayingRef = useRef(false);
  const confirmationActionRef = useRef<ConfirmationAction | null>(null);
  const localeReadyRef = useRef(false);

  const [snapshot, setSnapshot] = useState<GameModel>(initialModel);
  const [locale, setLocale] = useState<Locale>("zh");
  const [screen, setScreen] = useState<Screen>("loading");
  const [selectedLevelId, setSelectedLevelId] = useState<LevelId>(LEVELS[0].id);
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);
  const [briefingMode, setBriefingMode] = useState<GameMode>("level");
  const [briefingExiting, setBriefingExiting] = useState(false);
  const [selectedLane, setSelectedLane] = useState(2);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(0.7);
  const [shareCompleted, setShareCompleted] = useState(false);
  const [levelProgress, setLevelProgress] = useState<LevelProgress>(createEmptyLevelProgress);
  const [decorations, setDecorations] = useState(INITIAL_DECORATIONS);
  const [assetProgress, setAssetProgress] = useState(0);
  const [assetLoadFailed, setAssetLoadFailed] = useState(false);
  const [assetLoadAttempt, setAssetLoadAttempt] = useState(0);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [dragState, setDragState] = useState<DragState>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  const [catalogDetail, setCatalogDetail] = useState<CatalogDetail | null>(null);
  const [confirmationAction, setConfirmationAction] = useState<ConfirmationAction | null>(null);
  const [enemySpeedMultiplier, setEnemySpeedMultiplier] = useState<EnemySpeedMultiplier>(1);
  const copy = UI_COPY[locale];
  const loadingMessages = LOADING_MESSAGES[locale];
  const labelSeparator = locale === "zh" ? "：" : ": ";
  const selectedChapter = LEVEL_CHAPTERS[selectedChapterIndex];
  const selectedChapterStandardSlots = selectedChapter.slots.filter((slot) => slot.kind !== "hidden");
  const selectedChapterHiddenSlots = selectedChapter.slots.filter((slot) => slot.kind === "hidden");
  const selectedChapterCompleted = selectedChapterStandardSlots.length > 0 && selectedChapterStandardSlots.every((slot) => (
    slot.levelId !== undefined && levelProgress[slot.levelId].completed
  ));
  const selectedChapterPerfect = selectedChapterHiddenSlots.some((slot) => (
    slot.levelId !== undefined && levelProgress[slot.levelId].completed
  ));

  const selectChapter = useCallback((chapterIndex: number) => {
    const nextIndex = clamp(chapterIndex, 0, LEVEL_CHAPTERS.length - 1);
    setSelectedChapterIndex(nextIndex);
  }, []);

  const navigateTo = useCallback((nextScreen: Screen, transitionMode: PageTransitionMode = "page") => {
    const transitionDocument = document as ViewTransitionDocument;
    document.documentElement.dataset.pageTransition = transitionMode;

    if (!transitionDocument.startViewTransition) {
      setScreen(nextScreen);
      delete document.documentElement.dataset.pageTransition;
      return;
    }

    const transition = transitionDocument.startViewTransition(() => {
      flushSync(() => setScreen(nextScreen));
    });
    void transition.finished.finally(() => {
      delete document.documentElement.dataset.pageTransition;
    });
  }, []);

  const sync = useCallback(() => {
    const model = modelRef.current;
    setSnapshot({
      ...model,
      enemies: [...model.enemies],
      balls: [...model.balls],
      effects: [...model.effects],
      deathEffects: [...model.deathEffects],
      // 结算队列创建后保持只读，可安全复用引用，避免普通战斗同步时无意义复制。
      settlementQueue: model.settlementQueue,
      remainingCats: { ...model.remainingCats },
    });
  }, []);

  const setLane = useCallback((lane: number) => {
    const nextLane = clamp(lane, 0, modelRef.current.laneCount - 1);
    setSelectedLane(nextLane);
  }, []);

  /** 创建已经过加载页校验的媒体元素；回退远程地址时也强制使用统一的 CORS 模式。 */
  const createLoadedAudio = useCallback((src: string) => {
    const audio = new Audio();
    const loadedUrl = loadedAudioUrlsRef.current.get(src);
    if (!loadedUrl) audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    audio.src = loadedUrl ?? src;
    return audio;
  }, []);

  /** 播放加载页已解码的短音效，触发时不再创建媒体元素或等待 MP3 解码。 */
  const playInstantAudio = useCallback((src: string, volumeMultiplier: number, startOffsetSeconds = 0) => {
    if (!soundEnabledRef.current || typeof window === "undefined") return;
    const buffer = instantAudioBuffersRef.current.get(src);
    if (!buffer) return;

    const AudioContextClass =
      window.AudioContext
      || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = audioContextRef.current ?? new AudioContextClass();
    audioContextRef.current = context;

    const start = () => {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = clamp(soundVolumeRef.current * volumeMultiplier, 0, 1);
      source.connect(gain).connect(context.destination);
      source.start(0, startOffsetSeconds);
    };

    if (context.state === "suspended") void context.resume().then(start).catch(() => undefined);
    else start();
  }, []);

  /** 通关使用独立语音文件，其余简单反馈继续由 Web Audio API 即时合成。 */
  const playSound = useCallback((kind: "roll" | "hit" | "win" | "lose" | "star") => {
    if (!soundEnabledRef.current || typeof window === "undefined") return;

    if (kind === "win") {
      const audio = victoryAudioRef.current ?? createLoadedAudio(GAME_AUDIO_URLS.victory);
      victoryAudioRef.current = audio;
      audio.currentTime = 0;
      audio.volume = soundVolumeRef.current * 0.5;
      void audio.play().catch(() => undefined);
      return;
    }

    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = audioContextRef.current ?? new AudioContextClass();
    audioContextRef.current = context;
    const start = context.currentTime;
    const notes = {
      roll: [150, 112],
      hit: [240, 120],
      lose: [190, 145, 95],
      star: [520, 660, 820],
    }[kind];

    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const noteStart = start + index * 0.075;
      oscillator.type = kind === "roll" ? "triangle" : "square";
      oscillator.frequency.setValueAtTime(frequency, noteStart);
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.075 * soundVolumeRef.current, noteStart + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.09);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + 0.1);
    });
  }, [createLoadedAudio]);

  /** 音频路径与倍率由敌人类型配置决定；同一时刻多个敌人死亡时允许音效重叠。 */
  const playEnemyDeathSound = useCallback((typeId: EnemyTypeId) => {
    if (!soundEnabledRef.current || typeof window === "undefined") return;
    const enemyType = ENEMY_TYPES[typeId] ?? ENEMY_TYPES.luca;
    const sound = enemyType.soundEffects?.death;
    if (!sound) return;

    playInstantAudio(sound.src, sound.volumeMultiplier);
  }, [playInstantAudio]);

  const clearStarSoundTimers = useCallback(() => {
    starSoundTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    starSoundTimersRef.current = [];
  }, []);

  const stopDefeatBgm = useCallback(() => {
    stopAndResetAudio(defeatBgmRef.current);
  }, []);

  /** 开始按钮预留音效入口；素材为空时无声，后续配置路径即可启用。 */
  const playStartActionSound = useCallback(() => {
    if (!GAME_AUDIO_URLS.gameStart) return;
    playInstantAudio(GAME_AUDIO_URLS.gameStart, 0.35);
  }, [playInstantAudio]);

  const startGame = useCallback((levelId: LevelId = selectedLevelId, mode: GameMode = "level", usePageTransition = true) => {
    clearStarSoundTimers();
    stopDefeatBgm();
    enemySpeedMultiplierRef.current = 1;
    setEnemySpeedMultiplier(1);
    const level = getLevel(levelId);
    const nextModel = createGameModel(level, "playing", mode);
    modelRef.current = nextModel;
    previousFrameRef.current = null;
    syncAtRef.current = 0;
    setDecorations(createDecorations());
    setSelectedLevelId(levelId);
    setDragState(null);
    confirmationActionRef.current = null;
    setConfirmationAction(null);
    setLane(Math.floor((nextModel.laneCount - 1) / 2));
    if (usePageTransition) navigateTo("game", "fade");
    else setScreen("game");
    playSound("roll");
    sync();
  }, [clearStarSoundTimers, navigateTo, playSound, selectedLevelId, setLane, stopDefeatBgm, sync]);

  /** 准备弹窗自行离场，避免通用 View Transition 把整个游戏框一起淡出。 */
  const startGameFromBriefing = useCallback(() => {
    if (briefingExiting) return;
    if (briefingExitTimerRef.current !== null) window.clearTimeout(briefingExitTimerRef.current);
    playStartActionSound();
    setBriefingExiting(true);
    startGame(selectedLevelId, briefingMode, false);
    briefingExitTimerRef.current = window.setTimeout(() => {
      setBriefingExiting(false);
      briefingExitTimerRef.current = null;
    }, 620);
  }, [briefingExiting, briefingMode, playStartActionSound, selectedLevelId, startGame]);

  const cycleEnemySpeed = useCallback(() => {
    const nextMultiplier = (enemySpeedMultiplierRef.current % 3 + 1) as EnemySpeedMultiplier;
    enemySpeedMultiplierRef.current = nextMultiplier;
    setEnemySpeedMultiplier(nextMultiplier);
  }, []);

  const goToMainMenu = useCallback(() => {
    clearStarSoundTimers();
    stopDefeatBgm();
    modelRef.current = createGameModel(getLevel(selectedLevelId), "menu");
    previousFrameRef.current = null;
    navigateTo("main-menu");
    sync();
  }, [clearStarSoundTimers, navigateTo, selectedLevelId, stopDefeatBgm, sync]);

  const goToLevelSelect = useCallback(() => {
    clearStarSoundTimers();
    stopDefeatBgm();
    modelRef.current = createGameModel(getLevel(selectedLevelId), "menu");
    previousFrameRef.current = null;
    navigateTo("level-select");
    sync();
  }, [clearStarSoundTimers, navigateTo, selectedLevelId, stopDefeatBgm, sync]);

  const startFromMainMenu = useCallback(() => {
    playStartActionSound();
    goToLevelSelect();
  }, [goToLevelSelect, playStartActionSound]);

  const openLevelBriefing = useCallback((levelId: LevelId, mode: GameMode = "level") => {
    clearStarSoundTimers();
    stopDefeatBgm();
    enemySpeedMultiplierRef.current = 1;
    setEnemySpeedMultiplier(1);
    const level = getLevel(levelId);
    // 准备阶段直接创建静止的战场模型，使弹窗背后始终是真实关卡界面。
    const nextModel = createGameModel(level, "paused", mode);
    modelRef.current = nextModel;
    previousFrameRef.current = null;
    syncAtRef.current = 0;
    setSelectedLevelId(levelId);
    setBriefingMode(mode);
    setDragState(null);
    confirmationActionRef.current = null;
    setConfirmationAction(null);
    setLane(Math.floor((nextModel.laneCount - 1) / 2));
    navigateTo("level-briefing", "fade");
    sync();
  }, [clearStarSoundTimers, navigateTo, setLane, stopDefeatBgm, sync]);

  const togglePause = useCallback(() => {
    const model = modelRef.current;
    if (model.phase === "playing") model.phase = "paused";
    else if (model.phase === "paused") model.phase = "playing";
    else return;
    previousFrameRef.current = null;
    sync();
  }, [sync]);

  const toggleSound = useCallback(() => {
    const next = !soundEnabledRef.current;
    soundEnabledRef.current = next;
    setSoundEnabled(next);
    const defeatBgm = defeatBgmRef.current;
    const gameBgm = gameBgmRef.current;
    if (gameBgm) {
      if (!next) gameBgm.pause();
      else playLoopingAudio(gameBgm, soundVolumeRef.current * 0.2);
    }
    if (defeatBgm && !next) defeatBgm.pause();
  }, []);

  const changeSoundVolume = useCallback((nextVolume: number) => {
    const normalizedVolume = clamp(nextVolume, 0, 1);
    const wasMuted = !soundEnabledRef.current;
    soundVolumeRef.current = normalizedVolume;
    setSoundVolume(normalizedVolume);
    setAudioVolume(gameBgmRef.current, normalizedVolume * 0.2);
    setAudioVolume(defeatBgmRef.current, normalizedVolume * 0.4);
    if (normalizedVolume > 0 && !soundEnabledRef.current) {
      soundEnabledRef.current = true;
      setSoundEnabled(true);
    }
    if (normalizedVolume > 0 && wasMuted && gameBgmRef.current) {
      playLoopingAudio(gameBgmRef.current, normalizedVolume * 0.2);
    }
  }, []);

  const shareGame = useCallback(async () => {
    const url = "https://flora-ball.anuluca.com";
    try {
      if (navigator.share) await navigator.share({ title: copy.shareTitle, url });
      else await navigator.clipboard.writeText(url);
      setShareCompleted(true);
      window.setTimeout(() => setShareCompleted(false), 1600);
    } catch {
      // 用户取消系统分享面板时无需显示错误。
    }
  }, [copy.shareTitle]);

  const toggleLocale = useCallback(() => {
    setLocale((current) => current === "zh" ? "en" : "zh");
  }, []);

  const requestConfirmation = useCallback((action: ConfirmationAction) => {
    // 一个确认框存在时忽略其他中断操作，避免重来与返回选关弹窗叠加。
    if (confirmationActionRef.current !== null) return;
    confirmationActionRef.current = action;
    setSoundPanelOpen(false);
    const model = modelRef.current;
    confirmationWasPlayingRef.current = model.phase === "playing";
    if (confirmationWasPlayingRef.current) model.phase = "paused";
    setConfirmationAction(action);
    sync();
  }, [sync]);

  const cancelConfirmation = useCallback(() => {
    if (confirmationWasPlayingRef.current && modelRef.current.phase === "paused") {
      modelRef.current.phase = "playing";
      previousFrameRef.current = null;
    }
    confirmationWasPlayingRef.current = false;
    confirmationActionRef.current = null;
    setConfirmationAction(null);
    sync();
  }, [sync]);

  const confirmPendingAction = useCallback(() => {
    const action = confirmationAction;
    confirmationWasPlayingRef.current = false;
    confirmationActionRef.current = null;
    setConfirmationAction(null);
    if (action === "restart") openLevelBriefing(modelRef.current.levelId, modelRef.current.mode ?? "level");
    else if (action === "level-select") goToLevelSelect();
  }, [confirmationAction, goToLevelSelect, openLevelBriefing]);

  const shoot = useCallback(
    (lane: number, catTypeId: CatTypeId, selectedAsset?: string) => {
      const model = modelRef.current;
      const remaining = model.remainingCats[catTypeId] ?? 0;
      if (
        model.phase !== "playing" ||
        model.elapsed < model.nextShotAt ||
        (model.mode !== "endless" && remaining <= 0)
      ) return false;
      const catType = CAT_TYPES[catTypeId];

      setLane(lane);
      model.balls.push({
        id: Date.now() + model.shots,
        catTypeId,
        lane,
        targetLane: lane,
        x: 20.7,
        placedAt: model.elapsed,
        // 拖动开始时已确定的贴图必须一路复用到弹丸，避免预览和落下图案不一致。
        asset: selectedAsset ?? catType.projectileAssets[Math.floor(Math.random() * catType.projectileAssets.length)],
        hitCount: 0,
        hitEnemyIds: [],
      });
      model.shots += 1;
      if (model.mode !== "endless") model.remainingCats[catTypeId] = remaining - 1;
      model.nextShotAt = model.elapsed + GAME.cooldown;
      playInstantAudio(GAME_AUDIO_URLS.catDrop, 0.5);
      sync();
      return true;
    },
    [playInstantAudio, setLane, sync],
  );

  const updatePointerLane = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const lane = getLaneFromClientPoint(
        event.currentTarget,
        event.clientX,
        event.clientY,
        modelRef.current.laneCount,
      );
      if (lane !== null) setLane(lane);
    },
    [setLane],
  );

  const updateDragLane = useCallback((clientX: number, clientY: number) => {
    // 高频 pointermove 直接写入合成层 transform，避免每个事件触发整棵游戏页面 React 重渲染。
    if (dragGhostRef.current) {
      dragGhostRef.current.style.setProperty("--drag-x", `${clientX}px`);
      dragGhostRef.current.style.setProperty("--drag-y", `${clientY}px`);
    }
    const field = laneFieldRef.current;
    if (!field) return;
    const lane = getLaneFromClientPoint(field, clientX, clientY, modelRef.current.laneCount);
    if (lane !== null) setLane(lane);
  }, [setLane]);

  const finishCatDrag = useCallback((clientX: number, clientY: number, catTypeId: CatTypeId, asset: string | null) => {
    const field = laneFieldRef.current;
    const lane = field
      ? getLaneFromClientPoint(field, clientX, clientY, modelRef.current.laneCount)
      : null;
    if (lane !== null) shoot(lane, catTypeId, asset ?? undefined);
    setDragState(null);
  }, [shoot]);

  useEffect(() => {
    if (!dragState) return;

    document.body.classList.add("is-dragging-cat");

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault();
      updateDragLane(event.clientX, event.clientY);
    };
    const handlePointerUp = (event: PointerEvent) => {
      finishCatDrag(event.clientX, event.clientY, dragState.catTypeId, dragState.asset);
    };
    const handlePointerCancel = () => {
      setDragState(null);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      document.body.classList.remove("is-dragging-cat");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [dragState, finishCatDrag, updateDragLane]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      localeReadyRef.current = true;
      if (savedLocale === "zh" || savedLocale === "en") setLocale(savedLocale);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    document.title = copy.documentTitle;
    if (localeReadyRef.current) window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [copy.documentTitle, locale]);

  useEffect(() => {
    const emptyProgress = createEmptyLevelProgress();
    const timer = window.setTimeout(() => {
      try {
        const restored = loadLevelProgress(window.localStorage);
        setLevelProgress(restored);
        saveLevelProgress(window.localStorage, restored);
      } catch {
        setLevelProgress(emptyProgress);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  /**
   * 进入主菜单前加载全部图片、音频及字体。浏览器缓存命中时图片同样执行 decode，
   * 确保首局生成角色时不会出现短暂空白、透明占位或即时音效延迟。
   */
  useEffect(() => {
    let cancelled = false;
    let completed = 0;
    const randomizeMessageTimer = window.setTimeout(() => {
      setLoadingMessageIndex(Math.floor(Math.random() * LOADING_MESSAGES.zh.length));
    }, 0);

    const audioAssetUrls = GAME_ASSET_URLS.filter((src) => !GAME_IMAGE_URLS.includes(src));
    const totalAssets = GAME_ASSET_URLS.length + 1;
    const markAssetComplete = () => {
      if (cancelled) return;
      completed += 1;
      setAssetProgress(completed / totalAssets);
    };

    const loadAsset = (src: string) =>
      new Promise<void>((resolve, reject) => {
        const image = new window.Image();
        image.decoding = "async";
        image.onload = () => {
          const finish = () => {
            markAssetComplete();
            resolve();
          };

          if (typeof image.decode === "function") image.decode().catch(() => undefined).then(finish);
          else finish();
        };
        image.onerror = () => reject(new Error(`Failed to load ${src}`));
        image.src = src;
      });

    const loadFonts = async () => {
      if (document.fonts) {
        await document.fonts.load('1em "cn-custom"');
        await document.fonts.ready;
      }
      markAssetComplete();
    };

    const loadAudio = async (src: string) => {
      const AudioContextClass =
        window.AudioContext
        || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) throw new Error("Web Audio API is unavailable");
      const context = audioContextRef.current ?? new AudioContextClass();
      audioContextRef.current = context;
      // reload 绕过旧版本用 <audio> 产生的 no-cors 浏览器缓存；后续播放走本地 Blob，不再请求 R2。
      const response = await fetch(src, { cache: "reload", mode: "cors" });
      if (!response.ok) throw new Error(`Failed to load ${src}`);
      const bytes = await response.arrayBuffer();
      const previousUrl = loadedAudioUrlsRef.current.get(src);
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      loadedAudioUrlsRef.current.set(
        src,
        URL.createObjectURL(new Blob([bytes], { type: response.headers.get("content-type") ?? "audio/mpeg" })),
      );
      const buffer = await context.decodeAudioData(bytes.slice(0));
      if (GAME_INSTANT_AUDIO_URLS.includes(src)) instantAudioBuffersRef.current.set(src, buffer);
      markAssetComplete();
    };

    Promise.all([
      ...GAME_IMAGE_URLS.map(loadAsset),
      ...audioAssetUrls.map(loadAudio),
      loadFonts(),
    ])
      .then(() => {
        if (!cancelled) navigateTo("main-menu");
      })
      .catch(() => {
        if (!cancelled) setAssetLoadFailed(true);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(randomizeMessageTimer);
    };
  }, [assetLoadAttempt, navigateTo]);

  useEffect(() => () => {
    loadedAudioUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    loadedAudioUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    if (screen !== "loading" || assetLoadFailed) return;

    const timer = window.setInterval(() => {
      setLoadingMessageIndex((current) => {
        const offset = 1 + Math.floor(Math.random() * (LOADING_MESSAGES.zh.length - 1));
        return (current + offset) % LOADING_MESSAGES.zh.length;
      });
    }, 5000);

    return () => window.clearInterval(timer);
  }, [assetLoadFailed, screen]);

  const retryAssetLoad = useCallback(() => {
    setAssetProgress(0);
    setAssetLoadFailed(false);
    setAssetLoadAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    const tick = (timestamp: number) => {
      const model = modelRef.current;
      const previous = previousFrameRef.current ?? timestamp;
      const delta = Math.min((timestamp - previous) / 1000, 0.05);
      previousFrameRef.current = timestamp;

      if (model.phase === "playing") {
        const activeLevel = getLevel(model.levelId);
        model.elapsed += delta;

        let spawnedEnemyCount = 0;
        if (model.mode !== "endless") {
          for (const enemy of model.enemies) {
            if (enemy.spawned) spawnedEnemyCount += 1;
          }
        }
        const redHeatProgress = model.mode === "endless" ? 0 : spawnedEnemyCount / activeLevel.totalEnemies;
        const redHeatActive = model.mode !== "endless" && isRedHeatProgress(activeLevel, redHeatProgress);
        if (redHeatActive !== model.redHeatActive) {
          model.redHeatActive = redHeatActive;
          model.redHeatNotice = redHeatActive ? "entered" : "ended";
          model.redHeatNoticeExpiresAt = model.elapsed + 1.7;
        }
        if (model.redHeatNoticeExpiresAt <= model.elapsed) model.redHeatNotice = null;

        if (model.mode === "endless" && model.elapsed >= model.nextEndlessSpawnAt) {
          const spawnLane = chooseEnemySpawnLane(model.lastEnemySpawnAtByLane, model.elapsed);
          if (spawnLane === null) {
            const nextAvailableAt = Math.min(
              ...model.lastEnemySpawnAtByLane.map(
                (spawnAt) => spawnAt + MIN_SAME_LANE_SPAWN_INTERVAL,
              ),
            );
            model.nextEndlessSpawnAt = Math.max(model.elapsed + 0.01, nextAvailableAt);
          } else {
            model.enemies.push({
              id: model.nextEnemyId,
              typeId: activeLevel.enemyTypeIds[model.nextEnemyId % activeLevel.enemyTypeIds.length],
              lane: spawnLane,
              x: 103,
              spawnAt: model.elapsed,
              spawned: true,
              defeated: false,
              health: ENEMY_TYPES[activeLevel.enemyTypeIds[model.nextEnemyId % activeLevel.enemyTypeIds.length]].maxHealth,
            });
            model.lastEnemySpawnAtByLane[spawnLane] = model.elapsed;
            model.nextEnemyId += 1;
            model.nextEndlessSpawnAt = model.elapsed + 0.72 + Math.random() * 0.28;
          }
        }

        for (const enemy of model.enemies) {
          if (!enemy.spawned && enemy.spawnAt <= model.elapsed) enemy.spawned = true;
          if (enemy.spawned && !enemy.defeated) {
            const enemyType = ENEMY_TYPES[enemy.typeId] ?? ENEMY_TYPES.luca;
            const redHeatMultiplier = model.redHeatActive ? 3 : 1;
            const damagedSpeedMultiplier = enemy.health < enemyType.maxHealth
              ? ("damagedSpeedMultiplier" in enemyType ? enemyType.damagedSpeedMultiplier : 1)
              : 1;
            enemy.x -= BASE_ENEMY_SPEED
              * ENEMY_SPEED_MULTIPLIERS[enemyType.speed]
              * damagedSpeedMultiplier
              * redHeatMultiplier
              * enemySpeedMultiplierRef.current
              * delta;
          }
        }

        const defeatEnemy = (enemy: (typeof model.enemies)[number], ball: (typeof model.balls)[number]) => {
          if (enemy.defeated) return;

          enemy.defeated = true;
          ball.hitCount += 1;
          model.defeated += 1;
          const chainCount = ball.hitCount;
          const multiplier = getChainMultiplier(chainCount);
          const enemyType = ENEMY_TYPES[enemy.typeId] ?? ENEMY_TYPES.luca;
          const killScore = Math.round(enemyType.killScore * multiplier);
          model.combo = chainCount;
          model.bestCombo = Math.max(model.bestCombo, model.combo);
          model.lastHitAt = model.elapsed;
          model.score += killScore;
          model.effects.push({
            id: Date.now() + enemy.id,
            lane: enemy.lane,
            x: enemy.x,
            label: chainCount > 1 ? `×${multiplier.toFixed(1)} +${killScore}` : `+${killScore}`,
            expiresAt: model.elapsed + 0.65,
          });
          model.deathEffects.push({
            id: Date.now() * 10 + enemy.id,
            typeId: enemy.typeId,
            lane: enemy.lane,
            x: enemy.x,
            damaged: enemy.health < enemyType.maxHealth,
            expiresAt: model.elapsed + 0.72,
          });
          playEnemyDeathSound(enemy.typeId);
        };

        const damageEnemy = (enemy: (typeof model.enemies)[number], ball: (typeof model.balls)[number]) => {
          // 本地热更新中的旧弹丸可能还没有该字段，原地补齐以避免开发态中断。
          ball.hitEnemyIds ??= [];
          if (enemy.defeated || ball.hitEnemyIds.includes(enemy.id)) return false;

          const catType = CAT_TYPES[ball.catTypeId];
          const enemyType = ENEMY_TYPES[enemy.typeId] ?? ENEMY_TYPES.luca;
          ball.hitEnemyIds.push(enemy.id);
          const defeated = applyEnemyDamage(enemy, catType.damage, enemyType.maxHealth);
          if (defeated) defeatEnemy(enemy, ball);
          else playSound("hit");
          return defeated;
        };

        for (const ball of model.balls) {
          if (ball.fallingAt !== undefined) continue;
          ball.x += GAME.ballSpeed * delta;
          const laneDelta = ball.targetLane - ball.lane;
          if (Math.abs(laneDelta) > 0.01) {
            ball.lane += Math.sign(laneDelta) * Math.min(Math.abs(laneDelta), GAME.ballLaneSpeed * delta);
          }

          for (const enemy of model.enemies) {
            const isCollision =
              enemy.spawned &&
              !enemy.defeated &&
              !(ball.hitEnemyIds ?? []).includes(enemy.id) &&
              Math.abs(enemy.x - ball.x) < 3.35 &&
              Math.abs(enemy.lane - ball.lane) < 0.42;

            if (!isCollision) continue;

            const catType = CAT_TYPES[ball.catTypeId];
            const defeated = damageEnemy(enemy, ball);
            if (catType.ability === "lane-runner") {
              // 车轮花花固定在当前跑道继续滚动，每个敌人只受到一次接触伤害。
              continue;
            }

            if (defeated) {
              ball.targetLane = chooseRicochetLane(ball, model.enemies, model.laneCount);
            }
            // 普通球形花花命中后退场；多跑道仅在成功击败时执行一次换道连撞。
            if (model.laneCount === 1 || !defeated) ball.fallingAt = model.elapsed;
            break;
          }
        }

        model.balls = model.balls.filter((ball) =>
          ball.fallingAt !== undefined ? model.elapsed - ball.fallingAt < 0.42 : ball.x < 106,
        );
        if (model.mode === "endless") {
          model.enemies = model.enemies.filter((enemy) => !enemy.defeated);
        }
        model.effects = model.effects.filter((effect) => effect.expiresAt > model.elapsed);
        model.deathEffects = model.deathEffects.filter((effect) => effect.expiresAt > model.elapsed);
        if (model.elapsed - model.lastHitAt > 1.45) model.combo = 0;

        if (model.mode !== "endless" && model.defeated >= activeLevel.totalEnemies) {
          model.unusedCatBonus = getUnusedCatBonus(model.remainingCats);
          model.settlementBonusAdded = 0;
          model.settlementCatsCounted = 0;
          model.settlementQueue = createSettlementQueue(model.remainingCats);
          model.settlementStartedAt = timestamp;
          model.redHeatActive = false;
          model.redHeatNotice = null;
          model.phase = "settling";
          // 第一只猫咪的分数会随结算卡首帧出现，音效必须在同一帧触发。
          if (model.settlementQueue.length > 0) {
            playInstantAudio(GAME_AUDIO_URLS.victory, 0.25, 0.257);
          }
        } else if (
          model.enemies.some(
            (enemy) => enemy.spawned && !enemy.defeated && enemy.x <= GAME.homeLine,
          )
        ) {
          model.phase = "defeat";
          playSound("lose");
        }

        if (timestamp - syncAtRef.current > 15 || model.phase !== "playing") {
          syncAtRef.current = timestamp;
          sync();
        }
      }

      if (model.phase === "settling") {
        const elapsed = timestamp - model.settlementStartedAt;
        const settlementState = getSettlementState(elapsed, model.settlementQueue.length);
        if (settlementState.catsCounted !== model.settlementCatsCounted) {
          for (let index = model.settlementCatsCounted; index < settlementState.catsCounted; index += 1) {
            const catTypeId = model.settlementQueue[index];
            const bonus = CAT_TYPES[catTypeId].unusedBonusScore;
            model.score += bonus;
            model.settlementBonusAdded += bonus;
          }
          model.settlementCatsCounted = settlementState.catsCounted;
          // catsCounted 同时是下一张分数卡的索引；最后一只结算完成后不再出现新卡。
          if (model.settlementCatsCounted < model.settlementQueue.length) {
            playInstantAudio(GAME_AUDIO_URLS.victory, 0.25, 0.257);
          }
          sync();
        }

        if (settlementState.complete) {
          model.phase = "victory";
          setLevelProgress((current) => {
            const next = {
              ...current,
              [model.levelId]: {
                bestScore: Math.max(current[model.levelId].bestScore, model.score),
                completed: true,
              },
            };
            saveLevelProgress(window.localStorage, next);
            return next;
          });
          playSound("win");
          const earnedRating = getLevelRating(getLevel(model.levelId), model.score, true);
          // 弹窗出现后逐颗点亮已获得的星星；未获得的星星不播放误导性音效。
          Array.from({ length: earnedRating }, (_, index) => {
            const timer = window.setTimeout(() => playSound("star"), 360 + index * 300);
            starSoundTimersRef.current.push(timer);
          });
          sync();
        }
      }

      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [playEnemyDeathSound, playInstantAudio, playSound, sync]);

  useEffect(() => clearStarSoundTimers, [clearStarSoundTimers]);

  /**
   * 常驻 BGM 在所有界面连续播放，胜负弹窗音效只作为叠加的一次性反馈。
   * 首次自动播放若被浏览器拦截，会在用户第一次指针或键盘操作后启动。
   */
  useEffect(() => {
    if (screen === "loading") return;

    const audio = gameBgmRef.current ?? createLoadedAudio(GAME_AUDIO_URLS.gameBgm);
    gameBgmRef.current = audio;
    if (!soundEnabledRef.current) {
      audio.pause();
      return;
    }

    const startBgm = () => playLoopingAudio(audio, soundVolumeRef.current * 0.2);
    startBgm();
    window.addEventListener("pointerdown", startBgm, { once: true });
    window.addEventListener("keydown", startBgm, { once: true });

    return () => {
      window.removeEventListener("pointerdown", startBgm);
      window.removeEventListener("keydown", startBgm);
    };
  }, [createLoadedAudio, screen]);

  useEffect(() => {
    if (snapshot.phase !== "defeat") {
      stopDefeatBgm();
      return;
    }
    if (!soundEnabledRef.current) return;

    const audio = defeatBgmRef.current ?? createLoadedAudio(GAME_AUDIO_URLS.defeatBgm);
    defeatBgmRef.current = audio;
    playOneShotAudio(audio, soundVolumeRef.current * 0.4, true);
    // 独立 AudioBufferSource 与原失败音效同时播放，且天然只播放一次、不互相截断。
    playInstantAudio(GAME_AUDIO_URLS.defeatStinger, 0.125);

    return () => stopDefeatBgm();
  }, [createLoadedAudio, playInstantAudio, snapshot.phase, stopDefeatBgm]);

  useEffect(() => () => {
    if (briefingExitTimerRef.current !== null) window.clearTimeout(briefingExitTimerRef.current);
  }, []);

  useEffect(() => {
    const updateMobileShellScale = () => {
      const isPortraitPhone = window.matchMedia("(max-width: 767px) and (orientation: portrait)").matches;
      const isLandscapePhone = window.matchMedia("(max-width: 1000px) and (max-height: 620px) and (orientation: landscape)").matches;
      if (!isPortraitPhone && !isLandscapePhone) {
        document.documentElement.style.removeProperty("--mobile-shell-scale");
        return;
      }

      // 固定设计画布后只做等比缩放，避免窄屏媒体查询把内部模块重新排成单列。
      // 竖屏会旋转 90°，因此它的可用横纵空间需要交换；横屏则直接按当前视口计算。
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const availableWidth = isPortraitPhone ? viewportHeight : viewportWidth;
      const availableHeight = isPortraitPhone ? viewportWidth : viewportHeight;
      const scale = Math.min((availableWidth - 8) / 1200, (availableHeight - 8) / 760);
      document.documentElement.style.setProperty("--mobile-shell-scale", String(Math.max(0.2, scale)));
    };

    updateMobileShellScale();
    window.addEventListener("resize", updateMobileShellScale);
    window.addEventListener("orientationchange", updateMobileShellScale);
    window.visualViewport?.addEventListener("resize", updateMobileShellScale);

    return () => {
      window.removeEventListener("resize", updateMobileShellScale);
      window.removeEventListener("orientationchange", updateMobileShellScale);
      window.visualViewport?.removeEventListener("resize", updateMobileShellScale);
      document.documentElement.style.removeProperty("--mobile-shell-scale");
    };
  }, []);

  const activeLevel = getLevel(snapshot.levelId);
  const liveEnemies = snapshot.enemies.filter((enemy) => enemy.spawned && !enemy.defeated);
  // 顶部进度表示敌人出场进程，与击杀结果无关；红温区间也复用同一生成进度。
  const spawnedProgress = snapshot.mode === "endless"
    ? 0
    : snapshot.enemies.reduce((count, enemy) => count + Number(enemy.spawned), 0) / activeLevel.totalEnemies;
  const progress = spawnedProgress * 100;
  const displayedProgress = snapshot.mode === "endless" ? 0 : progress;
  const currentBestScore = levelProgress[snapshot.levelId].bestScore;
  const selectedLevel = getLevel(selectedLevelId);
  const firstEnemyType = CATALOG_ENEMY_TYPES[0];
  const currentRating = getLevelRating(activeLevel, snapshot.score, snapshot.phase === "victory");
  const laneCount = snapshot.laneCount;
  const settlementCats = snapshot.settlementQueue;
  const settlementCurrentCatId = settlementCats[Math.min(snapshot.settlementCatsCounted, Math.max(0, settlementCats.length - 1))];

  return (
    <main className="page-shell" lang={locale === "zh" ? "zh-CN" : "en"} data-locale={locale}>
      <div className="wall-doodle wall-doodle-one" aria-hidden="true">✦</div>
      <div className="wall-doodle wall-doodle-two" aria-hidden="true">=^･ω･^=</div>
      {screen !== "loading" && (
        <div className={`persistent-corner-frame${screen === "game" || screen === "level-briefing" ? " is-game-screen" : ""}`}>
          <CornerDecorations />
        </div>
      )}
      {screen !== "loading" && (
        <div className={`persistent-game-brand${screen === "main-menu" || screen === "about" ? " is-hidden" : " is-visible"}`} aria-hidden="true">
          <MainMenuHero locale={locale} size="small" />
        </div>
      )}
      {screen !== "loading" && (
        <div className={`menu-corner-tabs${screen === "main-menu" ? " is-visible" : " is-hidden"}`}>
          <button className="info-button" type="button" onClick={() => navigateTo("about")} aria-label={copy.aboutGame}>
            <FaInfoCircle aria-hidden="true" size={24} />
          </button>
          <button className="info-button changelog-button" type="button" onClick={() => navigateTo("changelog")} aria-label={copy.changelog}>
            <FaHistory aria-hidden="true" size={23} />
          </button>
        </div>
      )}

      {screen === "loading" && (
        <section className="game-cabinet loading-page" aria-live="polite" aria-busy={!assetLoadFailed}>
          <div className="loading-paper">
            <span className="pin pin-left" />
            <span className="pin pin-right" />
            {assetLoadFailed && <p>{copy.loadingFailed}</p>}
            <h1>{assetLoadFailed ? copy.imagesMissing : copy.wait}</h1>
            <div className="asset-progress" aria-label={`${copy.loadingProgress} ${Math.round(assetProgress * 100)}%`}>
              <span style={{ width: `${assetProgress * 100}%` }} />
            </div>
            <strong>{Math.round(assetProgress * 100)}%</strong>
            <small>{assetLoadFailed ? copy.checkNetwork : loadingMessages[loadingMessageIndex]}</small>
            {assetLoadFailed && (
              <button className="primary-button is-khaki" type="button" onClick={retryAssetLoad}>
                {copy.reload}
              </button>
            )}
          </div>
        </section>
      )}

      {screen === "main-menu" && (
        <section className="game-cabinet front-page" aria-label={copy.mainMenuLabel}>
          <div className="front-page-noise" aria-hidden="true" />

          <div className="front-page-layout">
            <MainMenuHero locale={locale} size="large" />

            <div className="paper-card main-menu-card">
              <nav className="main-menu-actions" aria-label={copy.mainMenuActions}>
                <button className="primary-button" type="button" onClick={startFromMainMenu}>
                  <FaPlay aria-hidden="true" size={22} /> {copy.startGame}
                </button>
                <div className="menu-secondary-row">
                  <button className="menu-secondary-button endless-button" type="button" onClick={() => openLevelBriefing(LEVELS[0].id, "endless")}>
                    <FaCat aria-hidden="true" size={25} /> {copy.endlessMode}
                  </button>
                  <button className="menu-secondary-button" type="button" onClick={() => navigateTo("bestiary")}>
                    <FaBookOpen aria-hidden="true" size={23} /> {copy.bestiary}
                  </button>
                </div>
              </nav>
            </div>
          </div>

          <div className="front-page-meta">
            <strong>© 2026 Anuluca</strong>
          </div>
        </section>
      )}

      {screen === "level-select" && (
        <section className="game-cabinet level-select-page" aria-label={copy.chooseLevel}>
          <header className="screen-topbar level-topbar">
            <BackButton locale={locale} onClick={goToMainMenu} />
            <strong>{copy.chooseLevel}</strong>
            <span aria-hidden="true" />
          </header>

          <div className="level-board">
            <div className="chapter-navigation">
              <button
                className="chapter-switch is-previous"
                type="button"
                disabled={selectedChapterIndex === 0}
                onClick={() => selectChapter(selectedChapterIndex - 1)}
                aria-label={locale === "zh" ? "上一章" : "Previous chapter"}
              >
                <span aria-hidden="true">◀</span>
              </button>
              <div className="chapter-viewport">
                <div
                  className="chapter-track"
                  style={{
                    "--chapter-count": LEVEL_CHAPTERS.length,
                    "--chapter-offset": `${selectedChapterIndex * (-100 / LEVEL_CHAPTERS.length)}%`,
                  } as CSSProperties}
                >
                  {LEVEL_CHAPTERS.map((chapter) => {
                    // 隐藏关不参与章节完成判定；所有普通槽位都必须已配置且已通关。
                    const standardSlots = chapter.slots.filter((slot) => slot.kind !== "hidden");
                    const hiddenSlots = chapter.slots.filter((slot) => slot.kind === "hidden");
                    const hiddenLevelUnlocked = standardSlots.length > 0 && standardSlots.every((slot) => (
                      slot.levelId !== undefined && levelProgress[slot.levelId].completed
                    ));
                    return (
                    <div className="chapter-slide" key={chapter.id}>
                      <div className="level-board-title">
                        <span className="tape tape-one" />
                        <span className="tape tape-two" />
                        <p>{localize(chapter.label, locale)}</p>
                        <h1>{localize(chapter.title, locale)}</h1>
                        <div className="chapter-completion-dots" aria-label={`${copy.completed} ${chapter.slots.filter((slot) => slot.levelId && levelProgress[slot.levelId].completed).length} / ${chapter.slots.length}`}>
                          <div className="chapter-standard-dots">
                            {standardSlots.map((slot) => {
                              const completed = Boolean(slot.levelId && levelProgress[slot.levelId].completed);
                              return <i className={completed ? "is-completed" : ""} key={slot.id} aria-label={`${slot.id} ${completed ? copy.completed : copy.notStarted}`}>{completed && <span aria-hidden="true">✓</span>}</i>;
                            })}
                          </div>
                          <span className="chapter-hidden-separator" aria-hidden="true" />
                          <div className="chapter-hidden-dots">
                            {hiddenSlots.map((slot) => {
                              const completed = Boolean(slot.levelId && levelProgress[slot.levelId].completed);
                              return <i className={completed ? "is-completed" : ""} key={slot.id} aria-label={`${slot.id} ${completed ? copy.completed : copy.notStarted}`}>{completed && <span aria-hidden="true">✓</span>}</i>;
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="level-grid">
                        {chapter.slots.map((slot) => {
                          const level = slot.levelId ? getLevel(slot.levelId) : null;
                          const isHiddenLevel = slot.kind === "hidden";
                          const isLevelAvailable = level !== null && (!isHiddenLevel || hiddenLevelUnlocked);
                          const progressEntry = isLevelAvailable ? levelProgress[level.id] : null;
                          const rating = isLevelAvailable && progressEntry
                            ? getLevelRating(level, progressEntry.bestScore, progressEntry.completed)
                            : 0;

                          return (
                            <button
                              className={`level-card ${isLevelAvailable ? "is-open" : "is-locked"}${isHiddenLevel ? " is-hidden-level" : ""}${isHiddenLevel && hiddenLevelUnlocked ? " is-hidden-unlocked" : ""}${progressEntry?.completed ? " is-completed" : ""}${rating === 3 ? " is-three-star" : ""}`}
                              type="button"
                              key={slot.id}
                              onClick={isLevelAvailable ? () => openLevelBriefing(level.id) : undefined}
                              disabled={!isLevelAvailable}
                            >
                              <span className="level-number">{isHiddenLevel && !hiddenLevelUnlocked ? "???" : slot.id}</span>
                              {isLevelAvailable ? (
                                <>
                                  <MatchupPreview level={level} locale={locale} />
                                  <strong>{localize(level.name, locale)}</strong>
                                  <small>{copy.maxScore} {String(progressEntry?.bestScore ?? 0).padStart(5, "0")}</small>
                                  <div className="level-difficulty" aria-label={`${copy.difficulty} ${level.difficulty}`}>
                                    <span>{copy.difficulty}</span>
                                    <div aria-hidden="true">
                                      {Array.from({ length: 5 }, (_, index) => (
                                        <Image
                                          className={index < level.difficulty ? "is-active" : ""}
                                          key={index}
                                          src="https://assets.anuluca.com/otherWebsites/flora-vs-luca/enemies/luca/head.webp"
                                          alt=""
                                          width={288}
                                          height={237}
                                          unoptimized
                                        />
                                      ))}
                                    </div>
                                  </div>
                                  <span className="level-rating-stickers" aria-label={`${rating} ${copy.rating}`}>
                                    {Array.from({ length: 3 }, (_, index) => (
                                      <i className={index < rating ? "is-active" : ""} key={index}><span aria-hidden="true">★</span></i>
                                    ))}
                                  </span>
                                  {progressEntry?.completed
                                    ? <i className="completion-label">{copy.completed}</i>
                                    : <i className="incomplete-label">{copy.notStarted}</i>}
                                </>
                              ) : (
                                <strong className="locked-sleep">
                                  {isHiddenLevel ? copy.hiddenLevelLocked : copy.lucaSleeping}
                                </strong>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
              {selectedChapterCompleted && (
                <div
                  className="chapter-completion-overlay"
                  key={`${selectedChapter.id}-${selectedChapterPerfect ? "perfect" : "complete"}`}
                  aria-hidden="true"
                >
                  <div className={`chapter-completion-stamp${selectedChapterPerfect ? " is-perfect" : ""}`}>
                    {selectedChapterPerfect ? "PERFECT!" : "COMPLETE!"}
                  </div>
                </div>
              )}
              <button
                className="chapter-switch is-next"
                type="button"
                disabled={selectedChapterIndex === LEVEL_CHAPTERS.length - 1}
                onClick={() => selectChapter(selectedChapterIndex + 1)}
                aria-label={locale === "zh" ? "下一章" : "Next chapter"}
              >
                <span aria-hidden="true">▶</span>
              </button>
            </div>
          </div>
          <nav className="chapter-quick-select" aria-label={copy.chapterQuickSelect}>
            {LEVEL_CHAPTERS.map((chapter, index) => {
              const standardSlots = chapter.slots.filter((slot) => slot.kind !== "hidden");
              const hiddenSlots = chapter.slots.filter((slot) => slot.kind === "hidden");
              const standardCompleted = standardSlots.length > 0 && standardSlots.every((slot) => (
                slot.levelId !== undefined && levelProgress[slot.levelId].completed
              ));
              const hiddenCompleted = hiddenSlots.some((slot) => (
                slot.levelId !== undefined && levelProgress[slot.levelId].completed
              ));

              return (
                <button
                  className={`${index === selectedChapterIndex ? "is-active" : ""}${standardCompleted ? " is-standard-completed" : ""}${hiddenCompleted ? " is-hidden-completed" : ""}`}
                  type="button"
                  key={chapter.id}
                  onClick={() => selectChapter(index)}
                  aria-current={index === selectedChapterIndex ? "page" : undefined}
                >
                  {copy.chapterLabel} {index + 1}
                </button>
              );
            })}
          </nav>
        </section>
      )}

      {screen === "about" && (
        <section className="game-cabinet secondary-page about-page" aria-label={copy.aboutGame}>
          <header className="screen-topbar secondary-topbar">
            <BackButton locale={locale} onClick={goToMainMenu} />
            <strong>{copy.aboutGame}</strong>
          </header>
          <div className="secondary-content">
            <div className="info-sheet">
              <MainMenuHero locale={locale} size="small" />
              <div className="about-grid">
                <article className="about-full-row"><span>{copy.gameSetting}</span><p>{copy.gameSettingCopy}</p></article>
                <article className="about-full-row"><span>{copy.gameplay}</span><p>{copy.gameplayCopy}</p></article>
                <article className="producer-card">
                  <span>{copy.producer}</span>
                  <div className="producer-profile"><Image src="https://assets.anuluca.com/otherWebsites/flora-vs-luca/anutrium-logo.webp" alt="Anuluca" width={320} height={320} unoptimized /><p>Anuluca</p></div>
                </article>
                <article className="related-links-card">
                  <span>{copy.relatedLinks}</span>
                  <div className="related-actions external-links">
                    <a href="https://github.com/Anuluca/flora_vs_luca_web" target="_blank" rel="noreferrer"><FaGithub aria-hidden="true" size={29} />GitHub</a>
                    <a href="https://anuluca.com" target="_blank" rel="noreferrer"><Image src="https://assets.anuluca.com/otherWebsites/flora-vs-luca/anutrium-logo.webp" alt="" width={320} height={320} unoptimized />Anutrium</a>
                  </div>
                  <p className="support-copy">{copy.supportCopy}</p>
                </article>
              </div>
            </div>
          </div>
        </section>
      )}

      {screen === "changelog" && (
        <section className="game-cabinet secondary-page changelog-page" aria-label={copy.changelog}>
          <header className="screen-topbar secondary-topbar">
            <BackButton locale={locale} onClick={goToMainMenu} />
            <strong>{copy.changelog}</strong>
          </header>
          <div className="secondary-content changelog-content">
            <div className="changelog-sheet">
              <h1>{copy.changelog}</h1>
              <article className="changelog-entry">
                <header>
                  <strong>v0.1_demo</strong>
                  <time dateTime="2026-08-13">2026/08/13</time>
                </header>
                <p>{copy.changelogCopy}</p>
              </article>
            </div>
          </div>
        </section>
      )}

      {screen === "bestiary" && (
        <section className="game-cabinet secondary-page bestiary-page" aria-label={copy.bestiary}>
          <header className="screen-topbar secondary-topbar">
            <BackButton locale={locale} onClick={goToMainMenu} />
            <strong>{copy.bestiary}</strong>
          </header>
          <div className="secondary-content bestiary-modules">
            <button className="bestiary-module cat-module" type="button" onClick={() => navigateTo("cat-catalog")}>
            <Image className="bestiary-single-cat" src="https://assets.anuluca.com/otherWebsites/flora-vs-luca/cats/ball-hua/projectile-01.webp" alt="" width={900} height={900} unoptimized />
              <strong>{copy.cats}</strong><small>{copy.species}{labelSeparator}{CATALOG_CAT_TYPES.length}/12</small>
            </button>
            <button className="bestiary-module enemy-module" type="button" onClick={() => navigateTo("enemy-catalog")}>
              <EnemyAvatar typeId={firstEnemyType.id} />
              <strong>{copy.enemies}</strong><small>{copy.species}{labelSeparator}{CATALOG_ENEMY_TYPES.length}/12</small>
            </button>
          </div>
        </section>
      )}

      {(screen === "cat-catalog" || screen === "enemy-catalog") && (
        <section className="game-cabinet secondary-page catalog-page" aria-label={screen === "cat-catalog" ? copy.catBestiary : copy.enemyBestiary}>
          <header className="screen-topbar secondary-topbar">
            <BackButton locale={locale} onClick={() => navigateTo("bestiary")}>{copy.backBestiary}</BackButton>
            <strong>{screen === "cat-catalog" ? copy.catList : copy.enemyList}</strong>
          </header>
          <div className="secondary-content catalog-list">
            <div className="catalog-grid">
              {Array.from({ length: 12 }, (_, index) => {
                const isCat = screen === "cat-catalog";
                const catalogType = isCat ? CATALOG_CAT_SLOTS[index] : CATALOG_ENEMY_TYPES[index];
                const isDiscovered = catalogType !== undefined;
                return (
                  <button
                    className={`catalog-entry${isCat ? " is-cat" : " is-enemy"}${isDiscovered ? "" : " is-placeholder"}`}
                    type="button"
                    key={index}
                    disabled={!isDiscovered}
                    onClick={() => {
                      if (!catalogType) return;
                      setCatalogDetail(isCat
                        ? { section: "cat", typeId: catalogType.id as CatTypeId, index }
                        : { section: "enemy", typeId: catalogType.id as EnemyTypeId, index });
                      navigateTo("catalog-detail", "fade");
                    }}
                  >
                    <div className="catalog-entry-image has-single-art" aria-hidden="true">
                      {isDiscovered ? (
                        isCat
                          ? <Image src={catalogType.previewAssets[0]} alt="" width={900} height={900} unoptimized />
                          : <EnemyAvatar typeId={catalogType.id as EnemyTypeId} />
                      ) : <strong>?</strong>}
                    </div>
                    <div>
                      <span>{formatCatalogNumber(index)}</span>
                      <h1>{catalogType ? localize(catalogType.name, locale) : copy.undiscovered}</h1>
                      {catalogType && <p className="catalog-lore">“{localize(catalogType.description, locale)}”</p>}
                      {catalogType && (isCat
                        ? <CatCatalogProperties typeId={catalogType.id as CatTypeId} locale={locale} />
                        : <EnemyCatalogProperties typeId={catalogType.id as EnemyTypeId} locale={locale} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {screen === "catalog-detail" && catalogDetail && (() => {
        const isCat = catalogDetail.section === "cat";
        const detailType = isCat ? CAT_TYPES[catalogDetail.typeId] : ENEMY_TYPES[catalogDetail.typeId];
        return (
          <section className="game-cabinet secondary-page catalog-detail-page" aria-label={localize(detailType.name, locale)}>
            <header className="screen-topbar secondary-topbar">
              <BackButton locale={locale} onClick={() => navigateTo(isCat ? "cat-catalog" : "enemy-catalog", "fade")} />
              <strong>{isCat ? copy.catList : copy.enemyList}</strong>
            </header>
            <div className="secondary-content catalog-detail-content">
              <div className="catalog-detail-stage">
                <div className={`catalog-detail-image${isCat ? ` has-multiple-art art-count-${detailType.imageAssets.length}` : ""}`} aria-hidden="true">
                  {isCat
                    ? detailType.imageAssets.map((src) => <Image key={src} src={src} alt="" width={900} height={900} unoptimized />)
                    : <div className="catalog-detail-enemy-model"><EnemyModel typeId={catalogDetail.typeId as EnemyTypeId} /></div>}
                </div>
                <article className="catalog-detail-sheet">
                  <div className="catalog-detail-copy">
                    <span>{formatCatalogNumber(catalogDetail.index)}</span>
                    <h1>{localize(detailType.name, locale)}</h1>
                    <p className="catalog-lore">“{localize(detailType.description, locale)}”</p>
                    <p className="catalog-trait"><strong>{copy.trait}{labelSeparator}</strong>{localize(detailType.traitDescription, locale)}</p>
                    {isCat
                      ? <CatCatalogProperties typeId={catalogDetail.typeId as CatTypeId} locale={locale} />
                      : <EnemyCatalogProperties typeId={catalogDetail.typeId as EnemyTypeId} locale={locale} />}
                  </div>
                </article>
              </div>
            </div>
          </section>
        );
      })()}

      {(screen === "game" || screen === "level-briefing") && (
      <section className={`game-cabinet game-page${screen === "level-briefing" ? " is-briefing" : ""}${briefingExiting ? " is-briefing-exiting" : ""}`} aria-label={screen === "level-briefing" ? copy.readyToDefend : copy.gameLabel}>
        <header className="game-hud">
          <div className="level-progress" aria-label={snapshot.mode === "endless" ? copy.endlessMode : `${copy.levelProgress} ${Math.round(progress)}%`}>
            <div className="level-copy">
              <span>{snapshot.mode === "endless" ? copy.endlessMode : `${copy.level} ${activeLevel.id}`}</span>
            </div>
            <div className="progress-track-wrap">
              <div className="progress-endpoints" aria-hidden="true">
                <Image
                  className="progress-endpoint-hua"
                  src="https://assets.anuluca.com/otherWebsites/flora-vs-luca/cats/ball-hua/projectile-01.webp"
                  alt=""
                  width={900}
                  height={900}
                  unoptimized
                />
                <EnemyAvatar className="progress-endpoint-enemy" typeId="luca" />
              </div>
              <div className="progress-track">
                <span className="progress-fill" style={{ width: `${displayedProgress}%` }} />
                {snapshot.mode !== "endless" && activeLevel.redHeatRanges?.map((range, index) => {
                  const start = clamp(range.start, 0, 1);
                  const end = clamp(range.end, start, 1);

                  return end > start ? (
                    <span
                      className="progress-red-heat-range"
                      key={`${start}-${end}-${index}`}
                      style={{ left: `${start * 100}%`, width: `${(end - start) * 100}%` }}
                      aria-hidden="true"
                    />
                  ) : null;
                })}
                <i className="progress-cat" style={{ left: `${clamp(displayedProgress, 3, 96)}%` }}>▲</i>
              </div>
              <strong className="progress-percentage">{snapshot.mode === "endless" ? "∞" : `${Math.round(progress)}%`}</strong>
            </div>
          </div>

          <div className="hud-score-actions">
            <div className="score-block">
              <span>{copy.score}</span>
              <strong>{String(snapshot.score).padStart(5, "0")}</strong>
              <small>{copy.best} {String(currentBestScore).padStart(5, "0")}</small>
            </div>
            <div className="hud-actions">
              <button
                className="icon-button hud-level-exit-button"
                type="button"
                onClick={() => requestConfirmation("level-select")}
                disabled={screen === "level-briefing" || confirmationAction !== null || !(["playing", "paused"] as Phase[]).includes(snapshot.phase)}
                aria-label={copy.backLevelSelect}
                title={copy.backLevelSelect}
              >
                <FaSignOutAlt aria-hidden="true" size={18} />
              </button>
              <button
                className="icon-button"
                type="button"
                onClick={() => requestConfirmation("restart")}
                disabled={screen === "level-briefing" || confirmationAction !== null || !(["playing", "paused"] as Phase[]).includes(snapshot.phase)}
                aria-label={copy.restart}
                title={copy.restart}
              >
                <FaRedoAlt aria-hidden="true" size={19} />
              </button>
              <button
                className="icon-button"
                type="button"
                onClick={togglePause}
                disabled={screen === "level-briefing" || confirmationAction !== null || !(["playing", "paused"] as Phase[]).includes(snapshot.phase)}
                aria-label={snapshot.phase === "paused" ? copy.resume : copy.pause}
                title={copy.pause}
              >
                {snapshot.phase === "paused" ? <FaPlay aria-hidden="true" size={18} /> : <FaPause aria-hidden="true" size={18} />}
              </button>
            </div>
          </div>
        </header>

        <div
          className={`battlefield phase-${snapshot.phase}${snapshot.redHeatActive ? " is-red-heat" : ""}`}
          style={{
            "--selected-lane": selectedLane,
            "--selected-lane-top": `${getLaneCenterPercent(selectedLane, laneCount)}%`,
          } as CSSProperties}
        >
          <div className="paper-noise" aria-hidden="true" />
          <div className="danger-note" aria-hidden="true">
            <span className="tape tape-one" />
            <span className="tape tape-two" />
            <p>{copy.dangerCopy}</p>
          </div>

          {(screen === "level-briefing" || briefingExiting) && (
            <div className={`game-overlay briefing-overlay${briefingExiting ? " is-exiting" : ""}`}>
              <div className="briefing-sheet" role="dialog" aria-modal="true" aria-labelledby="briefing-title">
                <button
                  className="briefing-close-button"
                  type="button"
                  onClick={briefingMode === "endless" ? goToMainMenu : goToLevelSelect}
                  aria-label={briefingMode === "endless" ? copy.backMainMenu : copy.backLevelSelect}
                  title={briefingMode === "endless" ? copy.backMainMenu : copy.backLevelSelect}
                >
                  <FaSignOutAlt aria-hidden="true" size={18} />
                </button>
                <span className="briefing-level-label">{briefingMode === "endless" ? copy.endlessMode : `${copy.level} ${selectedLevel.id}`}</span>
                <h1 id="briefing-title">{copy.readyToDefend}</h1>
                <p>{briefingMode === "endless" ? copy.currentLineup : copy.levelLineup}</p>
                <div className="briefing-types">
                  <section className="briefing-type-category is-cats">
                    <h2>{copy.cats}</h2>
                    <div className="briefing-individual-grid">
                      {selectedLevel.catTypeIds.map((catTypeId) => {
                        const catType = CAT_TYPES[catTypeId];
                        return (
                          <article className="briefing-type-card" key={catType.id}>
                            <div className="briefing-type-images">
                              <Image src={catType.previewAssets[0]} alt="" width={900} height={900} unoptimized />
                            </div>
                            <strong>{localize(catType.name, locale)}</strong>
                            <small className="briefing-score-note">
                              {briefingMode === "endless" ? "∞" : `×${selectedLevel.catInventory[catTypeId] ?? 0}`}
                            </small>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                  <section className="briefing-type-category is-enemies">
                    <h2>{copy.enemies}</h2>
                    <div className="briefing-individual-grid">
                      {selectedLevel.enemyTypeIds.map((enemyTypeId) => {
                        const enemyType = ENEMY_TYPES[enemyTypeId];
                        return (
                          <article className="briefing-type-card" key={enemyType.id}>
                            <div className="briefing-type-images">
                              <EnemyAvatar typeId={enemyTypeId} />
                            </div>
                            <strong>{localize(enemyType.name, locale)}</strong>
                            <small className="briefing-score-note is-placeholder" aria-hidden="true">×0</small>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                </div>
                <button className="primary-button briefing-start" type="button" onClick={startGameFromBriefing} disabled={briefingExiting}>
                  {copy.start}
                </button>
              </div>
            </div>
          )}

          <div className="home-zone" aria-hidden="true">
            <Image
              className="scratcher-house"
              src="https://assets.anuluca.com/otherWebsites/flora-vs-luca/scratcher-house.webp"
              alt=""
              width={675}
              height={900}
              priority
              unoptimized
            />
            <span className="home-label">{copy.floraHome}</span>
            <div className="treats-on-house">
              {decorations.map((decoration) => (
                <Image
                  key={decoration.id}
                  src="https://assets.anuluca.com/otherWebsites/flora-vs-luca/treat.webp"
                  alt=""
                  width={322}
                  height={700}
                  unoptimized
                  style={
                    {
                      left: `${decoration.x}%`,
                      top: `${decoration.y}%`,
                      "--treat-rotation": `${decoration.rotation}deg`,
                      "--treat-scale": decoration.scale,
                    } as CSSProperties
                  }
                />
              ))}
              <Image
                className="extra-treat"
                src="https://assets.anuluca.com/otherWebsites/flora-vs-luca/treat.webp"
                alt=""
                width={322}
                height={700}
                unoptimized
                style={{
                  left: "49%",
                  top: "68%",
                  "--treat-rotation": "4deg",
                  "--treat-scale": 1,
                } as CSSProperties}
              />
            </div>
          </div>

          <div className={`cat-inventory${dragState ? " is-dragging" : ""}`}>
            <span className="cat-inventory-title">{copy.catsTitle}</span>
            {activeLevel.catTypeIds.map((catTypeId) => {
              const catType = CAT_TYPES[catTypeId];
              const remaining = snapshot.remainingCats[catTypeId] ?? 0;
              const isUnavailable = snapshot.mode !== "endless" && remaining <= 0;

              return (
                <button
                  className={`cat-inventory-card${dragState?.catTypeId === catTypeId ? " is-active" : ""}`}
                  type="button"
                  key={catTypeId}
                  disabled={snapshot.phase !== "playing" || isUnavailable}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    const randomAsset = catType.projectileAssets[Math.floor(Math.random() * catType.projectileAssets.length)];
                    setDragState({ catTypeId, asset: randomAsset, x: event.clientX, y: event.clientY });
                  }}
                  aria-label={`${localize(catType.name, locale)}, ${copy.remaining} ${snapshot.mode === "endless" ? copy.infinite : remaining} ${copy.catsUnit}, ${copy.dragToLane}`}
                >
                  <Image src={catType.previewAssets[0]} alt="" width={900} height={900} unoptimized draggable={false} />
                  <span className="cat-name-tooltip" role="tooltip">{localize(catType.name, locale)}</span>
                  <b>{snapshot.mode === "endless" ? "∞" : `×${remaining}`}</b>
                </button>
              );
            })}
          </div>

          <div
            className="lane-field"
            ref={laneFieldRef}
            role="application"
            aria-label={`${laneCount} ${copy.lanesCopy}`}
            onPointerMove={updatePointerLane}
          >
            {Array.from({ length: laneCount }, (_, lane) => (
              <div
                className={`lane ${selectedLane === lane ? "is-selected" : ""}`}
                key={lane}
                aria-hidden="true"
              >
                <span>{lane + 1}</span>
              </div>
            ))}

            <div className="home-line" aria-hidden="true" />

            <div className="lane-aim" aria-hidden="true">
              <span>▶</span>
            </div>

            {liveEnemies.map((enemy) => {
              // HMR 期间旧局模型可能没有 typeId，回退到首个敌人类型避免本地热更新中断。
              const enemyType = ENEMY_TYPES[enemy.typeId] ?? ENEMY_TYPES.luca;
              const damaged = enemy.health < enemyType.maxHealth;
              const damagedSpeedMultiplier = damaged
                ? ("damagedSpeedMultiplier" in enemyType ? enemyType.damagedSpeedMultiplier : 1)
                : 1;

              return (
                <div
                  className={`luca-enemy enemy-type-${enemy.typeId}${damaged ? " is-damaged" : ""}${snapshot.redHeatActive ? " is-red-heat" : ""}`}
                  key={enemy.id}
                  style={{
                    left: `${enemy.x}%`,
                    top: `${getLaneCenterPercent(enemy.lane, laneCount)}%`,
                    "--walk-delay": `${-(enemy.id % 5) * 0.09}s`,
                    "--enemy-walk-duration": `${0.38 / (ENEMY_SPEED_MULTIPLIERS[enemyType.speed] * damagedSpeedMultiplier * enemySpeedMultiplier * (snapshot.redHeatActive ? 3 : 1))}s`,
                  } as CSSProperties}
                  aria-label={`${copy.lane} ${enemy.lane + 1}: ${localize(enemyType.name, locale)}`}
                >
                  <span className="enemy-shadow" />
                  <EnemyModel typeId={enemy.typeId} damaged={damaged} />
                </div>
              );
            })}

            {snapshot.balls.map((ball) => {
              const isLanding = ball.placedAt !== undefined
                && snapshot.elapsed - ball.placedAt < CAT_DROP_DUST_DURATION;

              return (
                <div
                  className={`hua-ball${isLanding ? " is-landing" : ""}${ball.fallingAt !== undefined ? " is-falling" : ""}`}
                  key={ball.id}
                  style={{
                    left: `${ball.x}%`,
                    top: `${getLaneCenterPercent(ball.lane, laneCount)}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                  aria-label={copy.rollingFlora}
                >
                  {isLanding && (
                    <div className="hua-drop-dust" aria-hidden="true">
                      <span /><span /><span /><span /><span /><span />
                    </div>
                  )}
                  <div className="hua-ball-impact-body">
                    <div className="hua-ball-sprite">
                      <Image
                        src={ball.asset}
                        alt=""
                        width={900}
                        height={900}
                        unoptimized
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {snapshot.effects.map((effect) => (
              <div
                className="hit-effect"
                key={effect.id}
                style={{
                  left: `${effect.x}%`,
                  top: `${getLaneCenterPercent(effect.lane, laneCount)}%`,
                }}
                aria-hidden="true"
              >
                <i>✦</i><strong>{effect.label}</strong><i>✦</i>
              </div>
            ))}

            {snapshot.deathEffects.map((effect) => (
              <div
                className="enemy-death-effect"
                key={effect.id}
                style={{
                  left: `${effect.x}%`,
                  top: `${getLaneCenterPercent(effect.lane, laneCount)}%`,
                } as CSSProperties}
                aria-hidden="true"
              >
                <span className="enemy-death-dust" />
                <EnemyModel typeId={effect.typeId} damaged={effect.damaged} death />
              </div>
            ))}
          </div>

          {snapshot.redHeatNotice && snapshot.phase === "playing" && (
            <div className={`red-heat-notice is-${snapshot.redHeatNotice}`} role="status">
              {snapshot.redHeatNotice === "entered" ? copy.redHeatEntered : copy.redHeatEnded}
            </div>
          )}

          {snapshot.phase === "settling" && (
            <div className="game-overlay settlement-overlay" aria-live="polite">
              <div className="settlement-inventory-card">
                <div className={`settlement-cat-stage${snapshot.settlementCatsCounted === 0 ? " is-first" : ""}`} key={snapshot.settlementCatsCounted}>
                  {settlementCurrentCatId && snapshot.settlementCatsCounted < settlementCats.length && (
                    <Image src={CAT_TYPES[settlementCurrentCatId].previewAssets[0]} alt="" width={900} height={900} unoptimized />
                  )}
                  {settlementCurrentCatId && snapshot.settlementCatsCounted < settlementCats.length && (
                    <b>+{CAT_TYPES[settlementCurrentCatId].unusedBonusScore}</b>
                  )}
                </div>
                <strong>×{Math.max(0, settlementCats.length - snapshot.settlementCatsCounted)}</strong>
                <span>{copy.unusedCatsConvert} +{snapshot.settlementBonusAdded}</span>
              </div>
            </div>
          )}

          {snapshot.combo > 1 && snapshot.phase === "playing" && (
            <div className="combo-badge" aria-live="polite">
              <span>{copy.chainHit}</span>
              <strong>×{snapshot.combo}</strong>
            </div>
          )}

          {screen === "game" && snapshot.phase === "paused" && !confirmationAction && (
            <div
              className="game-overlay pause-message-overlay"
              onClick={togglePause}
              role="button"
              tabIndex={0}
              aria-label={copy.tapToResume}
              aria-live="polite"
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  togglePause();
                }
              }}
            >
              <button
                className="pause-exit-button"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  goToLevelSelect();
                }}
                aria-label={copy.backLevelSelect}
                title={copy.backLevelSelect}
              >
                <FaSignOutAlt aria-hidden="true" size={18} />
              </button>
              <span className="pause-state-icon" aria-hidden="true">
                <FaPause className="pause-icon-pause" size={62} />
                <FaPlay className="pause-icon-play" size={58} />
              </span>
              <div className="pause-message">
                <h2>{copy.pauseTitle}</h2>
                <p>{copy.pauseCopy}</p>
              </div>
              <span className="pause-resume-hint">{copy.tapToResume}</span>
            </div>
          )}

          {confirmationAction && (
            <ConfirmDialog
              title={confirmationAction === "restart" ? copy.restartQuestion : copy.backLevelQuestion}
              description={copy.restartWarning}
              confirmLabel={confirmationAction === "restart" ? copy.retry : copy.backLevelSelect}
              cancelLabel={copy.cancel}
              onConfirm={confirmPendingAction}
              onCancel={cancelConfirmation}
            />
          )}

          {snapshot.phase === "victory" && (
            <div className="game-overlay victory-overlay">
              <div className="paper-card result-card">
                <Image
                  className="victory-cat-nest"
                  src="https://assets.anuluca.com/otherWebsites/flora-vs-luca/cats/victory-cat-nest.webp"
                  alt=""
                  width={900}
                  height={768}
                  unoptimized
                />
                <span className="result-stamp">CLEAR!</span>
                <span className="victory-level-tag">{activeLevel.id}</span>
                <div className="victory-rating" aria-label={`${currentRating} ${copy.starsClear}`}>
                  {Array.from({ length: 3 }, (_, index) => (
                    <i className={index < currentRating ? "is-active" : ""} key={index}>★</i>
                  ))}
                </div>
                <h2>{copy.homeSaved}</h2>
                <div className="victory-final-score"><span>{copy.finalScore}</span><strong>{snapshot.score}</strong></div>
                <div className="result-grid">
                  <span>{copy.unusedBonus}<strong>+{snapshot.unusedCatBonus}</strong></span>
                  <span>{copy.bestChain}<strong>×{snapshot.bestCombo}</strong></span>
                  <span>{copy.shots}<strong>{snapshot.shots}</strong></span>
                </div>
                <button className="primary-button" type="button" onClick={() => startGame(snapshot.levelId, "level")}><FaRedoAlt aria-hidden="true" size={19} />{copy.playAgain}</button>
                <button className="primary-button is-khaki result-secondary-button" type="button" onClick={goToLevelSelect}><FaSignOutAlt aria-hidden="true" size={19} />{copy.backLevelSelect}</button>
              </div>
            </div>
          )}

          {snapshot.phase === "defeat" && (
            <div className="game-overlay defeat-overlay">
              <div className="paper-card result-card">
                <Image
                  className="defeat-cat-art"
                  src="https://assets.anuluca.com/otherWebsites/flora-vs-luca/cats/defeat-cat.webp"
                  alt=""
                  width={988}
                  height={1000}
                  unoptimized
                />
                <span className="result-stamp bad-stamp">OOPS!</span>
                <h2>{snapshot.mode === "endless" ? copy.endlessOver : copy.homeLost}</h2>
                <p className="defeat-count"><span>{copy.defeatedCount}</span><strong>{snapshot.defeated}{snapshot.mode === "endless" ? "" : ` / ${activeLevel.totalEnemies}`}</strong><span>{copy.defeatedEnemy}</span></p>
                <button className="primary-button" type="button" onClick={() => openLevelBriefing(snapshot.levelId, snapshot.mode ?? "level")}><FaRedoAlt aria-hidden="true" size={19} />{copy.retryChallenge}</button>
                <button className="primary-button is-khaki result-secondary-button" type="button" onClick={snapshot.mode === "endless" ? goToMainMenu : goToLevelSelect}>
                  {snapshot.mode === "endless" ? <FaHome aria-hidden="true" size={20} /> : <FaSignOutAlt aria-hidden="true" size={19} />}
                  {snapshot.mode === "endless" ? copy.backMainMenu : copy.backLevelSelect}
                </button>
              </div>
            </div>
          )}
        </div>

        <footer className="game-controls">
          <p>{activeLevel.tips.map((tip) => <span key={tip.zh}>{localize(tip, locale)}</span>)}</p>
          <button
            className={`enemy-speed-button is-speed-${enemySpeedMultiplier}`}
            type="button"
            onClick={cycleEnemySpeed}
            disabled={screen === "level-briefing" || confirmationAction !== null || !(snapshot.phase === "playing" || snapshot.phase === "paused")}
            aria-label={`${copy.enemySpeed} ×${enemySpeedMultiplier}`}
            title={`${copy.enemySpeed} ×${enemySpeedMultiplier}`}
          >
            <FaFastForward aria-hidden="true" size={17} />
            {enemySpeedMultiplier > 1 && <strong>×{enemySpeedMultiplier}</strong>}
          </button>
        </footer>
      </section>
      )}

      {dragState && typeof document !== "undefined" && createPortal(
        <div
          className="cat-drag-ghost"
          ref={dragGhostRef}
          style={{ "--drag-x": `${dragState.x}px`, "--drag-y": `${dragState.y}px` } as CSSProperties}
          aria-hidden="true"
        >
          <Image src={dragState.asset} alt="" width={900} height={900} unoptimized draggable={false} />
        </div>,
        document.body,
      )}

      {screen !== "loading" && (
        <div className="site-utility-area">
          <button className="site-utility-button" type="button" onClick={shareGame} aria-label={copy.shareGame} title={copy.share}>
            {shareCompleted ? <FaCheck aria-hidden="true" size={18} /> : <FaShareAlt aria-hidden="true" size={18} />}
          </button>
          <div className="sound-inline-control" aria-label={copy.soundAdjuster}>
            <button
              className="sound-mute-button"
              type="button"
              onClick={toggleSound}
              disabled={confirmationAction !== null}
              aria-label={soundEnabled ? copy.mute : copy.unmute}
              title={soundEnabled ? copy.mute : copy.unmute}
            >
              {soundEnabled ? <FaVolumeUp aria-hidden="true" size={18} /> : <FaVolumeMute aria-hidden="true" size={18} />}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(soundVolume * 100)}
              onChange={(event) => changeSoundVolume(Number(event.target.value) / 100)}
              disabled={confirmationAction !== null}
              aria-label={copy.volume}
              style={{ "--sound-level": `${soundVolume * 100}%` } as CSSProperties}
            />
          </div>
          <button
            className="site-utility-button language-switch-button"
            type="button"
            onClick={toggleLocale}
            aria-label={copy.switchEnglish}
            title={copy.switchEnglish}
          >
            <strong>{locale === "zh" ? "汉" : "En"}</strong>
            <small>{locale === "zh" ? "En" : "中"}</small>
          </button>
        </div>
      )}
    </main>
  );
}
