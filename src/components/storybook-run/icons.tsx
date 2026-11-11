// A small hand-drawn icon set for "The Run". Deliberately NOT lucide / Ant icons: this deck is a third design
// language, so its glyphs are its own (2px round-cap strokes on a 24 grid). No dependency, no font.

import type { ReactNode } from 'react';
import type { IconName } from '@/lib/storybook-run/types';

const P = (d: string) => <path d={d} />;

const DEFS: Record<IconName, ReactNode> = {
  truck: <><path d="M2.5 6.5h11v9h-11z" /><path d="M13.5 9.5h4l3 3.2v2.8h-7z" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>,
  fish: <><path d="M2.5 12c3-4.8 8-6 12-3l4.5-3v12l-4.5-3c-4 3-9 1.8-12-3z" /><circle cx="8" cy="11" r=".6" fill="currentColor" /></>,
  lock: <><rect x="5" y="11" width="14" height="9.5" rx="2.2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  unlock: <><rect x="5" y="11" width="14" height="9.5" rx="2.2" /><path d="M8 11V8a4 4 0 0 1 7.6-1.8" /></>,
  key: <><circle cx="7.5" cy="15.5" r="3.5" /><path d="M10 13 20 3.5M16 7.5l3 3M13.5 10l2 2" /></>,
  eye: <><path d="M2 12c1.4-3 4.8-7 10-7s8.6 4 10 7c-1.4 3-4.8 7-10 7S3.4 15 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M3 3l18 18M10.4 6.2A9.6 9.6 0 0 1 12 6c5.2 0 8.6 4 10 6-.5 1-1.5 2.4-3 3.6M6.4 7.6C4.4 9 3 11 2 12c1.4 3 4.8 7 10 7 1.3 0 2.5-.3 3.6-.7" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.2 2" /></>,
  wifi: <><path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.6 16a5 5 0 0 1 6.8 0" /><circle cx="12" cy="19.2" r=".7" fill="currentColor" /></>,
  wifiOff: <><path d="M3 3l18 18M2.5 9a14 14 0 0 1 4-2.6M9.7 5.2A14 14 0 0 1 21.5 9M5.5 12.5a9.5 9.5 0 0 1 3-1.8M14 10.7a9.5 9.5 0 0 1 4.5 1.8M8.6 16a5 5 0 0 1 3.4-1.4" /><circle cx="12" cy="19.2" r=".7" fill="currentColor" /></>,
  check: P('M4 12.8l5 5L20 6.5'),
  x: P('M6 6l12 12M18 6L6 18'),
  stamp: <><path d="M5 20.5h14M6.5 20.5v-3.5h11v3.5" /><path d="M9 17c0-3 1.3-4 1.7-6.2a3 3 0 1 1 2.6 0C13.700 13 15 14 15 17" /></>,
  scale: <><path d="M12 4v16M7.5 20h9M5 7h14" /><path d="M5 7 2.4 13.4a3 3 0 0 0 5.2 0zM19 7l-2.600 6.400a3 3 0 0 0 5.200 0z" /></>,
  route: <><circle cx="6" cy="18" r="2.200" /><circle cx="18" cy="6" r="2.200" /><path d="M8.200 18H15a3.200 3.200 0 0 0 0-6.400H9.200a3.200 3.200 0 0 1 0-6.400H15.800" /></>,
  warehouse: <><path d="M3 10.500 12 4l9 6.500V20H3z" /><path d="M8 20v-6h8v6" /></>,
  user: <><circle cx="12" cy="8" r="3.600" /><path d="M5 20.500c0-4 3-6.200 7-6.200s7 2.200 7 6.200" /></>,
  users: <><circle cx="9" cy="8.500" r="3.200" /><path d="M2.500 20c0-3.600 2.800-5.600 6.500-5.600s6.500 2 6.500 5.600M16 5.600a3.200 3.200 0 0 1 0 5.800M18 14.600c2.200.7 3.500 2.500 3.500 5.400" /></>,
  shield: P('M12 3l8 3v6c0 5-3.500 8-8 9.200C7.500 20 4 17 4 12V6z'),
  flag: <><path d="M5.500 21V3.800" /><path d="M5.500 4.500h12l-2.600 4 2.600 4h-12" /></>,
  arrowR: P('M4.500 12h15M13.500 6l6 6-6 6'),
  switch: <><rect x="2.500" y="7.500" width="19" height="9" rx="4.500" /><circle cx="8" cy="12" r="2.300" fill="currentColor" /></>,
  bell: <><path d="M6 16.500V11a6 6 0 0 1 12 0v5.500l2 2H4z" /><path d="M10 21a2 2 0 0 0 4 0" /></>,
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>,
  box: <><path d="M3 8l9-5 9 5v8l-9 5-9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></>,
  alert: <><path d="M12 3.500 22 20.500H2z" /><path d="M12 10v4.500M12 17.500h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.500M12 7.800h.01" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1" /><path d="M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1" /></>,
  copy: <><rect x="8.500" y="8.500" width="12" height="12" rx="2.200" /><path d="M15.500 8.500V5.700a2.200 2.200 0 0 0-2.200-2.200H5.700a2.200 2.200 0 0 0-2.200 2.200v7.600a2.200 2.200 0 0 0 2.200 2.200h2.800" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.500v2.500M12 19v2.500M2.500 12H5M19 12h2.500M5.300 5.300l1.800 1.800M16.900 16.900l1.800 1.800M5.300 18.700l1.800-1.800M16.900 7.100l1.800-1.800" /></>,
  moon: P('M20 14.500A8.500 8.500 0 0 1 9.500 4 8.500 8.500 0 1 0 20 14.500z'),
  book: <><path d="M4 5.500A2.500 2.500 0 0 1 6.500 3H20v15H6.500A2.500 2.500 0 0 0 4 20.500z" /><path d="M4 20.500A2.500 2.500 0 0 0 6.500 23H20v-5" /></>,
  plus: P('M12 5v14M5 12h14'),
  chevR: P('M9 5l7 7-7 7'),
  chevD: P('M5 9l7 7 7-7'),
  sync: <><path d="M20 11a8 8 0 0 0-14-3.800L4 9.500M4 4.500v5h5M4 13a8 8 0 0 0 14 3.800l2-2.300M20 19.500v-5h-5" /></>,
  play: <path d="M7 4.500v15l12-7.500z" fill="currentColor" />,
  pause: <><rect x="6" y="4.500" width="4" height="15" rx="1" fill="currentColor" /><rect x="14" y="4.500" width="4" height="15" rx="1" fill="currentColor" /></>,
  home: <><path d="M3 11 12 3.500 21 11" /><path d="M5.500 9.500V20h13V9.500" /></>,
  list: P('M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01'),
  rupee: P('M7 5h10M7 9.500h10M7 5c5.500 0 6 8-1 9.500L14 20'),
  ban: <><circle cx="12" cy="12" r="9" /><path d="M5.600 5.600l12.800 12.800" /></>,
  qr: <><rect x="3.500" y="3.500" width="6" height="6" rx="1" /><rect x="14.500" y="3.500" width="6" height="6" rx="1" /><rect x="3.500" y="14.500" width="6" height="6" rx="1" /><path d="M14.500 14.500h2.500v2.500M20.500 14.500v.01M14.500 20.500h6M17 17.500v3" /></>,
  camera: <><path d="M4 8h3l1.500-2.500h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.500" /></>,
  search: <><circle cx="10.500" cy="10.500" r="6.500" /><path d="M15.500 15.500 21 21" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M5.300 18.700l2.100-2.100M16.600 7.400l2.100-2.100" /></>,
  star: P('M12 3.500l2.600 5.400 5.900.8-4.300 4.100 1 5.900L12 16.900l-5.200 2.800 1-5.900L3.500 9.700l5.900-.8z'),
  store: <><path d="M4 9.500 5.500 4h13L20 9.500" /><path d="M4 9.500a2.700 2.700 0 0 0 5.300 0 2.700 2.700 0 0 0 5.400 0 2.700 2.700 0 0 0 5.300 0" /><path d="M5.500 12.500V20h13v-7.500M10 20v-4.500h4V20" /></>,
  share: <><circle cx="6" cy="12" r="2.500" /><circle cx="18" cy="6" r="2.500" /><circle cx="18" cy="18" r="2.500" /><path d="M8.200 10.800 15.800 7.200M8.200 13.200l7.600 3.600" /></>,
  percent: <><path d="M19 5 5 19" /><circle cx="7" cy="7" r="2.300" /><circle cx="17" cy="17" r="2.300" /></>,
  cart: <><path d="M3 4h2.500l2 11h10l2-8H6.300" /><circle cx="9" cy="19" r="1.500" /><circle cx="17" cy="19" r="1.500" /></>,
};

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {DEFS[name]}
    </svg>
  );
}
