// voidHTTP script sandbox: the `pm` API, `console`, a small chai-style `pm.expect`, and the legacy Postman globals.
// Runs inside QuickJS (src/script.rs) before the user's script. There is no network, file or host access here:
// what goes in is `__input` (JSON), what comes out is `__finish()` (JSON). Everything else stays inside the sandbox.
(function () {
  "use strict";
  const input = JSON.parse(globalThis.__input);
  delete globalThis.__input;

  const phase = input.phase === "post" ? "post" : "pre";
  const started = Date.now();
  const out = { logs: [], tests: [], vars: [], error: null };

  // ---------- formatting ----------
  const tag = (v) => Object.prototype.toString.call(v).slice(8, -1);
  /** A short, readable form of any value; strings quoted with `q`. */
  function inspect(v, q, seen) {
    q = q || "'";
    seen = seen || [];
    if (typeof v === "string") return q + v + q;
    if (v === null || v === undefined || typeof v === "number" || typeof v === "boolean") return String(v);
    if (typeof v === "bigint") return v + "n";
    if (typeof v === "symbol") return v.toString();
    if (typeof v === "function") return "[Function" + (v.name ? ": " + v.name : "") + "]";
    if (v instanceof Date) return isNaN(v) ? "Invalid Date" : v.toISOString();
    if (v instanceof RegExp) return String(v);
    if (v instanceof Error) return v.name + ": " + v.message;
    if (seen.indexOf(v) >= 0) return "[Circular]";
    seen.push(v);
    let s;
    if (Array.isArray(v)) s = v.length ? "[ " + v.map((x) => inspect(x, q, seen)).join(", ") + " ]" : "[]";
    else {
      const keys = Object.keys(v);
      s = keys.length ? "{ " + keys.map((k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : q + k + q) + ": " + inspect(v[k], q, seen)).join(", ") + " }" : "{}";
    }
    seen.pop();
    return s;
  }
  const short = (v) => {
    const s = inspect(v);
    return s.length > 120 ? s.slice(0, 117) + "..." : s;
  };
  const text = (v) => (typeof v === "string" ? v : inspect(v, '"'));
  const errText = (e) => (e && typeof e === "object" && "message" in e ? (e.name || "Error") + ": " + e.message : String(e));
  /** The line in the user's script an error came from: the first `script:<line>` frame of its stack. */
  const lineOf = (e) => {
    const m = e && typeof e.stack === "string" && /script:(\d+)/.exec(e.stack);
    return m ? Number(m[1]) : undefined;
  };

  // ---------- console ----------
  // a script that logs in a loop must not flood the app: lines and line length are capped, the rest counted
  const MAX_LOGS = 1000;
  const MAX_LINE = 10000;
  let droppedLogs = 0;
  const note = (level, msg) => {
    if (out.logs.length >= MAX_LOGS) return void droppedLogs++;
    out.logs.push({ level, text: msg.length > MAX_LINE ? msg.slice(0, MAX_LINE) + "…" : msg, at: Date.now() - started });
  };
  const logger = (level) =>
    function () {
      if (out.logs.length >= MAX_LOGS) return void droppedLogs++;
      note(level, Array.prototype.map.call(arguments, text).join(" "));
    };
  globalThis.console = { log: logger("log"), info: logger("info"), debug: logger("log"), warn: logger("warn"), error: logger("error") };

  // ---------- variables ----------
  /** What a stored variable holds: text, as the variable tables keep it. */
  const stored = (v) => (typeof v === "string" ? v : v === undefined ? "" : typeof v === "object" && v !== null ? JSON.stringify(v) : String(v));

  /**
   * One variable scope. `kept` scopes report every change in `out.vars` so the app saves it;
   * `missing` is why a kept scope cannot keep anything (no environment selected, request not in a collection).
   */
  function scope(name, values, kept, missing) {
    const map = new Map(Object.entries(values || {}));
    const record = (op, key, value) => {
      if (!kept) return;
      if (missing) return note("warn", missing + ": " + name + "." + op + (key !== undefined ? " " + key : "") + " was not kept");
      out.vars.push({ scope: name, op, key, value });
      note("var", name + "." + op + (key !== undefined ? " " + key : "") + (op === "set" ? " = " + inspect(value, '"') : ""));
    };
    return {
      get: (k) => map.get(String(k)),
      has: (k) => map.has(String(k)),
      set(k, v) {
        const value = stored(v);
        map.set(String(k), value);
        record("set", String(k), value);
      },
      unset(k) {
        map.delete(String(k));
        record("unset", String(k));
      },
      clear() {
        map.clear();
        record("clear");
      },
      toObject: () => Object.fromEntries(map),
      replaceIn: (s) => replaceIn(s),
      _map: map,
    };
  }

  const env = input.environment;
  const environment = scope("environment", env && env.values, true, env ? null : "No environment is selected");
  environment.name = env ? env.name : undefined;
  const collectionVariables = scope("collectionVariables", input.collectionVariables, true, input.inCollection ? null : "This request is not saved in a collection");
  const globals = scope("globals", {}, true, "voidHTTP has no global variables yet");
  // pm.variables: this send only, carried from the pre-request script into the post-response one
  const local = scope("variables", input.locals, false);
  const iterationData = scope("iterationData", {}, false);

  /** Postman's lookup order, as voidHTTP resolves {{name}}: this run's values, then the environment, then the collection. */
  const lookup = (k) => {
    for (const s of [local, environment, collectionVariables, globals]) if (s._map.has(k)) return s._map.get(k);
    return undefined;
  };
  const dynamic = (n) => {
    if (n === "$guid" || n === "$randomUUID") return uuid();
    if (n === "$timestamp") return String(Math.floor(Date.now() / 1000));
    if (n === "$isoTimestamp") return new Date().toISOString();
    if (n === "$randomInt") return String(Math.floor(Math.random() * 1001));
    if (n.startsWith("$random")) {
      // faker, Postman's other {{$random…}} names: loaded on first use, then kept for this run
      if (typeof globalThis.__voidFake !== "function") __loadFake();
      return globalThis.__voidFake(n);
    }
    return undefined;
  };
  function replaceIn(s, depth) {
    if (typeof s !== "string" || (depth || 0) > 5 || s.indexOf("{{") < 0) return s;
    const next = s.replace(/\{\{([^{}]*)\}\}/g, (m, raw) => {
      const n = raw.trim();
      const v = lookup(n);
      return v !== undefined ? stored(v) : dynamic(n) ?? m;
    });
    return next === s ? s : replaceIn(next, (depth || 0) + 1);
  }
  const variables = {
    get: (k) => lookup(String(k)),
    has: (k) => lookup(String(k)) !== undefined,
    set: (k, v) => local.set(k, v),
    unset: (k) => local.unset(k),
    toObject: () => Object.assign({}, collectionVariables.toObject(), environment.toObject(), local.toObject()),
    replaceIn: (s) => replaceIn(s),
  };

  function uuid() {
    const h = "0123456789abcdef";
    let s = "";
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) s += "-";
      else if (i === 14) s += "4";
      else if (i === 19) s += h[(Math.random() * 4) | 8];
      else s += h[(Math.random() * 16) | 0];
    }
    return s;
  }

  // ---------- headers ----------
  function headerList(rows, readOnly) {
    const list = (rows || []).map((h) => ({ key: String(h.key), value: String(h.value) }));
    const find = (k) => {
      const n = String(k).toLowerCase();
      for (let i = list.length - 1; i >= 0; i--) if (list[i].key.toLowerCase() === n) return list[i];
      return undefined;
    };
    const norm = (h, v) => (typeof h === "string" ? (v === undefined && h.indexOf(":") > 0 ? { key: h.slice(0, h.indexOf(":")).trim(), value: h.slice(h.indexOf(":") + 1).trim() } : { key: h, value: v }) : h);
    const guard = () => {
      if (readOnly) throw new TypeError("Response headers cannot be changed");
    };
    return {
      get: (k) => (find(k) || {}).value,
      has: (k, v) => {
        const h = find(k);
        return !!h && (v === undefined || h.value === String(v));
      },
      one: (k) => find(k),
      all: () => list.map((h) => ({ key: h.key, value: h.value })),
      toObject: () => Object.fromEntries(list.map((h) => [h.key, h.value])),
      each: (fn) => list.forEach((h) => fn({ key: h.key, value: h.value })),
      map: (fn) => list.map((h) => fn({ key: h.key, value: h.value })),
      filter: (fn) => list.filter((h) => fn({ key: h.key, value: h.value })),
      count: () => list.length,
      add(h, v) {
        guard();
        h = norm(h, v);
        list.push({ key: String(h.key), value: stored(h.value) });
      },
      upsert(h, v) {
        guard();
        h = norm(h, v);
        const hit = find(h.key);
        if (hit) hit.value = stored(h.value);
        else list.push({ key: String(h.key), value: stored(h.value) });
      },
      remove(k) {
        guard();
        const n = typeof k === "string" ? k.toLowerCase() : null;
        for (let i = list.length - 1; i >= 0; i--) if (n ? list[i].key.toLowerCase() === n : k(list[i])) list.splice(i, 1);
      },
      clear() {
        guard();
        list.length = 0;
      },
      toString: () => list.map((h) => h.key + ": " + h.value).join("\n"),
      _list: list,
    };
  }

  // ---------- request ----------
  const r = input.request || { method: "GET", url: "", headers: [], body: null };
  let url = String(r.url || "");
  let method = String(r.method || "GET");
  let body = r.body ? String(r.body.raw ?? "") : null;
  const reqHeaders = headerList(r.headers, phase === "post");
  const startHeaders = JSON.stringify(reqHeaders._list);

  const splitUrl = (u) => {
    const h = u.indexOf("#");
    const base = h >= 0 ? u.slice(0, h) : u;
    const q = base.indexOf("?");
    return { path: q >= 0 ? base.slice(0, q) : base, query: q >= 0 ? base.slice(q + 1) : "", hash: h >= 0 ? u.slice(h) : "" };
  };
  const queryList = () =>
    splitUrl(url)
      .query.split("&")
      .filter(Boolean)
      .map((p) => {
        const i = p.indexOf("=");
        return i >= 0 ? { key: p.slice(0, i), value: p.slice(i + 1) } : { key: p, value: null };
      });
  /** A new query key or value: only what would break the URL is encoded, so {{variables}} stay as written. */
  const enc = (v, key) => String(v).replace(key ? /[&#= +%]/g : /[&# +]/g, (c) => (c === " " ? "%20" : encodeURIComponent(c)));
  const setQuery = (list) => {
    const p = splitUrl(url);
    const q = list.map((x) => (x.value === null || x.value === undefined ? x.key : x.key + "=" + x.value)).join("&");
    url = p.path + (q ? "?" + q : "") + p.hash;
  };
  const urlObject = () => {
    const p = splitUrl(url);
    const m = /^([a-z][a-z0-9+.-]*:\/\/)?([^/?#]*)(.*)$/i.exec(p.path) || [];
    return {
      toString: () => url,
      getHost: () => m[2] || "",
      getPath: () => m[3] || "/",
      getQueryString: () => p.query,
      query: {
        all: () => queryList(),
        get: (k) => (queryList().filter((x) => x.key === k).pop() || {}).value,
        has: (k) => queryList().some((x) => x.key === k),
        toObject: () => Object.fromEntries(queryList().map((x) => [x.key, x.value])),
        add(x) {
          setQuery(queryList().concat([{ key: enc(x.key, true), value: x.value === undefined || x.value === null ? null : enc(stored(x.value)) }]));
        },
        upsert(x) {
          const l = queryList();
          const key = enc(x.key, true);
          const hit = l.find((y) => y.key === key);
          if (hit) hit.value = enc(stored(x.value));
          else l.push({ key, value: enc(stored(x.value)) });
          setQuery(l);
        },
        remove(k) {
          setQuery(queryList().filter((x) => (typeof k === "function" ? !k(x) : x.key !== k)));
        },
      },
    };
  };
  const bodyObject = () =>
    body === null
      ? undefined
      : {
          mode: "raw",
          get raw() {
            return body;
          },
          set raw(v) {
            if (phase === "post") throw new TypeError("The request was already sent");
            body = stored(v);
          },
          update(v) {
            this.raw = typeof v === "string" ? v : v && typeof v === "object" && "raw" in v ? v.raw : JSON.stringify(v);
          },
          toString: () => body,
        };
  const request = {
    get url() {
      return urlObject();
    },
    set url(v) {
      if (phase === "post") throw new TypeError("The request was already sent");
      url = String(v);
    },
    get method() {
      return method;
    },
    set method(v) {
      if (phase === "post") throw new TypeError("The request was already sent");
      method = String(v).toUpperCase();
    },
    headers: reqHeaders,
    get body() {
      return bodyObject();
    },
    addHeader: (h) => reqHeaders.add(h),
    removeHeader: (k) => reqHeaders.remove(k),
    upsertHeader: (h) => reqHeaders.upsert(h),
  };

  // ---------- assertions (chai-style subset) ----------
  class AssertionError extends Error {
    constructor(message) {
      super(message);
      this.name = "AssertionError";
    }
  }
  function deepEqual(a, b, seen) {
    if (Object.is(a, b)) return true;
    if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
    if (tag(a) !== tag(b)) return false;
    if (a instanceof Date) return a.getTime() === b.getTime();
    if (a instanceof RegExp) return String(a) === String(b);
    seen = seen || [];
    if (seen.some((p) => p[0] === a && p[1] === b)) return true;
    seen.push([a, b]);
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k], seen));
  }
  const typeName = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : v instanceof Date ? "date" : v instanceof RegExp ? "regexp" : typeof v === "object" ? tag(v).toLowerCase() : typeof v);
  const sizeOf = (v) => (v instanceof Map || v instanceof Set ? v.size : v == null ? undefined : v.length);
  const pathGet = (o, path) => {
    let cur = o;
    for (const part of String(path).replace(/\[(\w+)\]/g, ".$1").split(".")) {
      if (cur === null || cur === undefined || !(Object(cur) instanceof Object) || !(part in Object(cur))) return { found: false };
      cur = cur[part];
    }
    return { found: true, value: cur };
  };

  function Assertion(obj, msg, flags) {
    this._obj = obj;
    this._msg = msg;
    this._flags = flags || {};
  }
  const A = Assertion.prototype;
  A._assert = function (ok, pos, neg) {
    if (this._flags.not ? ok : !ok) throw new AssertionError((this._msg ? this._msg + ": " : "") + (this._flags.not ? neg : pos));
    return this;
  };
  A._subject = function () {
    return this._flags.length ? sizeOf(this._obj) : this._obj;
  };
  for (const c of ["to", "be", "been", "is", "that", "which", "and", "has", "have", "with", "at", "of", "same", "but", "does", "still", "also"])
    Object.defineProperty(A, c, { get() { return this; } });
  for (const f of ["not", "deep", "nested", "own", "any", "all", "ordered"])
    Object.defineProperty(A, f, { get() { this._flags[f] = !this._flags[f]; return this; } });
  const getter = (name, fn) => Object.defineProperty(A, name, { get() { return fn.call(this); } });
  getter("ok", function () { return this._assert(!!this._obj, `expected ${short(this._obj)} to be truthy`, `expected ${short(this._obj)} to be falsy`); });
  getter("true", function () { return this._assert(this._obj === true, `expected ${short(this._obj)} to be true`, `expected ${short(this._obj)} to be false`); });
  getter("false", function () { return this._assert(this._obj === false, `expected ${short(this._obj)} to be false`, `expected ${short(this._obj)} to be true`); });
  getter("null", function () { return this._assert(this._obj === null, `expected ${short(this._obj)} to be null`, `expected ${short(this._obj)} not to be null`); });
  getter("undefined", function () { return this._assert(this._obj === undefined, `expected ${short(this._obj)} to be undefined`, `expected ${short(this._obj)} not to be undefined`); });
  getter("NaN", function () { return this._assert(Number.isNaN(this._obj), `expected ${short(this._obj)} to be NaN`, `expected ${short(this._obj)} not to be NaN`); });
  getter("exist", function () { return this._assert(this._obj !== null && this._obj !== undefined, `expected ${short(this._obj)} to exist`, `expected ${short(this._obj)} to not exist`); });
  getter("empty", function () {
    const o = this._obj;
    const n = typeof o === "string" || Array.isArray(o) ? o.length : o instanceof Map || o instanceof Set ? o.size : o && typeof o === "object" ? Object.keys(o).length : NaN;
    return this._assert(n === 0, `expected ${short(o)} to be empty`, `expected ${short(o)} not to be empty`);
  });
  // `length` and `lengthOf`: a call checks the length, a chain (`.length.above(2)`) compares it
  Object.defineProperty(A, "length", {
    get() {
      const self = this;
      const fn = function (n) {
        return self.lengthOf(n);
      };
      self._flags.length = true;
      Object.setPrototypeOf(fn, self);
      return fn;
    },
  });
  A.lengthOf = function (n) {
    const len = sizeOf(this._obj);
    return this._assert(len === n, `expected ${short(this._obj)} to have a length of ${n} but got ${len}`, `expected ${short(this._obj)} to not have a length of ${n}`);
  };
  A.a = A.an = function (type) {
    const t = String(type).toLowerCase();
    const art = /^[aeiou]/.test(t) ? "an" : "a";
    return this._assert(typeName(this._obj) === t, `expected ${short(this._obj)} to be ${art} ${t}`, `expected ${short(this._obj)} not to be ${art} ${t}`);
  };
  A.equal = A.equals = A.eq = function (v) {
    if (this._flags.deep) return this.eql(v);
    const s = this._subject();
    return this._assert(s === v, `expected ${short(s)} to equal ${short(v)}`, `expected ${short(s)} to not equal ${short(v)}`);
  };
  A.eql = A.eqls = function (v) {
    return this._assert(deepEqual(this._obj, v), `expected ${short(this._obj)} to deeply equal ${short(v)}`, `expected ${short(this._obj)} to not deeply equal ${short(v)}`);
  };
  const compare = (name, test, word) =>
    function (n) {
      const s = this._subject();
      const what = this._flags.length ? `${short(this._obj)} to have a length ${word} ${n} but got ${s}` : `${short(s)} to be ${word} ${short(n)}`;
      return this._assert(test(s, n), "expected " + what, "expected " + what.replace(" to ", " to not "));
    };
  A.above = A.gt = A.greaterThan = compare("above", (a, b) => a > b, "above");
  A.least = A.gte = A.greaterThanOrEqual = compare("least", (a, b) => a >= b, "at least");
  A.below = A.lt = A.lessThan = compare("below", (a, b) => a < b, "below");
  A.most = A.lte = A.lessThanOrEqual = compare("most", (a, b) => a <= b, "at most");
  A.within = function (lo, hi) {
    const s = this._subject();
    return this._assert(s >= lo && s <= hi, `expected ${short(s)} to be within ${lo}..${hi}`, `expected ${short(s)} to not be within ${lo}..${hi}`);
  };
  A.closeTo = A.approximately = function (v, d) {
    return this._assert(Math.abs(this._obj - v) <= d, `expected ${short(this._obj)} to be close to ${v} +/- ${d}`, `expected ${short(this._obj)} not to be close to ${v} +/- ${d}`);
  };
  // `include` and friends: a call checks membership, a chain (`.include.keys("id")`) lets keys be a subset
  for (const name of ["include", "includes", "contain", "contains"])
    Object.defineProperty(A, name, {
      get() {
        const self = this;
        const fn = function (v) {
          return self._include(v);
        };
        self._flags.contains = true;
        Object.setPrototypeOf(fn, self);
        return fn;
      },
    });
  A._include = function (v) {
    const o = this._obj;
    let ok;
    if (typeof o === "string") ok = o.indexOf(v) >= 0;
    else if (Array.isArray(o)) ok = this._flags.deep ? o.some((x) => deepEqual(x, v)) : o.indexOf(v) >= 0;
    else if (o instanceof Set || o instanceof Map) ok = o.has(v);
    else if (o && typeof o === "object" && v && typeof v === "object") ok = Object.keys(v).every((k) => (this._flags.deep ? deepEqual(o[k], v[k]) : o[k] === v[k]));
    else ok = false;
    return this._assert(ok, `expected ${short(o)} to include ${short(v)}`, `expected ${short(o)} to not include ${short(v)}`);
  };
  A.string = function (s) {
    return this._assert(typeof this._obj === "string" && this._obj.indexOf(s) >= 0, `expected ${short(this._obj)} to contain ${short(s)}`, `expected ${short(this._obj)} to not contain ${short(s)}`);
  };
  A.match = A.matches = function (re) {
    return this._assert(re.test(String(this._obj)), `expected ${short(this._obj)} to match ${re}`, `expected ${short(this._obj)} not to match ${re}`);
  };
  A.property = function (name, val) {
    const o = this._obj;
    const hit = this._flags.nested ? pathGet(o, name) : o !== null && o !== undefined && (this._flags.own ? Object.prototype.hasOwnProperty.call(o, name) : name in Object(o)) ? { found: true, value: o[name] } : { found: false };
    if (arguments.length < 2) {
      this._assert(hit.found, `expected ${short(o)} to have property ${short(name)}`, `expected ${short(o)} to not have property ${short(name)}`);
      return hit.found && !this._flags.not ? new Assertion(hit.value, this._msg) : this;
    }
    const same = hit.found && (this._flags.deep ? deepEqual(hit.value, val) : hit.value === val);
    return this._assert(
      same,
      `expected ${short(o)} to have property ${short(name)} of ${short(val)}` + (hit.found ? `, but got ${short(hit.value)}` : ""),
      `expected ${short(o)} to not have property ${short(name)} of ${short(val)}`,
    );
  };
  A.ownProperty = A.haveOwnProperty = function (name, val) {
    this._flags.own = true;
    return arguments.length < 2 ? this.property(name) : this.property(name, val);
  };
  A.nestedProperty = function (name, val) {
    this._flags.nested = true;
    return arguments.length < 2 ? this.property(name) : this.property(name, val);
  };
  A.keys = A.key = function () {
    const want = Array.isArray(arguments[0]) ? arguments[0] : typeof arguments[0] === "object" && arguments[0] !== null ? Object.keys(arguments[0]) : Array.from(arguments);
    const have = this._obj && typeof this._obj === "object" ? Object.keys(this._obj) : [];
    // chai: `.keys` asks for exactly these keys, `.include.keys` for at least these, `.any.keys` for one of them
    const ok = this._flags.any ? want.some((k) => have.indexOf(k) >= 0) : want.every((k) => have.indexOf(k) >= 0) && (this._flags.contains || want.length === have.length);
    const how = this._flags.any ? "any of" : "all of";
    return this._assert(ok, `expected ${short(this._obj)} to have ${how} keys ${want.map((k) => short(k)).join(", ")}`, `expected ${short(this._obj)} to not have ${how} keys ${want.map((k) => short(k)).join(", ")}`);
  };
  A.members = function (list) {
    // same members, each as many times: [1, 1, 2] and [1, 2, 2] differ
    const o = this._obj;
    const same = (x, y) => (this._flags.deep ? deepEqual(x, y) : x === y);
    const rest = Array.isArray(o) ? o.slice() : null;
    const ok =
      !!rest &&
      list.length === rest.length &&
      list.every((x) => {
        const i = rest.findIndex((y) => same(x, y));
        return i >= 0 && rest.splice(i, 1);
      });
    return this._assert(ok, `expected ${short(o)} to have the same members as ${short(list)}`, `expected ${short(o)} to not have the same members as ${short(list)}`);
  };
  A.oneOf = function (list) {
    const ok = list.some((x) => (this._flags.deep ? deepEqual(x, this._obj) : x === this._obj));
    return this._assert(ok, `expected ${short(this._obj)} to be one of ${short(list)}`, `expected ${short(this._obj)} to not be one of ${short(list)}`);
  };
  A.instanceOf = A.instanceof = function (C) {
    return this._assert(this._obj instanceof C, `expected ${short(this._obj)} to be an instance of ${C && C.name}`, `expected ${short(this._obj)} to not be an instance of ${C && C.name}`);
  };
  A.satisfy = A.satisfies = function (fn) {
    return this._assert(!!fn(this._obj), `expected ${short(this._obj)} to satisfy ${fn.name || "the function"}`, `expected ${short(this._obj)} to not satisfy ${fn.name || "the function"}`);
  };
  A.throw = A.throws = A.Throw = function (want) {
    let thrown = null;
    try {
      this._obj();
    } catch (e) {
      thrown = e;
    }
    const hit = thrown !== null && (want === undefined || (typeof want === "string" ? String(thrown && thrown.message).indexOf(want) >= 0 : want instanceof RegExp ? want.test(String(thrown && thrown.message)) : thrown instanceof want));
    return this._assert(hit, "expected the function to throw" + (want !== undefined ? " " + short(want) : ""), "expected the function not to throw, but it threw " + errText(thrown));
  };
  A.status = function (code) {
    return statusCheck(this, this._obj, code);
  };

  // ---------- response ----------
  let response;
  if (input.response) {
    const res = input.response;
    const rh = headerList(res.headers, true);
    if (res.bodyTruncated) note("warn", "The response body is over 8 MB: scripts see only its first 8 MB");
    let parsed;
    let parsedOk = false;
    const json = () => {
      if (!parsedOk) {
        const t = String(res.body || "").replace(/^﻿/, "");
        try {
          parsed = JSON.parse(t);
        } catch (e) {
          const err = new SyntaxError("The response body is not JSON: " + e.message);
          err.name = "JSONError";
          throw err;
        }
        parsedOk = true;
      }
      return parsed;
    };
    // every check hands back `to`, so `pm.response.to.be.ok.and.have.status(200)` reads as in Postman
    const fail = (ok, msg) => {
      if (!ok) throw new AssertionError(msg);
      return to;
    };
    const to = {
      have: {
        status: (code) => (statusCheck(null, response, code), to),
        header: (k, v) => fail(rh.has(k, v), v === undefined ? `expected the response to have header ${short(k)}` : `expected header ${short(k)} to be ${short(v)}, but got ${short(rh.get(k))}`),
        body: (s) => fail(s === undefined ? String(res.body || "").length > 0 : s instanceof RegExp ? s.test(res.body) : res.body === s, s === undefined ? "expected the response to have a body" : `expected the response body to be ${short(s)}`),
        jsonBody: (path, v) => {
          const b = json();
          if (path === undefined) return to;
          if (typeof path === "object") return fail(deepEqual(b, path), `expected the response body to deeply equal ${short(path)}`);
          const hit = pathGet(b, path);
          fail(hit.found && (v === undefined || deepEqual(hit.value, v)), v === undefined ? `expected the response body to have ${short(path)}` : `expected ${short(path)} to be ${short(v)}, but got ${short(hit.value)}`);
        },
      },
      be: {},
    };
    const range = (name, lo, hi, word) => Object.defineProperty(to.be, name, { get: () => fail(res.code >= lo && res.code <= hi, `expected the response to be ${word}, but got ${res.code}`) });
    range("ok", 200, 299, "ok");
    range("success", 200, 299, "a success");
    range("info", 100, 199, "informational");
    range("redirection", 300, 399, "a redirect");
    range("clientError", 400, 499, "a client error");
    range("serverError", 500, 599, "a server error");
    range("error", 400, 599, "an error");
    Object.defineProperty(to.be, "json", { get: () => (json(), to) });
    for (const c of ["and", "to"]) Object.defineProperty(to, c, { get: () => to });
    to.have.and = to.be.and = to;
    response = {
      code: res.code,
      status: res.status,
      responseTime: res.responseTime,
      responseSize: res.size,
      headers: rh,
      text: () => String(res.body || ""),
      json,
      reason: () => res.status,
      to,
    };
  }
  function statusCheck(a, res, code) {
    const ok = typeof code === "number" ? res && res.code === code : res && String(res.status).toLowerCase() === String(code).toLowerCase();
    const msg = `expected the response to have status ${typeof code === "number" ? "code " + code : short(code)} but got ${res ? (typeof code === "number" ? res.code : short(res.status)) : "no response"}`;
    if (a) return a._assert(ok, msg, `expected the response to not have status ${code}`);
    if (!ok) throw new AssertionError(msg);
  }

  // ---------- tests ----------
  function test(name, fn) {
    const rec = { name: String(name), passed: true };
    out.tests.push(rec);
    const failed = (e) => {
      rec.passed = false;
      rec.error = errText(e);
      rec.line = lineOf(e);
    };
    try {
      const r = typeof fn === "function" ? fn() : undefined;
      if (r && typeof r.then === "function") {
        // an async test passes only once it settles: one still pending at the end failed
        rec.pending = true;
        r.then(
          () => delete rec.pending,
          (e) => {
            delete rec.pending;
            failed(e);
          },
        );
      }
    } catch (e) {
      failed(e);
    }
    return pm;
  }
  test.skip = (name) => {
    out.tests.push({ name: String(name), passed: true, skipped: true });
    return pm;
  };

  const unsupported = (what) => () => {
    throw new Error(what + " is not supported in voidHTTP yet");
  };
  const pm = {
    environment,
    collectionVariables,
    globals,
    variables,
    iterationData,
    request,
    response,
    info: { eventName: phase === "pre" ? "prerequest" : "test", iteration: 0, iterationCount: 1, requestName: input.requestName || "", requestId: input.requestId || "" },
    test,
    expect: (v, msg) => new Assertion(v, msg),
    sendRequest: unsupported("pm.sendRequest"),
    visualizer: { set: unsupported("pm.visualizer") },
    cookies: { get: () => undefined, has: () => false, toObject: () => ({}) },
    execution: {
      setNextRequest: () => note("warn", "pm.execution.setNextRequest does nothing: voidHTTP has no collection runner yet"),
      skipRequest: unsupported("pm.execution.skipRequest"),
      location: [],
    },
  };
  globalThis.pm = pm;

  // ---------- the old Postman sandbox (tests["..."], responseBody, postman.*) ----------
  const tests = {};
  globalThis.tests = tests;
  globalThis.postman = {
    setEnvironmentVariable: (k, v) => environment.set(k, v),
    getEnvironmentVariable: (k) => environment.get(k),
    clearEnvironmentVariable: (k) => environment.unset(k),
    clearEnvironmentVariables: () => environment.clear(),
    setGlobalVariable: (k, v) => globals.set(k, v),
    getGlobalVariable: (k) => globals.get(k),
    clearGlobalVariable: (k) => globals.unset(k),
    getResponseHeader: (k) => response && response.headers.get(k),
    setNextRequest: () => pm.execution.setNextRequest(),
  };
  globalThis.environment = environment.toObject();
  globalThis.globals = {};
  globalThis.data = {};
  globalThis.request = { url, method, headers: reqHeaders.toObject(), data: body };
  if (response) {
    globalThis.responseBody = response.text();
    globalThis.responseCode = { code: response.code, name: response.status, detail: response.status };
    globalThis.responseTime = response.responseTime;
    globalThis.responseHeaders = response.headers.toObject();
  }

  // ---------- small helpers Postman scripts lean on ----------
  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  globalThis.btoa = function (s) {
    s = String(s);
    let o = "";
    for (let i = 0; i < s.length; i += 3) {
      const a = s.charCodeAt(i), b = s.charCodeAt(i + 1), c = s.charCodeAt(i + 2);
      if (a > 255 || b > 255 || c > 255) throw new Error("btoa: the string has characters outside Latin-1");
      const n = (a << 16) | ((b || 0) << 8) | (c || 0);
      o += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < s.length ? B64[(n >> 6) & 63] : "=") + (i + 2 < s.length ? B64[n & 63] : "=");
    }
    return o;
  };
  globalThis.atob = function (s) {
    s = String(s).replace(/[\s=]/g, "");
    let o = "";
    for (let i = 0; i < s.length; i += 4) {
      const n = (B64.indexOf(s[i]) << 18) | (B64.indexOf(s[i + 1]) << 12) | ((B64.indexOf(s[i + 2]) & 63) << 6) | (B64.indexOf(s[i + 3]) & 63);
      o += String.fromCharCode((n >> 16) & 255);
      if (i + 2 < s.length) o += String.fromCharCode((n >> 8) & 255);
      if (i + 3 < s.length) o += String.fromCharCode(n & 255);
    }
    return o;
  };
  globalThis.require = (name) => {
    throw new Error(`require('${name}') is not available in voidHTTP`);
  };

  // ---------- the host's two hooks ----------
  /** An error the script threw (or the engine raised: timeout, out of memory). */
  globalThis.__fail = (e, message) => {
    out.error = message ? { name: "Error", message } : { name: (e && e.name) || "Error", message: e && typeof e === "object" && "message" in e ? String(e.message) : String(e), line: lineOf(e) };
    note("error", out.error.name + ": " + out.error.message + (out.error.line ? " · line " + out.error.line : ""));
  };
  /** What the script left behind, as JSON. */
  globalThis.__finish = () => {
    for (const k of Object.keys(tests)) out.tests.push({ name: k, passed: !!tests[k] });
    for (const t of out.tests)
      if (t.pending) {
        delete t.pending;
        t.passed = false;
        t.error = "The test did not finish: its promise never settled";
      }
    if (droppedLogs) out.logs.push({ level: "warn", text: droppedLogs + " more lines were not kept", at: Date.now() - started });
    if (phase === "pre") {
      const changed = url !== String(r.url || "") || method !== String(r.method || "GET") || JSON.stringify(reqHeaders._list) !== startHeaders || body !== (r.body ? String(r.body.raw ?? "") : null);
      if (changed) out.request = { url, method, headers: reqHeaders._list, body: body === null ? null : { raw: body } };
    }
    out.locals = local.toObject();
    return JSON.stringify(out);
  };
})();
