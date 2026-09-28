import type { ReactNode } from "react";

type IconName =
  | "bowl" | "keto" | "lowcarb" | "gluten" | "vege"
  | "cart" | "chef" | "dumbbell" | "utensils" | "truck" | "bottle" | "trend" | "calculator" | "laktoza";

const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const PATHS: Record<IconName, ReactNode> = {
  bowl: <><path {...P} d="M3 11h18a9 9 0 0 1-9 9 9 9 0 0 1-9-9Z"/><path {...P} d="M7 11V8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3"/><path {...P} d="M12 3v3"/></>,
  keto: <><path {...P} d="M12 21c-4 0-7-3-7-7 0-5 4-8 7-11 3 3 7 6 7 11 0 4-3 7-7 7Z"/><path {...P} d="M12 17a3 3 0 0 0 3-3"/></>,
  lowcarb: <><path {...P} d="M4 20c0-6 4-11 10-13"/><path {...P} d="M20 7c0 7-5 12-11 12H5"/><path {...P} d="M4 4l16 16"/></>,
  gluten: <><path {...P} d="M12 21V9"/><path {...P} d="M12 12c-3 0-5-2-5-5 3 0 5 2 5 5Z"/><path {...P} d="M12 12c3 0 5-2 5-5-3 0-5 2-5 5Z"/><path {...P} d="M5 16l14-9"/></>,
  vege: <><path {...P} d="M11 21c0-6 3-10 9-11 0 6-3 10-9 11Z"/><path {...P} d="M11 21c0-4-2-7-6-8 0 4 2 7 6 8Z"/><path {...P} d="M11 21v-4"/></>,
  cart: <><circle {...P} cx="9" cy="20" r="1.4"/><circle {...P} cx="18" cy="20" r="1.4"/><path {...P} d="M2 3h3l2.6 12.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.2L21 7H6"/></>,
  chef: <><path {...P} d="M7 21h10v-6H7v6Z"/><path {...P} d="M7 15a4 4 0 0 1-1-7.9 4 4 0 0 1 7-2.4 4 4 0 0 1 7 2.4A4 4 0 0 1 17 15"/><path {...P} d="M10 18h4"/></>,
  dumbbell: <><path {...P} d="M4 9v6M7 7v10M17 7v10M20 9v6"/><path {...P} d="M7 12h10"/></>,
  utensils: <><path {...P} d="M6 3v7a2 2 0 0 0 4 0V3"/><path {...P} d="M8 10v11"/><path {...P} d="M17 3c-1.5 2-2 4-2 6.5 0 1.5.7 2.5 2 2.5V3Z"/><path {...P} d="M17 12v9"/></>,
  truck: <><path {...P} d="M2 6h11v10H2z"/><path {...P} d="M13 9h4.5l3.5 3.5V16h-8"/><circle {...P} cx="7" cy="18" r="1.8"/><circle {...P} cx="17" cy="18" r="1.8"/></>,
  bottle: <><path {...P} d="M10 2h4v3l1.5 2A3 3 0 0 1 16 9v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9a3 3 0 0 1 .5-2L10 5V2Z"/><path {...P} d="M8 13h8"/></>,
  trend: <><path {...P} d="M3 17l6-6 4 4 8-8"/><path {...P} d="M15 7h6v6"/></>,
  laktoza: <><path {...P} d="M9 3h6"/><path {...P} d="M10 3v4.5L6.6 16.2A3 3 0 0 0 9.4 21h5.2a3 3 0 0 0 2.8-4.8L14 7.5V3"/><path {...P} d="M4 4l16 16"/></>,
  calculator: <><rect {...P} x="4" y="2.5" width="16" height="19" rx="2.5"/><path {...P} d="M7.5 6.5h9v3.5h-9z"/><path {...P} d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01M16 17.5h.01"/></>
};

export function Icon(props: { name: IconName; size?: number; className?: string }) {
  const { name, size = 24, className } = props;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}

export type { IconName };
