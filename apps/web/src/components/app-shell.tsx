import type {Locale} from "@/lib/i18n/routing";
import type {ReactNode} from "react";
import {LocaleSwitcher} from "./locale-switcher";
import {ThemeSwitcher} from "./theme-switcher";

type NavKey = "home" | "documents" | "finance" | "assistant" | "settings";
type Copy = {nav: Record<NavKey, string>; home: Record<string, string>};
const icons: Record<NavKey, string> = {home: "⌂", documents: "▤", finance: "◫", assistant: "✦", settings: "⚙"};
const paths: Record<NavKey, (locale: Locale) => string> = {
  home: (locale) => `/${locale}`,
  documents: (locale) => `/${locale}/documents`,
  finance: (locale) => `/${locale}`,
  assistant: (locale) => `/${locale}`,
  settings: (locale) => `/${locale}`
};

export function AppShell({
  copy,
  locale,
  activeNav = "home",
  pageTitle,
  children
}: {copy: Copy; locale: Locale; activeNav?: NavKey; pageTitle?: string; children?: ReactNode}) {
  const items = Object.keys(icons) as NavKey[];
  return <div className="shell">
    <aside aria-label={copy.home.navigation} className="sidebar">
      <a className="brand" href={`/${locale}`} aria-label="Memora"><span className="brand__mark">M</span><span>memora</span></a>
      <nav aria-label="Primary" className="nav">{items.map((item) => <a aria-current={item === activeNav ? "page" : undefined} className="nav__item" href={paths[item](locale)} key={item}><span aria-hidden="true">{icons[item]}</span><span>{copy.nav[item]}</span></a>)}</nav>
      <div className="sidebar__footer"><ThemeSwitcher /><LocaleSwitcher locale={locale} /></div>
    </aside>
    <main className="workspace">
      {children ? <><header className="topbar"><div><p className="eyebrow">{copy.home.eyebrow}</p><h1>{pageTitle ?? copy.home.hello}</h1></div><button className="avatar" type="button" aria-label="Profile">AS</button></header><section className="page-content">{children}</section></> : <><header className="topbar"><div><p className="eyebrow">{copy.home.eyebrow}</p><h1>{copy.home.hello}</h1></div><button className="avatar" type="button" aria-label="Profile">AS</button></header>
        <section className="hero" aria-labelledby="hero-title"><div><h2 id="hero-title">{copy.home.lead}</h2><div className="actions"><button className="button button--primary" type="button"><span aria-hidden="true">＋</span>{copy.home.capture}</button><button className="button button--ai" type="button"><span aria-hidden="true">✦</span>{copy.home.ask}</button></div></div><div className="orb" aria-hidden="true"><span /><span /><span /></div></section>
        <section className="metrics" aria-label="Overview">
          <article className="metric"><p>{copy.home.balance}</p><strong className="money">—</strong><span className="metric__hint">{copy.home.month}</span></article>
          <article className="metric"><p>{copy.home.documents}</p><strong>0</strong><span className="metric__hint"><i className="status-dot" />{copy.home.protected}</span></article>
          <article className="metric metric--wide"><p>{copy.home.events}</p><div className="empty-line"><span>○</span>{copy.home.empty}</div></article>
        </section></>}
    </main>
    <aside aria-label={copy.home.stream} className="stream"><div className="stream__heading"><p className="eyebrow">Memory stream</p><h2>{copy.home.stream}</h2><span className="privacy"><i />{copy.home.private}</span></div><div className="stream__line"><span className="stream__node stream__node--active" /><span className="stream__node" /><span className="stream__node" /></div><p className="stream__empty">{copy.home.streamHint}</p></aside>
    <nav className="mobile-nav" aria-label="Mobile navigation">{items.slice(0, 4).map((item) => <a aria-current={item === activeNav ? "page" : undefined} href={paths[item](locale)} key={item}><span aria-hidden="true">{icons[item]}</span><small>{copy.nav[item]}</small></a>)}</nav>
  </div>;
}
