import Link from "next/link";
import type { ReactNode } from "react";
import { CAT_TYPES, ENEMY_TYPES, LEVELS, localize } from "@/features/game/config";
import { SEO_PAGES, SITE_AUTHOR, SITE_NAME, SITE_VERSION } from "./site";

export function SeoNav() {
  return (
    <nav className="seo-nav" aria-label="网站内容导航">
      <Link href="/">开始游戏</Link>
      {SEO_PAGES.map((page) => <Link href={page.href} key={page.href}>{page.label}</Link>)}
    </nav>
  );
}

export function HomeSeoContent() {
  return (
    <section className="seo-home-content" aria-labelledby="seo-home-title">
      <div className="seo-home-heading">
        <p>FREE BROWSER GAME · {SITE_VERSION}</p>
        <h1 id="seo-home-title">花花 vs 路卡：Anutrium 网页游戏</h1>
        <p>
          《花花 vs 路卡》是一款纸片拼贴风的免费网页游戏。拖动花花进入跑道，让猫咪蜷成球撞飞不断来袭的路卡，守住猫窝和猫条。无需下载或注册，可直接在电脑与手机浏览器游玩。
        </p>
      </div>

      <SeoNav />

      <div className="seo-summary-grid">
        {SEO_PAGES.map((page) => (
          <article key={page.href}>
            <h2><Link href={page.href}>{page.label}</Link></h2>
            <p>{page.description}</p>
            <Link className="seo-text-link" href={page.href}>查看详情 →</Link>
          </article>
        ))}
      </div>

      <div className="seo-home-facts" aria-label="游戏摘要">
        <p><strong>玩法：</strong>选择跑道并拖放猫咪，利用滚动、弹射和连撞阻止敌人越过警戒线。</p>
        <p><strong>角色：</strong>现有球形花花、车轮花花、路卡和受到攻击后会加速的牛马路卡。</p>
        <p><strong>进度：</strong>关卡完成状态和最高分保存在当前浏览器的本地存储中。</p>
      </div>
    </section>
  );
}

type SeoPageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function SeoPageShell({ eyebrow, title, description, children }: SeoPageShellProps) {
  return (
    <main className="seo-page-shell">
      <header className="seo-page-header">
        <Link className="seo-brand-link" href="/" aria-label={`${SITE_NAME}首页`}>
          <span>花花</span><b>VS</b><span>路卡</span><small>DEMO</small>
        </Link>
        <SeoNav />
      </header>
      <article className="seo-article">
        <header>
          <p>{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </header>
        {children}
      </article>
      <footer className="seo-footer">© 2026 {SITE_AUTHOR} · <Link href="/">返回游戏</Link></footer>
    </main>
  );
}

export function CatRoster() {
  const playableCats = [CAT_TYPES["ball-hua"], CAT_TYPES["wheel-hua"]];
  return (
    <div className="seo-data-grid">
      {playableCats.map((cat) => (
        <article key={cat.id}>
          <h2>{localize(cat.name, "zh")}</h2>
          <p>{localize(cat.description, "zh")}</p>
          <dl>
            <div><dt>站位</dt><dd>{localize(cat.tag, "zh")}</dd></div>
            <div><dt>强度</dt><dd>{cat.strength}</dd></div>
            <div><dt>特性</dt><dd>{localize(cat.traitDescription, "zh")}</dd></div>
          </dl>
        </article>
      ))}
    </div>
  );
}

export function EnemyRoster() {
  return (
    <div className="seo-data-grid">
      {Object.values(ENEMY_TYPES).map((enemy) => (
        <article key={enemy.id}>
          <h2>{localize(enemy.name, "zh")}</h2>
          <p>{localize(enemy.description, "zh")}</p>
          <dl>
            <div><dt>强度</dt><dd>{enemy.strength}</dd></div>
            <div><dt>速度</dt><dd>{enemy.speed === "slow" ? "慢" : enemy.speed}</dd></div>
            <div><dt>特性</dt><dd>{localize(enemy.traitDescription, "zh")}</dd></div>
          </dl>
        </article>
      ))}
    </div>
  );
}

export function LevelRoster() {
  return (
    <div className="seo-level-list">
      {LEVELS.map((level) => (
        <article key={level.id}>
          <p>{level.id}</p>
          <h2>{localize(level.name, "zh")}</h2>
          <ul>
            <li>难度：{level.difficulty} / 5</li>
            <li>跑道：{level.lanes} 条</li>
            <li>敌人：{level.totalEnemies} 个</li>
          </ul>
        </article>
      ))}
    </div>
  );
}
