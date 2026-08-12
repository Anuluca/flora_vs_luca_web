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
  FaGithub,
  FaHistory,
  FaHome,
  FaInfoCircle,
  FaListUl,
  FaPause,
  FaPlay,
  FaRedoAlt,
  FaShareAlt,
  FaVolumeMute,
  FaVolumeUp,
} from "react-icons/fa";
import { FaBilibili } from "react-icons/fa6";
import {
  CAT_TYPES,
  ENEMY_TYPES,
  GAME_ASSET_URLS,
  LEVELS,
  getLevel,
  localize,
  type CatTypeId,
  type LevelId,
  type Locale,
} from "@/features/game/config";
import { LOADING_MESSAGES, LOCALE_STORAGE_KEY, UI_COPY } from "@/features/game/i18n";
import {
  GAME,
  INITIAL_DECORATIONS,
  chooseRicochetLane,
  clamp,
  createDecorations,
  createGameModel,
  getChainMultiplier,
  getLevelRating,
  getUnusedCatBonus,
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
import {
  BackButton,
  CornerDecorations,
  GameWordmark,
  MatchupPreview,
  VersusArtwork,
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
  | "game";

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

type PageTransitionMode = "page" | "fade";
type ConfirmationAction = "restart" | "level-select";

function formatCatalogNumber(index: number) {
  return `No.${String(index + 1).padStart(3, "0")}`;
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
  const laneProgress = isRotatedPortrait
    ? (bounds.right - clientX) / bounds.width
    : (clientY - bounds.top) / bounds.height;
  return clamp(Math.floor(laneProgress * laneCount), 0, laneCount - 1);
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
  const laneFieldRef = useRef<HTMLDivElement | null>(null);
  const confirmationWasPlayingRef = useRef(false);
  const confirmationActionRef = useRef<ConfirmationAction | null>(null);
  const localeReadyRef = useRef(false);

  const [snapshot, setSnapshot] = useState<GameModel>(initialModel);
  const [locale, setLocale] = useState<Locale>("zh");
  const [screen, setScreen] = useState<Screen>("loading");
  const [selectedLevelId, setSelectedLevelId] = useState<LevelId>(LEVELS[0].id);
  const [briefingMode, setBriefingMode] = useState<GameMode>("level");
  const [selectedLane, setSelectedLane] = useState(2);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(0.7);
  const [soundPanelOpen, setSoundPanelOpen] = useState(false);
  const [shareCompleted, setShareCompleted] = useState(false);
  const [levelProgress, setLevelProgress] = useState<LevelProgress>(createEmptyLevelProgress);
  const [decorations, setDecorations] = useState(INITIAL_DECORATIONS);
  const [assetProgress, setAssetProgress] = useState(0);
  const [assetLoadFailed, setAssetLoadFailed] = useState(false);
  const [assetLoadAttempt, setAssetLoadAttempt] = useState(0);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [draggedCatTypeId, setDraggedCatTypeId] = useState<CatTypeId | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [confirmationAction, setConfirmationAction] = useState<ConfirmationAction | null>(null);
  const copy = UI_COPY[locale];
  const loadingMessages = LOADING_MESSAGES[locale];
  const labelSeparator = locale === "zh" ? "：" : ": ";

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
      deathEffects: [...(model.deathEffects ?? [])],
      remainingCats: { ...model.remainingCats },
    });
  }, []);

  const setLane = useCallback((lane: number) => {
    const nextLane = clamp(lane, 0, modelRef.current.laneCount - 1);
    setSelectedLane(nextLane);
  }, []);

  /** 通过 Web Audio API 即时合成短音效，避免额外音频文件和网络请求。 */
  const playSound = useCallback((kind: "roll" | "hit" | "win" | "lose") => {
    if (!soundEnabledRef.current || typeof window === "undefined") return;

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
      win: [330, 440, 660],
      lose: [190, 145, 95],
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
  }, []);

  const startGame = useCallback((levelId: LevelId = selectedLevelId, mode: GameMode = "level") => {
    const level = getLevel(levelId);
    const nextModel = createGameModel(level, "playing", mode);
    modelRef.current = nextModel;
    previousFrameRef.current = null;
    syncAtRef.current = 0;
    setDecorations(createDecorations());
    setSelectedLevelId(levelId);
    setDraggedCatTypeId(null);
    setDragPosition(null);
    confirmationActionRef.current = null;
    setConfirmationAction(null);
    setLane(Math.floor((nextModel.laneCount - 1) / 2));
    navigateTo("game", "fade");
    playSound("roll");
    sync();
  }, [navigateTo, playSound, selectedLevelId, setLane, sync]);

  const goToMainMenu = useCallback(() => {
    modelRef.current = createGameModel(getLevel(selectedLevelId), "menu");
    previousFrameRef.current = null;
    navigateTo("main-menu");
    sync();
  }, [navigateTo, selectedLevelId, sync]);

  const goToLevelSelect = useCallback(() => {
    modelRef.current = createGameModel(getLevel(selectedLevelId), "menu");
    previousFrameRef.current = null;
    navigateTo("level-select");
    sync();
  }, [navigateTo, selectedLevelId, sync]);

  const openLevelBriefing = useCallback((levelId: LevelId, mode: GameMode = "level") => {
    setSelectedLevelId(levelId);
    setBriefingMode(mode);
    navigateTo("level-briefing");
  }, [navigateTo]);

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
  }, []);

  const changeSoundVolume = useCallback((nextVolume: number) => {
    const normalizedVolume = clamp(nextVolume, 0, 1);
    soundVolumeRef.current = normalizedVolume;
    setSoundVolume(normalizedVolume);
    if (normalizedVolume > 0 && !soundEnabledRef.current) {
      soundEnabledRef.current = true;
      setSoundEnabled(true);
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
    if (action === "restart") startGame(modelRef.current.levelId, modelRef.current.mode ?? "level");
    else if (action === "level-select") goToLevelSelect();
  }, [confirmationAction, goToLevelSelect, startGame]);

  const shoot = useCallback(
    (lane: number, catTypeId: CatTypeId) => {
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
        asset: catType.projectileAssets[Math.floor(Math.random() * catType.projectileAssets.length)],
        hitIds: [],
      });
      model.shots += 1;
      if (model.mode !== "endless") model.remainingCats[catTypeId] = remaining - 1;
      model.nextShotAt = model.elapsed + GAME.cooldown;
      playSound("roll");
      sync();
      return true;
    },
    [playSound, setLane, sync],
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
    setDragPosition({ x: clientX, y: clientY });
    const field = laneFieldRef.current;
    if (!field) return;
    const lane = getLaneFromClientPoint(field, clientX, clientY, modelRef.current.laneCount);
    if (lane !== null) setLane(lane);
  }, [setLane]);

  const finishCatDrag = useCallback((clientX: number, clientY: number, catTypeId: CatTypeId) => {
    const field = laneFieldRef.current;
    const lane = field
      ? getLaneFromClientPoint(field, clientX, clientY, modelRef.current.laneCount)
      : null;
    if (lane !== null) shoot(lane, catTypeId);
    setDraggedCatTypeId(null);
    setDragPosition(null);
  }, [shoot]);

  useEffect(() => {
    if (!draggedCatTypeId) return;

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault();
      updateDragLane(event.clientX, event.clientY);
    };
    const handlePointerUp = (event: PointerEvent) => {
      finishCatDrag(event.clientX, event.clientY, draggedCatTypeId);
    };
    const handlePointerCancel = () => {
      setDraggedCatTypeId(null);
      setDragPosition(null);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [draggedCatTypeId, finishCatDrag, updateDragLane]);

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
   * 进入主菜单前下载并解码全部游戏贴图。浏览器缓存命中时同样执行 decode，
   * 确保首局生成角色时不会出现短暂空白或透明占位。
   */
  useEffect(() => {
    let cancelled = false;
    let completed = 0;
    const randomizeMessageTimer = window.setTimeout(() => {
      setLoadingMessageIndex(Math.floor(Math.random() * LOADING_MESSAGES.zh.length));
    }, 0);

    const loadAsset = (src: string) =>
      new Promise<void>((resolve, reject) => {
        const image = new window.Image();
        image.decoding = "async";
        image.onload = () => {
          const finish = () => {
            if (!cancelled) {
              completed += 1;
              setAssetProgress(completed / GAME_ASSET_URLS.length);
            }
            resolve();
          };

          if (typeof image.decode === "function") image.decode().catch(() => undefined).then(finish);
          else finish();
        };
        image.onerror = () => reject(new Error(`Failed to load ${src}`));
        image.src = src;
      });

    Promise.all(GAME_ASSET_URLS.map(loadAsset))
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

        if (model.mode === "endless" && model.elapsed >= model.nextEndlessSpawnAt) {
          model.enemies.push({
            id: model.nextEnemyId,
            typeId: activeLevel.enemyTypeIds[model.nextEnemyId % activeLevel.enemyTypeIds.length],
            lane: Math.floor(Math.random() * model.laneCount),
            x: 103,
            spawnAt: model.elapsed,
            spawned: true,
            defeated: false,
          });
          model.nextEnemyId += 1;
          model.nextEndlessSpawnAt = model.elapsed + 0.72 + Math.random() * 0.28;
        }

        for (const enemy of model.enemies) {
          if (!enemy.spawned && enemy.spawnAt <= model.elapsed) enemy.spawned = true;
          if (enemy.spawned && !enemy.defeated) {
            const speedMultiplier = model.mode === "endless" ? GAME.endlessEnemySpeedMultiplier : 1;
            enemy.x -= activeLevel.enemySpeed * speedMultiplier * delta;
          }
        }

        for (const ball of model.balls) {
          ball.x += GAME.ballSpeed * delta;
          const laneDelta = ball.targetLane - ball.lane;
          if (Math.abs(laneDelta) > 0.01) {
            ball.lane += Math.sign(laneDelta) * Math.min(Math.abs(laneDelta), GAME.ballLaneSpeed * delta);
          }

          for (const enemy of model.enemies) {
            const isCollision =
              enemy.spawned &&
              !enemy.defeated &&
              !ball.hitIds.includes(enemy.id) &&
              Math.abs(enemy.x - ball.x) < 3.35 &&
              Math.abs(enemy.lane - ball.lane) < 0.42;

            if (!isCollision) continue;

            enemy.defeated = true;
            ball.hitIds.push(enemy.id);
            ball.targetLane = chooseRicochetLane(ball, model.enemies, model.laneCount);
            model.defeated += 1;
            const chainCount = ball.hitIds.length;
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
            // 保留死亡瞬间的坐标和外观，让视图层能完整播放零件散落动画。
            (model.deathEffects ??= []).push({
              id: Date.now() * 10 + enemy.id,
              typeId: enemy.typeId,
              lane: enemy.lane,
              x: enemy.x,
              expiresAt: model.elapsed + 0.82,
            });
            playSound("hit");
            // 单跑道教学关中，球形花花命中一个敌人后立即退场，不能清掉整条跑道。
            if (model.laneCount === 1) {
              ball.x = 107;
              break;
            }
          }
        }

        model.balls = model.balls.filter((ball) => ball.x < 106);
        if (model.mode === "endless") {
          model.enemies = model.enemies.filter((enemy) => !enemy.defeated);
        }
        model.effects = model.effects.filter((effect) => effect.expiresAt > model.elapsed);
        model.deathEffects = (model.deathEffects ?? []).filter((effect) => effect.expiresAt > model.elapsed);
        if (model.elapsed - model.lastHitAt > 1.45) model.combo = 0;

        if (model.mode !== "endless" && model.defeated >= activeLevel.totalEnemies) {
          model.unusedCatBonus = getUnusedCatBonus(model.remainingCats);
          model.score += model.unusedCatBonus;
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

      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [playSound, sync]);

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
  const progress = (snapshot.defeated / activeLevel.totalEnemies) * 100;
  const displayedProgress = snapshot.mode === "endless" ? 0 : progress;
  const currentBestScore = levelProgress[snapshot.levelId].bestScore;
  const selectedLevel = getLevel(selectedLevelId);
  const selectedCatType = CAT_TYPES[selectedLevel.catTypeIds[0]];
  const selectedEnemyType = ENEMY_TYPES[selectedLevel.enemyTypeIds[0]];
  const currentRating = getLevelRating(activeLevel, snapshot.score, snapshot.phase === "victory");
  const laneCount = snapshot.laneCount;

  return (
    <main className="page-shell" lang={locale === "zh" ? "zh-CN" : "en"} data-locale={locale}>
      <div className="wall-doodle wall-doodle-one" aria-hidden="true">✦</div>
      <div className="wall-doodle wall-doodle-two" aria-hidden="true">=^･ω･^=</div>
      {screen !== "loading" && (
        <div className="persistent-corner-frame">
          <CornerDecorations />
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
            <VersusArtwork />
            <div className="main-menu-wordmark">
              <GameWordmark locale={locale} />
            </div>

            <div className="paper-card main-menu-card">
              <nav className="main-menu-actions" aria-label={copy.mainMenuActions}>
                <button className="primary-button" type="button" onClick={goToLevelSelect}>
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
            <div className="level-board-title">
              <span className="tape tape-one" />
              <span className="tape tape-two" />
              <p>{copy.chapterOne}</p>
              <h1>{copy.chapterTitle}</h1>
              <small>{copy.levelCount}</small>
            </div>

            <div className="level-grid">
              {LEVELS.map((level, levelIndex) => {
                const isOpen = levelIndex <= 1;
                const progressEntry = levelProgress[level.id];
                const rating = getLevelRating(level, progressEntry.bestScore, progressEntry.completed);

                return (
                  <button
                    className={`level-card ${isOpen ? "is-open" : "is-locked"}${progressEntry.completed ? " is-completed" : ""}${rating === 3 ? " is-three-star" : ""}`}
                    type="button"
                    key={level.id}
                    onClick={isOpen ? () => openLevelBriefing(level.id) : undefined}
                    disabled={!isOpen}
                  >
                    {isOpen ? (
                      <>
                        <span className="level-number">{level.id}</span>
                        <MatchupPreview level={level} locale={locale} />
                        <strong>{localize(level.name, locale)}</strong>
                        <small>{copy.maxScore} {String(progressEntry.bestScore).padStart(5, "0")}</small>
                        <div className="level-difficulty" aria-label={`${copy.difficulty} ${level.difficulty}`}>
                          <span>{copy.difficulty}</span>
                          <div aria-hidden="true">
                            {Array.from({ length: 5 }, (_, index) => (
                              <Image
                                className={index < level.difficulty ? "is-active" : ""}
                                key={index}
                                src="/assets/luca-head.png"
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
                        {progressEntry.completed
                          ? <i className="completion-label">{copy.completed}</i>
                          : <i className="incomplete-label">{copy.notStarted}</i>}
                      </>
                    ) : (
                      <strong className="locked-sleep">{copy.lucaSleeping}</strong>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {screen === "level-briefing" && (
        <section className="game-cabinet secondary-page briefing-page" aria-label={copy.readyToDefend}>
          <header className="screen-topbar secondary-topbar">
            <BackButton locale={locale} onClick={briefingMode === "endless" ? goToMainMenu : goToLevelSelect}>
              {briefingMode === "endless" ? copy.backMainMenu : copy.backLevelSelect}
            </BackButton>
            <strong>{briefingMode === "endless" ? copy.endlessMode : `${copy.level} ${selectedLevel.id}`}</strong>
          </header>
          <div className="secondary-content briefing-content">
            <div className="briefing-sheet">
              <h1>{copy.readyToDefend}</h1>
              <p>{briefingMode === "endless" ? copy.currentLineup : copy.levelLineup}</p>
              <div className="briefing-types">
                {selectedLevel.catTypeIds.map((catTypeId) => {
                  const catType = CAT_TYPES[catTypeId];
                  return (
                    <article className="briefing-type-card" key={catType.id}>
                      <span>{copy.catsInUse}</span>
                      <div className="briefing-type-images">
                        {catType.imageAssets.map((src) => <Image key={src} src={src} alt="" width={747} height={900} unoptimized />)}
                      </div>
                      <strong>{localize(catType.name, locale)}</strong>
                      <small className="briefing-score-note">
                        {briefingMode === "endless" ? copy.unlimited : `${copy.available} ${selectedLevel.catInventory[catTypeId] ?? 0} ${copy.catsUnit}`}
                        {` · ${copy.unusedEach} +${catType.unusedBonusScore} ${copy.points}`}
                      </small>
                    </article>
                  );
                })}
                {selectedLevel.enemyTypeIds.map((enemyTypeId) => {
                  const enemyType = ENEMY_TYPES[enemyTypeId];
                  return (
                    <article className="briefing-type-card" key={enemyType.id}>
                      <span>{copy.enemy}</span>
                      <div className="briefing-type-images">
                        {enemyType.imageAssets.map((src) => <Image key={src} src={src} alt="" width={288} height={237} unoptimized />)}
                      </div>
                      <strong>{localize(enemyType.name, locale)}</strong>
                      <small className="briefing-score-note">{copy.defeatScore} +{enemyType.killScore} {copy.points}</small>
                    </article>
                  );
                })}
              </div>
              <button className="primary-button briefing-start" type="button" onClick={() => startGame(selectedLevel.id, briefingMode)}>
                {copy.start}
              </button>
            </div>
          </div>
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
              <GameWordmark locale={locale} />
              <div className="about-grid">
                <article className="about-full-row"><span>{copy.gameSetting}</span><p>{copy.gameSettingCopy}</p></article>
                <article className="about-full-row"><span>{copy.gameplay}</span><p>{copy.gameplayCopy}</p></article>
                <article className="producer-card">
                  <span>{copy.producer}</span>
                  <div className="producer-profile"><Image src="/assets/anutrium-logo.jpg" alt="Anuluca" width={1280} height={1280} unoptimized /><p>Anuluca</p></div>
                </article>
                <article className="related-links-card">
                  <span>{copy.relatedLinks}</span>
                  <div className="related-actions external-links">
                    <a href="https://github.com/anuluca" target="_blank" rel="noreferrer"><FaGithub aria-hidden="true" size={29} />GitHub</a>
                    <a href="https://anuluca.com" target="_blank" rel="noreferrer"><Image src="/assets/anutrium-logo.jpg" alt="" width={1280} height={1280} unoptimized />Anutrium</a>
                    <a href="https://space.bilibili.com/128735968" target="_blank" rel="noreferrer"><FaBilibili aria-hidden="true" size={29} />bilibili</a>
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
              <Image className="bestiary-single-cat" src="/assets/hua-bowl-1.png" alt="" width={747} height={900} unoptimized />
              <strong>{copy.cats}</strong><small>{copy.species}{labelSeparator}1/12</small>
            </button>
            <button className="bestiary-module enemy-module" type="button" onClick={() => navigateTo("enemy-catalog")}>
              <Image src={selectedEnemyType.headAsset} alt="" width={288} height={237} unoptimized />
              <strong>{copy.enemies}</strong><small>{copy.species}{labelSeparator}1/12</small>
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
                const isDiscovered = index === 0;
                const isCat = screen === "cat-catalog";
                return (
                  <article className={`catalog-entry${isDiscovered ? "" : " is-placeholder"}`} key={index}>
                    <div className={`catalog-entry-image${isCat ? " has-multiple-art" : " has-single-art"}`} aria-hidden="true">
                      {isDiscovered ? (
                        isCat
                          ? selectedCatType.imageAssets.map((src) => <Image key={src} src={src} alt="" width={747} height={900} unoptimized />)
                          : selectedEnemyType.imageAssets.map((src) => <Image key={src} src={src} alt="" width={288} height={237} unoptimized />)
                      ) : <strong>?</strong>}
                    </div>
                    <div>
                      <span>{formatCatalogNumber(index)}</span>
                      <h1>{isDiscovered ? localize(isCat ? selectedCatType.name : selectedEnemyType.name, locale) : copy.undiscovered}</h1>
                      {isDiscovered && <p>{localize(isCat ? selectedCatType.description : selectedEnemyType.description, locale)}</p>}
                      {isDiscovered && (isCat
                        ? <small className="position-tag">{copy.position}{labelSeparator}{localize(selectedCatType.position, locale)}</small>
                        : <small className="strength-stars" aria-label={`${copy.strength} ${selectedEnemyType.strength}`}>{copy.strength}{labelSeparator}{Array.from({ length: 5 }, (_, star) => <i className={star < selectedEnemyType.strength ? "is-active" : ""} key={star}>★</i>)}</small>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {screen === "game" && (
      <section className="game-cabinet game-page" aria-label={copy.gameLabel}>
        <header className="game-hud">
          <div className="hud-brand-zone">
            <VersusArtwork compact />
            <GameWordmark compact locale={locale} />
          </div>

          <div className="level-progress" aria-label={snapshot.mode === "endless" ? copy.endlessMode : `${copy.levelProgress} ${Math.round(progress)}%`}>
            <div className="level-copy">
              <span>{snapshot.mode === "endless" ? copy.endlessMode : `${copy.level} ${activeLevel.id}`}</span>
              <strong>{snapshot.mode === "endless" ? "∞" : `${Math.round(progress)}%`}</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${displayedProgress}%` }} />
              <i className="progress-cat" style={{ left: `${clamp(displayedProgress, 3, 96)}%` }}>▲</i>
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
                className="icon-button"
                type="button"
                onClick={() => requestConfirmation("level-select")}
                disabled={confirmationAction !== null || !(["playing", "paused"] as Phase[]).includes(snapshot.phase)}
                aria-label={copy.backLevelSelect}
                title={copy.backLevelSelect}
              >
                <FaListUl aria-hidden="true" size={18} />
              </button>
              <button
                className="icon-button"
                type="button"
                onClick={() => requestConfirmation("restart")}
                disabled={confirmationAction !== null || !(["playing", "paused"] as Phase[]).includes(snapshot.phase)}
                aria-label={copy.restart}
                title={copy.restart}
              >
                <FaRedoAlt aria-hidden="true" size={19} />
              </button>
              <button
                className="icon-button"
                type="button"
                onClick={togglePause}
                disabled={confirmationAction !== null || !(["playing", "paused"] as Phase[]).includes(snapshot.phase)}
                aria-label={snapshot.phase === "paused" ? copy.resume : copy.pause}
                title={copy.pause}
              >
                {snapshot.phase === "paused" ? <FaPlay aria-hidden="true" size={18} /> : <FaPause aria-hidden="true" size={18} />}
              </button>
            </div>
          </div>
        </header>

        <div
          className={`battlefield phase-${snapshot.phase}`}
          style={{
            "--selected-lane": selectedLane,
            "--selected-lane-top": `${((selectedLane + 0.5) / laneCount) * 100}%`,
          } as CSSProperties}
        >
          <div className="paper-noise" aria-hidden="true" />
          <div className="danger-note" aria-hidden="true">
            <span className="tape tape-one" />
            <span className="tape tape-two" />
            <p>{copy.dangerCopy}</p>
          </div>

          <div className="home-zone" aria-hidden="true">
            <Image
              className="scratcher-house"
              src="/assets/scratcher-house.png"
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
                  src="/assets/treat.png"
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
                src="/assets/treat.png"
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

          <div className={`cat-inventory${draggedCatTypeId ? " is-dragging" : ""}`}>
            <span className="cat-inventory-title">{copy.catsTitle}</span>
            {activeLevel.catTypeIds.map((catTypeId) => {
              const catType = CAT_TYPES[catTypeId];
              const remaining = snapshot.remainingCats[catTypeId] ?? 0;
              const isUnavailable = snapshot.mode !== "endless" && remaining <= 0;

              return (
                <button
                  className={`cat-inventory-card${draggedCatTypeId === catTypeId ? " is-active" : ""}`}
                  type="button"
                  key={catTypeId}
                  disabled={snapshot.phase !== "playing" || isUnavailable}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setDraggedCatTypeId(catTypeId);
                    setDragPosition({ x: event.clientX, y: event.clientY });
                  }}
                  aria-label={`${localize(catType.name, locale)}, ${copy.remaining} ${snapshot.mode === "endless" ? copy.infinite : remaining} ${copy.catsUnit}, ${copy.dragToLane}`}
                >
                  <Image src={catType.previewAssets[0]} alt="" width={747} height={900} unoptimized draggable={false} />
                  <span className="cat-name-tooltip" role="tooltip">{localize(catType.name, locale)}</span>
                  <b>{snapshot.mode === "endless" ? "∞" : `×${remaining}`}</b>
                </button>
              );
            })}
          </div>

          <div
            className={`lane-field${laneCount === 1 ? " is-single-lane" : ""}`}
            ref={laneFieldRef}
            role="application"
            aria-label={`${laneCount} ${copy.lanesCopy}`}
            onPointerMove={updatePointerLane}
          >
            {Array.from({ length: laneCount }, (_, lane) => (
              <div
                className={`lane ${selectedLane === lane ? "is-selected" : ""}`}
                key={lane}
                style={{ height: `${100 / laneCount}%` }}
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

              return (
                <div
                  className="luca-enemy"
                  key={enemy.id}
                  style={{
                    left: `${enemy.x}%`,
                    top: `${((enemy.lane + 0.5) / laneCount) * 100}%`,
                    "--walk-delay": `${-(enemy.id % 5) * 0.09}s`,
                    "--enemy-body-color": enemyType.bodyColor,
                    "--enemy-arm-color": enemyType.armColor,
                  } as CSSProperties}
                  aria-label={`${copy.lane} ${enemy.lane + 1}: ${localize(enemyType.name, locale)}`}
                >
                  <span className="enemy-shadow" />
                  <span className="enemy-leg enemy-leg-left" />
                  <span className="enemy-leg enemy-leg-right" />
                  <span className="enemy-arm enemy-arm-right" />
                  <span className="enemy-body" data-emblem={enemyType.emblem} />
                  <span className="enemy-arm enemy-arm-left" />
                  <Image src={enemyType.headAsset} alt="" width={288} height={237} unoptimized />
                </div>
              );
            })}

            {snapshot.balls.map((ball) => (
              <div
                className="hua-ball"
                key={ball.id}
                style={{
                  left: `${ball.x}%`,
                  top: `${((ball.lane + 0.5) / laneCount) * 100}%`,
                  transform: "translate(-50%, -50%)",
                }}
                aria-label={copy.rollingFlora}
              >
                <div className="hua-ball-sprite">
                  <Image
                    src={ball.asset}
                    alt=""
                    width={747}
                    height={900}
                    unoptimized
                  />
                </div>
              </div>
            ))}

            {snapshot.effects.map((effect) => (
              <div
                className="hit-effect"
                key={effect.id}
                style={{
                  left: `${effect.x}%`,
                  top: `${((effect.lane + 0.5) / laneCount) * 100}%`,
                }}
                aria-hidden="true"
              >
                <i>✦</i><strong>{effect.label}</strong><i>✦</i>
              </div>
            ))}

            {(snapshot.deathEffects ?? []).map((effect) => {
              const enemyType = ENEMY_TYPES[effect.typeId] ?? ENEMY_TYPES.luca;

              return (
                <div
                  className="enemy-death-effect"
                  key={effect.id}
                  style={{
                    left: `${effect.x}%`,
                    top: `${((effect.lane + 0.5) / laneCount) * 100}%`,
                    "--enemy-body-color": enemyType.bodyColor,
                    "--enemy-arm-color": enemyType.armColor,
                  } as CSSProperties}
                  aria-hidden="true"
                >
                  <span className="enemy-death-dust" />
                  <span className="enemy-leg enemy-leg-left" />
                  <span className="enemy-leg enemy-leg-right" />
                  <span className="enemy-arm enemy-arm-right" />
                  <span className="enemy-body" data-emblem={enemyType.emblem} />
                  <span className="enemy-arm enemy-arm-left" />
                  <Image className="enemy-death-head" src={enemyType.headAsset} alt="" width={288} height={237} unoptimized />
                </div>
              );
            })}
          </div>

          {snapshot.combo > 1 && snapshot.phase === "playing" && (
            <div className="combo-badge" aria-live="polite">
              <span>{copy.chainHit}</span>
              <strong>×{snapshot.combo}</strong>
            </div>
          )}

          {snapshot.phase === "paused" && !confirmationAction && (
            <button
              className="game-overlay pause-message-overlay"
              type="button"
              onClick={togglePause}
              aria-label={copy.tapToResume}
              aria-live="polite"
            >
              <div className="pause-message">
                <h2>{copy.pauseTitle}</h2>
                <p>{copy.pauseCopy}</p>
              </div>
              <span className="pause-resume-hint">{copy.tapToResume}</span>
            </button>
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
                <span className="result-stamp">CLEAR!</span>
                <p className="eyebrow">{copy.homeSaved}</p>
                <h2>{activeLevel.id} {copy.cleared}</h2>
                <div className="victory-rating" aria-label={`${currentRating} ${copy.starsClear}`}>
                  {Array.from({ length: 3 }, (_, index) => (
                    <i className={index < currentRating ? "is-active" : ""} key={index}>★</i>
                  ))}
                </div>
                <div className="result-grid">
                  <span>{copy.finalScore}<strong>{snapshot.score}</strong></span>
                  <span>{copy.unusedBonus}<strong>+{snapshot.unusedCatBonus}</strong></span>
                  <span>{copy.bestChain}<strong>×{snapshot.bestCombo}</strong></span>
                  <span>{copy.shots}<strong>{snapshot.shots}</strong></span>
                </div>
                <button className="primary-button" type="button" onClick={() => startGame(snapshot.levelId, "level")}><FaRedoAlt aria-hidden="true" size={19} />{copy.playAgain}</button>
                <button className="primary-button is-khaki result-secondary-button" type="button" onClick={goToLevelSelect}><FaListUl aria-hidden="true" size={19} />{copy.backLevelSelect}</button>
              </div>
            </div>
          )}

          {snapshot.phase === "defeat" && (
            <div className="game-overlay defeat-overlay">
              <div className="paper-card result-card">
                <span className="result-stamp bad-stamp">OOPS!</span>
                <p className="eyebrow">{copy.lucaSlippedIn}</p>
                <h2>{snapshot.mode === "endless" ? copy.endlessOver : copy.homeLost}</h2>
                <p>{copy.defeatedCount} {snapshot.defeated}{snapshot.mode === "endless" ? "" : ` / ${activeLevel.totalEnemies}`} {localize(ENEMY_TYPES.luca.name, locale)}</p>
                <button className="primary-button" type="button" onClick={() => startGame(snapshot.levelId, snapshot.mode ?? "level")}><FaRedoAlt aria-hidden="true" size={19} />{copy.retryChallenge}</button>
                <button className="primary-button is-khaki result-secondary-button" type="button" onClick={snapshot.mode === "endless" ? goToMainMenu : goToLevelSelect}>
                  {snapshot.mode === "endless" ? <FaHome aria-hidden="true" size={20} /> : <FaListUl aria-hidden="true" size={19} />}
                  {snapshot.mode === "endless" ? copy.backMainMenu : copy.backLevelSelect}
                </button>
              </div>
            </div>
          )}
        </div>

        <footer className="game-controls">
          <p>{activeLevel.tips.map((tip) => <span key={tip.zh}>{localize(tip, locale)}</span>)}</p>
        </footer>
      </section>
      )}

      {draggedCatTypeId && dragPosition && typeof document !== "undefined" && createPortal(
        <div className="cat-drag-ghost" style={{ left: dragPosition.x, top: dragPosition.y }} aria-hidden="true">
          <Image src={CAT_TYPES[draggedCatTypeId].previewAssets[0]} alt="" width={747} height={900} unoptimized draggable={false} />
        </div>,
        document.body,
      )}

      {screen !== "loading" && (
        <div className="site-utility-area">
          <button className="site-utility-button" type="button" onClick={shareGame} aria-label={copy.shareGame} title={copy.share}>
            {shareCompleted ? <FaCheck aria-hidden="true" size={18} /> : <FaShareAlt aria-hidden="true" size={18} />}
          </button>
          <div className="sound-control-wrap">
            <button
              className={`site-utility-button${soundPanelOpen ? " is-active" : ""}`}
              type="button"
              onClick={() => setSoundPanelOpen((open) => !open)}
              disabled={confirmationAction !== null}
              aria-label={copy.soundSettings}
              aria-expanded={soundPanelOpen}
              title={copy.soundSettings}
            >
              {soundEnabled ? <FaVolumeUp aria-hidden="true" size={20} /> : <FaVolumeMute aria-hidden="true" size={20} />}
            </button>
            {soundPanelOpen && (
              <div className="sound-popover" aria-label={copy.soundAdjuster}>
                <button className="sound-mute-button" type="button" onClick={toggleSound} aria-label={soundEnabled ? copy.mute : copy.unmute}>
                  {soundEnabled ? <FaVolumeUp aria-hidden="true" size={18} /> : <FaVolumeMute aria-hidden="true" size={18} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(soundVolume * 100)}
                  onChange={(event) => changeSoundVolume(Number(event.target.value) / 100)}
                  aria-label={copy.volume}
                  style={{ "--sound-level": `${soundVolume * 100}%` } as CSSProperties}
                />
              </div>
            )}
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
