"use client";

import Image from "next/image";
import { FaArrowLeft } from "react-icons/fa";
import { CAT_TYPES, ENEMY_TYPES, localize, type Level, type Locale } from "../config";
import { UI_COPY } from "../i18n";

export function GameWordmark({ compact = false, locale }: { compact?: boolean; locale: Locale }) {
  const copy = UI_COPY[locale];
  return (
    <div className={`game-wordmark${compact ? " is-compact" : ""}`} aria-label={`${copy.flora} VS ${copy.luca}`}>
      <span>{copy.flora}</span><em>VS</em><span>{copy.luca}</span>
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
  return (
    <div className={`versus-artwork${compact ? " is-compact" : ""}`} aria-hidden="true">
      <Image
        className="versus-hua"
        src="/assets/hua-bowl-1.png"
        alt=""
        width={637}
        height={900}
        priority={!compact}
        unoptimized
      />
      <div className="versus-word">VS</div>
      <div className="versus-luca">
        <i className="versus-arm versus-arm-back" />
        <Image src="/assets/luca-head.png" alt="" width={288} height={237} priority={!compact} unoptimized />
        <span />
        <i className="versus-arm versus-arm-front" />
      </div>
    </div>
  );
}

export function MatchupPreview({ level, locale }: { level: Level; locale: Locale }) {
  const catType = CAT_TYPES[level.catTypeIds[0]];
  const enemyType = ENEMY_TYPES[level.enemyTypeIds[0]];

  return (
    <div className="matchup-preview" aria-label={`${localize(catType.name, locale)} VS ${localize(enemyType.name, locale)}`}>
      <div className="matchup-cat-group" aria-hidden="true">
        {catType.previewAssets.map((src, index) => (
          <Image
            className={`matchup-hua matchup-hua-${index + 1}`}
            key={`${catType.id}-${src}-${index}`}
            src={src}
            alt=""
            width={747}
            height={900}
            unoptimized
          />
        ))}
      </div>
      <strong className="matchup-vs" aria-hidden="true">VS</strong>
      <Image
        className="matchup-luca"
        src={enemyType.headAsset}
        alt=""
        width={288}
        height={237}
        unoptimized
      />
    </div>
  );
}

export function CornerDecorations() {
  return (
    <div className="corner-decorations" aria-hidden="true">
      <Image className="corner-luca" src="/assets/luca-head.png" alt="" width={288} height={237} unoptimized />
      <Image className="corner-hua" src="/assets/hua-bowl-2.png" alt="" width={747} height={900} unoptimized />
    </div>
  );
}
