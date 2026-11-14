import { Fragment, useLayoutEffect, useRef, useState, type InputHTMLAttributes } from "react";

/** What the address bar knows about one {{variable}}. */
export type VarInfo =
  | { kind: "value"; value: string; source: string; secret?: boolean }
  | { kind: "dynamic" }
  | { kind: "missing"; addLabel: string; onAdd: () => void };

type Tok = { t: "text" | "q"; s: string } | { t: "var"; s: string; name: string } | { t: "path"; s: string; name: string };

// same name rule as VAR_RE in lib/vars.ts; a path variable is a ":name" segment before the query
const TOKEN = /(\{\{([^{}]*)\}\})|\/(:([A-Za-z_][\w-]*))|([?&=])/g;

export function tokenizeUrl(v: string): Tok[] {
  const out: Tok[] = [];
  let last = 0;
  let query = false;
  const text = (s: string) => s && out.push({ t: "text", s });
  for (const m of v.matchAll(TOKEN)) {
    text(v.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[1] && m[2].trim()) out.push({ t: "var", s: m[1], name: m[2].trim() });
    else if (m[1]) text(m[1]);
    else if (m[3]) {
      text("/");
      out.push(query ? { t: "text", s: m[3] } : { t: "path", s: m[3], name: m[4] });
    } else {
      if (m[5] === "?") query = true;
      out.push(query ? { t: "q", s: m[5] } : { t: "text", s: m[5] });
    }
  }
  text(v.slice(last));
  return out;
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value"> & {
  value: string;
  lookup: (name: string) => VarInfo;
};

/**
 * The URL input with {{variables}} and :path variables coloured.
 * The input's own text is transparent; a painted copy sits behind it with the same font and
 * padding, so typing, caret, selection and paste all stay the browser's. Tokens may only grow
 * vertically: horizontal padding, borders or shadow spread would shift text off the caret or
 * paint over the neighbouring glyphs.
 */
export function UrlInput({ value, lookup, ...input }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const layer = useRef<HTMLSpanElement>(null);
  const [tip, setTip] = useState<{ i: number; left: number } | null>(null);
  const toks = tokenizeUrl(value);

  const follow = () => {
    if (layer.current && field.current) layer.current.style.transform = `translateX(${-field.current.scrollLeft}px)`;
  };
  useLayoutEffect(follow);

  const hover = (e: React.MouseEvent) => {
    const spans = layer.current?.querySelectorAll<HTMLElement>("[data-i]") ?? [];
    const hit = [...spans].find((x) => {
      const r = x.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top - 4 && e.clientY <= r.bottom + 4;
    });
    if (field.current) field.current.style.cursor = hit ? "help" : "";
    if (!hit) {
      if (!(e.target as HTMLElement).closest(".url-tip")) setTip(null);
      return;
    }
    const i = Number(hit.dataset.i);
    if (tip?.i === i) return;
    const w = wrap.current!.getBoundingClientRect();
    // keep the card inside the field's right edge
    setTip({ i, left: Math.max(0, Math.min(hit.getBoundingClientRect().left - w.left, w.width - 260)) });
  };

  const shown = tip && toks[tip.i];
  return (
    <div className="url-input" ref={wrap} onMouseMove={hover} onMouseLeave={() => setTip(null)}>
      <div className="url-hl" aria-hidden="true">
        <span className="url-hl-in" ref={layer}>
          {toks.map((k, i) =>
            k.t === "var" ? (
              <span key={i} data-i={i} className={lookup(k.name).kind === "missing" ? "tok-var is-missing" : "tok-var"}>
                <i>{"{{"}</i>
                {k.s.slice(2, -2)}
                <i>{"}}"}</i>
              </span>
            ) : k.t === "path" ? (
              <span key={i} data-i={i} className="tok-path">
                {k.s}
              </span>
            ) : k.t === "q" ? (
              <span key={i} className="tok-q">
                {k.s}
              </span>
            ) : (
              <Fragment key={i}>{k.s}</Fragment>
            ),
          )}{" "}
        </span>
      </div>
      <input
        {...input}
        ref={field}
        value={value}
        onScroll={follow}
        onSelect={follow}
        onKeyUp={follow}
        onInput={() => setTip(null)}
      />
      {shown && (shown.t === "var" || shown.t === "path") && (
        <div className="url-tip" style={{ left: tip.left }}>
          {shown.t === "path" ? (
            <>
              <span className="tip-k is-path">{shown.s}</span>
              <span className="tip-src">Path variable · sent as typed</span>
            </>
          ) : (
            <VarTip name={shown.name} info={lookup(shown.name)} />
          )}
        </div>
      )}
    </div>
  );
}

function VarTip({ name, info }: { name: string; info: VarInfo }) {
  if (info.kind === "dynamic")
    return (
      <>
        <span className="tip-k">{name}</span>
        <span className="tip-src">Dynamic · a new value on every send</span>
      </>
    );
  if (info.kind === "missing")
    return (
      <>
        <span className="tip-k is-missing">{name}</span>
        <span className="tip-src">Not defined, sent as typed</span>
        <button type="button" className="tip-link" onClick={info.onAdd}>
          {info.addLabel}
        </button>
      </>
    );
  return (
    <>
      <span className="tip-k">{name}</span>
      {info.secret ? <code className="muted">•••••••• hidden</code> : <code>{info.value || "(empty)"}</code>}
      <span className="tip-src">{info.source}</span>
    </>
  );
}
