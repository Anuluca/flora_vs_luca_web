"use client";

import Image from "next/image";
import { FaArrowLeft } from "react-icons/fa";
import { CAT_TYPES, ENEMY_TYPES, GAME_UI_ASSETS, localize, type Level, type Locale } from "../config";
import { UI_COPY } from "../i18n";
import { EnemyAvatar } from "./EnemyAvatar";
import { EnemyModel } from "./EnemyModel";

export function GameWordmark({ compact = false, locale }: { compact?: boolean; locale: Locale }) {
  const copy = UI_COPY[locale];
  return (
    <div className={`game-wordmark${compact ? " is-compact" : ""}`} aria-label={`${copy.flora} VS ${copy.luca}`}>
      <span>{copy.flora}</span><em><b>VS</b></em><span>{copy.luca}</span>
    </div>
  );
}

export function BackButton({ children, locale, onClick }: { children?: string; locale: Locale; onClick: () => void }) {
  return (
    <button className="back-button" type="button" onClick={onClick}>
      <FaArrowLeft aria-hidden="true" size={19} /> {children ?? UI_COPY[locale].back}
    </button>
  );
}

export function VersusArtwork({ compact = false }: { compact?: boolean }) {
  const playCharacterHop = (target: HTMLElement) => {
    target.getAnimations().find((animation) => animation.id === "brand-character-hop")?.cancel();

    const animation = target.animate(
      [
        { transform: "translate3d(0, 0, 0)", composite: "add" },
        { transform: "translate3d(0, -18px, 0)", composite: "add", offset: 0.48 },
        { transform: "translate3d(0, 0, 0)", composite: "add" },
      ],
      { duration: 360, easing: "cubic-bezier(.2, .8, .25, 1)" },
    );
    animation.id = "brand-character-hop";
  };

  const handleCharacterKeyDown = (target: HTMLElement, key: string) => {
    if (key === "Enter" || key === " ") playCharacterHop(target);
  };

  return (
    <div className={`versus-artwork${compact ? " is-compact" : ""}`}>
      <Image
        className="versus-hua"
        src={CAT_TYPES["ball-hua"].previewAssets[0]}
        alt="花花"
        width={900}
        height={900}
        priority={!compact}
        unoptimized
        role="button"
        tabIndex={0}
        onClick={(event) => playCharacterHop(event.currentTarget)}
        onKeyDown={(event) => handleCharacterKeyDown(event.currentTarget, event.key)}
      />
      <div className="versus-word">VS</div>
      <div
        className="versus-luca"
        role="button"
        tabIndex={0}
        aria-label="路卡"
        onClick={(event) => playCharacterHop(event.currentTarget)}
        onKeyDown={(event) => handleCharacterKeyDown(event.currentTarget, event.key)}
      >
        <EnemyModel typeId="luca" priority={!compact} />
      </div>
    </div>
  );
}

type MainMenuHeroProps = {
  locale: Locale;
  size: "large" | "small";
};

/** 统一管理标题与双方模型；大尺寸用于主菜单，小尺寸用于游戏 HUD。 */
export function MainMenuHero({ locale, size }: MainMenuHeroProps) {
  if (size === "small") {
    return (
      <div className="main-menu-hero is-small">
        <div className="small-brand-stage">
          <VersusArtwork />
          <div className="main-menu-wordmark">
            <GameWordmark locale={locale} />
            <span className="game-brand-demo">DEMO</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-menu-hero is-large">
      <VersusArtwork />
      <div className="main-menu-wordmark">
        <GameWordmark locale={locale} />
        <span className="game-brand-demo">DEMO</span>
      </div>
    </div>
  );
}

export function MatchupPreview({ level, locale }: { level: Level; locale: Locale }) {
  const previewCatTypes = level.matchupPreview.catTypeIds.map((typeId) => CAT_TYPES[typeId]);
  const previewEnemyTypes = level.matchupPreview.enemyTypeIds.map((typeId) => ENEMY_TYPES[typeId]);

  return (
    <div
      className="matchup-preview"
      aria-label={`${previewCatTypes.map((type) => localize(type.name, locale)).join("、")} VS ${previewEnemyTypes.map((type) => localize(type.name, locale)).join("、")}`}
    >
      <div className="matchup-cat-group" aria-hidden="true">
        {previewCatTypes.map((catType, index) => (
          <Image
            className={`matchup-hua matchup-hua-${index + 1}`}
            key={catType.id}
            src={catType.previewAssets[0]}
            alt=""
            width={900}
            height={900}
            unoptimized
          />
        ))}
      </div>
      <strong className="matchup-vs" aria-hidden="true">VS</strong>
      <div className="matchup-enemy-group">
        {previewEnemyTypes.map((enemyType) => <EnemyAvatar key={enemyType.id} typeId={enemyType.id} />)}
      </div>
    </div>
  );
}

export function CornerDecorations() {
  return (
    <div className="corner-decorations" aria-hidden="true">
      <div className="corner-treats">
        {Array.from({ length: 3 }, (_, index) => (
          <Image key={index} src={GAME_UI_ASSETS.treat} alt="" width={236} height={512} unoptimized />
        ))}
      </div>
    </div>
  );
}
