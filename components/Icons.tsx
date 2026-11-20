import type { SVGProps } from "react";

const base: SVGProps<SVGSVGElement> = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
type P = SVGProps<SVGSVGElement>;

export const IconDoor = (p: P) => (<svg {...base} {...p}><path d="M5 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17" /><path d="M3 21h18" /><circle cx="11.5" cy="12.5" r="0.6" fill="currentColor" /></svg>);
export const IconList = (p: P) => (<svg {...base} {...p}><path d="M8 6h12M8 12h12M8 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></svg>);
export const IconPeople = (p: P) => (<svg {...base} {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.8c1.9.7 3 2.3 3 5.2" /></svg>);
export const IconGear = (p: P) => (<svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" /></svg>);
export const IconBell = (p: P) => (<svg {...base} {...p}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 21h4" /></svg>);
export const IconBellOff = (p: P) => (<svg {...base} {...p}><path d="M6 16V11c0-1 .2-1.900.6-2.700M9 4.500A6 6 0 0 1 18 11v5l1.500 2H8M10 21h4M3 3l18 18" /></svg>);
export const IconSun = (p: P) => (<svg {...base} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.2 5.2l1.8 1.8M17 17l1.8 1.8M18.8 5.2L17 7M7 17l-1.8 1.8" /></svg>);
export const IconMoon = (p: P) => (<svg {...base} {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></svg>);
export const IconCheck = (p: P) => (<svg {...base} {...p}><path d="M4 12.5l5 5L20 6.500" /></svg>);
export const IconX = (p: P) => (<svg {...base} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const IconAlert = (p: P) => (<svg {...base} {...p}><path d="M12 3.500l9.500 16.500h-19z" /><path d="M12 10v4.500M12 17.500h.01" /></svg>);
export const IconClock = (p: P) => (<svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
export const IconCopy = (p: P) => (<svg {...base} {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></svg>);

/** The wayfinding glyph: a door that swings open, with an exit arrow. Authored for the sign. */
export function SignGlyph(p: P) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
      <path d="M10 56V10a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v46" />
      <path d="M4 56h56" />
      <g className="leaf"><path d="M14 12h16v44H14z" fill="currentColor" fillOpacity="0.18" stroke="none" /><circle cx="26" cy="35" r="1.6" fill="currentColor" stroke="none" /></g>
      <path d="M40 32h16M50 24l8 8-8 8" />
    </svg>
  );
}

export const IconChevron = (p: P) => (<svg {...base} {...p}><path d="M6 9l6 6 6-6" /></svg>);

/** Sleeping door for the idle state: the same door glyph with drifting z's. No text. */
export function SleepGlyph(p: P) {
  return (
    <svg viewBox="0 0 96 64" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
      <path d="M10 56V10a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v46" />
      <path d="M4 56h56" />
      <path d="M14 12h16v44H14z" fill="currentColor" fillOpacity="0.14" stroke="none" />
      <circle cx="26" cy="35" r="1.6" fill="currentColor" stroke="none" />
      <g className="zzz">
        <path className="z z1" strokeWidth={3} d="M52 30h9l-9 10h9" />
        <path className="z z2" strokeWidth={3} d="M66 18h7l-7 8h7" />
        <path className="z z3" strokeWidth={2.6} d="M78 8h5.5l-5.5 6.500h5.500" />
      </g>
    </svg>
  );
}
