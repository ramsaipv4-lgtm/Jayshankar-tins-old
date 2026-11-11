// ScrollArea — a scrollable region that says so.
//
// The device frames are a fixed size (340×600, 1180×720) and the scrollbars are hidden for looks, so a
// screen with more content than fits simply lost its bottom edge in the picture — a reviewer could not
// tell "this screen ends here" from "this screen continues". This keeps the clean, scrollbar-free look
// but adds what a real app shows: a soft fade at the bottom edge and a small "More" pill while there is
// content below, which disappears once you have scrolled to the end. (Wheel and touch scrolling work as
// normal; so does "Actual size" in the lightbox.)

import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { DownOutlined } from '@ant-design/icons';

export default function ScrollArea({
  children,
  style,
  fade = '#f5f5f5',
}: {
  children: ReactNode;
  style?: CSSProperties;
  /** The colour the fade should dissolve into — the area's own background. */
  fade?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  const check = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 10);
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [check]);

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', ...style }}>
      <div ref={ref} onScroll={check} className="sba-noscroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        {children}
      </div>
      {more && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            insetInline: 0,
            bottom: 0,
            height: 54,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: 6,
            background: `linear-gradient(to bottom, transparent, ${fade} 78%)`,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.62)', color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: 10, fontWeight: 600 }}>
            <DownOutlined style={{ fontSize: 8 }} /> More
          </span>
        </div>
      )}
    </div>
  );
}
