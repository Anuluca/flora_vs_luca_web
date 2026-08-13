import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageShell } from "@/features/seo/SeoContent";
import { SITE_AUTHOR, SITE_VERSION, createSeoMetadata } from "@/features/seo/site";

const description = "了解免费网页游戏《花花 vs 路卡》的世界观与猫窝防守设定、制作人 Anuluca、当前 Demo 版本、游戏技术形态和开源项目地址。";

export const metadata: Metadata = createSeoMetadata("关于游戏", description, "/about");

export default function AboutPage() {
  return (
    <SeoPageShell eyebrow="ABOUT THE GAME" title="关于花花 vs 路卡" description={description}>
      <section className="seo-section-card">
        <h2>游戏设定</h2>
        <p>可恶的路卡正在从四面八方进攻花花的猫条，善良的花花蜷缩成球形进行反击。帮小花花守住花窝最后的防线吧。</p>
      </section>
      <section className="seo-section-card">
        <h2>制作与版本</h2>
        <p>制作人：{SITE_AUTHOR}</p>
        <p>当前版本：{SITE_VERSION}。这是可直接在现代浏览器运行的免费单人网页游戏。</p>
      </section>
      <section className="seo-section-card">
        <h2>相关链接</h2>
        <ul>
          <li><a href="https://github.com/Anuluca/flora_vs_luca_web" rel="noreferrer">GitHub 项目仓库</a></li>
          <li><a href="https://anuluca.com" rel="noreferrer">Anutrium</a></li>
          <li><Link href="/guide">阅读玩法指南</Link></li>
        </ul>
      </section>
    </SeoPageShell>
  );
}
