import "./TabsBar.css";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { methodLabel } from "../lib/model";
import type { Tab } from "../types";
import { KEYS } from "../shortcuts";
import { EnvMenu } from "./EnvMenu";
import { RowMenu, type MenuItem } from "./RowMenu";
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  Bookmark,
  CopyX,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  PinOff,
  Plus,
  X,
  ico,
} from "./Icon";

export function TabsBar() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const environments = useStore((s) => s.environments);
  const activeEnvironmentId = useStore((s) => s.activeEnvironmentId);
  const sidebarHidden = useStore((s) => !!s.settings.sidebarHidden);
  const s = useStore.getState(); // actions only
  const pins = tabs.filter((t) => t.pinned);
  const rest = tabs.filter((t) => !t.pinned);

  const strip = useRef<HTMLDivElement>(null);
  const pinGroup = useRef<HTMLDivElement>(null);
  const menuAnchor = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  // the pinned group is sticky at the strip's left edge: tabs scrolled under it must not hide behind it
  const [pinsW, setPinsW] = useState(0);
  const [stuck, setStuck] = useState(false);

  // ⌘1–⌘9, ⇧⌘] and ⌘P can pick a tab scrolled out of view: bring it in (scroll-padding keeps it clear of the pins)
  useEffect(() => {
    document.querySelector('.tabsbar .tab[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTabId]);

  // the edge with tabs past it fades (data-fade-*, TabsBar.css); written straight to the DOM so scrolling never re-renders
  const fadeEdges = () => {
    const el = strip.current;
    if (!el) return;
    el.dataset.fadeStart = String(el.scrollLeft > 1);
    el.dataset.fadeEnd = String(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };
  // a tab opened, closed, renamed or pinned changes the strip's width without resizing the strip itself
  useLayoutEffect(fadeEdges, [tabs]);

  useLayoutEffect(() => {
    const el = strip.current!;
    const measure = () => {
      setPinsW(pinGroup.current?.offsetWidth ?? 0);
      setStuck(el.scrollLeft > 0);
      fadeEdges();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (pinGroup.current) ro.observe(pinGroup.current);
    return () => ro.disconnect();
  }, [pins.length]);

  // no scrollbar on the strip: a plain mouse wheel (vertical) scrolls it sideways; trackpads already do
  useEffect(() => {
    const el = strip.current!;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /** The right-click menu of one tab. Bulk closes never take a pinned tab. */
  const menuItems = (t: Tab): MenuItem[] => {
    const order = [...pins, ...rest];
    const i = order.findIndex((x) => x.id === t.id);
    const ids = (list: Tab[]) => list.filter((x) => !x.pinned && x.id !== t.id).map((x) => x.id);
    const others = ids(order);
    const right = ids(order.slice(i + 1));
    const left = ids(order.slice(0, i));
    return [
      t.pinned
        ? { label: "Unpin tab", icon: <PinOff {...ico} />, run: () => s.pinTab(t.id, false) }
        : { label: "Pin tab", icon: <Pin {...ico} />, run: () => s.pinTab(t.id, true) },
      "sep",
      // ⌘W leaves a pinned tab open, so its menu shows no hint
      { label: "Close tab", icon: <X {...ico} />, kbd: t.pinned ? undefined : KEYS.closeTab, run: () => s.closeTab(t.id) },
      { label: "Close other tabs", icon: <CopyX {...ico} />, disabled: !others.length, run: () => s.closeTabs(others, t.id) },
      { label: "Close tabs to the right", icon: <ArrowRightToLine {...ico} />, disabled: !right.length, run: () => s.closeTabs(right, t.id) },
      { label: "Close tabs to the left", icon: <ArrowLeftToLine {...ico} />, disabled: !left.length, run: () => s.closeTabs(left, t.id) },
    ];
  };

  /** Drag to reorder, pointer-driven like the sidebar tree (HTML5 drag and drop is unreliable inside the Tauri webview).
   * The tab follows the pointer along its own group (pinned or not), the tabs it passes slide aside, and the drop commits
   * the order. Everything during the drag is written straight to the DOM, so moving the pointer never re-renders. */
  const startDrag = (e: React.MouseEvent<HTMLDivElement>, t: Tab) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest(".icon-btn")) return;
    const el = e.currentTarget;
    const stripEl = strip.current!;
    const nodes = [...el.parentElement!.children].filter((n): n is HTMLElement => n.classList.contains("tab"));
    const from = nodes.indexOf(el);
    if (from < 0 || nodes.length < 2) return;
    // offsets in the strip's content, so scrolling mid-drag keeps them valid; the pinned group is sticky and never scrolls
    const scroll = () => (t.pinned ? 0 : stripEl.scrollLeft);
    const s0 = scroll();
    const rects = nodes.map((n) => n.getBoundingClientRect());
    const step = rects[from].width + (parseFloat(getComputedStyle(el.parentElement!).columnGap) || 0);
    const min = rects[0].left - rects[from].left;
    const max = rects[rects.length - 1].right - rects[from].right;
    const mid0 = (rects[from].left + rects[from].right) / 2;
    const x0 = e.clientX;
    const edge = t.pinned ? 0 : pinsW;
    let active = false;
    let to = from;
    const move = (ev: MouseEvent) => {
      if (!active) {
        if (Math.abs(ev.clientX - x0) < 5) return;
        active = true;
        stripEl.classList.add("is-dragging");
        el.classList.add("dragging");
        document.body.classList.add("tree-dragging");
        s.setActiveTab(t.id);
      }
      if (!t.pinned) {
        const r = stripEl.getBoundingClientRect();
        if (ev.clientX < r.left + edge + 28) stripEl.scrollLeft -= 10;
        else if (ev.clientX > r.right - 28) stripEl.scrollLeft += 10;
      }
      const dx = Math.min(max, Math.max(min, ev.clientX - x0 + scroll() - s0));
      el.style.transform = `translateX(${dx}px)`;
      // a neighbour slides aside once the dragged tab's centre passes its centre
      to = from;
      nodes.forEach((n, j) => {
        if (j === from) return;
        const c = (rects[j].left + rects[j].right) / 2;
        let shift = 0;
        if (j > from && mid0 + dx > c) (shift = -step), (to = Math.max(to, j));
        else if (j < from && mid0 + dx < c) (shift = step), (to = Math.min(to, j));
        n.style.transform = shift ? `translateX(${shift}px)` : "";
      });
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      if (!active) return;
      // the click that ends a drag must not also land on the tab
      const swallow = (ev: MouseEvent) => (ev.stopPropagation(), ev.preventDefault());
      window.addEventListener("click", swallow, true);
      setTimeout(() => window.removeEventListener("click", swallow, true), 0);
      // no slide back: the transforms and the transition go in the same frame the new order renders
      stripEl.classList.remove("is-dragging");
      el.classList.remove("dragging");
      document.body.classList.remove("tree-dragging");
      for (const n of nodes) n.style.transform = "";
      if (to !== from) s.moveTab(t.id, (t.pinned ? 0 : pins.length) + to);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const renderTab = (t: Tab) => (
    <div
      key={t.id}
      className={menu?.id === t.id ? "tab menu-open" : "tab"}
      aria-current={t.id === activeTabId ? "page" : undefined}
      onMouseDown={(e) => startDrag(e, t)}
      // middle-click closes a normal tab; a pinned one ignores it, so it can't go by accident
      onAuxClick={(e) => e.button === 1 && !t.pinned && s.closeTab(t.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ id: t.id, x: e.clientX, y: e.clientY });
      }}
    >
      <button
        type="button"
        className="tab-main"
        ref={menu?.id === t.id ? menuAnchor : undefined}
        // the name can end in "…": the tooltip carries it in full
        title={t.request.url ? `${t.request.name}\n${t.request.url}` : t.request.name}
        onClick={() => s.setActiveTab(t.id)}
      >
        {t.example ? <Bookmark {...ico} className="ico ex-ico" /> : <span className={`m m-${t.request.method}`}>{methodLabel(t.request.method)}</span>}
        <span className="name">{t.request.name}</span>
        {t.dirty && t.savedRef && <span className="dirty" role="img" aria-label="Unsaved changes" />}
      </button>
      {t.pinned ? (
        <button type="button" className="icon-btn unpin" title="Pinned · click to unpin" aria-label={`Unpin ${t.request.name}`} onClick={() => s.pinTab(t.id, false)}>
          <Pin {...ico} />
        </button>
      ) : (
        <button type="button" className="icon-btn close" aria-label={`Close ${t.request.name}`} onClick={() => s.closeTab(t.id)}>
          <X {...ico} />
        </button>
      )}
    </div>
  );
  const menuTab = menu && tabs.find((t) => t.id === menu.id);

  return (
    <div className="tabsbar">
      <button
        type="button"
        className="icon-btn side-toggle"
        title={`${sidebarHidden ? "Show" : "Hide"} sidebar (⌘\\)`}
        aria-label={sidebarHidden ? "Show sidebar" : "Hide sidebar"}
        onClick={() => s.setSettings({ sidebarHidden: !sidebarHidden })}
      >
        {sidebarHidden ? <PanelLeftOpen {...ico} /> : <PanelLeftClose {...ico} />}
      </button>
      <div
        ref={strip}
        className="tabs"
        style={pins.length ? ({ "--pins-w": `${pinsW}px` } as React.CSSProperties) : undefined}
        onScroll={(e) => {
          setStuck(e.currentTarget.scrollLeft > 0);
          fadeEdges();
        }}
      >
        {pins.length > 0 && (
          <div ref={pinGroup} className={stuck ? "tab-pins is-stuck" : "tab-pins"} role="group" aria-label="Pinned tabs">
            {pins.map(renderTab)}
          </div>
        )}
        {rest.map(renderTab)}
        <button type="button" className="icon-btn tab-add" title="New tab (⌘T)" aria-label="New tab" onClick={() => s.newTab()}>
          <Plus {...ico} />
        </button>
      </div>
      {menu && menuTab && (
        <RowMenu anchor={menuAnchor} at={{ x: menu.x, y: menu.y }} label={`Tab ${menuTab.request.name}`} items={menuItems(menuTab)} onClose={() => setMenu(null)} />
      )}

      <EnvMenu
        environments={environments}
        activeId={activeEnvironmentId}
        onPick={(id) => s.setActiveEnvironment(id)}
        onManage={() => s.openModal({ kind: "environments" })}
      />
    </div>
  );
}
