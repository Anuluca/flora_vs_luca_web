import type { Metadata } from "next";
import { SeoPageShell } from "@/features/seo/SeoContent";
import { createSeoMetadata } from "@/features/seo/site";

const description = "了解免费网页游戏《花花 vs 路卡》的拖放操作、跑道防守、连击得分、红温状态、失败条件、无尽模式和通关技巧，快速掌握猫咪防守玩法。";

export const metadata: Metadata = createSeoMetadata("玩法指南", description, "/guide");

export default function GuidePage() {
  return (
    <SeoPageShell eyebrow="HOW TO PLAY" title="花花 vs 路卡玩法指南" description={description}>
      <section className="seo-section-card">
        <h2>基本操作</h2>
        <ol>
          <li>选择一个已开放关卡，在“准备防守”中确认本关猫咪、敌人和数量。</li>
          <li>将底部库存中的猫咪拖到目标跑道，松手后猫咪会沿跑道滚动。</li>
          <li>让花花撞上路卡。敌人越过红色虚线警戒线时，本局失败。</li>
          <li>等待全部敌人出现并将其消灭，即可完成关卡并结算剩余猫咪奖励。</li>
        </ol>
      </section>

      <section className="seo-section-card">
        <h2>猫咪能力</h2>
        <ul>
          <li><strong>球形花花：</strong>命中敌人后会弹向其他跑道，适合制造连续碰撞。</li>
          <li><strong>车轮花花：</strong>沿当前跑道持续前进，适合清理同一路线上的多个敌人。</li>
        </ul>
      </section>

      <section className="seo-section-card">
        <h2>进度、红温与得分</h2>
        <p>顶部进度条表示本关敌人的出场进程，而不是已消灭数量。红色区间为红温阶段，敌人会临时加速。</p>
        <p>连续撞击可以提高得分；完成关卡后，未使用的猫咪会逐只兑换为额外分数。每关最高分与完成状态仅保存在当前浏览器。</p>
      </section>

      <section className="seo-section-card">
        <h2>无尽模式</h2>
        <p>无尽模式没有固定敌人总数，路卡会持续进入跑道。目标是尽可能长时间守住防线并刷新分数。</p>
      </section>
    </SeoPageShell>
  );
}
