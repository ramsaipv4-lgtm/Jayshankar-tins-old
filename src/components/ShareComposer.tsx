// ShareComposer — D20's "lite" implementation (decision #67): no WhatsApp Business Cloud API,
// no Meta business verification, no message-template pre-approval process — just hands
// composed text to whatever app the person picks via the OS share sheet (WhatsApp included on
// any phone that has it installed), or lets them copy it to paste in by hand. Same pattern
// already proven in TeamManagement.tsx's invite-link panel — extracted here so it isn't
// reimplemented per screen.
//
// This is deliberately NOT automated sending — nothing in this app ever calls an external API
// to deliver a message on the user's behalf, matching D20's own "outbound-only... via the
// official WhatsApp Business Cloud API" being the FULL implementation still deferred, not this
// one. A person always makes the final send themselves, in their own WhatsApp.

import { useState } from 'react';

// `image` (added alongside the bill-reconciliation work, migration 0034): an optional generated
// receipt-style picture to go with the text -- shared as a real file via the Web Share API where
// the platform supports sharing files (most Android/WhatsApp combinations do), so the receiving
// end gets both the picture and the caption in one share sheet action, same as attaching a photo
// by hand. Still never sent automatically -- the person always makes the final send themselves.
export function ShareComposer({ text, label = 'Copy', image }: { text: string; label?: string; image?: { blob: Blob; fileName: string } }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, non-secure context) — the composed text is
      // already visible above this component, so it can still be copied by hand.
    }
  }

  async function onShare() {
    const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
    if (image && nav.canShare) {
      const file = new File([image.blob], image.fileName, { type: image.blob.type });
      const withFile: ShareData = { text, files: [file] };
      if (nav.canShare(withFile)) {
        navigator.share(withFile).catch(() => {});
        return;
      }
    }
    navigator.share({ text }).catch(() => {});
  }

  function onDownloadImage() {
    if (!image) return;
    const url = URL.createObjectURL(image.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = image.fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onCopy}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        {copied ? 'Copied!' : label}
      </button>
      {image && (
        <button
          type="button"
          onClick={onDownloadImage}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Save picture
        </button>
      )}
      {typeof navigator !== 'undefined' && 'share' in navigator && (
        <button
          type="button"
          onClick={onShare}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Share…
        </button>
      )}
    </div>
  );
}
