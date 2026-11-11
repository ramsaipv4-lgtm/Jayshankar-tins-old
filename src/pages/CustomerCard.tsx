// CustomerCard — search result detail for a customer: contact/business info, credit status,
// sale history with per-sale balance, and a traceability line per sale (which employee
// recorded it, which vendor(s) the fish actually came from). Everything here is derivable from
// existing customers/sales/payments/movements/batches/vendors/users data — no new schema
// (decision #65). The vendor/employee trace walks sales -> movements -> batches -> vendors,
// since a container-sourced sale can draw from several batches/vendors in one cascade
// (migration 0009) — this lists every distinct vendor involved, not just one.

import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { FormFooter } from '../components/FormFields';

interface Customer {
  id: string; name: string; business_name: string | null; phone: string | null; address: string | null;
  fish_preference: string | null; credit_limit: number | null; credit_period_days: number | null;
}

interface CreditStatus {
  outstanding_balance: number; is_over_limit: boolean; days_overdue: number | null;
}

interface SaleRow {
  id: string; sold_at: string; total_amount: number;
  skus: { english_name: string } | null;
  sold_by_user: { display_name: string } | null;
}

interface MovementVendorRow {
  sale_id: string;
  batches: { vendors: { name: string } | null } | null;
}

export default function CustomerCard() {
  const { customerId } = useParams<{ customerId: string }>();

  const { data: customer } = useQuery({
    queryKey: ['customer-card', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, business_name, phone, address, fish_preference, credit_limit, credit_period_days')
        .eq('id', customerId)
        .single();
      if (error) throw error;
      return data as Customer;
    },
  });

  const { data: status } = useQuery({
    queryKey: ['customer-card-credit', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_credit_status')
        .select('outstanding_balance, is_over_limit, days_overdue')
        .eq('customer_id', customerId)
        .single();
      if (error) throw error;
      return data as CreditStatus;
    },
  });

  const { data: sales } = useQuery({
    queryKey: ['customer-card-sales', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('id, sold_at, total_amount, skus(english_name), sold_by_user:users!sold_by(display_name)')
        .eq('customer_id', customerId)
        .order('sold_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as SaleRow[];
    },
  });

  const { data: paidBySale } = useQuery({
    queryKey: ['customer-card-payments', customerId, sales?.map((s) => s.id).join(',')],
    enabled: !!sales && sales.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('sale_id, amount')
        .in('sale_id', sales!.map((s) => s.id));
      if (error) throw error;
      const map = new Map<string, number>();
      for (const p of data ?? []) map.set(p.sale_id, (map.get(p.sale_id) ?? 0) + Number(p.amount));
      return map;
    },
  });

  const { data: vendorsBySale } = useQuery({
    queryKey: ['customer-card-vendors', customerId, sales?.map((s) => s.id).join(',')],
    enabled: !!sales && sales.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('movements')
        .select('sale_id, batches(vendors(name))')
        .in('sale_id', sales!.map((s) => s.id));
      if (error) throw error;
      const map = new Map<string, Set<string>>();
      for (const m of (data ?? []) as unknown as MovementVendorRow[]) {
        if (!m.sale_id) continue;
        const name = m.batches?.vendors?.name;
        if (!name) continue;
        if (!map.has(m.sale_id)) map.set(m.sale_id, new Set());
        map.get(m.sale_id)!.add(name);
      }
      return map;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">{customer?.name ?? 'Loading…'}</h2>
        {customer && (
          <p className="text-sm text-slate-500 mt-1">
            {customer.business_name && `${customer.business_name} · `}
            {customer.phone ? <a href={`tel:${customer.phone}`} className="text-indigo-600 hover:underline">{customer.phone}</a> : 'No phone on file'}
            {customer.fish_preference && ` · Usually buys ${customer.fish_preference}`}
          </p>
        )}
        {customer?.address && <p className="text-sm text-slate-500 mt-1">{customer.address}</p>}
      </div>

      {status && (
        <div className={`rounded-lg border p-4 ${status.is_over_limit ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700">Outstanding balance</span>
            <span className="text-lg font-semibold text-slate-800">₹{status.outstanding_balance.toFixed(2)}</span>
          </div>
          {customer?.credit_limit != null && (
            <div className="text-xs text-slate-500 mt-1">
              Credit limit ₹{customer.credit_limit}
              {status.is_over_limit && <span className="text-red-600 font-medium"> — over limit</span>}
            </div>
          )}
          {status.days_overdue != null && status.days_overdue > 0 && (
            <div className="text-xs text-amber-700 mt-1">{status.days_overdue} day{status.days_overdue === 1 ? '' : 's'} overdue on the oldest unpaid sale</div>
          )}
        </div>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">Purchase history — with full trace</h3>
        <div className="space-y-2">
          {sales?.map((s) => {
            const paid = paidBySale?.get(s.id) ?? 0;
            const balance = Math.max(0, Number(s.total_amount) - paid);
            const vendors = vendorsBySale?.get(s.id);
            return (
              <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-slate-800">{s.skus?.english_name ?? 'Sale'}</div>
                  <div className="text-sm text-slate-800 font-medium">₹{Number(s.total_amount).toFixed(2)}</div>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {new Date(s.sold_at).toLocaleDateString()} · sold by {s.sold_by_user?.display_name ?? '—'}
                  {vendors && vendors.size > 0 && ` · from ${Array.from(vendors).join(', ')}`}
                  {balance > 0 ? <span className="text-amber-700"> · ₹{balance.toFixed(2)} owed</span> : ' · paid in full'}
                </div>
              </div>
            );
          })}
          {sales?.length === 0 && (
            <div className="text-sm text-slate-500 text-center py-8">No purchases yet.</div>
          )}
        </div>
      </section>

      <FormFooter backHref="/search" backLabel="Back to search" />
    </div>
  );
}
