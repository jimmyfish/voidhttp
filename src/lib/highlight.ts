/** Tiny JSON tokenizer → HTML. No editor dependency, linear time. */

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const TOKEN =
  /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(true|false)\b|\b(null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\/\/.*|\/\*.*?(?:\*\/|$))/g;

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
    else if (m[6]) out += `<span class="j-com">${esc(m[6])}</span>`;
    last = i + m[0].length;
  }
  return out + esc(src.slice(last));
}

const KEYWORDS = new Set(
  "const let var if else return function new typeof instanceof await async for of in while do break continue switch case default throw try catch finally class extends this true false null undefined delete void yield".split(
    " ",
  ),
);
// comment | string | number | identifier | a "/" that may open a regex literal
const JS_TOKEN =
  /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|`(?:[^`\\]|\\[\s\S])*`?)|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|([A-Za-z_$][\w$]*)|(\/)/g;
const REGEX_AT = /\/(?![*/])(?:[^/\\\n[]|\\.|\[(?:[^\]\\\n]|\\.)*\])+\/[dgimsuy]*/y;

/** Tiny JavaScript tokenizer for the Scripts editor: [class, text] runs over the whole source (comments and strings may span lines). */
function jsRuns(src: string): [string, string][] {
  const runs: [string, string][] = [];
  let last = 0;
  let prev = ""; // the last token that is not blank: a regex may follow an operator or a keyword, not a value
  JS_TOKEN.lastIndex = 0;
  for (let m = JS_TOKEN.exec(src); m; m = JS_TOKEN.exec(src)) {
    const i = m.index;
    const gap = src.slice(last, i);
    if (gap) runs.push(["", gap]);
    if (gap.trim()) prev = gap.trim().slice(-1);
    let cls = "";
    let text = m[0];
    if (m[1]) cls = "j-com";
    else if (m[2]) cls = "j-str";
    else if (m[3]) cls = "j-num";
    else if (m[4]) cls = KEYWORDS.has(m[4]) ? "j-kw" : m[4] === "pm" || m[4] === "console" ? "j-pm" : "";
    else if (m[5]) {
      REGEX_AT.lastIndex = i;
      const re = !prev || /[(,=:[!&|?{};+\-*%<>~^]$/.test(prev) || prev === "return" || prev === "typeof" ? REGEX_AT.exec(src) : null;
      if (re) {
        cls = "j-re";
        text = re[0];
        JS_TOKEN.lastIndex = i + text.length;
      }
    }
    runs.push([cls, text]);
    if (!m[1]) prev = m[4] && KEYWORDS.has(m[4]) ? m[4] : text.slice(-1);
    last = i + text.length;
  }
  if (last < src.length) runs.push(["", src.slice(last)]);
  return runs;
}

/** JavaScript as `.l` lines, each run cut at its line breaks so a span never crosses a line. */
function jsLines(src: string): string[] {
  const lines: string[] = [""];
  for (const [cls, text] of jsRuns(src)) {
    text.split("\n").forEach((part, k) => {
      if (k > 0) lines.push("");
      if (part) lines[lines.length - 1] += cls ? `<span class="${cls}">${esc(part)}</span>` : esc(part);
    });
  }
  return lines;
}

const line = (lead: string, body: string, cls = "l") => `<span class="${cls}">${lead ? `<span class="ind">${lead}</span>` : ""}${body}</span>`;

/**
 * One `.l` block per line, leading indentation wrapped in `.ind` (indent guides),
 * tokens coloured for JSON (`true` or "json") or JavaScript ("js"). `mark` (1-based) flags one line, e.g. where a script failed.
 * Line numbers come from CSS counters.
 */
export function highlightLines(src: string, lang: boolean | "json" | "js", mark?: number): string {
  const cls = (i: number) => (i + 1 === mark ? "l err-line" : "l");
  if (lang === "js") {
    // indentation is plain text at the start of a line: peel it off the rendered line
    return jsLines(src)
      .map((html, i) => {
        const m = /^ +/.exec(html);
        return line(m ? m[0] : "", m ? html.slice(m[0].length) : html, cls(i));
      })
      .join("");
  }
  const json = lang === true || lang === "json";
  return src
    .split("\n")
    .map((text, i) => {
      const m = /^ +/.exec(text);
      const lead = m ? m[0] : "";
      const rest = text.slice(lead.length);
      return line(lead, json ? highlightJson(rest) : esc(rest), cls(i));
    })
    .join("");
}
