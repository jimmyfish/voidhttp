import type { KeyboardEvent } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

/** Plain textarea with Tab-to-indent. Deliberately not Monaco: ~0 KB vs ~3 MB. */
export function CodeArea({ value, onChange, placeholder }: Props) {
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart: s, selectionEnd: end } = el;
    const next = value.slice(0, s) + "  " + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
  };
  return (
    <textarea
      className="code"
      spellCheck={false}
      autoCorrect="off"
      autoCapitalize="off"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
    />
  );
}
