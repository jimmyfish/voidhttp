import "./EnvMenu.css";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Environment } from "../types";
import { envStyle } from "../lib/tags";
import { KEYS } from "../shortcuts";
import { Braces, Check, ChevronDown, SlidersHorizontal, ico } from "./Icon";

const countLabel = (e: Environment) => {
  const n = e.variables.filter((v) => v.key.trim()).length;
  return `${n} ${n === 1 ? "variable" : "variables"}`;
};

/**
 * The environment picker in the tabs bar: a pill tinted by the environment's colour (no edge, bold name,
 * Braces icon; grey when it has no colour, muted for "No environment"), opening our own menu instead of the
 * native macOS one. Menu rows are [dot][name over its variable count][check]: "No environment" first, a rule,
 * the environments, a rule, then Manage environments (⌘E).
 */
export function EnvMenu({
  environments,
  activeId,
  onPick,
  onManage,
}: {
  environments: Environment[];
  activeId: string | null | undefined;
  onPick: (id: string | null) => void;
  onManage: () => void;
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
  const item = (id: string, name: string, color: Environment["color"], note: string) => (
    <button key={id || "none"} type="button" role="menuitemradio" aria-checked={current === id} onClick={() => pick(id)}>
      {color && envStyle(color) ? <span className="env-dot" style={envStyle(color)} aria-hidden="true" /> : <span className="env-dot-slot" aria-hidden="true" />}
      <span className="env-text">
        <span className={id ? "env-name" : "env-name env-none"}>{name}</span>
        <small>{note}</small>
      </span>
      <Check {...ico} className="ico env-check" />
    </button>
  );
  const label = env ? env.name : "No environment";

  return (
    <div className="env-group" ref={wrap}>
      <button
        ref={btn}
        type="button"
        className="env-picker"
        style={envStyle(env?.color)}
        data-tint={!!envStyle(env?.color) || undefined}
        data-none={!env || undefined}
        aria-label={`Environment: ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Braces {...ico} className="ico env-ico" />
        <span className="env-name">{label}</span>
        <ChevronDown {...ico} className="ico env-chev" />
      </button>
      {open && (
        <div className="menu env-menu" role="menu" aria-label="Environment" ref={menu} onKeyDown={onKey}>
          {item("", "No environment", undefined, "Collection variables only")}
          <hr />
          {environments.map((e) => item(e.id, e.name, e.color, countLabel(e)))}
          {environments.length > 0 && <hr />}
          <button
            type="button"
            role="menuitem"
            className="env-manage"
            onClick={() => {
              setOpen(false);
              onManage();
            }}
          >
            <SlidersHorizontal {...ico} />
            <span className="env-name">Manage environments</span>
            <kbd>{KEYS.variables}</kbd>
          </button>
        </div>
      )}
    </div>
  );
}
