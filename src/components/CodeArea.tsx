import { useMemo, type KeyboardEvent, type ReactNode } from "react";
import { highlightLines } from "../lib/highlight";
import { toggleLineComments } from "../lib/jsonc";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** colour JSON tokens in the layer under the text; ⌘/ toggles `//` line comments */
  json?: boolean;
  /** floats in the editor's top-right corner (Beautify) */
  tools?: ReactNode;
  label?: string;
  /** soft-wrap long lines instead of scrolling sideways */
  wrap?: boolean;
}

/** Above this the highlight layer is skipped: plain text, still line-numbered. */
const HIGHLIGHT_LIMIT = 200 * 1024;

/**
 * Editable code without an editor dependency (~0 KB vs Monaco's ~3 MB):
 * a highlighted, line-numbered <pre> sits under a transparent <textarea> in one grid cell,
 * so both share one scroll and the caret, selection and typing stay native.
 */
export function CodeArea({ value, onChange, placeholder, json, tools, label = "Request body", wrap = false }: Props) {
  const html = useMemo(
    () => highlightLines(value, !!json && value.length <= HIGHLIGHT_LIMIT),
    [value, json],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (json && (e.metaKey || e.ctrlKey) && !e.altKey && (e.key === "/" || e.code === "Slash")) {
      e.preventDefault();
      const el = e.currentTarget;
      const edit = toggleLineComments(value, el.selectionStart, el.selectionEnd);
      // insertText keeps the change on the native undo stack (⌘Z)
      el.setSelectionRange(edit.from, edit.to);
      if (!document.execCommand("insertText", false, edit.text)) onChange(edit.value);
      requestAnimationFrame(() => el.setSelectionRange(edit.selStart, edit.selEnd));
      return;
    }
    if (e.key !== "Tab") return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart: s, selectionEnd: end } = el;
    onChange(value.slice(0, s) + "  " + value.slice(end));
    requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
  };

  return (
    <div className="editor">
      {tools && <div className="editor-bar">{tools}</div>}
      <div className={`code-edit${wrap ? " wrap" : ""}`}>
        <div className="code-edit-grid">
          <pre className="code" aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />
          <textarea
            className="code-input"
            aria-label={label}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            wrap={wrap ? "soft" : "off"}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
      </div>
    </div>
  );
}
