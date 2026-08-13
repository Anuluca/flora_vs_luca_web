import Image from "next/image";
import { ENEMY_TYPES } from "../../config";

type LucaAvatarProps = {
  priority?: boolean;
};

/** 路卡头像目前只展示战斗模型的头部素材。 */
export function LucaAvatar({ priority = false }: LucaAvatarProps) {
  return (
    <div className="enemy-avatar-canvas luca-avatar-canvas">
      <Image
        className="enemy-avatar-image"
        src={ENEMY_TYPES.luca.headAsset}
        alt=""
        width={288}
        height={237}
        priority={priority}
        unoptimized
      />
    </div>
  );
}
