"use client";

import { useEffect, useRef } from "react";

type BalloonColor = { base: string; light: string; dark: string };

type Balloon = {
  x: number;
  y: number;
  radius: number;
  speed: number;
  angle: number;
  wobbleSpeed: number;
  color: BalloonColor;
  popped: boolean;
  respawnAt: number;
  previousX: number;
  tailMiddleY: number;
  tailEndY: number;
  tailMiddleVelocity: number;
  tailEndVelocity: number;
};

type Particle = {
  x: number;
  y: number;
  radius: number;
  speedX: number;
  speedY: number;
  opacity: number;
  color: string;
};

// 参考实现同时绘制 30 个气球；按需求将出现频率降低一半。
const BALLOON_COUNT = 15;
// 以 60 FPS 作为运动速度基准；实际绘制跟随 requestAnimationFrame，避免阈值误差导致隔帧。
const FRAME_DURATION = 1000 / 60;
const PORTRAIT_MOBILE_QUERY = "(max-width: 767px) and (orientation: portrait)";
const BALLOON_COLORS: BalloonColor[] = [
  { base: "#a8423f", light: "#d78676", dark: "#682b2b" },
  { base: "#d19a3d", light: "#eed28a", dark: "#846028" },
  { base: "#5d8780", light: "#a7c1b5", dark: "#365b58" },
  { base: "#d4c892", light: "#eee4b7", dark: "#8d8153" },
  { base: "#9b6f60", light: "#d2aa95", dark: "#5d4038" },
  { base: "#b77773", light: "#e0aaa0", dark: "#704442" },
];

/**
 * 大背景气球层。移动速度为参考实现的 50%：原始 0.4–1.4 px/帧，现为
 * 0.2–0.7 px/帧。它与按需刷新的网格分层绘制，避免网格跟随气球持续重算。
 */
export function BalloonBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = { x: -2000, y: -2000 };
    let balloons: Balloon[] = [];
    let particles: Particle[] = [];
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let frameId = 0;
    let resizeFrameId = 0;
    let previousFrameAt = performance.now();

    const randomColor = () => BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)];

    const resetBalloon = (balloon: Balloon, firstLoad: boolean) => {
      balloon.radius = Math.random() * 13 + 27;
      balloon.x = Math.random() * width;
      balloon.y = firstLoad ? Math.random() * height : height + balloon.radius + 130;
      balloon.color = randomColor();
      // 参考速度乘以 0.5：Math.random() * 0.5 + 0.2。
      balloon.speed = Math.random() * 0.5 + 0.2;
      balloon.wobbleSpeed = Math.random() * 0.012 + 0.006;
      balloon.angle = Math.random() * Math.PI * 2;
      balloon.popped = false;
      balloon.respawnAt = 0;
      balloon.previousX = balloon.x;
      balloon.tailMiddleY = balloon.radius + 34;
      balloon.tailEndY = balloon.radius + 94;
      balloon.tailMiddleVelocity = 0;
      balloon.tailEndVelocity = 0;
    };

    const createBalloon = (firstLoad: boolean) => {
      const balloon: Balloon = {
        x: 0,
        y: 0,
        radius: 0,
        speed: 0,
        angle: 0,
        wobbleSpeed: 0,
        color: BALLOON_COLORS[0],
        popped: false,
        respawnAt: 0,
        previousX: 0,
        tailMiddleY: 0,
        tailEndY: 0,
        tailMiddleVelocity: 0,
        tailEndVelocity: 0,
      };
      resetBalloon(balloon, firstLoad);
      return balloon;
    };

    const drawBalloonBody = (radius: number) => {
      context.beginPath();
      context.moveTo(0, radius);
      context.bezierCurveTo(-radius * 1.2, radius * 0.8, -radius * 1.3, -radius * 1.2, 0, -radius * 1.2);
      context.bezierCurveTo(radius * 1.3, -radius * 1.2, radius * 1.2, radius * 0.8, 0, radius);
      context.closePath();
    };

    const drawString = (balloon: Balloon, frameScale: number) => {
      const deltaX = balloon.x - balloon.previousX;
      if (frameScale > 0) {
        balloon.previousX = balloon.x;
        const stiffness = 0.065 * frameScale;
        const damping = 0.87 ** frameScale;
        const middleTarget = balloon.radius + 34 + Math.abs(deltaX) * 7;
        balloon.tailMiddleVelocity += (middleTarget - balloon.tailMiddleY) * stiffness;
        balloon.tailMiddleVelocity *= damping;
        balloon.tailMiddleY += balloon.tailMiddleVelocity;
        const endTarget = balloon.radius + 94 + Math.abs(deltaX) * 11;
        balloon.tailEndVelocity += (endTarget - balloon.tailEndY) * stiffness;
        balloon.tailEndVelocity *= damping;
        balloon.tailEndVelocity += 0.18 * frameScale;
        balloon.tailEndY += balloon.tailEndVelocity;
      }
      const sway = Math.sin(balloon.angle * 1.8) * 5 + deltaX * 3;

      context.beginPath();
      context.moveTo(0, balloon.radius + 4);
      context.bezierCurveTo(
        sway,
        balloon.tailMiddleY * 0.5,
        -sway,
        balloon.tailMiddleY,
        sway * 0.6,
        balloon.tailEndY,
      );
      context.strokeStyle = "rgba(77, 61, 51, 0.32)";
      context.lineWidth = 1.15;
      context.stroke();
    };

    const drawBalloon = (balloon: Balloon, frameScale: number) => {
      context.save();
      context.translate(balloon.x, balloon.y);
      context.rotate(Math.sin(balloon.angle) * 0.055);
      drawString(balloon, frameScale);
      drawBalloonBody(balloon.radius);
      context.fillStyle = balloon.color.base;
      context.strokeStyle = balloon.color.dark;
      context.lineWidth = 1.2;
      context.globalAlpha = 0.66;
      context.fill();
      context.globalAlpha = 0.42;
      context.stroke();

      // 独立高光比每帧创建径向渐变更轻量，也更接近站点的纸片插画风格。
      context.fillStyle = balloon.color.light;
      context.globalAlpha = 0.38;
      context.beginPath();
      context.ellipse(
        -balloon.radius * 0.32,
        -balloon.radius * 0.48,
        balloon.radius * 0.2,
        balloon.radius * 0.36,
        -0.42,
        0,
        Math.PI * 2,
      );
      context.fill();

      context.fillStyle = balloon.color.dark;
      context.globalAlpha = 0.58;
      context.beginPath();
      context.moveTo(-4, balloon.radius - 1);
      context.lineTo(0, balloon.radius + 8);
      context.lineTo(4, balloon.radius - 1);
      context.closePath();
      context.fill();
      context.restore();
    };

    const popBalloon = (balloon: Balloon, now: number) => {
      if (balloon.popped) return;
      balloon.popped = true;
      balloon.respawnAt = now + 1600 + Math.random() * 1600;
      for (let index = 0; index < 12; index += 1) {
        particles.push({
          x: balloon.x,
          y: balloon.y,
          radius: Math.random() * 2.4 + 1,
          speedX: (Math.random() - 0.5) * 7,
          speedY: (Math.random() - 0.5) * 7,
          opacity: 1,
          color: balloon.color.base,
        });
      }
    };

    const updateBalloon = (balloon: Balloon, now: number, frameScale: number) => {
      if (balloon.popped) {
        if (now >= balloon.respawnAt) resetBalloon(balloon, false);
        return;
      }

      balloon.y -= balloon.speed * frameScale;
      balloon.angle += balloon.wobbleSpeed * frameScale;
      balloon.x += Math.sin(balloon.angle * 0.6) * 0.42 * frameScale;
      const pointerDistance = Math.hypot(
        balloon.x - pointer.x,
        balloon.y - balloon.radius * 0.2 - pointer.y,
      );
      if (pointerDistance < balloon.radius + 9) popBalloon(balloon, now);
      if (balloon.y < -balloon.radius - 120) resetBalloon(balloon, false);
      if (!balloon.popped) drawBalloon(balloon, frameScale);
    };

    const updateParticles = (frameScale: number) => {
      for (const particle of particles) {
        particle.x += particle.speedX * frameScale;
        particle.y += particle.speedY * frameScale;
        particle.speedY += 0.12 * frameScale;
        particle.opacity -= 0.022 * frameScale;
        context.save();
        context.globalAlpha = Math.max(0, particle.opacity);
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }
      particles = particles.filter((particle) => particle.opacity > 0);
    };

    const drawFrame = (now: number) => {
      frameId = 0;
      const frameScale = Math.min(3, Math.max(0.25, (now - previousFrameAt) / FRAME_DURATION));
      previousFrameAt = now;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      updateParticles(frameScale);
      for (const balloon of balloons) updateBalloon(balloon, now, frameScale);
      if (!document.hidden && !reducedMotion.matches) frameId = window.requestAnimationFrame(drawFrame);
    };

    const drawStaticFrame = () => {
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      for (const balloon of balloons) drawBalloon(balloon, 0);
    };

    const resize = () => {
      resizeFrameId = 0;
      const previousWidth = width;
      const previousHeight = height;
      const shouldRotateWithGame = window.matchMedia(PORTRAIT_MOBILE_QUERY).matches;
      // 竖屏手机中的游戏画布会顺时针旋转为横向，因此先交换气球画布尺寸，
      // 再交由 CSS 同步旋转，确保气球方向正确且旋转后仍覆盖完整视口。
      width = shouldRotateWithGame ? window.innerHeight : window.innerWidth;
      height = shouldRotateWithGame ? window.innerWidth : window.innerHeight;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      if (balloons.length === 0 || previousWidth === 0 || previousHeight === 0) {
        balloons = Array.from({ length: BALLOON_COUNT }, () => createBalloon(true));
      } else {
        // 旋转手机或缩放窗口时保留气球状态，避免整层随机跳变。
        const scaleX = width / previousWidth;
        const scaleY = height / previousHeight;
        for (const balloon of balloons) {
          balloon.x *= scaleX;
          balloon.y *= scaleY;
          balloon.previousX *= scaleX;
        }
      }
      particles = [];
      drawStaticFrame();
    };

    const scheduleResize = () => {
      if (!resizeFrameId) resizeFrameId = window.requestAnimationFrame(resize);
    };

    const trackPointer = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    };

    const handleVisibility = () => {
      if (document.hidden && frameId) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      } else if (!document.hidden && !reducedMotion.matches && !frameId) {
        previousFrameAt = performance.now();
        frameId = window.requestAnimationFrame(drawFrame);
      }
    };

    const handleMotionPreference = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
      particles = [];
      if (reducedMotion.matches) {
        drawStaticFrame();
        return;
      }
      if (!document.hidden) {
        previousFrameAt = performance.now();
        frameId = window.requestAnimationFrame(drawFrame);
      }
    };

    resize();
    window.addEventListener("resize", scheduleResize);
    window.addEventListener("pointermove", trackPointer, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    reducedMotion.addEventListener("change", handleMotionPreference);
    if (!reducedMotion.matches) frameId = window.requestAnimationFrame(drawFrame);

    return () => {
      window.removeEventListener("resize", scheduleResize);
      window.removeEventListener("pointermove", trackPointer);
      document.removeEventListener("visibilitychange", handleVisibility);
      reducedMotion.removeEventListener("change", handleMotionPreference);
      if (frameId) window.cancelAnimationFrame(frameId);
      if (resizeFrameId) window.cancelAnimationFrame(resizeFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="balloon-backdrop" aria-hidden="true" />;
}
