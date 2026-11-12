/** Tiny JSON tokenizer → HTML. No editor dependency, linear time. */

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const TOKEN =
  /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(true|false)\b|\b(null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

export function highlightJson(src: string): string {
  let out = "";
  let last = 0;
  for (const m of src.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    out += esc(src.slice(last, i));
    if (m[1]) {
      out += m[2] ? `<span class="j-key">${esc(m[1])}</span>${m[2]}` : `<span class="j-str">${esc(m[1])}</span>`;
    } else if (m[3]) out += `<span class="j-bool">${m[3]}</span>`;
    else if (m[4]) out += `<span class="j-null">${m[4]}</span>`;
    else if (m[5]) out += `<span class="j-num">${m[5]}</span>`;
    last = i + m[0].length;
  }
  return out + esc(src.slice(last));
}

/**
 * One `.l` block per line, leading indentation wrapped in `.ind` (indent guides),
 * JSON tokens coloured when `json` is true. Line numbers come from CSS counters.
 */
export function highlightLines(src: string, json: boolean): string {
  return src
    .split("\n")
    .map((line) => {
      const m = /^ +/.exec(line);
      const lead = m ? m[0] : "";
      const rest = line.slice(lead.length);
      const body = json ? highlightJson(rest) : esc(rest);
      return `<span class="l">${lead ? `<span class="ind">${lead}</span>` : ""}${body}</span>`;
    })
    .join("");
}
