// mutations.ts — the mutation entry points. Each calls a SECURITY DEFINER
// Postgres function that runs the FIFO + cascade logic atomically server-side
// and bypasses RLS so workers can record movements they otherwise couldn't.
//
// Functions and their server-side counterparts:
//   - recordBillDelivery → record_bill_delivery     (migration 0019, one bill, N SKU lines)
//   - recordContainerFill → record_container_fill   (migration 0007, pack a bill's batches)
//   - recordSale        → record_container_sale      (migration 0009, two-phase cascade)
//   - recordSpoilage    → record_container_spoilage (migration 0009, two-phase cascade)
//   - recordTransfer    → record_transfer_cascade   (migration 0005, FIFO cascade)
//   - recordRepack      → record_repack             (migration 0008, container→container)
//   - confirmDeliveryArrival → confirm_delivery_arrival (migration 0032, promised vs measured)
//
// Every one of these now handles FOR UPDATE locking (where relevant) and the
// full write server-side — the previous race-condition concern (decision #19)
// about a partial-failure between two sequential client-side inserts doesn't
// apply anywhere in this file anymore. recordDelivery (client-side: 1 batch
// insert + 1 movement insert, no bills row, one SKU per call) was the last
// holdout — replaced by recordBillDelivery (V1 sprint, decision #64) once it
// became clear §4.3.7 step 1 actually requires a bills row to exist at all,
// which the old path never created.

import { supabase } from './supabase';

export interface BillLineInput {
  skuId: string;
  kg: number;                  // numeric(10,3)
  pricePerKgPaid: number;      // numeric(10,2) — in INR
}

export interface BillDeliveryInput {
  vendorId: string;
  locationId: string;          // one location for the whole bill — a vendor's delivery arrives in one trip
  billDate?: string;           // ISO date (YYYY-MM-DD); defaults to today server-side if omitted
  vendorBillNumber?: string;
  lines: BillLineInput[];
  // 'cash' (default) or 'credit' (migration 0034) — a credit bill's reconciliation can be
  // deferred with a reminder instead of settled right away.
  paymentTerms?: 'cash' | 'credit';
}

export interface BillDeliveryResult {
  billId: string | null;
  movementGroupId: string | null;
  totalAmount: number;
  batches: { batchId: string; skuId: string; kg: number }[];
  error: string | null;
}

// recordBillDelivery — calls the SECURITY DEFINER Postgres function
// public.record_bill_delivery (migration 0019). Creates one bills row and one
// batches row (+ delivery_in movement) per line, atomically. Replaces the old
// recordDelivery — see this file's header comment.
export async function recordBillDelivery(input: BillDeliveryInput): Promise<BillDeliveryResult> {
  const { data, error } = await supabase.rpc('record_bill_delivery', {
    p_vendor_id: input.vendorId,
    p_location_id: input.locationId,
    p_bill_date: input.billDate ?? undefined,
    p_vendor_bill_number: input.vendorBillNumber ?? null,
    p_items: input.lines.map((l) => ({ sku_id: l.skuId, kg: l.kg, price_per_kg_paid: l.pricePerKgPaid })),
    p_payment_terms: input.paymentTerms ?? 'cash',
  });
  if (error) {
    return { billId: null, movementGroupId: null, totalAmount: 0, batches: [], error: `Bill RPC: ${error.message}` };
  }
  const payload = (data ?? {}) as {
    bill_id?: string; movement_group_id?: string; total_amount?: number;
    batches?: { batch_id: string; sku_id: string; kg: number }[]; error?: string;
  };
  if (payload.error) {
    return { billId: null, movementGroupId: null, totalAmount: 0, batches: [], error: payload.error };
  }
  return {
    billId: payload.bill_id ?? null,
    movementGroupId: payload.movement_group_id ?? null,
    totalAmount: payload.total_amount ?? 0,
    batches: (payload.batches ?? []).map((b) => ({ batchId: b.batch_id, skuId: b.sku_id, kg: Number(b.kg) })),
    error: null,
  };
}

export interface ContainerFillLineInput {
  batchId: string;
  kg: number;
}

export interface ContainerFillInput {
  billId: string;
  locationId: string;
  containerNumber: string;
  capacityKg: number;
  lines: ContainerFillLineInput[];
  // Only used when this container_number is genuinely new (migration 0033) — ignored server-side
  // when adding to an already-registered container. Defaults to 'owned' either way.
  ownership?: 'owned' | 'vendor_provided' | 'given_to_buyer';
}

export interface ContainerFillResult {
  containerId: string | null;
  containerFillId: string | null;
  expiresAt: string | null;
  totalKg: number;
  error: string | null;
}

// recordContainerFill — calls the SECURITY DEFINER Postgres function
// public.record_container_fill (migration 0007). Packs a subset of one bill's
// batches into a (possibly brand-new) numbered container. p_container_number
// is a plain string, not a UUID — the function finds an existing active
// container by that number or registers a new one, so this form never needs
// its own "is this a new or existing container" toggle.
export async function recordContainerFill(input: ContainerFillInput): Promise<ContainerFillResult> {
  const { data, error } = await supabase.rpc('record_container_fill', {
    p_bill_id: input.billId,
    p_location_id: input.locationId,
    p_container_number: input.containerNumber,
    p_capacity_kg: input.capacityKg,
    p_items: input.lines.map((l) => ({ batch_id: l.batchId, kg: l.kg })),
    p_ownership: input.ownership ?? 'owned',
  });
  if (error) {
    return { containerId: null, containerFillId: null, expiresAt: null, totalKg: 0, error: `Container fill RPC: ${error.message}` };
  }
  const payload = (data ?? {}) as {
    container_id?: string; container_fill_id?: string; expires_at?: string; total_kg?: number; error?: string;
  };
  if (payload.error) {
    return { containerId: null, containerFillId: null, expiresAt: null, totalKg: 0, error: payload.error };
  }
  return {
    containerId: payload.container_id ?? null,
    containerFillId: payload.container_fill_id ?? null,
    expiresAt: payload.expires_at ?? null,
    totalKg: payload.total_kg ?? 0,
    error: null,
  };
}

export interface SaleInput {
  skuId: string;
  locationId: string;
  customerName: string;
  // Optional (migration 0015) -- when set, the sale links to a real customers row and the
  // database derives the display name from there rather than trusting customerName. A one-off
  // buyer with no formal record still works exactly as before, free-text name only.
  customerId?: string;
  totalKg: number;
  salePricePerKg: number;
  notes?: string;
}

export interface SaleResult {
  saleId: string | null;
  shortfall: number;             // kg that couldn't be fulfilled
  containerSourcedKg: number;    // kg drawn from container-tracked stock
  directSourcedKg: number;       // kg drawn from un-contained (storage) batches
  error: string | null;
}

// recordSale — calls the SECURITY DEFINER Postgres function
// public.record_container_sale (migration 0009). The function runs a real
// two-phase cascade server-side: container-tracked stock first (soonest-to-
// expire fill first), then un-contained batches for whatever isn't packed yet.
// Can draw across several fills and several batches in a single call, so the
// result carries no single batchId — just the totals. Partial fulfillment
// reports a shortfall rather than rejecting.
export async function recordSale(input: SaleInput, _userId: string): Promise<SaleResult> {
  const { data, error } = await supabase.rpc('record_container_sale', {
    p_sku_id: input.skuId,
    p_location_id: input.locationId,
    p_customer_name: input.customerName,
    p_total_kg: input.totalKg,
    p_sale_price_per_kg: input.salePricePerKg,
    p_notes: input.notes ?? null,
    p_customer_id: input.customerId ?? null,
  });
  if (error) {
    return { saleId: null, shortfall: input.totalKg, containerSourcedKg: 0, directSourcedKg: 0, error: `Sale RPC: ${error.message}` };
  }
  const payload = (data ?? {}) as { sale_id?: string; movement_group_id?: string; kg_sold?: number; shortfall?: number; container_sourced_kg?: number; direct_sourced_kg?: number; error?: string };
  if (payload.error) {
    return { saleId: null, shortfall: payload.shortfall ?? input.totalKg, containerSourcedKg: 0, directSourcedKg: 0, error: payload.error };
  }
  return {
    saleId: payload.sale_id ?? null,
    shortfall: payload.shortfall ?? 0,
    containerSourcedKg: payload.container_sourced_kg ?? 0,
    directSourcedKg: payload.direct_sourced_kg ?? 0,
    error: null,
  };
}

export interface TransferInput {
  skuId: string;
  fromLocationId: string;
  toLocationId: string;
  totalKg: number;
  notes?: string;
}

export interface TransferResult {
  movementGroupId: string | null;
  destinationBatchId: string | null;
  shortfall: number;
  error: string | null;
}

// recordTransfer — calls the SECURITY DEFINER Postgres function
// public.record_transfer_cascade (migration 0005). The function handles the
// FIFO + destination-batch + movement insert atomically, bypassing RLS so that
// workers (who can't insert batches directly) can record transfers.
//
// We tried the client-side FIFO approach in W3 first (decisions 18/19 plan),
// but it hit two issues: (1) RLS denied the destination-batch insert for
// workers, (2) no FOR UPDATE protection against concurrent transfers of the
// same source batch. The function fixes both.
export async function recordTransfer(input: TransferInput, _userId: string): Promise<TransferResult> {
  const { data, error } = await supabase.rpc('record_transfer_cascade', {
    p_sku_id: input.skuId,
    p_from_location_id: input.fromLocationId,
    p_to_location_id: input.toLocationId,
    p_kg: input.totalKg,
    p_notes: input.notes ?? null,
  });
  if (error) {
    return { movementGroupId: null, destinationBatchId: null, shortfall: input.totalKg, error: `Transfer RPC: ${error.message}` };
  }
  const payload = (data ?? {}) as { destination_batch_id?: string; movement_group_id?: string; shortfall?: number; error?: string };
  if (payload.error) {
    return { movementGroupId: null, destinationBatchId: null, shortfall: payload.shortfall ?? input.totalKg, error: payload.error };
  }
  return {
    movementGroupId: payload.movement_group_id ?? null,
    destinationBatchId: payload.destination_batch_id ?? null,
    shortfall: payload.shortfall ?? 0,
    error: null,
  };
}

export interface SpoilageInput {
  skuId: string;
  locationId: string;
  totalKg: number;
  reason: string;
  notes?: string;
}

export interface SpoilageResult {
  movementGroupId: string | null;
  shortfall: number;             // kg that couldn't be fulfilled
  containerSourcedKg: number;    // kg drawn from container-tracked stock
  directSourcedKg: number;       // kg drawn from un-contained (storage) batches
  error: string | null;
}

// recordSpoilage — calls the SECURITY DEFINER Postgres function
// public.record_container_spoilage (migration 0009). Same two-phase cascade
// as recordSale: container fills first, then un-contained batches. No
// sale-row ordering issue here, just FIFO draw + movement insert.
export async function recordSpoilage(input: SpoilageInput, _userId: string): Promise<SpoilageResult> {
  const { data, error } = await supabase.rpc('record_container_spoilage', {
    p_sku_id: input.skuId,
    p_location_id: input.locationId,
    p_total_kg: input.totalKg,
    p_reason: input.reason,
    p_notes: input.notes ?? null,
  });
  if (error) {
    return { movementGroupId: null, shortfall: input.totalKg, containerSourcedKg: 0, directSourcedKg: 0, error: `Spoilage RPC: ${error.message}` };
  }
  const payload = (data ?? {}) as { movement_group_id?: string; kg_spoiled?: number; shortfall?: number; container_sourced_kg?: number; direct_sourced_kg?: number; error?: string };
  if (payload.error) {
    return { movementGroupId: null, shortfall: payload.shortfall ?? input.totalKg, containerSourcedKg: 0, directSourcedKg: 0, error: payload.error };
  }
  return {
    movementGroupId: payload.movement_group_id ?? null,
    shortfall: payload.shortfall ?? 0,
    containerSourcedKg: payload.container_sourced_kg ?? 0,
    directSourcedKg: payload.direct_sourced_kg ?? 0,
    error: null,
  };
}

// Helpers
// (no client-side helpers needed — all math happens inside the RPCs now)

export interface RepackInput {
  sourceFillId: string;
  destinationContainerId: string;
}

export interface RepackResult {
  destinationContainerFillId: string | null;
  kgMoved: number;
  expiresAt: string | null;
  movementGroupId: string | null;
  error: string | null;
}

// recordRepack — calls the SECURITY DEFINER Postgres function
// public.record_repack (migration 0008). The function handles the
// container-to-container move atomically (source kg_remaining → 0, destination
// fill created with the source's UNCHANGED filled_at and expires_at, movement
// row inserted, fill_items copied), bypassing RLS so that workers can repack.
//
// The whole point of this operation is that the new container inherits the old
// container's exact filled_at/expires_at — repacking must never make fish
// appear fresher than it is. That discipline is enforced inside the function;
// this client just surfaces what the function returns.
export async function recordRepack(input: RepackInput, _userId: string): Promise<RepackResult> {
  const { data, error } = await supabase.rpc('record_repack', {
    p_source_fill_id: input.sourceFillId,
    p_destination_container_id: input.destinationContainerId,
  });
  if (error) {
    return { destinationContainerFillId: null, kgMoved: 0, expiresAt: null, movementGroupId: null, error: `Repack RPC: ${error.message}` };
  }
  const payload = (data ?? {}) as { destination_container_fill_id?: string; kg_moved?: number; expires_at?: string; movement_group_id?: string; error?: string };
  if (payload.error) {
    return { destinationContainerFillId: null, kgMoved: 0, expiresAt: null, movementGroupId: null, error: payload.error };
  }
  return {
    destinationContainerFillId: payload.destination_container_fill_id ?? null,
    kgMoved: payload.kg_moved ?? 0,
    expiresAt: payload.expires_at ?? null,
    movementGroupId: payload.movement_group_id ?? null,
    error: null,
  };
}

export interface ConfirmDeliveryArrivalInput {
  batchId: string;
  destinationLocationId: string;
  confirmedGoodKg: number;
  // Found spoiled/damaged already, at receiving -- kept structurally distinct from ordinary
  // in-warehouse spoilage (recordSpoilage) since it's far more likely the vendor's fault, not
  // the wholesaler's handling. See migration 0033's own comment.
  confirmedSpoiledKg?: number;
  confirmedSkuId?: string | null;
  notes?: string;
  photoStatus?: 'none' | 'pending_upload' | 'uploaded';
}

export interface ConfirmDeliveryArrivalResult {
  confirmationId: string | null;
  discrepancyFlag: boolean;
  confirmedGoodKg: number;
  confirmedSpoiledKg: number;
  promisedKg: number;
  error: string | null;
}

// confirmDeliveryArrival — calls the SECURITY DEFINER Postgres function
// public.confirm_delivery_arrival (migration 0033, superseding 0032's single-kg version).
// Moves a batch out of an in_transit_inbound location into a real one, recording what was
// actually measured against what the vendor's bill promised at pickup -- split into a good and
// a spoiled-at-receiving share. Physical stock (batches.kg/kg_remaining) adjusts to the good
// share; the bill's own total_amount is deliberately never touched here — the business's own
// answer was "case by case, reconciled by hand," not an automatic adjustment either way.
export async function confirmDeliveryArrival(input: ConfirmDeliveryArrivalInput): Promise<ConfirmDeliveryArrivalResult> {
  const { data, error } = await supabase.rpc('confirm_delivery_arrival', {
    p_batch_id: input.batchId,
    p_destination_location_id: input.destinationLocationId,
    p_confirmed_good_kg: input.confirmedGoodKg,
    p_confirmed_spoiled_kg: input.confirmedSpoiledKg ?? 0,
    p_confirmed_sku_id: input.confirmedSkuId ?? null,
    p_notes: input.notes ?? null,
    p_photo_status: input.photoStatus ?? 'none',
  });
  if (error) {
    return { confirmationId: null, discrepancyFlag: false, confirmedGoodKg: 0, confirmedSpoiledKg: 0, promisedKg: 0, error: `Confirm arrival RPC: ${error.message}` };
  }
  const payload = (data ?? {}) as { confirmation_id?: string; discrepancy_flag?: boolean; confirmed_good_kg?: number; confirmed_spoiled_kg?: number; promised_kg?: number; error?: string };
  if (payload.error) {
    return { confirmationId: null, discrepancyFlag: false, confirmedGoodKg: 0, confirmedSpoiledKg: 0, promisedKg: 0, error: payload.error };
  }
  return {
    confirmationId: payload.confirmation_id ?? null,
    discrepancyFlag: payload.discrepancy_flag ?? false,
    confirmedGoodKg: payload.confirmed_good_kg ?? 0,
    confirmedSpoiledKg: payload.confirmed_spoiled_kg ?? 0,
    promisedKg: payload.promised_kg ?? 0,
    error: null,
  };
}

export interface ReconcileBillInput {
  billId: string;
  // Settle now: give an amount and/or notes. Defer instead: give remindInDays, no amount yet.
  reconciledTotalAmount?: number;
  notes?: string;
  remindInDays?: number;
}

export interface ReconcileBillResult {
  reconciledAt: string | null;
  deferredTo: string | null;
  error: string | null;
}

// reconcileBill — calls the SECURITY DEFINER Postgres function public.reconcile_bill
// (migration 0034). Records what the admin actually decided about a delivery discrepancy (or
// any bill they want to note a final figure on) -- deliberately separate from bills.total_amount,
// which this never touches (D54's "case by case, reconciled by hand" answer).
export async function reconcileBill(input: ReconcileBillInput): Promise<ReconcileBillResult> {
  const { data, error } = await supabase.rpc('reconcile_bill', {
    p_bill_id: input.billId,
    p_reconciled_total_amount: input.reconciledTotalAmount ?? null,
    p_notes: input.notes ?? null,
    p_remind_in_days: input.remindInDays ?? null,
  });
  if (error) {
    return { reconciledAt: null, deferredTo: null, error: `Reconcile RPC: ${error.message}` };
  }
  const payload = (data ?? {}) as { reconciled_at?: string; deferred_to?: string; error?: string };
  if (payload.error) {
    return { reconciledAt: null, deferredTo: null, error: payload.error };
  }
  return { reconciledAt: payload.reconciled_at ?? null, deferredTo: payload.deferred_to ?? null, error: null };
}
