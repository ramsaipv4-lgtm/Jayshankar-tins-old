// billImage.ts — draws a plain receipt-style picture of a bill onto an offscreen <canvas> and
// hands back a PNG Blob. No PDF library, no server-side rendering — matches D20's "lite"
// philosophy (a WhatsApp share is a picture + caption a person sends themselves, not a generated
// document pipeline). Field visibility is caller-controlled (BillsManagement.tsx's own toggles),
// not hardcoded here — this module only knows how to lay out whatever it's given.

export interface BillImageLine {
  skuName: string;
  kg: number;
  pricePerKg: number;
}

export interface BillImageOptions {
  vendorName: string;
  billDate: string;
  vendorBillNumber?: string | null;
  lines: BillImageLine[];
  totalAmount: number;
  reconciledTotalAmount?: number | null;
  reconciliationNotes?: string | null;
  showPrices: boolean;
  showTotal: boolean;
  note?: string;
}

const WIDTH = 640;
const PAD = 32;

export async function generateBillImage(opts: BillImageOptions): Promise<Blob> {
  const rowHeight = 30;
  const headerHeight = 150;
  const noteHeight = opts.note ? 60 : 0;
  const reconciledHeight = opts.reconciledTotalAmount != null ? 70 : 0;
  const height = headerHeight + opts.lines.length * rowHeight + 110 + noteHeight + reconciledHeight;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, height);

  let y = PAD;
  ctx.fillStyle = '#0f172a';
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.fillText('Jayshankar — Purchase bill', PAD, (y += 26));

  ctx.font = '400 14px system-ui, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText(`Vendor: ${opts.vendorName}`, PAD, (y += 28));
  ctx.fillText(`Date: ${new Date(opts.billDate).toLocaleDateString()}`, PAD, (y += 20));
  if (opts.vendorBillNumber) {
    ctx.fillText(`Bill #: ${opts.vendorBillNumber}`, PAD, (y += 20));
  }

  y += 16;
  ctx.strokeStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(WIDTH - PAD, y);
  ctx.stroke();
  y += 24;

  ctx.fillStyle = '#0f172a';
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.fillText('Fish', PAD, y);
  ctx.textAlign = 'right';
  ctx.fillText('Kg', WIDTH - PAD - (opts.showPrices ? 220 : 0), y);
  if (opts.showPrices) {
    ctx.fillText('₹/kg', WIDTH - PAD - 110, y);
    ctx.fillText('Subtotal', WIDTH - PAD, y);
  }
  ctx.textAlign = 'left';
  y += 12;

  ctx.font = '400 14px system-ui, sans-serif';
  for (const line of opts.lines) {
    y += rowHeight;
    ctx.fillStyle = '#1e293b';
    ctx.fillText(line.skuName, PAD, y);
    ctx.textAlign = 'right';
    ctx.fillText(line.kg.toFixed(2), WIDTH - PAD - (opts.showPrices ? 220 : 0), y);
    if (opts.showPrices) {
      ctx.fillText(line.pricePerKg.toFixed(2), WIDTH - PAD - 110, y);
      ctx.fillText((line.kg * line.pricePerKg).toFixed(2), WIDTH - PAD, y);
    }
    ctx.textAlign = 'left';
  }

  y += 24;
  ctx.strokeStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(WIDTH - PAD, y);
  ctx.stroke();
  y += 30;

  if (opts.showTotal) {
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'right';
    ctx.fillText(`Total: ₹${opts.totalAmount.toFixed(2)}`, WIDTH - PAD, y);
    ctx.textAlign = 'left';
  }

  if (opts.reconciledTotalAmount != null) {
    y += 32;
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillStyle = '#b45309';
    ctx.textAlign = 'right';
    ctx.fillText(`Settled at: ₹${opts.reconciledTotalAmount.toFixed(2)}`, WIDTH - PAD, y);
    ctx.textAlign = 'left';
    if (opts.reconciliationNotes) {
      y += 22;
      ctx.font = '400 13px system-ui, sans-serif';
      ctx.fillStyle = '#78716c';
      ctx.fillText(opts.reconciliationNotes, PAD, y);
    }
  }

  if (opts.note) {
    y += 30;
    ctx.font = '400 13px system-ui, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(opts.note, PAD, y);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not render image'));
    }, 'image/png');
  });
}
