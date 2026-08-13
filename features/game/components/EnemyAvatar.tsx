import { ENEMY_TYPES, type EnemyTypeId } from "../config";
import { LucaAvatar } from "./avatars/LucaAvatar";
import { WorkLucaAvatar } from "./avatars/WorkLucaAvatar";

type EnemyAvatarProps = {
  typeId: EnemyTypeId;
  className?: string;
  priority?: boolean;
};

const AVATAR_COMPONENTS = {
  luca: LucaAvatar,
  "work-luca": WorkLucaAvatar,
} as const;

/** 根据敌人配置选择独立头像组件，页面不直接依赖具体头像素材。 */
export function EnemyAvatar({ typeId, className = "", priority = false }: EnemyAvatarProps) {
  const enemyType = ENEMY_TYPES[typeId] ?? ENEMY_TYPES.luca;
  const AvatarComponent = AVATAR_COMPONENTS[enemyType.avatar];

  return (
    <div className={`enemy-avatar enemy-avatar-${enemyType.avatar}${className ? ` ${className}` : ""}`} aria-hidden="true">
      <AvatarComponent priority={priority} />
    </div>
  );
}
