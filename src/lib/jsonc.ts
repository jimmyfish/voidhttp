/**
 * JSON with comments (JSONC) for request bodies: `//` and `/* *\/` comments plus trailing commas
 * are allowed while editing, and stripped before the body is sent.
 */

type Tok =
  | { t: "str" | "lit" | "punct"; v: string }
  | { t: "line" | "block"; v: string; ownLine: boolean };

/** Splits JSONC into tokens. Anything that isn't a string, comment or punctuation becomes a literal run. */
function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  let sawNewline = true; // a comment at the very start sits on its own line
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") { sawNewline = true; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"' && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      j = Math.min(j + 1, src.length);
      out.push({ t: "str", v: src.slice(i, j) });
      i = j;
    } else if (c === "/" && src[i + 1] === "/") {
      const end = src.indexOf("\n", i);
      const j = end === -1 ? src.length : end;
      out.push({ t: "line", v: src.slice(i, j).trimEnd(), ownLine: sawNewline });
      i = j;
    } else if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      const j = end === -1 ? src.length : end + 2;
      out.push({ t: "block", v: src.slice(i, j), ownLine: sawNewline });
      i = j;
    } else if (c === "{" && src[i + 1] === "{") {
      // unquoted {{variable}} stays one literal
      const end = src.indexOf("}}", i + 2);
      const j = end === -1 ? src.length : end + 2;
      out.push({ t: "lit", v: src.slice(i, j) });
      i = j;
    } else if ("{}[],:".includes(c)) {
      out.push({ t: "punct", v: c });
      i++;
    } else {
      let j = i;
      while (j < src.length && !/[\s{}[\],:"]/.test(src[j]) && !(src[j] === "/" && /[/*]/.test(src[j + 1] ?? ""))) j++;
      out.push({ t: "lit", v: src.slice(i, j) });
      i = j;
    }
    sawNewline = false;
  }
  return out;
}

export const hasJsonComments = (src: string) => tokenize(src).some((t) => t.t === "line" || t.t === "block");

/**
 * Removes comments and trailing commas, leaving everything else byte-for-byte.
 * A line that held only a `//` comment is dropped entirely.
 */
export function stripJsonComments(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"' && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      j = Math.min(j + 1, src.length);
      out += src.slice(i, j);
      i = j;
    } else if (c === "/" && src[i + 1] === "/") {
      const end = src.indexOf("\n", i);
      const lineStart = out.lastIndexOf("\n") + 1;
      if (/^[ \t]*$/.test(out.slice(lineStart))) {
        // whole-line comment: drop the line and its newline
        out = out.slice(0, lineStart);
        i = end === -1 ? src.length : end + 1;
      } else {
        out = out.replace(/[ \t]+$/, "");
        i = end === -1 ? src.length : end;
      }
    } else if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? src.length : end + 2;
    } else {
      out += c;
      i++;
    }
  }
  return dropTrailingCommas(out);
}

/** `,` followed only by whitespace and then `}` or `]` (outside strings) is removed. */
function dropTrailingCommas(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"' && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      j = Math.min(j + 1, src.length);
      out += src.slice(i, j);
      i = j;
      continue;
    }
    if (c === ",") {
      let j = i + 1;
      while (j < src.length && /\s/.test(src[j])) j++;
      if (src[j] === "}" || src[j] === "]") { i++; continue; }
    }
    out += c;
    i++;
  }
  return out;
}

/** Pretty-prints JSONC with 2-space indents, keeping comments where they were (own line or trailing). */
export function formatJsonc(src: string): string {
  const toks = tokenize(src);
  const IND = "  ";
  let out = "";
  let depth = 0;
  let newline = false;
  const emit = (s: string) => {
    if (newline && out) out += "\n" + IND.repeat(depth);
    newline = false;
    out += s;
  };

  for (let k = 0; k < toks.length; k++) {
    const tok = toks[k];
    if (tok.t === "line" || tok.t === "block") {
      if (tok.ownLine || !out) {
        newline = true;
        emit(tok.v);
        newline = true;
      } else {
        // trailing comment stays on its line; a pending line break still follows it
        out += " " + tok.v;
        if (tok.t === "line") newline = true;
      }
      continue;
    }
    if (tok.t !== "punct") {
      emit(tok.v);
      continue;
    }
    const p = tok.v;
    if (p === "{" || p === "[") {
      const next = toks[k + 1];
      if (next?.t === "punct" && next.v === (p === "{" ? "}" : "]")) {
        emit(p + next.v);
        k++;
        continue;
      }
      emit(p);
      depth++;
      newline = true;
    } else if (p === "}" || p === "]") {
      depth = Math.max(0, depth - 1);
      newline = true;
      emit(p);
    } else if (p === ",") {
      out += ",";
      newline = true;
    } else {
      out += ": ";
      newline = false;
    }
  }
  return out;
}

export interface LineEdit {
  value: string;
  /** replace [from, to) of the old value with `text` */
  from: number;
  to: number;
  text: string;
  selStart: number;
  selEnd: number;
}

/**
 * VS Code-style ⌘/ on the lines a selection touches: comments them all with `// ` at their shared indent,
 * or uncomments them when every non-blank line is already commented.
 */
export function toggleLineComments(value: string, selStart: number, selEnd: number): LineEdit {
  const from = value.lastIndexOf("\n", selStart - 1) + 1;
  // a selection ending at column 0 doesn't include that line
  let endAt = selEnd > selStart && value[selEnd - 1] === "\n" ? selEnd - 1 : selEnd;
  if (endAt < from) endAt = from;
  const nl = value.indexOf("\n", endAt);
  const to = nl === -1 ? value.length : nl;

  const lines = value.slice(from, to).split("\n");
  const filled = lines.filter((l) => l.trim());
  const uncomment = filled.length > 0 && filled.every((l) => l.trimStart().startsWith("//"));
  const indent = Math.min(...filled.map((l) => l.length - l.trimStart().length), Infinity);

  const deltas: { at: number; d: number }[] = []; // offset within the old block, change in length
  let pos = 0;
  const next = lines.map((l) => {
    const start = pos;
    pos += l.length + 1;
    if (!l.trim()) return l;
    if (uncomment) {
      const lead = l.length - l.trimStart().length;
      const n = l.startsWith("// ", lead) ? 3 : 2;
      deltas.push({ at: start + lead, d: -n });
      return l.slice(0, lead) + l.slice(lead + n);
    }
    deltas.push({ at: start + indent, d: 3 });
    return l.slice(0, indent) + "// " + l.slice(indent);
  });
  const text = next.join("\n");

  // move a selection end by every edit before it; a removal it falls inside pulls it to the edit start
  const shift = (abs: number) => {
    const rel = abs - from;
    let out = abs;
    for (const { at, d } of deltas) {
      if (rel < at || (d > 0 && rel === at && filled.length > 1)) continue;
      out += d < 0 ? -Math.min(-d, rel - at) : d;
    }
    return out;
  };

  return {
    value: value.slice(0, from) + text + value.slice(to),
    from,
    to,
    text,
    selStart: shift(selStart),
    selEnd: shift(selEnd),
  };
}
