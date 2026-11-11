// OfflineBanner — persistent banner that appears below the header when the
// browser is offline. SPEC §2.14: "Offline — read only. Changes will be
// available when back online." SPEC §3.5: role="status" aria-live="polite"
// so screen readers announce it without stealing focus.

import { useOnlineStatus } from '../lib/online';

export default function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-amber-100 border-b border-amber-200 text-amber-900 text-sm"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-2">
        <span aria-hidden="true">⚠️</span>
        <span>Offline — read only. Changes will be available when back online.</span>
      </div>
    </div>
  );
}
