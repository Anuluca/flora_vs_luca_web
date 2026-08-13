import type { Metadata } from "next";
import { LevelRoster, SeoPageShell } from "@/features/seo/SeoContent";
import { createSeoMetadata } from "@/features/seo/site";

const description = "查看免费网页游戏《花花 vs 路卡》的现有关卡资料、难度、跑道和敌人数量，包括第一章魔丸降世、隐藏关红温禁区和第二章牛马登场。";

export const metadata: Metadata = createSeoMetadata("关卡资料", description, "/levels");

export default function LevelsPage() {
  return (
    <SeoPageShell eyebrow="LEVEL ARCHIVE" title="花花 vs 路卡关卡资料" description={description}>
      <section className="seo-section-card">
        <h2>第一章：魔丸降世</h2>
        <p>第一章包含五个普通关卡和一个隐藏关。完成全部五个普通关卡后解锁隐藏关“红温禁区”；完成隐藏关可获得 PERFECT 标记。</p>
      </section>
      <section>
        <LevelRoster />
      </section>
      <section className="seo-section-card">
        <h2>解锁规则</h2>
        <p>关卡按顺序开放。完成状态和每关最高分绑定，并保存在浏览器 LocalStorage；清理浏览器站点数据会重置进度。</p>
      </section>
    </SeoPageShell>
  );
}
