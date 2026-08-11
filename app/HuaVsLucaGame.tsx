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
  totalEnemies: 18,
  enemySpeed: 3.6,
  ballSpeed: 39,
  ballLaneSpeed: 4.5,
  cooldown: 0.62,
  homeLine: 18.5,
} as const;

type Phase = "menu" | "playing" | "paused" | "victory" | "defeat";
type Screen = "main-menu" | "level-select" | "game";

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
  angle: number;
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
 * 每局重新生成敌人轨道与出现时间。总量保持为 18，避免无限刷怪，
 * 同时限制同一轨道连续出现，保证保龄球弹射路线有可读性。
 */
function createEnemySchedule(): Enemy[] {
  let previousLane = -1;
  let repeated = 0;

  return Array.from({ length: GAME.totalEnemies }, (_, index) => {
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

function createModel(phase: Phase = "menu"): GameModel {
  return {
    phase,
    elapsed: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    defeated: 0,
    shots: 0,
    nextShotAt: 0,
    lastHitAt: -10,
    enemies: createEnemySchedule(),
    balls: [],
    effects: [],
  };
}

function createDecorations(): Decoration[] {
  const count = Math.random() > 0.5 ? 6 : 5;

  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    x: 7 + (index % 3) * 28 + Math.random() * 7,
    y: 5 + Math.floor(index / 3) * 39 + Math.random() * 9,
    rotation: -13 + Math.random() * 26,
    scale: 0.82 + Math.random() * 0.24,
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
  const [screen, setScreen] = useState<Screen>("main-menu");
  const [selectedLane, setSelectedLane] = useState(2);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [bestScore, setBestScore] = useState(0);
  const [decorations, setDecorations] = useState<Decoration[]>(initialDecorations);

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

  const startGame = useCallback(() => {
    modelRef.current = createModel("playing");
    previousFrameRef.current = null;
    syncAtRef.current = 0;
    setDecorations(createDecorations());
    setLane(2);
    setScreen("game");
    playSound("roll");
    sync();
  }, [playSound, setLane, sync]);

  const goToMainMenu = useCallback(() => {
    modelRef.current = createModel("menu");
    previousFrameRef.current = null;
    setScreen("main-menu");
    sync();
  }, [sync]);

  const goToLevelSelect = useCallback(() => {
    modelRef.current = createModel("menu");
    previousFrameRef.current = null;
    setScreen("level-select");
    sync();
  }, [sync]);

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
        angle: 0,
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
    const saved = Number(window.localStorage.getItem("hua-vs-luca-best") ?? 0);
    const timer = window.setTimeout(() => {
      if (Number.isFinite(saved)) setBestScore(saved);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", " "].includes(event.key)) event.preventDefault();

      if (screen === "main-menu") {
        if (event.key === " " || event.key === "Enter") goToLevelSelect();
        return;
      }

      if (screen === "level-select") {
        if (event.key === " " || event.key === "Enter") startGame();
        else if (event.key === "Escape") goToMainMenu();
        return;
      }

      if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
        setLane(selectedLaneRef.current - 1);
      } else if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
        setLane(selectedLaneRef.current + 1);
      } else if (event.key === " " || event.key === "Enter") {
        shoot();
      } else if (event.key === "Escape" || event.key.toLowerCase() === "p") {
        togglePause();
      } else if (event.key.toLowerCase() === "m") {
        toggleSound();
      }
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToLevelSelect, goToMainMenu, screen, setLane, shoot, startGame, togglePause, toggleSound]);

  useEffect(() => {
    const tick = (timestamp: number) => {
      const model = modelRef.current;
      const previous = previousFrameRef.current ?? timestamp;
      const delta = Math.min((timestamp - previous) / 1000, 0.05);
      previousFrameRef.current = timestamp;

      if (model.phase === "playing") {
        model.elapsed += delta;

        for (const enemy of model.enemies) {
          if (!enemy.spawned && enemy.spawnAt <= model.elapsed) enemy.spawned = true;
          if (enemy.spawned && !enemy.defeated) {
            enemy.x -= GAME.enemySpeed * delta * (1 + enemy.variant * 0.035);
          }
        }

        for (const ball of model.balls) {
          ball.x += GAME.ballSpeed * delta;
          ball.angle += 430 * delta;

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

        if (model.defeated >= GAME.totalEnemies) {
          model.phase = "victory";
          const nextBest = Math.max(bestScore, model.score);
          setBestScore(nextBest);
          window.localStorage.setItem("hua-vs-luca-best", String(nextBest));
          playSound("win");
        } else if (
          model.enemies.some(
            (enemy) => enemy.spawned && !enemy.defeated && enemy.x <= GAME.homeLine,
          )
        ) {
          model.phase = "defeat";
          playSound("lose");
        }

        if (timestamp - syncAtRef.current > 33 || model.phase !== "playing") {
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
  }, [bestScore, playSound, sync]);

  const liveEnemies = snapshot.enemies.filter((enemy) => enemy.spawned && !enemy.defeated);
  const remaining = GAME.totalEnemies - snapshot.defeated;
  const progress = (snapshot.defeated / GAME.totalEnemies) * 100;
  const cooldown = clamp(
    1 - Math.max(0, snapshot.nextShotAt - snapshot.elapsed) / GAME.cooldown,
    0,
    1,
  );
  const statusText =
    snapshot.phase === "playing"
      ? `剩余 ${remaining} 个路卡`
      : snapshot.phase === "paused"
        ? "游戏已暂停"
        : snapshot.phase === "victory"
          ? "1-1 通关"
          : snapshot.phase === "defeat"
            ? "猫窝失守"
            : "等待开始";

  return (
    <main className="page-shell">
      <div className="wall-doodle wall-doodle-one" aria-hidden="true">✦</div>
      <div className="wall-doodle wall-doodle-two" aria-hidden="true">=^･ω･^=</div>

      {screen === "main-menu" && (
        <section className="game-cabinet front-page" aria-label="花花对战路卡主菜单">
          <div className="front-page-noise" aria-hidden="true" />
          <header className="screen-topbar">
            <span>HUĀHUĀ DEFENSE CLUB</span>
            <strong>最高分 {String(bestScore).padStart(5, "0")}</strong>
          </header>

          <div className="front-page-layout">
            <div className="front-art" aria-hidden="true">
              <span className="front-scribble">ROLL!</span>
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
              <i className="motion-line line-one" />
              <i className="motion-line line-two" />
              <i className="motion-line line-three" />
            </div>

            <div className="paper-card main-menu-card">
              <span className="pin pin-left" />
              <span className="pin pin-right" />
              <p className="eyebrow">猫窝保卫战</p>
              <h1>花花 <em>vs</em> 路卡</h1>
              <p className="menu-tagline">滚动花花，弹飞路卡。<br />这次猫窝一个都不能少。</p>
              <nav className="main-menu-actions" aria-label="主菜单操作">
                <button className="primary-button" type="button" onClick={goToLevelSelect}>
                  <span>▶</span> 开始游戏
                </button>
                <button className="menu-secondary-button" type="button" onClick={goToLevelSelect}>
                  选择关卡 <span>→</span>
                </button>
              </nav>
              <div className="menu-rule">
                <span>目标</span>
                <strong>清除全部路卡</strong>
                <i>18 ENEMIES</i>
              </div>
            </div>
          </div>

          <footer className="front-page-footer">
            <span><kbd>ENTER</kbd> 确认</span>
            <span><kbd>↑</kbd><kbd>↓</kbd> 选择跑道</span>
            <span><kbd>SPACE</kbd> 发射花花</span>
          </footer>
        </section>
      )}

      {screen === "level-select" && (
        <section className="game-cabinet level-select-page" aria-label="选择关卡">
          <header className="screen-topbar level-topbar">
            <button type="button" onClick={goToMainMenu} aria-label="返回主菜单">← 返回</button>
            <div>
              <span>CHAPTER 01</span>
              <strong>选择关卡</strong>
            </div>
            <i>猫窝外围</i>
          </header>

          <div className="level-board">
            <div className="level-board-title">
              <span className="tape tape-one" />
              <span className="tape tape-two" />
              <p>第一章</p>
              <h1>路卡来袭</h1>
              <small>目前开放 1 个关卡</small>
            </div>

            <div className="level-grid">
              <button className="level-card is-open" type="button" onClick={startGame}>
                <span className="level-number">1-1</span>
                <div className="level-preview" aria-hidden="true">
                  <Image src="/assets/scratcher-house.png" alt="" width={675} height={900} unoptimized />
                  <Image src="/assets/luca-head.png" alt="" width={288} height={237} unoptimized />
                </div>
                <strong>猫窝前院</strong>
                <small>18 个路卡 · 五条跑道</small>
                <i>可挑战</i>
              </button>

              {["1-2", "1-3", "1-4", "1-5", "1-6"].map((level) => (
                <button className="level-card is-locked" type="button" key={level} disabled>
                  <span className="level-number">{level}</span>
                  <div className="locked-mark" aria-hidden="true">×</div>
                  <strong>尚未开放</strong>
                  <small>等待后续章节</small>
                  <i>LOCKED</i>
                </button>
              ))}
            </div>
          </div>

          <footer className="level-page-footer">
            <span>选择 1-1 开始挑战</span>
            <strong>BEST {String(bestScore).padStart(5, "0")}</strong>
          </footer>
        </section>
      )}

      {screen === "game" && (
      <section className="game-cabinet" aria-label="花花对战路卡网页游戏">
        <header className="game-hud">
          <div className="brand-lockup" aria-label="花花 vs 路卡">
            <span className="brand-kicker">猫窝保卫战</span>
            <span className="brand-title">花花 <i>VS</i> 路卡</span>
          </div>

          <div className="level-progress" aria-label={`关卡进度 ${snapshot.defeated}/${GAME.totalEnemies}`}>
            <div className="level-copy">
              <span>关卡 1-1</span>
              <strong>{snapshot.defeated}/{GAME.totalEnemies}</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${progress}%` }} />
              <i className="progress-cat" style={{ left: `${clamp(progress, 3, 96)}%` }}>▲</i>
            </div>
          </div>

          <div className="score-block">
            <span>分数</span>
            <strong>{String(snapshot.score).padStart(5, "0")}</strong>
            <small>BEST {String(bestScore).padStart(5, "0")}</small>
          </div>

          <div className="hud-actions">
            <button
              className="icon-button"
              type="button"
              onClick={goToLevelSelect}
              aria-label="返回选关"
              title="返回选关"
            >
              ⌂
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={toggleSound}
              aria-label={soundEnabled ? "关闭音效" : "打开音效"}
              title="音效 M"
            >
              {soundEnabled ? "♪" : "×"}
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={togglePause}
              disabled={!(["playing", "paused"] as Phase[]).includes(snapshot.phase)}
              aria-label={snapshot.phase === "paused" ? "继续游戏" : "暂停游戏"}
              title="暂停 P"
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
          <div className="back-wall" aria-hidden="true">
            <span className="tape tape-one" />
            <span className="tape tape-two" />
            <p>滚 动 即 攻 击</p>
          </div>

          <div className="home-zone" aria-hidden="true">
            <span className="home-label">花花的窝</span>
            <Image
              className="scratcher-house"
              src="/assets/scratcher-house.png"
              alt=""
              width={675}
              height={900}
              priority
              unoptimized
            />
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
            aria-label="五条保龄球跑道。上下移动选择跑道，点击或按空格发射。"
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
                  transform: `translate(-50%, -50%) rotate(${ball.angle}deg)`,
                }}
                aria-label="滚动中的花花"
              >
                <Image
                  src={`/assets/hua-bowl-${ball.skin}.png`}
                  alt=""
                  width={747}
                  height={900}
                  unoptimized
                />
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

          {snapshot.phase === "playing" && snapshot.shots < 2 && (
            <div className="tutorial-note" aria-hidden="true">
              <b>点击跑道发射</b>
              <span>或 ↑ ↓ + 空格</span>
            </div>
          )}

          {snapshot.combo > 1 && snapshot.phase === "playing" && (
            <div className="combo-badge" aria-live="polite">
              <span>连撞</span>
              <strong>×{snapshot.combo}</strong>
            </div>
          )}

          {snapshot.phase === "paused" && (
            <div className="game-overlay">
              <div className="paper-card result-card">
                <p className="eyebrow">先喘口气</p>
                <h2>暂停中</h2>
                <p>路卡也被定住了。</p>
                <button className="primary-button" type="button" onClick={togglePause}>继续游戏</button>
                <button className="text-button" type="button" onClick={startGame}>重新开始</button>
                <button className="text-button" type="button" onClick={goToLevelSelect}>返回选关</button>
              </div>
            </div>
          )}

          {snapshot.phase === "victory" && (
            <div className="game-overlay victory-overlay">
              <div className="paper-card result-card">
                <span className="result-stamp">CLEAR!</span>
                <p className="eyebrow">猫窝守住了</p>
                <h2>1-1 通关</h2>
                <div className="result-grid">
                  <span>最终得分<strong>{snapshot.score}</strong></span>
                  <span>最高连撞<strong>×{snapshot.bestCombo}</strong></span>
                  <span>发射次数<strong>{snapshot.shots}</strong></span>
                </div>
                <button className="primary-button" type="button" onClick={startGame}>再来一局</button>
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
                <p>已赶走 {snapshot.defeated} / {GAME.totalEnemies} 个路卡</p>
                <button className="primary-button" type="button" onClick={startGame}>重新挑战</button>
                <button className="text-button" type="button" onClick={goToLevelSelect}>返回选关</button>
              </div>
            </div>
          )}
        </div>

        <footer className="game-controls">
          <div className="mobile-lane-controls" aria-label="移动端控制">
            <button type="button" onClick={() => setLane(selectedLane - 1)} aria-label="上一条跑道">↑</button>
            <div><span>跑道</span><strong>{selectedLane + 1}</strong></div>
            <button type="button" onClick={() => setLane(selectedLane + 1)} aria-label="下一条跑道">↓</button>
          </div>
          <button
            className="launch-button"
            type="button"
            onClick={() => shoot()}
            disabled={snapshot.phase !== "playing" || cooldown < 1}
            aria-label="发射花花"
            style={{ "--charge": `${cooldown * 100}%` } as CSSProperties}
          >
            <span>发射花花</span>
            <i>{cooldown >= 1 ? "READY" : "滚动中"}</i>
          </button>
          <div className="status-strip" aria-live="polite">
            <span className={`status-dot phase-${snapshot.phase}`} />
            <strong>{statusText}</strong>
            <small>冲过红线即失败</small>
          </div>
        </footer>
      </section>
      )}

      {screen === "game" && (
        <p className="page-note">点击任意跑道即可瞄准并发射 · 建议横屏游玩</p>
      )}
    </main>
  );
}
