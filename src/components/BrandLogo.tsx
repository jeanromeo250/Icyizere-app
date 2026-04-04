import { cn } from "@/lib/utils";

/** Shown next to the mark on auth screens and in metadata. */
export const BRAND_NAME = "ICYIZERE BUSINESS LTD";
export const BRAND_SHORT_NAME = "ICYIZERE";
export const BRAND_TAGLINE = "Smart Stock & Business Management";

const LOGO_SRC = "/logo.ico";

type BrandLogoProps = {
  /** Hero: large centered mark on login/register. Header: compact mark in app chrome. */
  variant?: "hero" | "header";
  className?: string;
};

export function BrandLogo({ variant = "header", className }: BrandLogoProps) {
  const hero = variant === "hero";

  return (
    <div className={cn("relative shrink-0", hero && "mx-auto", className)}>
      {hero && (
        <div
          className="pointer-events-none absolute -inset-6 rounded-[2.5rem] bg-gradient-to-b from-primary-foreground/15 via-primary-foreground/5 to-transparent blur-2xl"
          aria-hidden
        />
      )}
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden bg-card",
          hero
            ? "h-[7.25rem] w-[7.25rem] rounded-full p-3.5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.35)] ring-[3px] ring-primary-foreground/20"
            : "h-11 w-11 min-h-[44px] min-w-[44px] rounded-full p-1.5 shadow-sm ring-2 ring-border/90"
        )}
      >
        <img
          src={LOGO_SRC}
          alt=""
          width={hero ? 116 : 44}
          height={hero ? 116 : 44}
          decoding="async"
          fetchPriority={hero ? "high" : "auto"}
          className="h-full w-full object-contain select-none"
          draggable={false}
        />
      </div>
    </div>
  );
}
