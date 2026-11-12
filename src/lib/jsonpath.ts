/**
 * JSONPath for the response filter, in the Goessner / jsonpath-plus dialect Insomnia uses,
 * evaluated without eval():
 *   $  .key  ['key']  [0]  [-1]  [*]  ..key  [start:end:step]  [a,b]
 *   [?(@.price > 10 && @.tag =~ /new/i)]   filters
 *   [(@.length-1)]                         script index
 *   .length                                on arrays and strings
 */

export class JsonPathError extends Error {}

type Expr =
  | { k: "lit"; v: unknown }
  | { k: "path"; root: "@" | "$"; steps: Step[] }
  | { k: "un"; op: "!" | "-"; a: Expr }
  | { k: "bin"; op: string; a: Expr; b: Expr }
  | { k: "re"; re: RegExp };
/** a step inside an expression path: .name, ['name'], [0] or [(expr)] */
type Step = { k: "name"; name: string } | { k: "expr"; e: Expr };
type Sel =
  | { k: "name"; name: string }
  | { k: "wild" }
  | { k: "index"; i: number }
  | { k: "slice"; start?: number; end?: number; step?: number }
  | { k: "filter"; e: Expr }
  | { k: "script"; e: Expr };
interface Segment {
  desc: boolean;
  sels: Sel[];
}
export interface JsonPath {
  segs: Segment[];
  /** at most one result: show the value itself rather than an array */
  singular: boolean;
}

const PATH_NAME = /[A-Za-z0-9_$\-\u0080-￿]+/y;
const EXPR_NAME = /[A-Za-z0-9_$\u0080-￿]+/y;
const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
const INT = /-?\d+/y;
const WORD = /(?:true|false|null|undefined)(?![\w$])/y;
const CMP = ["===", "!==", "==", "!=", "<=", ">=", "=~", "<", ">"];

class Parser {
  i = 0;
  constructor(readonly s: string) {}

  fail(what: string, at = this.i): never {
    throw new JsonPathError(at >= this.s.length ? `Incomplete: expected ${what}` : `Expected ${what} at ${at + 1}`);
  }
  ws() {
    while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++;
  }
  peek(n = 0): string | undefined {
    return this.s[this.i + n];
  }
  eat(t: string) {
    if (!this.s.startsWith(t, this.i)) return false;
    this.i += t.length;
    return true;
  }
  need(t: string) {
    this.ws();
    if (!this.eat(t)) this.fail(t);
  }
  match(re: RegExp): string | undefined {
    re.lastIndex = this.i;
    const m = re.exec(this.s);
    if (!m) return undefined;
    this.i += m[0].length;
    return m[0];
  }

  path(): Segment[] {
    this.ws();
    if (!this.eat("$")) this.fail("$");
    const segs: Segment[] = [];
    for (;;) {
      this.ws();
      if (this.i >= this.s.length) return segs;
      if (this.eat("..")) segs.push({ desc: true, sels: this.peek() === "[" ? this.bracket() : [this.dotSel()] });
      else if (this.eat(".")) segs.push({ desc: false, sels: [this.dotSel()] });
      else if (this.peek() === "[") segs.push({ desc: false, sels: this.bracket() });
      else this.fail(". or [");
    }
  }
  dotSel(): Sel {
    if (this.eat("*")) return { k: "wild" };
    const name = this.match(PATH_NAME);
    if (name === undefined) this.fail("a property name");
    return { k: "name", name };
  }
  bracket(): Sel[] {
    this.need("[");
    const sels: Sel[] = [];
    do {
      this.ws();
      sels.push(this.sel());
      this.ws();
    } while (this.eat(","));
    this.need("]");
    return sels;
  }
  sel(): Sel {
    const c = this.peek();
    if (c === "*") {
      this.i++;
      return { k: "wild" };
    }
    if (c === "'" || c === '"') return { k: "name", name: this.str() };
    if (c === "?") {
      this.i++;
      return { k: "filter", e: this.expr() };
    }
    if (c === "(") return { k: "script", e: this.expr() };
    const start = this.int();
    this.ws();
    if (this.peek() !== ":") {
      if (start === undefined) this.fail("a key, index, *, ?() or ()");
      return { k: "index", i: start };
    }
    this.i++;
    this.ws();
    const end = this.int();
    this.ws();
    let step: number | undefined;
    if (this.eat(":")) {
      this.ws();
      step = this.int();
    }
    return { k: "slice", start, end, step };
  }
  int(): number | undefined {
    const m = this.match(INT);
    return m === undefined ? undefined : Number(m);
  }
  str(): string {
    const q = this.s[this.i++];
    let out = "";
    while (this.i < this.s.length) {
      const c = this.s[this.i++];
      if (c === q) return out;
      if (c !== "\\") {
        out += c;
        continue;
      }
      const n = this.s[this.i++];
      if (n === "u") {
        out += String.fromCharCode(parseInt(this.s.slice(this.i, this.i + 4), 16));
        this.i += 4;
      } else out += n === "n" ? "\n" : n === "t" ? "\t" : n === "r" ? "\r" : (n ?? "");
    }
    return this.fail(`closing ${q}`);
  }

  expr(): Expr {
    let a = this.and();
    for (;;) {
      this.ws();
      if (!this.eat("||")) return a;
      a = { k: "bin", op: "||", a, b: this.and() };
    }
  }
  and(): Expr {
    let a = this.cmp();
    for (;;) {
      this.ws();
      if (!this.eat("&&")) return a;
      a = { k: "bin", op: "&&", a, b: this.cmp() };
    }
  }
  cmp(): Expr {
    const a = this.add();
    this.ws();
    for (const op of CMP) {
      if (!this.eat(op)) continue;
      return { k: "bin", op, a, b: op === "=~" ? this.regex() : this.add() };
    }
    return a;
  }
  add(): Expr {
    let a = this.mul();
    for (;;) {
      this.ws();
      const c = this.peek();
      if (c !== "+" && c !== "-") return a;
      this.i++;
      a = { k: "bin", op: c, a, b: this.mul() };
    }
  }
  mul(): Expr {
    let a = this.unary();
    for (;;) {
      this.ws();
      const c = this.peek();
      if (c !== "*" && c !== "/" && c !== "%") return a;
      this.i++;
      a = { k: "bin", op: c, a, b: this.unary() };
    }
  }
  unary(): Expr {
    this.ws();
    if (this.eat("!")) return { k: "un", op: "!", a: this.unary() };
    if (this.peek() === "-" && !/[\d.]/.test(this.peek(1) ?? "")) {
      this.i++;
      return { k: "un", op: "-", a: this.unary() };
    }
    return this.primary();
  }
  primary(): Expr {
    this.ws();
    const c = this.peek();
    if (c === "(") {
      this.i++;
      const e = this.expr();
      this.need(")");
      return e;
    }
    if (c === "@" || c === "$") {
      this.i++;
      return { k: "path", root: c, steps: this.steps() };
    }
    if (c === "'" || c === '"') return { k: "lit", v: this.str() };
    const num = this.match(NUMBER);
    if (num !== undefined) return { k: "lit", v: Number(num) };
    const word = this.match(WORD);
    if (word !== undefined) return { k: "lit", v: word === "true" ? true : word === "false" ? false : word === "null" ? null : undefined };
    return this.fail("a value");
  }
  steps(): Step[] {
    const steps: Step[] = [];
    for (;;) {
      if (this.peek() === "." && this.peek(1) !== ".") {
        this.i++;
        const name = this.match(EXPR_NAME);
        if (name === undefined) this.fail("a property name");
        steps.push({ k: "name", name });
      } else if (this.peek() === "[") {
        this.i++;
        this.ws();
        const c = this.peek();
        steps.push(c === "'" || c === '"' ? { k: "name", name: this.str() } : { k: "expr", e: this.expr() });
        this.need("]");
      } else return steps;
    }
  }
  regex(): Expr {
    this.ws();
    const at = this.i;
    const c = this.peek();
    if (c === "'" || c === '"') return { k: "re", re: this.mkRe(this.str(), "", at) };
    if (!this.eat("/")) this.fail("a /regex/");
    let src = "";
    let inClass = false;
    while (this.i < this.s.length) {
      const ch = this.s[this.i++];
      if (ch === "\\") {
        src += ch + (this.s[this.i++] ?? "");
        continue;
      }
      if (ch === "/" && !inClass) {
        const flags = this.match(/[gimsuy]*/y) ?? "";
        return { k: "re", re: this.mkRe(src, flags.replace("g", ""), at) };
      }
      if (ch === "[") inClass = true;
      else if (ch === "]") inClass = false;
      src += ch;
    }
    return this.fail("closing /");
  }
  mkRe(src: string, flags: string, at: number): RegExp {
    try {
      return new RegExp(src, flags);
    } catch {
      return this.fail("a valid regex", at);
    }
  }
}

export function compile(src: string): JsonPath {
  const segs = new Parser(src).path();
  const singular = segs.every((s) => !s.desc && s.sels.length === 1 && ["name", "index", "script"].includes(s.sels[0].k));
  return { segs, singular };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

function children(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (isObj(v)) return Object.values(v);
  return [];
}

function child(v: unknown, key: string | number): unknown {
  if (Array.isArray(v)) {
    if (key === "length") return v.length;
    const n = typeof key === "number" ? Math.trunc(key) : /^-?\d+$/.test(key) ? Number(key) : NaN;
    if (Number.isNaN(n)) return undefined;
    const i = n < 0 ? v.length + n : n;
    return i >= 0 && i < v.length ? v[i] : undefined;
  }
  if (typeof v === "string") return key === "length" ? v.length : undefined;
  if (isObj(v)) return has(v, String(key)) ? v[String(key)] : undefined;
  return undefined;
}

function slice(a: unknown[], { start, end, step = 1 }: { start?: number; end?: number; step?: number }): unknown[] {
  const out: unknown[] = [];
  if (step === 0) return out;
  const n = a.length;
  const norm = (i: number) => (i < 0 ? n + i : i);
  const clamp = (i: number, lo: number, hi: number) => Math.min(Math.max(i, lo), hi);
  if (step > 0) {
    const hi = clamp(norm(end ?? n), 0, n);
    for (let i = clamp(norm(start ?? 0), 0, n); i < hi; i += step) out.push(a[i]);
  } else {
    const lo = end === undefined ? -1 : clamp(norm(end), -1, n - 1);
    for (let i = start === undefined ? n - 1 : clamp(norm(start), -1, n - 1); i > lo; i += step) out.push(a[i]);
  }
  return out;
}

const truthy = (v: unknown) => (typeof v === "number" ? v !== 0 && !Number.isNaN(v) : Boolean(v));

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function evaluate(e: Expr, at: unknown, root: unknown): unknown {
  switch (e.k) {
    case "lit":
      return e.v;
    case "re":
      return e.re;
    case "path": {
      let v: unknown = e.root === "@" ? at : root;
      for (const s of e.steps) {
        if (v === undefined) return undefined;
        const key = s.k === "name" ? s.name : evaluate(s.e, at, root);
        v = typeof key === "number" || typeof key === "string" ? child(v, key) : undefined;
      }
      return v;
    }
    case "un":
      return e.op === "!" ? !truthy(evaluate(e.a, at, root)) : -Number(evaluate(e.a, at, root));
    case "bin": {
      if (e.op === "&&") return truthy(evaluate(e.a, at, root)) && truthy(evaluate(e.b, at, root));
      if (e.op === "||") return truthy(evaluate(e.a, at, root)) || truthy(evaluate(e.b, at, root));
      const a = evaluate(e.a, at, root);
      const b = evaluate(e.b, at, root);
      switch (e.op) {
        case "==":
        case "===":
          return equal(a, b);
        case "!=":
        case "!==":
          return !equal(a, b);
        case "=~":
          return typeof a === "string" && b instanceof RegExp && b.test(a);
        case "<":
        case "<=":
        case ">":
        case ">=": {
          const comparable = (typeof a === "number" && typeof b === "number") || (typeof a === "string" && typeof b === "string");
          if (!comparable) return false;
          const x = a as number | string;
          const y = b as number | string;
          return e.op === "<" ? x < y : e.op === "<=" ? x <= y : e.op === ">" ? x > y : x >= y;
        }
        case "+":
          return typeof a === "string" || typeof b === "string" ? `${a}${b}` : Number(a) + Number(b);
        case "-":
          return Number(a) - Number(b);
        case "*":
          return Number(a) * Number(b);
        case "/":
          return Number(a) / Number(b);
        case "%":
          return Number(a) % Number(b);
      }
      return undefined;
    }
  }
}

function select(v: unknown, sel: Sel, root: unknown, out: unknown[]) {
  const push = (x: unknown) => {
    if (x !== undefined) out.push(x);
  };
  switch (sel.k) {
    case "name":
      return push(child(v, sel.name));
    case "index":
      return Array.isArray(v) ? push(child(v, sel.i)) : undefined;
    case "wild":
      for (const c of children(v)) out.push(c);
      return;
    case "slice":
      if (Array.isArray(v)) for (const c of slice(v, sel)) out.push(c);
      return;
    case "filter":
      for (const c of children(v)) {
        const r = evaluate(sel.e, c, root);
        // a bare path tests that the member exists, so [?(@.balance)] keeps balance: 0
        if (sel.e.k === "path" ? r !== undefined : truthy(r)) out.push(c);
      }
      return;
    case "script": {
      const key = evaluate(sel.e, v, root);
      if (typeof key === "number" || typeof key === "string") push(child(v, key));
    }
  }
}

/** Every value the path selects, in document order. */
export function query(root: unknown, path: JsonPath): unknown[] {
  let nodes: unknown[] = [root];
  for (const seg of path.segs) {
    const next: unknown[] = [];
    for (const n of nodes) {
      if (!seg.desc) {
        for (const s of seg.sels) select(n, s, root, next);
        continue;
      }
      // the node itself, then its descendants, depth first
      const stack: unknown[] = [n];
      while (stack.length) {
        const d = stack.pop();
        for (const s of seg.sels) select(d, s, root, next);
        const cs = children(d);
        for (let i = cs.length - 1; i >= 0; i--) if (typeof cs[i] === "object" && cs[i] !== null) stack.push(cs[i]);
      }
    }
    nodes = next;
  }
  return nodes;
}
