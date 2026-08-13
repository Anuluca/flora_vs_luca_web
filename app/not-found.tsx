import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "页面不存在",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="seo-page-shell">
      <article className="seo-article">
        <header>
          <p>404 · LUCA GOT LOST</p>
          <h1>这个路卡走错跑道了</h1>
          <p>当前页面不存在或已经移动。返回游戏首页继续守住猫窝。</p>
        </header>
        <nav className="seo-nav" aria-label="错误页导航">
          <Link href="/">返回游戏</Link>
          <Link href="/guide">玩法指南</Link>
          <Link href="/bestiary">角色图鉴</Link>
        </nav>
      </article>
    </main>
  );
}
