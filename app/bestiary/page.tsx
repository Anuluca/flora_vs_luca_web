import type { Metadata } from "next";
import { CatRoster, EnemyRoster, SeoPageShell } from "@/features/seo/SeoContent";
import { createSeoMetadata } from "@/features/seo/site";

const description = "查看免费网页游戏《花花 vs 路卡》的猫咪和敌人图鉴，包括球形花花、车轮花花、路卡与牛马路卡的角色设定、强度、速度和战斗特性。";

export const metadata: Metadata = createSeoMetadata("猫咪与敌人图鉴", description, "/bestiary");

export default function BestiaryPage() {
  return (
    <SeoPageShell eyebrow="CATS & ENEMIES" title="猫咪与敌人图鉴" description={description}>
      <section>
        <h2>猫咪</h2>
        <CatRoster />
      </section>
      <section>
        <h2>敌人</h2>
        <EnemyRoster />
      </section>
    </SeoPageShell>
  );
}
