import Image from "next/image";
import { ENEMY_TYPES, type EnemyTypeId } from "../config";

type EnemyModelProps = {
  typeId: EnemyTypeId;
  damaged?: boolean;
  death?: boolean;
  priority?: boolean;
};

/**
 * 敌人的统一拼装模型。
 *
 * 战斗、死亡散落和主菜单只负责提供容器及动画，本组件统一部件素材与
 * 绘制顺序，避免同一种敌人在不同页面出现不同造型。调整头部装备位置时，
 * 同步检查对应 EnemyAvatar，保证选关、准备页和图鉴头像一致。
 */
export function EnemyModel({ typeId, damaged = false, death = false, priority = false }: EnemyModelProps) {
  const enemyType = ENEMY_TYPES[typeId] ?? ENEMY_TYPES.luca;
  const equipment = "equipmentAssets" in enemyType ? enemyType.equipmentAssets : null;

  return (
    <>
      <Image className="enemy-part enemy-leg enemy-leg-left" src={enemyType.partAssets.leg} alt="" width={346} height={843} priority={priority} unoptimized />
      <Image className="enemy-part enemy-leg enemy-leg-right" src={enemyType.partAssets.leg} alt="" width={346} height={843} priority={priority} unoptimized />
      <Image className="enemy-part enemy-tail" src={enemyType.partAssets.tail} alt="" width={707} height={548} priority={priority} unoptimized />
      <Image className="enemy-part enemy-arm enemy-arm-right" src={enemyType.partAssets.hand} alt="" width={803} height={361} priority={priority} unoptimized />
      <Image className="enemy-part enemy-body" src={enemyType.partAssets.body} alt="" width={1048} height={1065} priority={priority} unoptimized />
      <Image className="enemy-part enemy-arm enemy-arm-left" src={enemyType.partAssets.hand} alt="" width={803} height={361} priority={priority} unoptimized />
      <Image
        className={death ? "enemy-death-head" : "enemy-head"}
        src={enemyType.headAsset}
        alt=""
        width={288}
        height={237}
        priority={priority}
        unoptimized
      />
      {equipment && (
        <>
          <Image
            className={`enemy-accessory enemy-accessory-glasses${damaged ? " is-broken" : ""}`}
            src={damaged ? equipment.brokenGlasses : equipment.glasses}
            alt=""
            width={533}
            height={435}
            priority={priority}
            unoptimized
          />
          {!damaged && (
            <Image
              className="enemy-accessory enemy-accessory-laptop"
              src={equipment.laptop}
              alt=""
              width={798}
              height={649}
              priority={priority}
              unoptimized
            />
          )}
          {damaged && !death && (
            <Image
              className="enemy-accessory enemy-accessory-laptop is-dropping"
              src={equipment.laptop}
              alt=""
              width={798}
              height={649}
              priority={priority}
              unoptimized
            />
          )}
        </>
      )}
    </>
  );
}
