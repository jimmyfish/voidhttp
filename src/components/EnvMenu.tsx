import "./EnvMenu.css";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { Environment } from "../types";
import { envStyle } from "../lib/tags";
import { Check, ChevronDown, ico } from "./Icon";

/**
 * The environment picker in the tabs bar: our own menu instead of the native macOS one. The face and
 * every row show the environment's colour dot and name (no lettermark badge, in either density);
 * "No environment" comes first, after it a rule, then the environments. `children` is the joined tail
 * (the Manage environments button).
 */
export function EnvMenu({
  environments,
  activeId,
  onPick,
  children,
}: {
  environments: Environment[];
  activeId: string | null | undefined;
  onPick: (id: string | null) => void;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const env = environments.find((e) => e.id === activeId);
  const current = env?.id ?? "";

  useEffect(() => {
    if (!open) return;
    const items = menu.current?.querySelectorAll<HTMLButtonElement>("button");
    (menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]') ?? items?.[0])?.focus();
    const away = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const close = () => {
    setOpen(false);
    btn.current?.focus();
  };
  const pick = (id: string) => {
    close();
    if (id !== current) onPick(id || null);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const all = [...(menu.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
      const i = all.indexOf(document.activeElement as HTMLButtonElement);
      const next = e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : (i + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length;
      all[next]?.focus();
    }
  };
  const item = (id: string, name: string, color: Environment["color"]) => (
    <button key={id || "none"} type="button" role="menuitemradio" aria-checked={current === id} onClick={() => pick(id)}>
      {color && envStyle(color) ? <span className="env-dot" style={envStyle(color)} aria-hidden="true" /> : <span className="env-dot-slot" aria-hidden="true" />}
      <span className={id ? "env-name" : "env-name env-none"}>{name}</span>
      <Check {...ico} className="ico env-check" />
    </button>
  );
  const label = env ? env.name : "No environment";

  return (
    <div className="joined env-group" ref={wrap}>
      <button
        ref={btn}
        type="button"
        className="env-picker"
        style={envStyle(env?.color)}
        aria-label={`Environment: ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {env?.color && <span className="env-dot" aria-hidden="true" />}
        <span className="env-name">{label}</span>
        <ChevronDown {...ico} />
      </button>
      {children}
      {open && (
        <div className="menu env-menu" role="menu" aria-label="Environment" ref={menu} onKeyDown={onKey}>
          {item("", "No environment", undefined)}
          <hr />
          {environments.map((e) => item(e.id, e.name, e.color))}
        </div>
      )}
    </div>
  );
}
