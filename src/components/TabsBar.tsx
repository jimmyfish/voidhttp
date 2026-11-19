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
  Menu,
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

  useLayoutEffect(() => {
    const el = strip.current!;
    const measure = () => {
      setPinsW(pinGroup.current?.offsetWidth ?? 0);
      setStuck(el.scrollLeft > 0);
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

  const renderTab = (t: Tab) => (
    <div
      key={t.id}
      className={menu?.id === t.id ? "tab menu-open" : "tab"}
      aria-current={t.id === activeTabId ? "page" : undefined}
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
        onScroll={(e) => setStuck(e.currentTarget.scrollLeft > 0)}
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

      <EnvMenu environments={environments} activeId={activeEnvironmentId} onPick={(id) => s.setActiveEnvironment(id)}>
        <button
          type="button"
          className="btn joined-tail"
          title="Manage environments (⌘E)"
          aria-label="Manage environments"
          onClick={() => s.openModal({ kind: "environments" })}
        >
          <Menu {...ico} />
        </button>
      </EnvMenu>
    </div>
  );
}
