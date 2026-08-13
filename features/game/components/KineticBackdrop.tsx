"use client";

import { useEffect, useRef } from "react";

type Point = { x: number; y: number };
type Ripple = Point & { bornAt: number; radius: number; opacity: number };

const CELL_SIZE = 62;
const INFLUENCE_RADIUS = 250;
const MAX_WARP = 19;
const DOT_SPACING = 30;
const POINTER_EASING = 0.1;
const MAX_RIPPLES = 4;
const BACKGROUND_COLOR = "#e7dfcb";
const LINE_COLOR = { r: 92, g: 76, b: 64, a: 0.14 };
const ACTIVE_LINE_COLOR = { r: 226, g: 52, b: 86, a: 0.58 };
const ACTIVE_NODE_COLOR = { r: 226, g: 52, b: 86, a: 0.82 };

function interpolate(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function colorBetween(
  start: { r: number; g: number; b: number; a: number },
  end: { r: number; g: number; b: number; a: number },
  amount: number,
) {
  const red = Math.round(interpolate(start.r, end.r, amount));
  const green = Math.round(interpolate(start.g, end.g, amount));
  const blue = Math.round(interpolate(start.b, end.b, amount));
  const alpha = interpolate(start.a, end.a, amount);
  return `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(3)})`;
}

/**
 * 游戏框外的交互式纸色网格。静态纸纹缓存到离屏 Canvas，网格坐标复用
 * Float32Array；鼠标停止且涟漪结束后停止 RAF，避免背景持续占用 CPU/GPU。
 */
export function KineticBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const staticCanvas = document.createElement("canvas");
    const staticContext = staticCanvas.getContext("2d");
    if (!staticContext) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = { x: -9999, y: -9999 };
    const targetPointer = { x: -9999, y: -9999 };
    const ripples: Ripple[] = [];
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let columns = 0;
    let rows = 0;
    let cellWidth = 0;
    let cellHeight = 0;
    let pointX = new Float32Array(0);
    let pointY = new Float32Array(0);
    let proximity = new Float32Array(0);
    let frameId = 0;
    let resizeFrameId = 0;
    let needsPointerAnimation = false;

    const rebuildGridBuffers = () => {
      columns = Math.max(2, Math.ceil(width / CELL_SIZE)) + 1;
      rows = Math.max(2, Math.ceil(height / CELL_SIZE)) + 1;
      cellWidth = width / (columns - 1);
      cellHeight = height / (rows - 1);
      const pointCount = columns * rows;
      pointX = new Float32Array(pointCount);
      pointY = new Float32Array(pointCount);
      proximity = new Float32Array(pointCount);
    };

    const paintStaticPaper = () => {
      staticContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      staticContext.fillStyle = BACKGROUND_COLOR;
      staticContext.fillRect(0, 0, width, height);
      staticContext.fillStyle = "rgba(83, 66, 52, 0.055)";
      for (let x = DOT_SPACING / 2; x < width; x += DOT_SPACING) {
        for (let y = DOT_SPACING / 2; y < height; y += DOT_SPACING) {
          staticContext.beginPath();
          staticContext.arc(x, y, 0.75, 0, Math.PI * 2);
          staticContext.fill();
        }
      }
    };

    const calculateWarpedPoint = (
      gridX: number,
      gridY: number,
      column: number,
      row: number,
      index: number,
    ) => {
      const edgeMargin = 1.5;
      const columnPin = Math.min(column / edgeMargin, (columns - 1 - column) / edgeMargin, 1);
      const rowPin = Math.min(row / edgeMargin, (rows - 1 - row) / edgeMargin, 1);
      const pin = columnPin * columnPin * rowPin * rowPin;
      const pointerX = gridX - pointer.x;
      const pointerY = gridY - pointer.y;
      const distance = Math.hypot(pointerX, pointerY);
      proximity[index] = Math.max(0, 1 - distance / INFLUENCE_RADIUS) * pin;
      let rippleX = 0;
      let rippleY = 0;

      for (const ripple of ripples) {
        const deltaX = gridX - ripple.x;
        const deltaY = gridY - ripple.y;
        const rippleDistance = Math.hypot(deltaX, deltaY);
        const distanceFromWave = rippleDistance - ripple.radius;
        const waveWidth = 52;
        if (Math.abs(distanceFromWave) >= waveWidth) continue;
        const strength = (1 - Math.abs(distanceFromWave) / waveWidth) * ripple.opacity * 13 * pin;
        const angle = Math.atan2(deltaY, deltaX);
        const direction = distanceFromWave < 0 ? 1 : -1;
        rippleX += Math.cos(angle) * strength * direction;
        rippleY += Math.sin(angle) * strength * direction;
      }

      if (distance >= INFLUENCE_RADIUS || distance === 0 || pin === 0) {
        pointX[index] = gridX + rippleX;
        pointY[index] = gridY + rippleY;
        return;
      }

      const normalizedDistance = distance / INFLUENCE_RADIUS;
      const easing = normalizedDistance < 0.01
        ? 0
        : (1 - normalizedDistance) ** 2 * Math.min(1, distance / 60);
      const warp = easing * MAX_WARP * pin;
      const angle = Math.atan2(pointerY, pointerX);
      pointX[index] = gridX - Math.cos(angle) * warp + rippleX;
      pointY[index] = gridY - Math.sin(angle) * warp + rippleY;
    };

    const drawLine = (startIndex: number, endIndex: number) => {
      const average = (proximity[startIndex] + proximity[endIndex]) / 2;
      const activeAmount = average * average * (3 - 2 * average);
      context.beginPath();
      context.moveTo(pointX[startIndex], pointY[startIndex]);
      context.lineTo(pointX[endIndex], pointY[endIndex]);
      context.strokeStyle = colorBetween(LINE_COLOR, ACTIVE_LINE_COLOR, activeAmount);
      context.lineWidth = interpolate(0.75, 1.45, activeAmount);
      context.stroke();
    };

    const draw = (now: number) => {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(staticCanvas, 0, 0);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      for (let index = ripples.length - 1; index >= 0; index -= 1) {
        const ripple = ripples[index];
        // rAF 回调可能复用当前帧开始时的时间戳，短暂早于 pointerdown 中的
        // performance.now()。年龄必须钳制到 0，避免 Canvas arc 收到负半径。
        const age = Math.max(0, (now - ripple.bornAt) / 1000);
        ripple.radius = Math.max(0, age * 310);
        ripple.opacity = Math.max(0, 1 - age * 1.05);
        if (ripple.opacity === 0) ripples.splice(index, 1);
      }

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const index = row * columns + column;
          calculateWarpedPoint(column * cellWidth, row * cellHeight, column, row, index);
        }
      }

      context.lineCap = "butt";
      for (let row = 0; row < rows; row += 1) {
        const rowOffset = row * columns;
        for (let column = 0; column < columns - 1; column += 1) {
          drawLine(rowOffset + column, rowOffset + column + 1);
        }
      }
      for (let column = 0; column < columns; column += 1) {
        for (let row = 0; row < rows - 1; row += 1) {
          const startIndex = row * columns + column;
          drawLine(startIndex, startIndex + columns);
        }
      }

      for (let index = 0; index < pointX.length; index += 1) {
        const amount = proximity[index] ** 2 * (3 - 2 * proximity[index]);
        const radius = interpolate(1.35, 2.85, amount);
        if (amount > 0.28) {
          const glow = context.createRadialGradient(
            pointX[index],
            pointY[index],
            0,
            pointX[index],
            pointY[index],
            radius + 5,
          );
          glow.addColorStop(0, `rgba(226, 52, 86, ${(amount * 0.28).toFixed(3)})`);
          glow.addColorStop(1, "rgba(226, 52, 86, 0)");
          context.fillStyle = glow;
          context.beginPath();
          context.arc(pointX[index], pointY[index], radius + 5, 0, Math.PI * 2);
          context.fill();
        }
        context.fillStyle = colorBetween(
          { r: 82, g: 67, b: 56, a: 0.2 },
          ACTIVE_NODE_COLOR,
          amount,
        );
        context.beginPath();
        context.arc(pointX[index], pointY[index], radius, 0, Math.PI * 2);
        context.fill();
      }

      for (const ripple of ripples) {
        context.strokeStyle = `rgba(226, 52, 86, ${(ripple.opacity * 0.34).toFixed(3)})`;
        context.lineWidth = 1.4;
        context.beginPath();
        context.arc(ripple.x, ripple.y, Math.max(0, ripple.radius), 0, Math.PI * 2);
        context.stroke();
      }
    };

    const animate = (now: number) => {
      frameId = 0;
      if (needsPointerAnimation) {
        pointer.x = interpolate(pointer.x, targetPointer.x, POINTER_EASING);
        pointer.y = interpolate(pointer.y, targetPointer.y, POINTER_EASING);
        needsPointerAnimation = Math.hypot(pointer.x - targetPointer.x, pointer.y - targetPointer.y) > 0.25;
      }
      draw(now);
      if (needsPointerAnimation || ripples.length > 0) frameId = window.requestAnimationFrame(animate);
    };

    const requestDraw = () => {
      if (!frameId && !document.hidden) frameId = window.requestAnimationFrame(animate);
    };

    const resize = () => {
      resizeFrameId = 0;
      width = window.innerWidth;
      height = window.innerHeight;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      staticCanvas.width = canvas.width;
      staticCanvas.height = canvas.height;
      rebuildGridBuffers();
      paintStaticPaper();
      draw(performance.now());
    };

    const scheduleResize = () => {
      if (!resizeFrameId) resizeFrameId = window.requestAnimationFrame(resize);
    };

    const movePointer = (event: PointerEvent) => {
      if (reducedMotion.matches || event.pointerType === "touch") return;
      if (pointer.x < -1000) {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
      }
      targetPointer.x = event.clientX;
      targetPointer.y = event.clientY;
      needsPointerAnimation = true;
      requestDraw();
    };

    const addRipple = (event: PointerEvent) => {
      if (reducedMotion.matches) return;
      if (ripples.length >= MAX_RIPPLES) ripples.shift();
      ripples.push({ x: event.clientX, y: event.clientY, radius: 0, opacity: 1, bornAt: performance.now() });
      requestDraw();
    };

    const handleVisibility = () => {
      if (document.hidden && frameId) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      } else if (!document.hidden) requestDraw();
    };

    const handleMotionPreference = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
      needsPointerAnimation = false;
      ripples.length = 0;
      pointer.x = targetPointer.x;
      pointer.y = targetPointer.y;
      draw(performance.now());
    };

    resize();
    window.addEventListener("resize", scheduleResize);
    window.addEventListener("pointermove", movePointer, { passive: true });
    window.addEventListener("pointerdown", addRipple, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    reducedMotion.addEventListener("change", handleMotionPreference);

    return () => {
      window.removeEventListener("resize", scheduleResize);
      window.removeEventListener("pointermove", movePointer);
      window.removeEventListener("pointerdown", addRipple);
      document.removeEventListener("visibilitychange", handleVisibility);
      reducedMotion.removeEventListener("change", handleMotionPreference);
      if (frameId) window.cancelAnimationFrame(frameId);
      if (resizeFrameId) window.cancelAnimationFrame(resizeFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="kinetic-backdrop" aria-hidden="true" />;
}
