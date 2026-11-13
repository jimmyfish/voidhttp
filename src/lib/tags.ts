import type { CSSProperties } from "react";

/**
 * Tag colours (flatuicolors.com, Flat UI): fixed in every theme and colour scheme, so a colour means the
 * same thing everywhere ("red is Production"). Only for things the user tags; never a stand-in for scheme
 * colours such as methods, status or the accent. Fills and inks live in tokens.css as --tag-<id> and --tag-<id>-ink.
 */
export const TAG_COLORS = [
  { id: "turquoise", name: "Turquoise" },
  { id: "emerald", name: "Emerald" },
  { id: "river", name: "Peter River" },
  { id: "amethyst", name: "Amethyst" },
  { id: "asphalt", name: "Wet Asphalt" },
  { id: "sunflower", name: "Sunflower" },
  { id: "carrot", name: "Carrot" },
  { id: "alizarin", name: "Alizarin" },
  { id: "clouds", name: "Clouds" },
  { id: "concrete", name: "Concrete" },
] as const;

export type TagColor = (typeof TAG_COLORS)[number]["id"];

export const tagName = (c: TagColor | undefined) => TAG_COLORS.find((t) => t.id === c)?.name;

/** --env-c (fill) and --env-ink (text on the badge) for an environment's colour; nothing when it has none. */
export const envStyle = (c: TagColor | undefined): CSSProperties | undefined =>
  c && tagName(c) ? ({ "--env-c": `var(--tag-${c})`, "--env-ink": `var(--tag-${c}-ink)` } as CSSProperties) : undefined;
