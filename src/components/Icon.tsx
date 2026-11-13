/** Icons: Lucide (lucide-react), one stroke weight everywhere. The app mark is voidHTTP's own. */
export {
  ArrowDown,
  ArrowUp,
  Bookmark,
  BookmarkPlus,
  Braces,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  Clock,
  CircleCheck,
  CircleDashed,
  CircleDot,
  Check,
  CodeXml,
  Columns2,
  Copy,
  CopyPlus,
  Ellipsis,
  EyeOff,
  FileCode,
  FilePlus,
  FileUp,
  Filter,
  Folder,
  FolderOpen,
  FolderPlus,
  History as HistoryIcon,
  House,
  Import,
  Layers,
  Lock,
  LockOpen,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Rows2,
  ScanSearch,
  Search,
  Send,
  Server,
  Settings,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  Type,
  WandSparkles,
  WrapText,
  X,
} from "lucide-react";

/** Spread on any Lucide icon: <Plus {...ico} /> */
export const ico = { size: 16, strokeWidth: 1.75, className: "ico", "aria-hidden": true } as const;
export const icoLg = { size: 22, strokeWidth: 1.75, className: "ico ico-lg", "aria-hidden": true } as const;

/** The app mark: the same two rings as the app icon. */
export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6" fill="none" strokeWidth="2" style={{ stroke: "var(--color-accent)" }} />
      <circle cx="8" cy="8" r="2.25" fill="none" strokeWidth="1.5" style={{ stroke: "var(--color-ok)" }} />
    </svg>
  );
}
