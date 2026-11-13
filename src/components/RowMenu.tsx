import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type MenuItem = { label: string; icon: React.ReactNode; run: () => void; danger?: boolean } | "sep";

/** A row menu is closed (false), open from its "…" button (true), or open at the pointer after a right-click. */
export type MenuState = boolean | { x: number; y: number };

/** onContextMenu for a row: opens its "…" menu where the pointer is, in place of the webview's own menu. */
export const openAtPointer = (setMenu: (m: MenuState) => void) => (e: React.MouseEvent) => {
  e.preventDefault();
  setMenu({ x: e.clientX, y: e.clientY });
};

/** The "…" menu of a tree or list row: fixed to the viewport so the tree's scroll box never clips it. */
export function RowMenu({
  anchor,
  label,
  items,
  onClose,
  at,
}: {
  anchor: React.RefObject<HTMLButtonElement>;
  /** where a right-click opened it; without one the menu hangs off the anchor */
  at?: MenuState;
  label: string;
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  // the row re-renders during drags and edits; keep the listeners (and focus) from resetting each time
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const point = typeof at === "object" ? at : null;
  useLayoutEffect(() => {
    const m = ref.current!.getBoundingClientRect();
    if (point) {
      // at the pointer, flipped up or left when it would run off the window
      const top = point.y + m.height > window.innerHeight - 8 ? Math.max(8, point.y - m.height) : point.y;
      const left = point.x + m.width > window.innerWidth - 8 ? Math.max(8, point.x - m.width) : point.x;
      return setPos({ top, left });
    }
    const a = anchor.current!.getBoundingClientRect();
    const below = a.bottom + 2;
    const top = below + m.height > window.innerHeight - 8 ? Math.max(8, a.top - m.height - 2) : below;
    setPos({ top, left: Math.max(8, a.right - m.width) });
  }, [anchor, point?.x, point?.y]);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onClose = () => closeRef.current();
    const close = onClose;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !anchor.current?.contains(t)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
      const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        anchor.current?.focus();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const n = buttons.length;
        buttons[(i + (e.key === "ArrowDown" ? 1 : n - 1)) % n]?.focus();
      } else if (e.key === "Tab") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [anchor]);

  return (
    <div
      ref={ref}
      className="menu row-menu"
      role="menu"
      aria-label={label}
      style={{ position: "fixed", top: pos?.top ?? 0, left: pos?.left ?? 0, right: "auto", visibility: pos ? "visible" : "hidden" }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {items.map((it, i) =>
        it === "sep" ? (
          <hr key={i} />
        ) : (
          <button
            key={it.label}
            type="button"
            role="menuitem"
            className={it.danger ? "danger" : undefined}
            onClick={() => {
              onClose();
              it.run();
            }}
          >
            {it.icon}
            {it.label}
          </button>
        ),
      )}
    </div>
  );
}
