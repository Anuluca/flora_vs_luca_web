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
import { flushSync } from "react-dom";
import {
  FaBookOpen,
  FaCat,
  FaGithub,
  FaHistory,
  FaHome,
  FaInfoCircle,
  FaListUl,
  FaPause,
  FaPlay,
  FaRedoAlt,
  FaVolumeMute,
  FaVolumeUp,
} from "react-icons/fa";
import {
  CAT_TYPES,
  ENEMY_TYPES,
  GAME_ASSET_URLS,
  LEVELS,
  getLevel,
  type LevelId,
} from "@/features/game/config";
import {
  GAME,
  INITIAL_DECORATIONS,
  chooseRicochetLane,
  clamp,
  createDecorations,
  createGameModel,
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

const LOADING_MESSAGES = [
  "- 花花正在睡觉 -",
  "- 花花正在跑酷 -",
  "- 花花正在玩玩具 -",
  "- 花花正在咬路卡 -",
  "- 花花正在发呆 -",
] as const;

function formatCatalogNumber(index: number) {
  return `No.${String(index + 1).padStart(3, "0")}`;
}

export default function HuaVsLucaGame() {
  const [initialModel] = useState<GameModel>(() => createGameModel());
  const modelRef = useRef<GameModel>(initialModel);
  const frameRef = useRef<number | null>(null);
  const previousFrameRef = useRef<number | null>(null);
  const syncAtRef = useRef(0);
  const selectedLaneRef = useRef(2);
  const soundEnabledRef = useRef(true);
  const audioContextRef = useRef<AudioContext | null>(null);

  const [snapshot, setSnapshot] = useState<GameModel>(initialModel);
  const [screen, setScreen] = useState<Screen>("loading");
  const [selectedLevelId, setSelectedLevelId] = useState<LevelId>(LEVELS[0].id);
  const [briefingMode, setBriefingMode] = useState<GameMode>("level");
  const [selectedLane, setSelectedLane] = useState(2);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [levelProgress, setLevelProgress] = useState<LevelProgress>(createEmptyLevelProgress);
  const [decorations, setDecorations] = useState(INITIAL_DECORATIONS);
  const [assetProgress, setAssetProgress] = useState(0);
  const [assetLoadFailed, setAssetLoadFailed] = useState(false);
  const [assetLoadAttempt, setAssetLoadAttempt] = useState(0);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  const navigateTo = useCallback((nextScreen: Screen) => {
    const transitionDocument = document as ViewTransitionDocument;

    if (!transitionDocument.startViewTransition) {
      setScreen(nextScreen);
      return;
    }

    transitionDocument.startViewTransition(() => {
      flushSync(() => setScreen(nextScreen));
    });
  }, []);

  const sync = useCallback(() => {
    const model = modelRef.current;
    setSnapshot({
      ...model,
      enemies: [...model.enemies],
      balls: [...model.balls],
      effects: [...model.effects],
    });
  }, []);

  const setLane = useCallback((lane: number) => {
    const nextLane = clamp(lane, 0, GAME.lanes - 1);
    selectedLaneRef.current = nextLane;
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
      gain.gain.exponentialRampToValueAtTime(0.055, noteStart + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.09);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + 0.1);
    });
  }, []);

  const startGame = useCallback((levelId: LevelId = selectedLevelId, mode: GameMode = "level") => {
    const level = getLevel(levelId);
    modelRef.current = createGameModel(level, "playing", mode);
    previousFrameRef.current = null;
    syncAtRef.current = 0;
    setDecorations(createDecorations());
    setSelectedLevelId(levelId);
    setLane(2);
    navigateTo("game");
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

  const shoot = useCallback(
    (lane = selectedLaneRef.current) => {
      const model = modelRef.current;
      if (model.phase !== "playing" || model.elapsed < model.nextShotAt) return;
      const catTypeId = getLevel(model.levelId).catTypeIds[0];
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
      model.nextShotAt = model.elapsed + GAME.cooldown;
      playSound("roll");
      sync();
    },
    [playSound, setLane, sync],
  );

  const updatePointerLane = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const lane = Math.floor(((event.clientY - bounds.top) / bounds.height) * GAME.lanes);
      setLane(lane);
    },
    [setLane],
  );

  const handleBoardPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      updatePointerLane(event);
      const bounds = event.currentTarget.getBoundingClientRect();
      const lane = Math.floor(((event.clientY - bounds.top) / bounds.height) * GAME.lanes);
      shoot(clamp(lane, 0, GAME.lanes - 1));
    },
    [shoot, updatePointerLane],
  );

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
      setLoadingMessageIndex(Math.floor(Math.random() * LOADING_MESSAGES.length));
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
        const offset = 1 + Math.floor(Math.random() * (LOADING_MESSAGES.length - 1));
        return (current + offset) % LOADING_MESSAGES.length;
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
            lane: Math.floor(Math.random() * GAME.lanes),
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
            ball.targetLane = chooseRicochetLane(ball, model.enemies);
            model.defeated += 1;
            model.combo = model.elapsed - model.lastHitAt < 1.3 ? model.combo + 1 : 1;
            model.bestCombo = Math.max(model.bestCombo, model.combo);
            model.lastHitAt = model.elapsed;
            model.score += 100 + Math.max(0, model.combo - 1) * 35;
            model.effects.push({
              id: Date.now() + enemy.id,
              lane: enemy.lane,
              x: enemy.x,
              label: model.combo > 2 ? `×${model.combo} 连撞!` : "砰!",
              expiresAt: model.elapsed + 0.65,
            });
            playSound("hit");
          }
        }

        model.balls = model.balls.filter((ball) => ball.x < 106);
        if (model.mode === "endless") {
          model.enemies = model.enemies.filter((enemy) => !enemy.defeated);
        }
        model.effects = model.effects.filter((effect) => effect.expiresAt > model.elapsed);
        if (model.elapsed - model.lastHitAt > 1.45) model.combo = 0;

        if (model.mode !== "endless" && model.defeated >= activeLevel.totalEnemies) {
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

  const activeLevel = getLevel(snapshot.levelId);
  const liveEnemies = snapshot.enemies.filter((enemy) => enemy.spawned && !enemy.defeated);
  const progress = (snapshot.defeated / activeLevel.totalEnemies) * 100;
  const displayedProgress = snapshot.mode === "endless" ? 0 : progress;
  const currentBestScore = levelProgress[snapshot.levelId].bestScore;
  const selectedLevel = getLevel(selectedLevelId);
  const selectedCatType = CAT_TYPES[selectedLevel.catTypeIds[0]];
  const selectedEnemyType = ENEMY_TYPES[selectedLevel.enemyTypeIds[0]];

  return (
    <main className="page-shell">
      <div className="wall-doodle wall-doodle-one" aria-hidden="true">✦</div>
      <div className="wall-doodle wall-doodle-two" aria-hidden="true">=^･ω･^=</div>
      {screen !== "loading" && (
        <div className="persistent-corner-frame">
          <CornerDecorations />
        </div>
      )}
      {screen !== "loading" && (
        <div className={`menu-corner-tabs${screen === "main-menu" ? " is-visible" : " is-hidden"}`}>
          <button className="info-button" type="button" onClick={() => navigateTo("about")} aria-label="关于游戏">
            <FaInfoCircle aria-hidden="true" size={24} />
          </button>
          <button className="info-button changelog-button" type="button" onClick={() => navigateTo("changelog")} aria-label="更新日志">
            <FaHistory aria-hidden="true" size={23} />
          </button>
        </div>
      )}

      {screen === "loading" && (
        <section className="game-cabinet loading-page" aria-live="polite" aria-busy={!assetLoadFailed}>
          <div className="loading-paper">
            <span className="pin pin-left" />
            <span className="pin pin-right" />
            {assetLoadFailed && <p>资源加载失败</p>}
            <h1>{assetLoadFailed ? "图片没有到齐" : "等一下!"}</h1>
            <div className="asset-progress" aria-label={`图片加载进度 ${Math.round(assetProgress * 100)}%`}>
              <span style={{ width: `${assetProgress * 100}%` }} />
            </div>
            <strong>{Math.round(assetProgress * 100)}%</strong>
            <small>{assetLoadFailed ? "检查网络后重新加载" : LOADING_MESSAGES[loadingMessageIndex]}</small>
            {assetLoadFailed && (
              <button className="primary-button is-khaki" type="button" onClick={retryAssetLoad}>
                重新加载
              </button>
            )}
          </div>
        </section>
      )}

      {screen === "main-menu" && (
        <section className="game-cabinet front-page" aria-label="花花对战路卡主菜单">
          <div className="front-page-noise" aria-hidden="true" />

          <div className="front-page-layout">
            <VersusArtwork />

            <div className="paper-card main-menu-card">
              <GameWordmark />
              <nav className="main-menu-actions" aria-label="主菜单操作">
                <button className="primary-button" type="button" onClick={goToLevelSelect}>
                  <FaPlay aria-hidden="true" size={22} /> 开始游戏
                </button>
                <div className="menu-secondary-row">
                  <button className="menu-secondary-button endless-button" type="button" onClick={() => openLevelBriefing(LEVELS[0].id, "endless")}>
                    <FaCat aria-hidden="true" size={25} /> 无尽模式
                  </button>
                  <button className="menu-secondary-button" type="button" onClick={() => navigateTo("bestiary")}>
                    <FaBookOpen aria-hidden="true" size={23} /> 图鉴
                  </button>
                </div>
              </nav>
            </div>
          </div>

          <div className="front-page-meta">
            <strong>©2026 Anuluca</strong>
          </div>
        </section>
      )}

      {screen === "level-select" && (
        <section className="game-cabinet level-select-page" aria-label="选择关卡">
          <header className="screen-topbar level-topbar">
            <BackButton onClick={goToMainMenu} />
            <strong>选择关卡</strong>
            <span aria-hidden="true" />
          </header>

          <div className="level-board">
            <div className="level-board-title">
              <span className="tape tape-one" />
              <span className="tape tape-two" />
              <p>第一章</p>
              <h1>魔丸降世</h1>
              <small>共 5 个关卡</small>
            </div>

            <div className="level-grid">
              {LEVELS.map((level, levelIndex) => {
                const isOpen = levelIndex === 0;

                return (
                  <button
                    className={`level-card ${isOpen ? "is-open" : "is-locked"}${levelProgress[level.id].completed ? " is-completed" : ""}`}
                    type="button"
                    key={level.id}
                    onClick={isOpen ? () => openLevelBriefing(level.id) : undefined}
                    disabled={!isOpen}
                  >
                    {isOpen ? (
                      <>
                        <span className="level-number">{level.id}</span>
                        <MatchupPreview level={level} />
                        <strong>{level.name}</strong>
                        <small>最高分 {String(levelProgress[level.id].bestScore).padStart(5, "0")}</small>
                        <div className="level-difficulty" aria-label={`难度 ${level.difficulty} 星`}>
                          <span>难度</span>
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
                        {levelProgress[level.id].completed && <i className="completion-label">已完成</i>}
                      </>
                    ) : (
                      <strong className="locked-sleep">路卡正在睡觉…</strong>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {screen === "level-briefing" && (
        <section className="game-cabinet secondary-page briefing-page" aria-label="准备防守">
          <header className="screen-topbar secondary-topbar">
            <BackButton onClick={briefingMode === "endless" ? goToMainMenu : goToLevelSelect}>
              {briefingMode === "endless" ? "返回主菜单" : "返回选关"}
            </BackButton>
            <strong>{briefingMode === "endless" ? "无尽模式" : `关卡 ${selectedLevel.id}`}</strong>
          </header>
          <div className="secondary-content briefing-content">
            <div className="briefing-sheet">
              <h1>准备防守</h1>
              <p>{briefingMode === "endless" ? "本局阵容" : "本关阵容"}</p>
              <div className="briefing-types">
                {selectedLevel.catTypeIds.map((catTypeId) => {
                  const catType = CAT_TYPES[catTypeId];
                  return (
                    <article className="briefing-type-card" key={catType.id}>
                      <span>使用猫咪</span>
                      <div className="briefing-type-images">
                        {catType.imageAssets.map((src) => <Image key={src} src={src} alt="" width={747} height={900} unoptimized />)}
                      </div>
                      <strong>{catType.name}</strong>
                    </article>
                  );
                })}
                {selectedLevel.enemyTypeIds.map((enemyTypeId) => {
                  const enemyType = ENEMY_TYPES[enemyTypeId];
                  return (
                    <article className="briefing-type-card" key={enemyType.id}>
                      <span>敌人</span>
                      <div className="briefing-type-images">
                        {enemyType.imageAssets.map((src) => <Image key={src} src={src} alt="" width={288} height={237} unoptimized />)}
                      </div>
                      <strong>{enemyType.name}</strong>
                    </article>
                  );
                })}
              </div>
              <button className="primary-button briefing-start" type="button" onClick={() => startGame(selectedLevel.id, briefingMode)}>
                开始！
              </button>
            </div>
          </div>
        </section>
      )}

      {screen === "about" && (
        <section className="game-cabinet secondary-page about-page" aria-label="关于花花对战路卡">
          <header className="screen-topbar secondary-topbar">
            <BackButton onClick={goToMainMenu} />
            <strong>关于游戏</strong>
          </header>
          <div className="secondary-content">
            <div className="info-sheet">
              <GameWordmark />
              <div className="about-grid">
                <article className="about-full-row"><span>游戏设定</span><p>可恶的路卡正在从四面八方进攻花花的猫条，善良的花花蜷缩成球形进行反击，帮小花花守住花窝最后的防线吧</p></article>
                <article className="about-full-row"><span>玩法</span><p>选择跑道并点击发射，清除敌人，别让路卡越过危险线。</p></article>
                <article><span>制作人</span><p>Anuluca</p></article>
                <article><span>相关链接</span><div className="related-actions external-links"><a href="https://github.com/anuluca" target="_blank" rel="noreferrer"><FaGithub aria-hidden="true" size={29} />GitHub</a><a href="https://anuluca.com" target="_blank" rel="noreferrer"><Image src="/assets/anutrium-logo.jpg" alt="" width={1280} height={1280} unoptimized />Anutrium</a></div></article>
              </div>
            </div>
          </div>
        </section>
      )}

      {screen === "changelog" && (
        <section className="game-cabinet secondary-page changelog-page" aria-label="更新日志">
          <header className="screen-topbar secondary-topbar">
            <BackButton onClick={goToMainMenu} />
            <strong>更新日志</strong>
          </header>
          <div className="secondary-content changelog-content">
            <div className="changelog-sheet">
              <h1>更新日志</h1>
              <article className="changelog-entry">
                <header>
                  <strong>v0.1_demo</strong>
                  <time dateTime="2026-08-13">2026/08/13</time>
                </header>
                <p>完成游戏大体框架。</p>
              </article>
            </div>
          </div>
        </section>
      )}

      {screen === "bestiary" && (
        <section className="game-cabinet secondary-page bestiary-page" aria-label="图鉴">
          <header className="screen-topbar secondary-topbar">
            <BackButton onClick={goToMainMenu} />
            <strong>图鉴</strong>
          </header>
          <div className="secondary-content bestiary-modules">
            <button className="bestiary-module cat-module" type="button" onClick={() => navigateTo("cat-catalog")}>
              <Image className="bestiary-single-cat" src="/assets/hua-bowl-1.png" alt="" width={747} height={900} unoptimized />
              <strong>猫咪</strong><small>种类：1/12</small>
            </button>
            <button className="bestiary-module enemy-module" type="button" onClick={() => navigateTo("enemy-catalog")}>
              <Image src={selectedEnemyType.headAsset} alt="" width={288} height={237} unoptimized />
              <strong>敌人</strong><small>种类：1/12</small>
            </button>
          </div>
        </section>
      )}

      {(screen === "cat-catalog" || screen === "enemy-catalog") && (
        <section className="game-cabinet secondary-page catalog-page" aria-label={screen === "cat-catalog" ? "猫咪图鉴" : "敌人图鉴"}>
          <header className="screen-topbar secondary-topbar">
            <BackButton onClick={() => navigateTo("bestiary")}>返回图鉴</BackButton>
            <strong>{screen === "cat-catalog" ? "猫咪列表" : "敌人列表"}</strong>
          </header>
          <div className="secondary-content catalog-list">
            <div className={`catalog-grid${screen === "enemy-catalog" ? " is-enemy-grid" : ""}`}>
              {Array.from({ length: 12 }, (_, index) => {
                const isDiscovered = index === 0;
                const isCat = screen === "cat-catalog";
                return (
                  <article className={`catalog-entry${isCat ? " is-cat" : " is-enemy"}${isDiscovered ? "" : " is-placeholder"}`} key={index}>
                    <div className="catalog-entry-image" aria-hidden="true">
                      {isDiscovered ? (
                        isCat
                          ? selectedCatType.imageAssets.map((src) => <Image key={src} src={src} alt="" width={747} height={900} unoptimized />)
                          : selectedEnemyType.imageAssets.map((src) => <Image key={src} src={src} alt="" width={288} height={237} unoptimized />)
                      ) : <strong>?</strong>}
                    </div>
                    <div>
                      <span>{formatCatalogNumber(index)}</span>
                      <h1>{isDiscovered ? (isCat ? selectedCatType.name : selectedEnemyType.name) : "尚未收录"}</h1>
                      {isDiscovered && <p>{isCat ? selectedCatType.description : selectedEnemyType.description}</p>}
                      {isDiscovered && (isCat
                        ? <small className="position-tag">站位：{selectedCatType.position}</small>
                        : <small className="strength-stars" aria-label={`强度 ${selectedEnemyType.strength} 星`}>强度：{Array.from({ length: 5 }, (_, star) => <i className={star < selectedEnemyType.strength ? "is-active" : ""} key={star}>★</i>)}</small>
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
      <section className="game-cabinet game-page" aria-label="花花对战路卡网页游戏">
        <header className="game-hud">
          <div className="hud-brand-zone">
            <VersusArtwork compact />
            <GameWordmark compact />
          </div>

          <div className="level-progress" aria-label={snapshot.mode === "endless" ? "无尽模式" : `关卡进度 ${Math.round(progress)}%`}>
            <div className="level-copy">
              <span>{snapshot.mode === "endless" ? "无尽模式" : `关卡 ${activeLevel.id}`}</span>
              <strong>{snapshot.mode === "endless" ? "∞" : `${Math.round(progress)}%`}</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${displayedProgress}%` }} />
              <i className="progress-cat" style={{ left: `${clamp(displayedProgress, 3, 96)}%` }}>▲</i>
            </div>
          </div>

          <div className="hud-score-actions">
            <div className="score-block">
              <span>分数</span>
              <strong>{String(snapshot.score).padStart(5, "0")}</strong>
              <small>BEST {String(currentBestScore).padStart(5, "0")}</small>
            </div>
            <div className="hud-actions">
              <button
                className="icon-button"
                type="button"
                onClick={toggleSound}
                aria-label={soundEnabled ? "关闭音效" : "打开音效"}
                title="音效"
              >
                {soundEnabled ? <FaVolumeUp aria-hidden="true" size={20} /> : <FaVolumeMute aria-hidden="true" size={20} />}
              </button>
              <button
                className="icon-button"
                type="button"
                onClick={togglePause}
                disabled={!(["playing", "paused"] as Phase[]).includes(snapshot.phase)}
                aria-label={snapshot.phase === "paused" ? "继续游戏" : "暂停游戏"}
                title="暂停"
              >
                {snapshot.phase === "paused" ? <FaPlay aria-hidden="true" size={18} /> : <FaPause aria-hidden="true" size={18} />}
              </button>
            </div>
          </div>
        </header>

        <div
          className={`battlefield phase-${snapshot.phase}`}
          style={{ "--selected-lane": selectedLane } as CSSProperties}
        >
          <div className="paper-noise" aria-hidden="true" />
          <div className="danger-note" aria-hidden="true">
            <span className="tape tape-one" />
            <span className="tape tape-two" />
            <p>冲过红线则游戏结束</p>
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
            <span className="home-label">花花的窝</span>
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
                      transform: `rotate(${decoration.rotation}deg) scale(${decoration.scale})`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          </div>

          <div
            className="lane-field"
            role="application"
            aria-label="五条保龄球跑道。移动鼠标选择跑道，点击发射。"
            onPointerMove={updatePointerLane}
            onPointerDown={handleBoardPointerDown}
          >
            {Array.from({ length: GAME.lanes }, (_, lane) => (
              <div
                className={`lane ${selectedLane === lane ? "is-selected" : ""}`}
                key={lane}
                aria-hidden="true"
              >
                <span>{lane + 1}</span>
              </div>
            ))}

            <div className="home-line" aria-hidden="true">
              <span>危险线</span>
            </div>

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
                    top: `${((enemy.lane + 0.5) / GAME.lanes) * 100}%`,
                    "--walk-delay": `${-(enemy.id % 5) * 0.09}s`,
                    "--enemy-body-color": enemyType.bodyColor,
                    "--enemy-arm-color": enemyType.armColor,
                  } as CSSProperties}
                  aria-label={`第 ${enemy.lane + 1} 跑道的${enemyType.name}`}
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
                  top: `${((ball.lane + 0.5) / GAME.lanes) * 100}%`,
                  transform: "translate(-50%, -50%)",
                }}
                aria-label="滚动中的花花"
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
                  top: `${((effect.lane + 0.5) / GAME.lanes) * 100}%`,
                }}
                aria-hidden="true"
              >
                <i>✦</i><strong>{effect.label}</strong><i>✦</i>
              </div>
            ))}
          </div>

          {snapshot.combo > 1 && snapshot.phase === "playing" && (
            <div className="combo-badge" aria-live="polite">
              <span>连撞</span>
              <strong>×{snapshot.combo}</strong>
            </div>
          )}

          {snapshot.phase === "paused" && (
            <div className="game-overlay">
              <div className="paper-card result-card">
                <h2>等一下！</h2>
                <p>先喘口气！路卡也被定住了！</p>
                <div className="pause-actions">
                  <button className="primary-button" type="button" onClick={togglePause}><FaPlay aria-hidden="true" size={19} />继续游戏</button>
                  <button className="primary-button is-khaki" type="button" onClick={() => startGame(snapshot.levelId, snapshot.mode ?? "level")}><FaRedoAlt aria-hidden="true" size={19} />重新开始</button>
                  <button className="primary-button is-khaki" type="button" onClick={snapshot.mode === "endless" ? goToMainMenu : goToLevelSelect}>
                    {snapshot.mode === "endless" ? <FaHome aria-hidden="true" size={20} /> : <FaListUl aria-hidden="true" size={19} />}
                    {snapshot.mode === "endless" ? "返回主菜单" : "返回选关"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {snapshot.phase === "victory" && (
            <div className="game-overlay victory-overlay">
              <div className="paper-card result-card">
                <span className="result-stamp">CLEAR!</span>
                <p className="eyebrow">猫窝守住了</p>
                <h2>{activeLevel.id} 通关</h2>
                <div className="result-grid">
                  <span>最终得分<strong>{snapshot.score}</strong></span>
                  <span>最高连撞<strong>×{snapshot.bestCombo}</strong></span>
                  <span>发射次数<strong>{snapshot.shots}</strong></span>
                </div>
                <button className="primary-button" type="button" onClick={() => startGame(snapshot.levelId, "level")}><FaRedoAlt aria-hidden="true" size={19} />再来一局</button>
                <button className="primary-button is-khaki result-secondary-button" type="button" onClick={goToLevelSelect}><FaListUl aria-hidden="true" size={19} />返回选关</button>
              </div>
            </div>
          )}

          {snapshot.phase === "defeat" && (
            <div className="game-overlay defeat-overlay">
              <div className="paper-card result-card">
                <span className="result-stamp bad-stamp">OOPS!</span>
                <p className="eyebrow">有路卡溜进来了</p>
                <h2>{snapshot.mode === "endless" ? "无尽防守结束" : "猫窝失守"}</h2>
                <p>{snapshot.mode === "endless" ? `已赶走 ${snapshot.defeated} 个路卡` : `已赶走 ${snapshot.defeated} / ${activeLevel.totalEnemies} 个路卡`}</p>
                <button className="primary-button" type="button" onClick={() => startGame(snapshot.levelId, snapshot.mode ?? "level")}><FaRedoAlt aria-hidden="true" size={19} />重新挑战</button>
                <button className="primary-button is-khaki result-secondary-button" type="button" onClick={snapshot.mode === "endless" ? goToMainMenu : goToLevelSelect}>
                  {snapshot.mode === "endless" ? <FaHome aria-hidden="true" size={20} /> : <FaListUl aria-hidden="true" size={19} />}
                  {snapshot.mode === "endless" ? "返回主菜单" : "返回选关"}
                </button>
              </div>
            </div>
          )}
        </div>

        <footer className="game-controls">
          <p>点击任意跑道即可瞄准并发射 · 建议横屏游玩</p>
        </footer>
      </section>
      )}
    </main>
  );
}
