// Close animation for every dialog and quick open, in one place (same approach as ypacapy's src/lib/modalExit.ts).
//
// Dialogs close along many paths (Escape, Cancel, the close button, a backdrop click, a store action that
// clears `modal`), and React removes the `.backdrop` at once. Rather than teach each dialog to delay its own
// unmount, this watches the DOM: when a `.backdrop` is removed, the same node goes back where it was as an
// inert ghost, plays `.closing` (styles.css), and is removed when that ends. React never sees the ghost: it is
// outside its tree, `inert` keeps focus and keys out, and `.closing` turns off pointer events.
//
// The removed node itself is reused, not a clone, so typed values stay for the fade.
// Quick open's `.qo-backdrop` is handled too; ⌘P and ⇧⌘P switch modes on the same mounted box, so no ghost appears on a switch.

/** removes the ghost even when no animationend arrives (hidden window, animations off) */
const FALLBACK_MS = 600;

function ghost(node: HTMLElement, parent: Node, next: Node | null) {
  if (!parent.isConnected) return;
  node.inert = true;
  node.classList.add("closing");
  parent.insertBefore(node, next && next.parentNode === parent ? next : null);
  let done = false;
  const remove = () => {
    if (done) return;
    done = true;
    node.remove();
  };
  node.addEventListener("animationend", (e) => e.target === node && remove());
  setTimeout(remove, FALLBACK_MS);
}

export function installModalExit() {
  new MutationObserver((records) => {
    for (const r of records)
      r.removedNodes.forEach((n) => {
        if (n instanceof HTMLElement && (n.classList.contains("backdrop") || n.classList.contains("qo-backdrop")) && !n.classList.contains("closing"))
          ghost(n, r.target, r.nextSibling);
      });
  }).observe(document.body, { childList: true, subtree: true });
}
