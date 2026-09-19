"use client";

import type { ReactNode, SVGProps } from "react";

export const CATEGORY_ICON_SLUGS = [
  "coffee",
  "utensils",
  "moon",
  "cup",
  "bus",
  "phone",
  "home",
  "building",
  "bag",
  "smile",
  "heart",
  "book",
  "dots",
  "wallet",
  "gift",
  "chart",
  "briefcase",
  "car",
  "plane",
  "music",
  "game",
  "cart",
  "bolt",
  "leaf",
] as const;

export type CategoryIconSlug = (typeof CATEGORY_ICON_SLUGS)[number];

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

const ICONS: Record<CategoryIconSlug, ReactNode> = {
  coffee: (
    <Svg>
      <path d="M4 8h12v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8z" />
      <path d="M16 9h2a3 3 0 0 1 0 6h-2" />
      <path d="M8 2v2M12 2v2" />
    </Svg>
  ),
  utensils: (
    <Svg>
      <path d="M8 3v7a2 2 0 0 1-2 2H5V3" />
      <path d="M6 12v9" />
      <path d="M14 3v9h2a2 2 0 0 0 2-2V7a4 4 0 0 0-4-4z" />
      <path d="M15 12v9" />
    </Svg>
  ),
  moon: (
    <Svg>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5z" />
    </Svg>
  ),
  cup: (
    <Svg>
      <path d="M6 8h10l-1 9a3 3 0 0 1-3 2.5H10A3 3 0 0 1 7 17L6 8z" />
      <path d="M8 8V6.5A2.5 2.5 0 0 1 10.5 4h3A2.5 2.5 0 0 1 16 6.5V8" />
      <path d="M9 21h6" />
    </Svg>
  ),
  bus: (
    <Svg>
      <rect x="4" y="4" width="16" height="13" rx="2" />
      <path d="M4 11h16" />
      <path d="M7 17v2M17 17v2" />
      <circle cx="8" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="14" r="1" fill="currentColor" stroke="none" />
    </Svg>
  ),
  phone: (
    <Svg>
      <path d="M8.5 3.5h7A2.5 2.5 0 0 1 18 6v12a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 18V6A2.5 2.5 0 0 1 8.5 3.5z" />
      <path d="M10 18h4" />
    </Svg>
  ),
  home: (
    <Svg>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6.5 10.5V20h11V10.5" />
      <path d="M10 20v-5h4v5" />
    </Svg>
  ),
  building: (
    <Svg>
      <rect x="5" y="4" width="14" height="16" rx="1" />
      <path d="M9 8h1.5M13.5 8H15M9 12h1.5M13.5 12H15M9 16h1.5M13.5 16H15" />
    </Svg>
  ),
  bag: (
    <Svg>
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8V6.5A3 3 0 0 1 12 3.5a3 3 0 0 1 3 3V8" />
    </Svg>
  ),
  smile: (
    <Svg>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9 10h.01M15 10h.01" />
      <path d="M8.5 14.5c1.2 1.5 2.7 2.2 3.5 2.2s2.3-.7 3.5-2.2" />
    </Svg>
  ),
  heart: (
    <Svg>
      <path d="M12 19s-7-4.4-7-9a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 4.6-7 9-7 9z" />
    </Svg>
  ),
  book: (
    <Svg>
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5z" />
      <path d="M5 5.5V21.5" />
    </Svg>
  ),
  dots: (
    <Svg>
      <circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </Svg>
  ),
  wallet: (
    <Svg>
      <rect x="3.5" y="7" width="17" height="11" rx="2" />
      <path d="M3.5 10h17" />
      <circle cx="16.5" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
    </Svg>
  ),
  gift: (
    <Svg>
      <rect x="4" y="10" width="16" height="10" rx="1" />
      <path d="M12 6v14M4 14h16" />
      <path d="M8.5 6a2.5 2.5 0 0 1 3.5 2.2C12 6.5 13.5 4 15.5 4A2.5 2.5 0 0 1 17 8.5H7A2.5 2.5 0 0 1 8.5 6z" />
    </Svg>
  ),
  chart: (
    <Svg>
      <path d="M4 19h16" />
      <path d="M7 16V10M12 16V6M17 16v-4" />
    </Svg>
  ),
  briefcase: (
    <Svg>
      <rect x="3.5" y="8" width="17" height="11" rx="2" />
      <path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8" />
      <path d="M3.5 13h17" />
    </Svg>
  ),
  car: (
    <Svg>
      <path d="M4 14h16l-1.5-5.5A2 2 0 0 0 16.6 7H7.4a2 2 0 0 0-1.9 1.5L4 14z" />
      <path d="M5 14v3.5M19 14v3.5" />
      <circle cx="8" cy="17.5" r="1.3" />
      <circle cx="16" cy="17.5" r="1.3" />
    </Svg>
  ),
  plane: (
    <Svg>
      <path d="M3 13.5 21 5l-3.5 14-4.5-4-3.5 3.5-.8-4.5L3 13.5z" />
    </Svg>
  ),
  music: (
    <Svg>
      <path d="M9 18V6l10-2v12" />
      <circle cx="7" cy="18" r="2.2" />
      <circle cx="17" cy="16" r="2.2" />
    </Svg>
  ),
  game: (
    <Svg>
      <rect x="3.5" y="8" width="17" height="9" rx="3" />
      <path d="M8 11v4M6 13h4" />
      <circle cx="15" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="14" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  ),
  cart: (
    <Svg>
      <path d="M4 5h2l2.2 10h9.3l2-7H8" />
      <circle cx="10" cy="19" r="1.3" />
      <circle cx="16.5" cy="19" r="1.3" />
    </Svg>
  ),
  bolt: (
    <Svg>
      <path d="M13 3 6 13h5l-1 8 8-11h-5l0-7z" />
    </Svg>
  ),
  leaf: (
    <Svg>
      <path d="M5 18c8-1 13-7 14-14-7 1-13 6-14 14z" />
      <path d="M5 18c3-4 7-7 12-9" />
    </Svg>
  ),
};

function resolveSlug(icon: string): CategoryIconSlug {
  return (CATEGORY_ICON_SLUGS as readonly string[]).includes(icon)
    ? (icon as CategoryIconSlug)
    : "dots";
}

export function CategoryIconGlyph({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  const slug = resolveSlug(icon);
  return (
    <span className={["inline-flex shrink-0 [&_svg]:h-full [&_svg]:w-full", className].filter(Boolean).join(" ")}>
      {ICONS[slug]}
    </span>
  );
}

export function CategoryIcon({
  icon,
  color,
  size = "md",
  className,
}: {
  icon: string;
  color: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dim =
    size === "sm" ? "h-9 w-9" : size === "lg" ? "h-14 w-14" : "h-11 w-11";
  const glyph =
    size === "sm" ? "h-4 w-4" : size === "lg" ? "h-7 w-7" : "h-5 w-5";

  return (
    <span
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-full text-white",
        dim,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ backgroundColor: color || "#0f7a5f" }}
      aria-hidden
    >
      <CategoryIconGlyph icon={icon} className={glyph} />
    </span>
  );
}
