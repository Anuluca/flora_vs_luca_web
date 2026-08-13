"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type InstallHint = "ios" | "safari" | "browser" | null;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type StandaloneNavigator = Navigator & { standalone?: boolean };

function isRunningStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: window-controls-overlay)").matches
    || (navigator as StandaloneNavigator).standalone === true;
}

/**
 * 统一维护 PWA 安装状态。Chromium 使用原生安装弹窗，Safari 等没有安装事件的
 * 浏览器回退为操作指引；监听器从游戏加载页开始常驻，避免错过一次性的安装事件。
 */
export function usePwaInstall() {
  const installPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canPromptInstall, setCanPromptInstall] = useState(false);
  const [installed, setInstalled] = useState(() => (
    typeof window !== "undefined" && isRunningStandalone()
  ));
  const [installHint, setInstallHint] = useState<InstallHint>(null);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      installPromptRef.current = event as BeforeInstallPromptEvent;
      setCanPromptInstall(true);
      setInstallHint(null);
    };
    const handleInstalled = () => {
      installPromptRef.current = null;
      setCanPromptInstall(false);
      setInstallHint(null);
      setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    // PWA 只允许在安全上下文注册；本机 localhost 也属于安全上下文。
    if ("serviceWorker" in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    const installPrompt = installPromptRef.current;
    if (installPrompt) {
      installPromptRef.current = null;
      setCanPromptInstall(false);
      setInstallHint(null);
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      return;
    }

    const userAgent = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/i.test(userAgent);
    const isSafari = /Safari/i.test(userAgent) && !/Chrome|CriOS|Edg|OPR|Firefox|FxiOS/i.test(userAgent);
    setInstallHint(isIos ? "ios" : isSafari ? "safari" : "browser");
  }, []);

  return { canPromptInstall, installed, installHint, install };
}
