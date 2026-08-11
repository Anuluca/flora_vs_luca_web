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

const GAME = {
  lanes: 5,
  ballSpeed: 39,
  ballLaneSpeed: 4.5,
  cooldown: 0.62,
  homeLine: 18.5,
} as const;

type LevelConfig = {
  id: `1-${number}`;
  name: string;
  description: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  totalEnemies: number;
  enemySpeed: number;
  huaSkins: readonly (1 | 2)[];
};

/**
 * 所有关卡的展示信息与游戏参数集中维护，选关页和游戏逻辑共用同一份数据，
 * 避免界面文案、敌人数量与实际难度分别散落在组件中。
 */
const LEVELS = [
  { id: "1-1", name: "猫窝前院", description: "初次迎战", difficulty: 1, totalEnemies: 18, enemySpeed: 3.6, huaSkins: [1, 2, 1] },
  { id: "1-2", name: "客厅防线", description: "快速来袭", difficulty: 2, totalEnemies: 20, enemySpeed: 3.85, huaSkins: [2, 1, 2] },
  { id: "1-3", name: "走廊追击", description: "连续夹击", difficulty: 3, totalEnemies: 22, enemySpeed: 4.1, huaSkins: [1, 2, 1] },
  { id: "1-4", name: "阳台乱斗", description: "高速攻防", difficulty: 4, totalEnemies: 24, enemySpeed: 4.35, huaSkins: [2, 1, 2] },
  { id: "1-5", name: "终极守卫", description: "路卡总攻", difficulty: 5, totalEnemies: 26, enemySpeed: 4.6, huaSkins: [1, 2, 1] },
] as const satisfies readonly LevelConfig[];

type LevelId = (typeof LEVELS)[number]["id"];
type LevelProgress = Record<LevelId, { bestScore: number; completed: boolean }>;

const LEVEL_PROGRESS_STORAGE_KEY = "hua-vs-luca-level-progress-v1";

function createEmptyLevelProgress(): LevelProgress {
  return Object.fromEntries(
    LEVELS.map((level) => [level.id, { bestScore: 0, completed: false }]),
  ) as LevelProgress;
}

function getLevel(levelId: LevelId): LevelConfig {
  return LEVELS.find((level) => level.id === levelId) ?? LEVELS[0];
}

const GAME_ASSET_URLS = [
  "/assets/hua-bowl-1.png",
  "/assets/hua-bowl-2.png",
  "/assets/luca-head.png",
  "/assets/scratcher-house.png",
  "/assets/treat.png",
] as const;

type Phase = "menu" | "playing" | "paused" | "victory" | "defeat";
type Screen = "loading" | "main-menu" | "level-select" | "game";

type Enemy = {
  id: number;
  lane: number;
  x: number;
  spawnAt: number;
  spawned: boolean;
  defeated: boolean;
  variant: number;
};

type Ball = {
  id: number;
  lane: number;
  targetLane: number;
  x: number;
  skin: 1 | 2;
  hitIds: number[];
};

type HitEffect = {
  id: number;
  lane: number;
  x: number;
  label: string;
  expiresAt: number;
};

type GameModel = {
  levelId: LevelId;
  phase: Phase;
  elapsed: number;
  score: number;
  combo: number;
  bestCombo: number;
  defeated: number;
  shots: number;
  nextShotAt: number;
  lastHitAt: number;
  enemies: Enemy[];
  balls: Ball[];
  effects: HitEffect[];
};

type Decoration = {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
};

const initialDecorations: Decoration[] = [
  { id: 1, x: 8, y: 10, rotation: -12, scale: 0.92 },
  { id: 2, x: 35, y: 5, rotation: 8, scale: 1.03 },
  { id: 3, x: 62, y: 14, rotation: -4, scale: 0.88 },
  { id: 4, x: 18, y: 43, rotation: 11, scale: 0.96 },
  { id: 5, x: 49, y: 47, rotation: -9, scale: 1.05 },
  { id: 6, x: 72, y: 37, rotation: 5, scale: 0.86 },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/**
 * 每局按当前关卡配置生成敌人轨道与出现时间，并限制同一轨道连续出现，
 * 保证不同难度使用独立敌人总量的同时，保留弹射路线的可读性。
 */
function createEnemySchedule(level: LevelConfig): Enemy[] {
  let previousLane = -1;
  let repeated = 0;

  return Array.from({ length: level.totalEnemies }, (_, index) => {
    let lane = Math.floor(Math.random() * GAME.lanes);

    if (lane === previousLane) repeated += 1;
    else repeated = 0;

    if (repeated > 1) {
      lane = (lane + 1 + Math.floor(Math.random() * (GAME.lanes - 1))) % GAME.lanes;
      repeated = 0;
    }

    previousLane = lane;

    return {
      id: index + 1,
      lane,
      x: 103 + (index % 3) * 2.2,
      spawnAt: 0.75 + index * 1.08 + Math.random() * 0.32,
      spawned: false,
      defeated: false,
      variant: index % 3,
    };
  });
}

function createModel(level: LevelConfig = LEVELS[0], phase: Phase = "menu"): GameModel {
  return {
    levelId: level.id as LevelId,
    phase,
    elapsed: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    defeated: 0,
    shots: 0,
    nextShotAt: 0,
    lastHitAt: -10,
    enemies: createEnemySchedule(level),
    balls: [],
    effects: [],
  };
}

function createDecorations(): Decoration[] {
  const count = Math.random() > 0.5 ? 6 : 5;
  const clusteredSlots = [
    { x: 29, y: 15 },
    { x: 46, y: 9 },
    { x: 62, y: 17 },
    { x: 34, y: 39 },
    { x: 51, y: 34 },
    { x: 66, y: 42 },
  ];

  return clusteredSlots.slice(0, count).map((slot, index) => ({
    id: index + 1,
    x: slot.x + Math.random() * 3,
    y: slot.y + Math.random() * 3,
    rotation: -18 + Math.random() * 36,
    scale: 0.9 + Math.random() * 0.16,
  }));
}

function chooseRicochetLane(ball: Ball, enemies: Enemy[]) {
  const currentLane = Math.round(ball.lane);
  const liveTargets = enemies
    .filter(
      (enemy) =>
        enemy.spawned &&
        !enemy.defeated &&
        enemy.x > ball.x + 2 &&
        Math.abs(enemy.lane - currentLane) === 1,
    )
    .sort((a, b) => a.x - b.x);

  if (liveTargets[0]) return liveTargets[0].lane;
  if (currentLane === 0) return 1;
  if (currentLane === GAME.lanes - 1) return GAME.lanes - 2;
  return currentLane + (Math.random() > 0.5 ? 1 : -1);
}

export default function HuaVsLucaGame() {
  const [initialModel] = useState<GameModel>(() => createModel());
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
  const [selectedLane, setSelectedLane] = useState(2);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [levelProgress, setLevelProgress] = useState<LevelProgress>(createEmptyLevelProgress);
  const [decorations, setDecorations] = useState<Decoration[]>(initialDecorations);
  const [assetProgress, setAssetProgress] = useState(0);
  const [assetLoadFailed, setAssetLoadFailed] = useState(false);
  const [assetLoadAttempt, setAssetLoadAttempt] = useState(0);

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

  const startGame = useCallback((levelId: LevelId = selectedLevelId) => {
    const level = getLevel(levelId);
    modelRef.current = createModel(level, "playing");
    previousFrameRef.current = null;
    syncAtRef.current = 0;
    setDecorations(createDecorations());
    setSelectedLevelId(levelId);
    setLane(2);
    setScreen("game");
    playSound("roll");
    sync();
  }, [playSound, selectedLevelId, setLane, sync]);

  const goToMainMenu = useCallback(() => {
    modelRef.current = createModel(getLevel(selectedLevelId), "menu");
    previousFrameRef.current = null;
    setScreen("main-menu");
    sync();
  }, [selectedLevelId, sync]);

  const goToLevelSelect = useCallback(() => {
    modelRef.current = createModel(getLevel(selectedLevelId), "menu");
    previousFrameRef.current = null;
    setScreen("level-select");
    sync();
  }, [selectedLevelId, sync]);

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

      setLane(lane);
      model.balls.push({
        id: Date.now() + model.shots,
        lane,
        targetLane: lane,
        x: 20.7,
        skin: Math.random() > 0.5 ? 1 : 2,
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
    const legacyBestScore = Number(window.localStorage.getItem("hua-vs-luca-best") ?? 0);
    const saved = window.localStorage.getItem(LEVEL_PROGRESS_STORAGE_KEY);
    const timer = window.setTimeout(() => {
      try {
        const parsed = saved ? JSON.parse(saved) as Partial<LevelProgress> : {};
        const restored = Object.fromEntries(
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
        setLevelProgress(restored);
        window.localStorage.setItem(LEVEL_PROGRESS_STORAGE_KEY, JSON.stringify(restored));
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
        if (!cancelled) setScreen("main-menu");
      })
      .catch(() => {
        if (!cancelled) setAssetLoadFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [assetLoadAttempt]);

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

        for (const enemy of model.enemies) {
          if (!enemy.spawned && enemy.spawnAt <= model.elapsed) enemy.spawned = true;
          if (enemy.spawned && !enemy.defeated) {
            enemy.x -= activeLevel.enemySpeed * delta * (1 + enemy.variant * 0.035);
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
        model.effects = model.effects.filter((effect) => effect.expiresAt > model.elapsed);
        if (model.elapsed - model.lastHitAt > 1.45) model.combo = 0;

        if (model.defeated >= activeLevel.totalEnemies) {
          model.phase = "victory";
          setLevelProgress((current) => {
            const next = {
              ...current,
              [model.levelId]: {
                bestScore: Math.max(current[model.levelId].bestScore, model.score),
                completed: true,
              },
            };
            window.localStorage.setItem(LEVEL_PROGRESS_STORAGE_KEY, JSON.stringify(next));
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
  const currentBestScore = levelProgress[snapshot.levelId].bestScore;

  return (
    <main className="page-shell">
      <div className="wall-doodle wall-doodle-one" aria-hidden="true">✦</div>
      <div className="wall-doodle wall-doodle-two" aria-hidden="true">=^･ω･^=</div>

      {screen === "loading" && (
        <section className="game-cabinet loading-page" aria-live="polite" aria-busy={!assetLoadFailed}>
          <div className="loading-paper">
            <span className="pin pin-left" />
            <span className="pin pin-right" />
            <p>{assetLoadFailed ? "资源加载失败" : "资源准备中"}</p>
            <h1>{assetLoadFailed ? "图片没有到齐" : "稍等一下！"}</h1>
            <div className="asset-progress" aria-label={`图片加载进度 ${Math.round(assetProgress * 100)}%`}>
              <span style={{ width: `${assetProgress * 100}%` }} />
            </div>
            <strong>{Math.round(assetProgress * 100)}%</strong>
            <small>{assetLoadFailed ? "检查网络后重新加载" : "正在提前加载并解码全部游戏图片"}</small>
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
            <div className="front-art" aria-hidden="true">
              <Image
                className="front-hua"
                src="/assets/hua-bowl-1.png"
                alt=""
                width={637}
                height={900}
                priority
                unoptimized
              />
              <div className="front-versus">VS</div>
              <div className="front-luca">
                <Image src="/assets/luca-head.png" alt="" width={288} height={237} priority unoptimized />
                <span />
              </div>
            </div>

            <div className="paper-card main-menu-card">
              <span className="pin pin-left" />
              <span className="pin pin-right" />
              <h1><span>花花</span><em>VS</em><span>路卡</span></h1>
              <p className="menu-tagline">滚动花花，弹飞路卡。</p>
              <nav className="main-menu-actions" aria-label="主菜单操作">
                <button className="primary-button" type="button" onClick={goToLevelSelect}>
                  <span>▶</span> 开始游戏
                </button>
              </nav>
            </div>
          </div>

          <div className="front-page-meta">
            <span>使用鼠标选择关卡 · 点击跑道发射花花</span>
            <strong>©2026 Anuluca</strong>
          </div>
        </section>
      )}

      {screen === "level-select" && (
        <section className="game-cabinet level-select-page" aria-label="选择关卡">
          <header className="screen-topbar level-topbar">
            <button type="button" onClick={goToMainMenu} aria-label="返回主菜单">← 返回</button>
            <strong>选择关卡</strong>
            <span aria-hidden="true" />
          </header>

          <div className="level-board">
            <div className="level-board-title">
              <span className="tape tape-one" />
              <span className="tape tape-two" />
              <p>第一章</p>
              <h1>路卡来袭</h1>
              <small>共 5 个关卡</small>
            </div>

            <div className="level-grid">
              {LEVELS.map((level) => (
                <button
                  className={`level-card is-open${levelProgress[level.id].completed ? " is-completed" : ""}`}
                  type="button"
                  key={level.id}
                  onClick={() => startGame(level.id)}
                >
                  <span className="level-number">{level.id}</span>
                  <div className="level-avatar-stack" aria-hidden="true">
                    {level.huaSkins.map((skin, index) => (
                      <Image
                        key={`${level.id}-${index}`}
                        src={`/assets/hua-bowl-${skin}.png`}
                        alt=""
                        width={747}
                        height={900}
                        unoptimized
                      />
                    ))}
                  </div>
                  <strong>{level.name}</strong>
                  <small>{level.description} · 最高分 {String(levelProgress[level.id].bestScore).padStart(5, "0")}</small>
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
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {screen === "game" && (
      <section className="game-cabinet game-page" aria-label="花花对战路卡网页游戏">
        <header className="game-hud">
          <div className="brand-lockup" aria-label="花花 vs 路卡">
            <span className="brand-title">花花 <i>VS</i> 路卡</span>
          </div>

          <div className="level-progress" aria-label={`关卡进度 ${Math.round(progress)}%`}>
            <div className="level-copy">
              <span>关卡 {activeLevel.id}</span>
              <strong>{Math.round(progress)}%</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${progress}%` }} />
              <i className="progress-cat" style={{ left: `${clamp(progress, 3, 96)}%` }}>▲</i>
            </div>
          </div>

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
              {soundEnabled ? "♪" : "×"}
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={togglePause}
              disabled={!(["playing", "paused"] as Phase[]).includes(snapshot.phase)}
              aria-label={snapshot.phase === "paused" ? "继续游戏" : "暂停游戏"}
              title="暂停"
            >
              {snapshot.phase === "paused" ? "▶" : "Ⅱ"}
            </button>
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

            {liveEnemies.map((enemy) => (
              <div
                className="luca-enemy"
                data-variant={enemy.variant}
                key={enemy.id}
                style={{
                  left: `${enemy.x}%`,
                  top: `${((enemy.lane + 0.5) / GAME.lanes) * 100}%`,
                  "--walk-delay": `${-(enemy.id % 5) * 0.09}s`,
                } as CSSProperties}
                aria-label={`第 ${enemy.lane + 1} 跑道的路卡`}
              >
                <span className="enemy-shadow" />
                <span className="enemy-leg enemy-leg-left" />
                <span className="enemy-leg enemy-leg-right" />
                <span className="enemy-arm enemy-arm-left" />
                <span className="enemy-arm enemy-arm-right" />
                <span className="enemy-body" />
                <Image src="/assets/luca-head.png" alt="" width={288} height={237} unoptimized />
              </div>
            ))}

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
                    src={`/assets/hua-bowl-${ball.skin}.png`}
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
                  <button className="primary-button" type="button" onClick={togglePause}>继续游戏</button>
                  <button className="primary-button is-khaki" type="button" onClick={() => startGame()}>重新开始</button>
                  <button className="primary-button is-khaki" type="button" onClick={goToLevelSelect}>返回选关</button>
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
                <button className="primary-button" type="button" onClick={() => startGame()}>再来一局</button>
                <button className="text-button" type="button" onClick={goToLevelSelect}>返回选关</button>
              </div>
            </div>
          )}

          {snapshot.phase === "defeat" && (
            <div className="game-overlay defeat-overlay">
              <div className="paper-card result-card">
                <span className="result-stamp bad-stamp">OOPS!</span>
                <p className="eyebrow">有路卡溜进来了</p>
                <h2>猫窝失守</h2>
                <p>已赶走 {snapshot.defeated} / {activeLevel.totalEnemies} 个路卡</p>
                <button className="primary-button" type="button" onClick={() => startGame()}>重新挑战</button>
                <button className="text-button" type="button" onClick={goToLevelSelect}>返回选关</button>
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
