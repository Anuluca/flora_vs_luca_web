"use client";

import Image from "next/image";
import { FaArrowLeft } from "react-icons/fa";
import { CAT_TYPES, ENEMY_TYPES, type Level } from "../config";

export function GameWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`game-wordmark${compact ? " is-compact" : ""}`} aria-label="花花 VS 路卡">
      <span>花花</span><em>VS</em><span>路卡</span>
    </div>
  );
}

export function BackButton({ children = "返回", onClick }: { children?: string; onClick: () => void }) {
  return (
    <button className="back-button" type="button" onClick={onClick}>
      <FaArrowLeft aria-hidden="true" size={19} /> {children}
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

export function MatchupPreview({ level }: { level: Level }) {
  const catType = CAT_TYPES[level.catTypeIds[0]];
  const enemyType = ENEMY_TYPES[level.enemyTypeIds[0]];

  return (
    <div className="matchup-preview" aria-label={`${catType.name} 对战 ${enemyType.name}`}>
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
