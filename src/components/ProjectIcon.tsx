import "./ProjectIcon.css";
import type { CSSProperties } from "react";
import {
  Bell,
  Briefcase,
  Bug,
  Building2,
  Camera,
  Cloud,
  CodeXml,
  CreditCard,
  Database,
  FlaskConical,
  Gamepad2,
  Globe,
  GraduationCap,
  HeartPulse,
  KeyRound,
  Landmark,
  Layers,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Music,
  Package,
  Rocket,
  Server,
  ShieldCheck,
  ShoppingCart,
  Store,
  Truck,
  UserRound,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** The icons a project can wear, in picker order (8 per row). */
export const PROJECT_ICONS: Record<string, LucideIcon> = {
  landmark: Landmark,
  "building-2": Building2,
  wallet: Wallet,
  "credit-card": CreditCard,
  "shopping-cart": ShoppingCart,
  store: Store,
  truck: Truck,
  package: Package,
  "user-round": UserRound,
  users: Users,
  briefcase: Briefcase,
  rocket: Rocket,
  "flask-conical": FlaskConical,
  bug: Bug,
  "code-xml": CodeXml,
  server: Server,
  database: Database,
  cloud: Cloud,
  "shield-check": ShieldCheck,
  lock: Lock,
  "key-round": KeyRound,
  bell: Bell,
  mail: Mail,
  "message-circle": MessageCircle,
  globe: Globe,
  "map-pin": MapPin,
  "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap,
  "gamepad-2": Gamepad2,
  music: Music,
  camera: Camera,
  zap: Zap,
};

/** Fallback for a project created before icons existed (the migrated "My project"). */
const FALLBACK = Layers;

export const PROJECT_COLORS: { id: number; name: string }[] = [
  { id: 1, name: "Blue" },
  { id: 2, name: "Green" },
  { id: 3, name: "Orange" },
  { id: 4, name: "Purple" },
  { id: 5, name: "Teal" },
  { id: 6, name: "Pink" },
];

export const tileStyle = (color: number) =>
  ({ "--fg": `var(--proj-${color}-fg)`, "--bg": `var(--proj-${color}-bg)` }) as CSSProperties;

export function ProjectTile({ icon, color, small }: { icon: string; color: number; small?: boolean }) {
  const I = PROJECT_ICONS[icon] ?? FALLBACK;
  return (
    <span className={`proj-tile${small ? " proj-tile--sm" : ""}`} style={tileStyle(color)}>
      <I className="ico" size={small ? 13 : 22} strokeWidth={1.75} aria-hidden="true" />
    </span>
  );
}
