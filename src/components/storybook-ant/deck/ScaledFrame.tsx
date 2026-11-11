// ScaledFrame — fits a fixed-size device frame into whatever width it is given.
//
// WHY THIS EXISTS: the phone (340×600) and the desktop panel (1180×720) are drawn at a fixed size and
// the screen around them is anything from a 360px phone to a 1440px monitor. The shared Tailwind
// player solved that with a table of hand-picked `scale-[0.82]` classes per breakpoint and a matching
// table of box sizes that had to be edited together. Here the scale is *measured*: the container's
// width (and, optionally, a height ceiling) decides it, so there is no breakpoint table to drift out
// of step with the frame sizes, and a frame can never overflow its card.
//
// Plain inline styles on purpose — this file is part of the Ant deck, and the Ant deck's own layout
// code should not depend on Tailwind utility classes.

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export interface ScaledFrameProps {
  /** The frame's natural size, in CSS px. */
  width: number;
  height: number;
  /** Never scale above this (default 1 — a frame is never blown up past its drawn size). */
  maxScale?: number;
  /** Also cap the scale so the frame is at most this tall once scaled. */
  maxHeight?: number;
  /**
   * `fit` shrinks to the container. `actual` renders at 1:1 and lets the container scroll — the
   * "read every word" mode for desktop panels on a phone.
   */
  mode?: 'fit' | 'actual';
  children: ReactNode;
  style?: CSSProperties;
}

export default function ScaledFrame({
  width,
  height,
  maxScale = 1,
  maxHeight,
  mode = 'fit',
  children,
  style,
}: ScaledFrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Start from the natural width so the first paint is the full-size frame, not a collapsed one.
  const [available, setAvailable] = useState(width);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setAvailable(el.clientWidth || width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);

  const scale =
    mode === 'actual'
      ? 1
      : Math.max(0.05, Math.min(maxScale, available / width, maxHeight ? maxHeight / height : Infinity));
  const scaledWidth = width * scale;

  return (
    <div
      ref={ref}
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: mode === 'actual' && scaledWidth > available ? 'flex-start' : 'center',
        overflowX: mode === 'actual' ? 'auto' : 'hidden',
        ...style,
      }}
    >
      <div style={{ width: scaledWidth, height: height * scale, flex: 'none', position: 'relative' }}>
        <div
          style={{
            width,
            height,
            position: 'absolute',
            top: 0,
            left: 0,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
