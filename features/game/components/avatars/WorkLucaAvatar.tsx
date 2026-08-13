import Image from "next/image";

type WorkLucaAvatarProps = {
  priority?: boolean;
};

/**
 * 牛马路卡头像复用路卡头部，并叠加完整眼镜。
 * 调整完整模型的头部装备时，必须同步校正此头像；电脑属于手持物，不进入头像裁切区域。
 */
export function WorkLucaAvatar({ priority = false }: WorkLucaAvatarProps) {
  return (
    <div className="enemy-avatar-canvas work-luca-avatar">
      <Image
        className="enemy-avatar-image"
        src="https://assets.anuluca.com/otherWebsites/flora-vs-luca/enemies/luca/head.webp"
        alt=""
        width={288}
        height={237}
        priority={priority}
        unoptimized
      />
      <Image
        className="work-luca-avatar-glasses"
        src="https://assets.anuluca.com/otherWebsites/flora-vs-luca/enemies/work-luca/glasses.webp"
        alt=""
        width={533}
        height={435}
        priority={priority}
        unoptimized
      />
    </div>
  );
}
