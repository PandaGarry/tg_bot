import type { SVGProps } from "react";

export type ConceptIconName =
  | "lord"
  | "meat"
  | "wood"
  | "stone"
  | "metal"
  | "mushrooms"
  | "gold"
  | "court"
  | "reports"
  | "map"
  | "chronicle"
  | "menu"
  | "build"
  | "train"
  | "research"
  | "commanders"
  | "clan"
  | "items"
  | "shop"
  | "mail"
  | "settings"
  | "road"
  | "cottage"
  | "farm"
  | "sawmill"
  | "quarry"
  | "mine"
  | "barracks"
  | "lantern"
  | "bench"
  | "well"
  | "flag";

const COMMON: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 48 48",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.1,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  focusable: false,
  "aria-hidden": true,
};

export function ConceptIcon({
  name,
  ...props
}: { name: ConceptIconName } & Omit<SVGProps<SVGSVGElement>, "name">) {
  const common = { ...COMMON, ...props };
  switch (name) {
    case "lord":
      return (
        <svg {...common} viewBox="0 0 64 64" strokeWidth="1.6">
          <circle cx="32" cy="32" r="29" fill="var(--ui-avatar-bg, #36413d)" stroke="var(--ui-avatar-ring, #d9b66a)" strokeWidth="2.2" />
          <path d="M12 54c2-10 8-16 17-17h6c9 1 15 7 17 17" fill="var(--ui-avatar-cloak, #6e403c)" stroke="var(--ui-avatar-ring, #d9b66a)" />
          <path d="M20 25c0-11 5-17 12-17s12 6 12 17l-3 9c-2 6-5 9-9 9s-7-3-9-9z" fill="var(--ui-avatar-face, #caa67c)" stroke="var(--ui-avatar-ring, #d9b66a)" />
          <path d="M19 25c-1-12 4-20 13-20 8 0 14 6 13 19l-5-5-3-7-5 5-9 2z" fill="var(--ui-avatar-helm, #283239)" stroke="var(--ui-avatar-ring, #d9b66a)" />
          <path d="M25 28h2m10 0h2m-12 8c3 2 7 2 10 0" stroke="#30261f" strokeWidth="1.8" />
          <path d="m23 46 9 7 9-7" stroke="var(--ui-avatar-ring, #d9b66a)" strokeWidth="2" />
        </svg>
      );
    case "meat":
      return <svg {...common}><path d="M15 17c4-4 9-2 12 2l7 8c3 3 7 4 10 2l2 4-6 7-4-2c1-4 0-7-3-10l-8-7c-4-3-8-2-10 1l-5-1 1-5z" fill="currentColor" fillOpacity=".22"/><circle cx="12" cy="15" r="4" fill="currentColor"/><circle cx="17" cy="11" r="3.6" fill="currentColor"/><path d="M13 19 35 39"/></svg>;
    case "wood":
      return <svg {...common}><path d="M9 15c0-3 6-5 15-5s15 2 15 5v18c0 3-6 5-15 5S9 36 9 33z" fill="currentColor" fillOpacity=".18"/><path d="M9 15c0 3 6 5 15 5s15-2 15-5M9 24c0 3 6 5 15 5s15-2 15-5M9 33c0 3 6 5 15 5s15-2 15-5"/><path d="M17 11v6m13-6v6M17 29v7m13-7v7" opacity=".65"/></svg>;
    case "stone":
      return <svg {...common}><path d="m7 34 7-17 10-6 13 7 5 16-9 7H15z" fill="currentColor" fillOpacity=".22"/><path d="m7 34 12-3 5-20m0 20 18 3M14 17l10 14 13-13M15 41l4-10"/></svg>;
    case "metal":
      return <svg {...common}><path d="m7 18 7-8h20l7 8-7 22H14z" fill="currentColor" fillOpacity=".2"/><path d="M7 18h34M14 10l6 8-6 22m20-30-6 8 6 22M20 18l4 22 4-22"/></svg>;
    case "mushrooms":
      return <svg {...common}><path d="M8 22c1-9 8-15 16-15s15 6 16 15z" fill="currentColor" fillOpacity=".25"/><path d="M18 22c0 7-4 8-4 12 0 4 4 7 10 7s10-3 10-7c0-4-4-5-4-12" fill="currentColor" fillOpacity=".12"/><path d="M8 22h32M19 18h.1m9-5h.1m2 7h.1" strokeWidth="3"/></svg>;
    case "gold":
      return <svg {...common}><circle cx="24" cy="24" r="17" fill="currentColor" fillOpacity=".2"/><circle cx="24" cy="24" r="12"/><path d="M27 16c-1-2-6-2-7 1-2 5 8 4 7 9-.5 4-6 5-9 2m6-15v22"/></svg>;
    case "court":
      return <svg {...common}><path d="M7 20 24 8l17 12v19H7z" fill="currentColor" fillOpacity=".16"/><path d="M4 20 24 5l20 15M13 39V25h8v14m5-14h9v8h-9zM10 39h28"/><path d="M24 10v6m-3-3h6" opacity=".7"/></svg>;
    case "reports":
      return <svg {...common}><path d="M12 7h20l6 6v28H12z" fill="currentColor" fillOpacity=".12"/><path d="M32 7v8h7M18 22h14M18 28h14M18 34h9"/><path d="m7 13 2 2m-2 7 2 2m-2 7 2 2" opacity=".7"/></svg>;
    case "map":
      return <svg {...common}><path d="m6 12 12-5 12 5 12-5v29l-12 5-12-5-12 5z" fill="currentColor" fillOpacity=".14"/><path d="M18 7v29m12-24v29M12 18l7-3m11 9 7-3"/><path d="m26 15 2 4-2 3-2-3z" fill="currentColor"/></svg>;
    case "chronicle":
      return <svg {...common}><path d="M10 9h25v31H10z" fill="currentColor" fillOpacity=".13"/><path d="M15 15h15M15 21h15M15 27h12M15 33h15"/><path d="M7 12v25c0 4 3 6 6 6h22" opacity=".7"/></svg>;
    case "menu":
      return <svg {...common}><path d="M9 13h30M9 24h30M9 35h30" strokeWidth="3"/><circle cx="8" cy="13" r="2" fill="currentColor"/><circle cx="40" cy="24" r="2" fill="currentColor"/><circle cx="8" cy="35" r="2" fill="currentColor"/></svg>;
    case "build":
      return <svg {...common}><path d="m9 15 5-6 8 7-5 6z" fill="currentColor" fillOpacity=".22"/><path d="m18 22 18 18m-4-4 4-4m-8 0 4-4M8 39l10-10 5 5-10 10H8z"/><path d="m31 8 9 9-4 4-9-9z" fill="currentColor" fillOpacity=".2"/></svg>;
    case "train":
      return <svg {...common}><path d="m13 8 22 32M35 8 13 40M8 18h32M8 30h32"/><path d="m24 10 4 6-4 5-4-5zM24 27l4 5-4 6-4-6z" fill="currentColor" fillOpacity=".24"/></svg>;
    case "research":
      return <svg {...common}><path d="M18 8h12m-9 0v11L11 36c-2 3 0 5 3 5h20c3 0 5-2 3-5L27 19V8"/><path d="M15 32c5-4 13 4 19-1l4 7H11z" fill="currentColor" fillOpacity=".25"/><circle cx="23" cy="29" r="1.4" fill="currentColor"/></svg>;
    case "commanders":
      return <svg {...common}><path d="M8 34 11 19l8 5 5-11 5 11 8-5 3 15-8 7H16z" fill="currentColor" fillOpacity=".18"/><path d="M14 34h20m-13-11 3-10 3 10m-15-4 5 5m15-5-5 5M19 41l5-5 5 5"/></svg>;
    case "clan":
      return <svg {...common}><path d="M24 5 40 11v12c0 11-7 17-16 21C15 40 8 34 8 23V11z" fill="currentColor" fillOpacity=".15"/><path d="M17 21c0-3 3-5 7-5s7 2 7 5-3 5-7 5-7-2-7-5zm-4 12c2-4 6-6 11-6s9 2 11 6"/><path d="M24 9v5"/></svg>;
    case "items":
      return <svg {...common}><path d="M12 16h24l3 25H9z" fill="currentColor" fillOpacity=".15"/><path d="M17 17v-5a7 7 0 0 1 14 0v5m-7 8v8m-4-4h8"/></svg>;
    case "shop":
      return <svg {...common}><path d="M8 19h32l-3-10H11z" fill="currentColor" fillOpacity=".2"/><path d="M10 19v22h28V19M8 19c0 4 7 5 8 0 0 5 8 5 8 0 0 5 8 5 8 0 1 5 8 4 8 0M17 28h14v13H17z"/></svg>;
    case "mail":
      return <svg {...common}><rect x="7" y="12" width="34" height="25" rx="3" fill="currentColor" fillOpacity=".13"/><path d="m9 15 15 12 15-12M9 35l11-9m19 9-11-9"/></svg>;
    case "settings":
      return <svg {...common}><path d="M20 7h8l1 5 4 2 5-2 4 7-4 4v4l4 4-4 7-5-2-4 2-1 5h-8l-1-5-4-2-5 2-4-7 4-4v-4l-4-4 4-7 5 2 4-2z" fill="currentColor" fillOpacity=".12" transform="translate(-2 -2) scale(1.08)"/><circle cx="24" cy="24" r="7"/></svg>;
    case "road":
      return <svg {...common}><path d="M14 7h20l5 34H9z" fill="currentColor" fillOpacity=".14"/><path d="M20 8 17 19m14-11 3 11M18 27h12m-11 6h13"/><path d="M24 12v3m0 6v3m0 6v3" strokeWidth="3"/></svg>;
    case "cottage":
      return <svg {...common}><path d="M7 23 24 9l17 14v17H7z" fill="currentColor" fillOpacity=".2"/><path d="M4 23 24 6l20 17M19 40V27h10v13M31 14v-6h5v10"/></svg>;
    case "farm":
      return <svg {...common}><path d="M7 25h34v15H7zM10 24V15h16v9M8 15l10-8 10 8" fill="currentColor" fillOpacity=".16"/><path d="M7 31h34M7 36h34M31 24v-9l7-5v14"/></svg>;
    case "sawmill":
      return <svg {...common}><path d="M6 26h28v14H6zM8 26l7-11h14l7 11" fill="currentColor" fillOpacity=".16"/><circle cx="36" cy="17" r="8"/><path d="M36 7v20M26 17h20m-17-7 14 14m0-14L29 24m-13 8h9m-9 5h7"/></svg>;
    case "quarry":
      return <svg {...common}><path d="m5 38 8-19 8 9 8-20 14 30z" fill="currentColor" fillOpacity=".2"/><path d="m13 19 6 12m10-23 3 14m-16 16 10-7 10 8"/></svg>;
    case "mine":
      return <svg {...common}><path d="M7 39c1-18 7-29 17-29s16 11 17 29z" fill="currentColor" fillOpacity=".18"/><path d="M15 39V25l9-8 9 8v14m-18-14h18M21 39V28h7v11M13 12 24 5l11 7"/></svg>;
    case "barracks":
      return <svg {...common}><path d="M6 22 24 8l18 14v18H6z" fill="currentColor" fillOpacity=".17"/><path d="M3 22 24 5l21 17M18 40V26h12v14M24 10v10m-4-5h8M34 8v-5m0 2 8 4-8 4"/></svg>;
    case "lantern":
      return <svg {...common}><path d="M24 6 34 12v16l-10 7-10-7V12z" fill="currentColor" fillOpacity=".23"/><path d="M18 12h12m-6-6v-3M24 35v8m-8 1h16m-11-27v11m6-11v11M14 17 8 14m26 3 6-3"/></svg>;
    case "bench":
      return <svg {...common}><path d="M8 21h32v6H8zM11 29h26v5H11z" fill="currentColor" fillOpacity=".2"/><path d="M12 27v14m24-14v14m-24-5h24M10 18h28"/></svg>;
    case "well":
      return <svg {...common}><path d="M9 24h30v12H9z" fill="currentColor" fillOpacity=".16"/><path d="m5 22 19-14 19 14M14 22v14m20-14v14M9 36h30M17 24h14"/><ellipse cx="24" cy="28" rx="7" ry="3"/></svg>;
    case "flag":
      return <svg {...common}><path d="M13 42h23m-12-3V6"/><path d="M24 8h16l-5 7 5 7H24z" fill="currentColor" fillOpacity=".24"/><circle cx="24" cy="6" r="2" fill="currentColor"/></svg>;
  }
}
