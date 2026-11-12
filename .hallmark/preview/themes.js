/* Preview copy of src/lib/themes.ts: Ghostty colour schemes turned into voidHTTP tokens. Keep the two in step. */
(() => {
  /** Ghostty theme files, verbatim: background, foreground, then palette 0..15 */
  const G = (bg, fg, p) => ({ bg, fg, p: p.split(" ") });
  const SCHEMES = [
    { id: "ayu", name: "Ayu", family: "Ayu", g: G("#0b0e14", "#bfbdb6", "#11151c #ea6c73 #7fd962 #f9af4f #53bdfa #cda1fa #90e1c6 #c7c7c7 #686868 #f07178 #aad94c #ffb454 #59c2ff #d2a6ff #95e6cb #ffffff") },
    { id: "ayu-light", name: "Ayu Light", family: "Ayu", g: G("#f8f9fa", "#5c6166", "#000000 #ea6c6d #6cbf43 #eca944 #3199e1 #9e75c7 #46ba94 #bababa #686868 #f07171 #86b300 #f2ae49 #399ee6 #a37acc #4cbf99 #d1d1d1") },
    { id: "ayu-mirage", name: "Ayu Mirage", family: "Ayu", g: G("#1f2430", "#cccac2", "#171b24 #ed8274 #87d96c #facc6e #6dcbfa #dabafa #90e1c6 #c7c7c7 #686868 #f28779 #d5ff80 #ffd173 #73d0ff #dfbfff #95e6cb #ffffff") },
    { id: "atom-one-light", name: "Atom One Light", family: "Atom", g: G("#f9f9f9", "#2a2c33", "#000000 #de3e35 #3f953a #d2b67c #2f5af3 #950095 #3f953a #bbbbbb #000000 #de3e35 #3f953a #d2b67c #2f5af3 #a00095 #3f953a #ffffff") },
    { id: "atom-one-dark", name: "Atom One Dark", family: "Atom", g: G("#21252b", "#abb2bf", "#21252b #e06c75 #98c379 #e5c07b #61afef #c678dd #56b6c2 #abb2bf #767676 #e06c75 #98c379 #e5c07b #61afef #c678dd #56b6c2 #abb2bf") },
    { id: "everforest-light-hard", name: "Everforest Light Hard", family: "Everforest", g: G("#f2efdf", "#5c6a72", "#7a8478 #e67e80 #9ab373 #ceaf72 #7fbbb3 #d699b6 #83c092 #b2af9f #a6b0a0 #f85552 #8da101 #dfa000 #3a94c5 #df69ba #35a77c #fffbef") },
    { id: "everforest-dark-hard", name: "Everforest Dark Hard", family: "Everforest", g: G("#1e2326", "#d3c6aa", "#7a8478 #e67e80 #a7c080 #dbbc7f #7fbbb3 #d699b6 #83c092 #f2efdf #a6b0a0 #f85552 #8da101 #dfa000 #3a94c5 #df69ba #35a77c #fffbef") },
    { id: "gruvbox-light", name: "Gruvbox Light", family: "Gruvbox", g: G("#fbf1c7", "#3c3836", "#fbf1c7 #cc241d #98971a #d79921 #458588 #b16286 #689d6a #7c6f64 #928374 #9d0006 #79740e #b57614 #076678 #8f3f71 #427b58 #3c3836") },
    { id: "gruvbox-material", name: "Gruvbox Material", family: "Gruvbox", g: G("#1d2021", "#d4be98", "#141617 #ea6926 #c1d041 #eecf75 #6da3ec #fd9bc1 #fe9d6e #ffffff #4c4c4c #d3573b #c1d041 #eecf75 #2c86ff #fd9bc1 #92a5df #ffffff") },
    { id: "gruvbox-dark", name: "Gruvbox Dark", family: "Gruvbox", g: G("#282828", "#ebdbb2", "#282828 #cc241d #98971a #d79921 #458588 #b16286 #689d6a #a89984 #928374 #fb4934 #b8bb26 #fabd2f #83a598 #d3869b #8ec07c #ebdbb2") },
  ];

  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const hex = (c) => "#" + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
  /** a weighted toward b by t (0..1), in sRGB */
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };
  const lum = (h) => { const [r, g, b] = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  /** the scheme's own hue, pushed toward black or white only as far as it takes to read on bg */
  const fit = (c, bg, min = 4.5) => {
    const to = lum(bg) > 0.18 ? "#000000" : "#ffffff";
    for (let t = 0; t <= 1; t += 0.04) { const x = mix(c, to, t); if (contrast(x, bg) >= min) return x; }
    return to;
  };
  /** of the normal and bright slot of one hue, the one that reads better on bg */
  const pick = (p, n, bg) => (contrast(p[n + 8], bg) > contrast(p[n], bg) ? p[n + 8] : p[n]);
  const alpha = (h, a) => `rgb(${rgb(h).join(" ")} / ${a})`;

  const isDark = (s) => lum(s.g.bg) < lum(s.g.fg);

  /** every colour token tokens.css defines, derived from one Ghostty scheme */
  function tokens(s) {
    const { bg: B, fg: F, p } = s.g;
    const dark = isDark(s);
    const red = pick(p, 1, B), green = pick(p, 2, B), yellow = pick(p, 3, B), blue = pick(p, 4, B), magenta = pick(p, 5, B), cyan = pick(p, 6, B);
    const orange = mix(red, yellow, 0.5);
    const txt = (c) => fit(c, B);
    // light schemes keep white button text: their blue is darkened just enough for white to read (3:1)
    const accent = dark ? p[4] : fit(p[4], "#ffffff", 3);
    // white on the accent, as the built-in themes do; a dark ink only when the accent is too pale for white (under 3:1)
    const accentInk = contrast("#ffffff", accent) >= 3 ? "#ffffff" : [B, F, "#ffffff", "#000000"].reduce((best, c) => (contrast(c, accent) > contrast(best, accent) ? c : best));
    const muted = fit(mix(F, B, 0.35), B);
    const t = {
      "--color-canvas": dark ? mix(B, "#000000", 0.3) : mix(B, F, 0.05),
      "--color-paper": B, "--color-paper-2": mix(B, F, 0.08), "--color-paper-3": mix(B, F, 0.04),
      "--color-ink": txt(F), "--color-ink-2": txt(mix(F, B, 0.15)), "--color-muted": muted, "--color-placeholder": fit(mix(F, B, 0.4), B),
      "--color-rule": mix(B, F, 0.1), "--color-edge-soft": mix(B, F, 0.16), "--color-edge-aa": fit(mix(F, B, 0.5), B, 3),
      "--color-gutter": fit(blue, B, 3), "--color-guide": mix(B, F, 0.25),
      "--color-accent": accent, "--color-accent-ink": accentInk, "--color-accent-soft": mix(B, accent, 0.14),
      "--color-link": txt(blue), "--color-focus": fit(blue, B, 3), "--color-bar": accent,
      "--color-ok": txt(green), "--color-redir": txt(cyan), "--color-error": txt(red), "--color-warn": txt(yellow),
      "--color-hit": alpha(yellow, dark ? 0.22 : 0.3), "--color-hit-cur": alpha(yellow, dark ? 0.5 : 0.6), "--color-hit-edge": fit(yellow, B, 3),
      "--color-overlay": dark ? "rgb(0 0 0 / 0.55)" : alpha(F, 0.32), "--color-shadow": dark ? "rgb(0 0 0 / 0.3)" : alpha(F, 0.08),
      "--m-get": txt(green), "--m-post": txt(orange), "--m-put": txt(blue), "--m-patch": txt(magenta), "--m-delete": txt(red), "--m-other": muted,
      "--j-key": txt(red), "--j-str": txt(green), "--j-num": txt(orange), "--j-bool": txt(magenta), "--j-punct": muted,
      "color-scheme": dark ? "dark" : "light",
    };
    [blue, green, orange, magenta, cyan, red].forEach((c, i) => {
      const bg = mix(B, c, dark ? 0.18 : 0.12);
      t[`--proj-${i + 1}-fg`] = fit(c, bg);
      t[`--proj-${i + 1}-bg`] = bg;
    });
    return t;
  }

  /** five dots for the picker: background, then the hues requests are coloured with */
  const swatch = (s) => [s.g.bg, ...[2, 3, 4, 1].map((n) => pick(s.g.p, n, s.g.bg))];

  window.VoidThemes = { SCHEMES, tokens, isDark, swatch };
})();
