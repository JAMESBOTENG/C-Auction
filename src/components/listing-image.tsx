import Image from "next/image";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Gradient backgrounds keyed by the first letter of the title — gives each listing
// a distinct but professional placeholder when no image is available.
const GRADIENTS = [
  "from-slate-700 to-slate-900",
  "from-blue-800 to-blue-950",
  "from-cyan-700 to-slate-900",
  "from-indigo-700 to-indigo-950",
  "from-teal-700 to-slate-900",
  "from-sky-700 to-slate-900",
  "from-violet-700 to-slate-900",
];

function pickGradient(title: string) {
  const code = (title.charCodeAt(0) ?? 0) % GRADIENTS.length;
  return GRADIENTS[code];
}

interface Props {
  imageUrl?: string | null;
  title: string;
  className?: string;
}

export function ListingImage({ imageUrl, title, className }: Props) {
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
      </div>
    );
  }

  return (
    <div className={cn(base, `bg-gradient-to-br ${pickGradient(title)} flex items-center justify-center`)}>
      <div className="flex flex-col items-center gap-2 text-white/30">
        <Building2 className="size-10" />
        <span className="text-xs font-medium tracking-wide uppercase">{title.slice(0, 24)}</span>
      </div>
    </div>
  );
}
