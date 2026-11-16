import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { METHODS } from "../lib/model";

/**
 * The method in the request line: our own menu instead of the native macOS one. Each method in its
 * scheme colour, the current one on a soft fill, GraphQL, gRPC, WebSocket, Socket.IO and Kafka after a rule. Methods are a fixed list.
 */
export function MethodMenu({
  value,
  disabled,
  className,
  title,
  onPick,
  children,
}: {
  value: string;
  disabled?: boolean;
  className: string;
  title?: string;
  onPick: (method: string) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const current = value.toUpperCase();

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
  const pick = (m: string) => {
    close();
    if (m !== current) onPick(m);
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
  const item = (m: string, label: string) => (
    <button key={m} type="button" role="menuitemradio" aria-checked={current === m} className={`m-${m}`} onClick={() => pick(m)}>
      {label}
    </button>
  );

  return (
    <div className="method-wrap" ref={wrap}>
      <button
        ref={btn}
        type="button"
        className={className}
        title={title}
        aria-label={`Method: ${current === "GQL" ? "GraphQL" : current === "GRPC" ? "gRPC" : current === "WS" ? "WebSocket" : current === "SIO" ? "Socket.IO" : current === "KAFKA" ? "Kafka" : current}`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        {children}
      </button>
      {open && (
        <div className="menu method-menu" role="menu" aria-label="Method" ref={menu} onKeyDown={onKey}>
          {METHODS.map((m) => item(m, m))}
          <hr />
          {item("GQL", "GraphQL")}
          {item("GRPC", "gRPC")}
          {item("WS", "WebSocket")}
          {item("SIO", "Socket.IO")}
          {item("KAFKA", "Kafka")}
        </div>
      )}
    </div>
  );
}
