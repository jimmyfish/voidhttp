import type { Prepared } from "./http";

const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export function toCurl(p: Prepared): string {
  const parts = [`curl -X ${p.method} ${q(p.url)}`];
  for (const h of p.headers) parts.push(`-H ${q(`${h.key}: ${h.value}`)}`);
  if (p.body?.type === "text") parts.push(`--data-raw ${q(p.body.content)}`);
  if (p.body?.type === "formUrlEncoded")
    for (const f of p.body.fields) parts.push(`--data-urlencode ${q(`${f.key}=${f.value}`)}`);
  if (p.body?.type === "multipart")
    for (const f of p.body.fields) parts.push(`-F ${q(f.kind === "file" ? `${f.key}=@${f.value}` : `${f.key}=${f.value}`)}`);
  return parts.join(" \\\n  ");
}
