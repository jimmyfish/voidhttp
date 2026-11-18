/** Icons: Lucide (lucide-react), one stroke weight everywhere. The app mark is voidHTTP's own. */
export {
  ArrowDown,
  ArrowUp,
  Ban,
  Bookmark,
  BookmarkPlus,
  Braces,
  Bug,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  Clock,
  CircleArrowDown,
  CircleCheck,
  CircleX,
  CircleDashed,
  CircleDot,
  Check,
  CodeXml,
  Columns2,
  Copy,
  CopyPlus,
  CornerDownLeft,
  Ellipsis,
  ExternalLink,
  EyeOff,
  FileBadge,
  FileCode,
  FileJson,
  FileOutput,
  FilePlus,
  FileUp,
  Filter,
  Folder,
  FolderOpen,
  FolderPlus,
  History as HistoryIcon,
  House,
  Info,
  KeyRound,
  Import,
  Keyboard,
  Link,
  Layers,
  ListFilter,
  LoaderCircle,
  Lock,
  LockOpen,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  Plug,
  Paperclip,
  Pencil,
  Network,
  Plus,
  RefreshCw,
  RotateCcw,
  Scale,
  Rows2,
  Save,
  ScanSearch,
  Search,
  SearchX,
  Send,
  SendHorizontal,
  ShieldOff,
  Server,
  Settings,
  SlidersHorizontal,
  SunMoon,
  Trash2,
  TriangleAlert,
  Type,
  Undo2,
  Unplug,
  WandSparkles,
  WrapText,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { createLucideIcon } from "lucide-react";

/**
 * Lucide 1.x dropped brand icons, so the GitHub mark lives here.
 * Path data copied from lucide-react 0.460.0 (ISC), so it looks and behaves like the other icons.
 */
export const Github = createLucideIcon("Github", [
  [
    "path",
    {
      d: "M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4",
      key: "tonef",
    },
  ],
  ["path", { d: "M9 18c-4.51 2-5-2-7-2", key: "9comsn" }],
]);

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
