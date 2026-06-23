import Image from "next/image";
import {
  Building2, Wind, HeartPulse, Flame, Droplets, Bug, ReceiptText, Zap,
  Trees, UtensilsCrossed, ShoppingBag, Truck, Factory, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Each industry gets an art-directed cover: a vibrant two-tone gradient and a
// representative icon. Keyword-matched so admin-added industries pick a fitting
// look automatically, with a strong brand-gradient default.
interface Theme { match: string[]; from: string; to: string; icon: LucideIcon }

const THEMES: Theme[] = [
  { match: ["hvac", "air", "heating", "cooling", "climate", "refriger"], from: "#0ea5e9", to: "#4f46e5", icon: Wind },
  { match: ["health", "medical", "care", "clinic", "dental", "nurse", "hospice", "therapy"], from: "#ec4899", to: "#7c3aed", icon: HeartPulse },
  { match: ["fire", "safety", "security", "alarm", "protect"], from: "#f97316", to: "#e11d48", icon: Flame },
  { match: ["plumb", "drain", "water", "pipe", "sewer"], from: "#06b6d4", to: "#3b82f6", icon: Droplets },
  { match: ["pest", "extermin", "termite"], from: "#22c55e", to: "#0d9488", icon: Bug },
  { match: ["billing", "account", "finance", "bookkeep", "insurance", "tax"], from: "#6366f1", to: "#a855f7", icon: ReceiptText },
  { match: ["electric", "power", "solar", "energy", "voltage"], from: "#f59e0b", to: "#d946ef", icon: Zap },
  { match: ["landscap", "lawn", "garden", "tree", "irrigation"], from: "#16a34a", to: "#65a30d", icon: Trees },
  { match: ["restaurant", "food", "cafe", "bakery", "catering", "kitchen"], from: "#f43f5e", to: "#f59e0b", icon: UtensilsCrossed },
  { match: ["retail", "store", "shop", "ecommerce", "commerce", "boutique"], from: "#8b5cf6", to: "#ec4899", icon: ShoppingBag },
  { match: ["logistic", "transport", "trucking", "delivery", "freight", "courier"], from: "#0891b2", to: "#4338ca", icon: Truck },
  { match: ["manufactur", "fabricat", "industrial", "machin", "plant", "welding"], from: "#64748b", to: "#6d4dfc", icon: Factory },
];

const DEFAULT_THEME: Theme = { match: [], from: "#6d4dfc", to: "#d946ef", icon: Building2 };

export function getListingTheme(...keys: (string | null | undefined)[]): Theme {
  const hay = keys.filter(Boolean).join(" ").toLowerCase();
  return THEMES.find((t) => t.match.some((m) => hay.includes(m))) ?? DEFAULT_THEME;
}

interface Props {
  imageUrl?: string | null;
  title: string;
  /** Industry helps pick the cover theme + label. */
  industry?: string | null;
  className?: string;
  /** Hide the small industry chip (e.g. tiny thumbnails). */
  compact?: boolean;
}

export function ListingImage({ imageUrl, title, industry, className, compact }: Props) {
  const base = cn("relative w-full overflow-hidden bg-muted", className);

  if (imageUrl) {
    return (
      <div className={base}>
        <Image
          src={imageUrl}
          alt={title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/30 to-transparent" />
      </div>
    );
  }

  const theme = getListingTheme(industry, title);
  const Icon = theme.icon;

  return (
    <div
      className={cn(base, "flex items-end")}
      style={{ backgroundImage: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)` }}
    >
      <div className="absolute inset-0 cover-grain opacity-50" />
      {/* glow accent */}
      <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
      {/* oversized watermark icon */}
      <Icon className="absolute -bottom-6 -right-6 size-44 text-white/15" strokeWidth={1.25} />
      {!compact && (
        <div className="relative z-10 p-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm ring-1 ring-white/30">
            <Icon className="size-3.5" />
            {industry ?? "Business"}
          </span>
        </div>
      )}
      {compact && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className="size-1/2 max-h-8 max-w-8 text-white/80" />
        </div>
      )}
    </div>
  );
}
