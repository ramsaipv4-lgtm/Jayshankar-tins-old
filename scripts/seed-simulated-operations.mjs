#!/usr/bin/env node
// seed-simulated-operations.mjs — imports the real client spreadsheet's item catalog
// (example-video/Weekly Report.xlsx, "Item report" sheet — 106 real items, prices, quantities)
// into a NEW, clearly-provisional warehouse, then seeds a realistic operational history against
// it (deliveries, packing, sales) so there's real texture to develop against. Per the user's own
// framing: "the actual values can be another warehouse with no other detail filled in
// retroactively until client confirms" — this is explicitly NOT "Real Operations" (which stays
// empty, reserved for the client's actual confirmed operational data) and NOT the Mode A demo
// (fictional names/showcase). category/size_grade/shelf_life_hours are NOT in the spreadsheet at
// all — inferred by plain keyword heuristics below, honestly imperfect, clearly flagged as such
// in the warehouse's own display_name and in every SKU's notes field.
//
// Calls the REAL RPCs signed in as a real demo account for deliveries/packing/sales (same
// discipline as seed-demo-showcase.mjs) — but at their CURRENTLY LIVE signatures (5-param
// record_bill_delivery/record_container_fill) since migrations 0030-0034 (payment_terms,
// ownership, etc.) are written but not yet applied as of this run. Vendors/customers/SKUs are
// plain inserts via the service role (same as every other one-off catalog seed this sprint).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import xlsx from 'xlsx';

function loadEnv(path) {
  const text = readFileSync(path, 'utf8');
  const env = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    let val = line.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[line.slice(0, eq).trim()] = val;
  }
  return env;
}

const scriptsEnv = loadEnv(resolve(import.meta.dirname, '.env'));
const baseUrl = scriptsEnv.SUPABASE_URL;
const anonKey = scriptsEnv.SUPABASE_PUBLISHABLE_KEY;
const secretKey = scriptsEnv.SUPABASE_SECRET_KEY;
const secretHeaders = { apikey: secretKey, Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' };

async function signIn(email, password) {
  const res = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`signIn ${email} failed: ${JSON.stringify(body)}`);
  return { access_token: body.access_token, user_id: body.user.id };
}
function asHeaders(token) { return { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }; }
async function rpc(name, args, headers) {
  const res = await fetch(`${baseUrl}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(args) });
  const body = await res.json();
  if (!res.ok || body?.error) throw new Error(`${name} failed: ${JSON.stringify(body)}`);
  return body;
}
async function get(path, headers = secretHeaders) {
  const res = await fetch(`${baseUrl}/rest/v1/${path}`, { headers });
  return res.json();
}
async function post(path, data, headers = secretHeaders) {
  const res = await fetch(`${baseUrl}/rest/v1/${path}`, { method: 'POST', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(data) });
  const body = await res.json();
  if (!res.ok) throw new Error(`POST ${path} failed: ${JSON.stringify(body)}`);
  return body;
}

// ---------- 1. Read the real spreadsheet ----------

const wb = xlsx.readFile(resolve(import.meta.dirname, '..', 'example-video', 'Weekly Report.xlsx'));
const sheet = wb.Sheets['Item report'];
const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
const itemRows = rawRows.slice(1)
  .filter((r) => r[0] && String(r[0]).trim() !== '' && String(r[0]).trim() !== 'Total')
  .map((r) => ({ name: String(r[0]).trim(), saleQty: Number(r[1]) || 0, saleAmt: Number(r[2]) || 0, purchQty: Number(r[3]) || 0, purchAmt: Number(r[4]) || 0 }));

console.log(`Read ${itemRows.length} real items from the spreadsheet.`);

// Tamil script is embedded inline in ~half the names (e.g. "Avuli அவுலி") -- split it out.
const TAMIL_RE = /[஀-௿]+/;
function splitName(raw) {
  const m = raw.match(TAMIL_RE);
  if (!m) return { english: raw, tamil: '' };
  return { english: raw.replace(TAMIL_RE, '').trim(), tamil: m[0].trim() };
}

// Plain keyword heuristics -- the spreadsheet has no category/size_grade at all. Honestly
// imperfect (this business's real vocabulary needs the wholesaler's own confirmation), not a
// disguised guess: every SKU created this way gets a notes field saying so.
function inferCategory(name) {
  const n = name.toLowerCase();
  if (/\bcrab\b/.test(n)) return 'crustacean';
  if (/\bpr\b|prawn/.test(n)) return 'crustacean';
  if (/\bcf\b|squid|cuttlefish|\boc\b/.test(n)) return 'cephalopod';
  return 'fin_fish';
}
function inferSizeGrade(name) {
  const n = name.toLowerCase();
  if (/\bsmall\b|^s |^s\/|\bs \d/.test(n)) return 'small';
  if (/\bmedium\b|^m |^m\/|\bm \d/.test(n)) return 'medium';
  if (/\blarge\b/.test(n)) return 'large';
  if (/\bsuper\b|\bxl\b/.test(n)) return 'xl';
  const gradeMatch = n.match(/\b(100|200|300|500|700)\b/);
  if (gradeMatch) {
    const g = Number(gradeMatch[1]);
    if (g <= 200) return 'small';
    if (g <= 300) return 'medium';
    return 'large';
  }
  return 'mixed';
}
function slugCode(name, used) {
  let base = name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) || 'ITEM';
  let code = base, n = 1;
  while (used.has(code)) code = `${base}-${++n}`;
  used.add(code);
  return code;
}

async function main() {
  // ---------- 2. The warehouse ----------
  const [existingWh] = await get(`warehouses?select=id,name&name=eq.simulated-operations`);
  let warehouseId, locationId;
  if (existingWh) {
    warehouseId = existingWh.id;
    console.log('Reusing existing "simulated-operations" warehouse.');
    [{ id: locationId }] = await get(`locations?select=id&warehouse_id=eq.${warehouseId}&kind=eq.warehouse`);
  } else {
    const [wh] = await post('warehouses', {
      name: 'simulated-operations',
      display_name: 'Simulated Operations (dev data — NOT client-confirmed)',
    });
    warehouseId = wh.id;
    const [loc] = await post('locations', {
      name: 'simulated-operations-main',
      display_name: 'Main Storage',
      kind: 'warehouse',
      warehouse_id: warehouseId,
    });
    locationId = loc.id;
    console.log('Created warehouse + main location:', warehouseId, locationId);
  }

  // ---------- 3. SKUs (reuse by english_name if one already exists anywhere) ----------
  const existingSkus = await get(`skus?select=id,english_name`);
  const existingByName = new Map(existingSkus.map((s) => [s.english_name.toLowerCase(), s.id]));
  const usedCodes = new Set((await get(`skus?select=code`)).map((s) => s.code));

  const skuMap = new Map(); // itemRow.name -> { id, purchasePricePerKg, salePricePerKg }
  let created = 0, reused = 0;
  for (const item of itemRows) {
    const { english, tamil } = splitName(item.name);
    const purchasePricePerKg = item.purchQty > 0 ? Math.round((item.purchAmt / item.purchQty) * 100) / 100 : null;
    const salePricePerKg = item.saleQty > 0 ? Math.round((item.saleAmt / item.saleQty) * 100) / 100 : null;

    const existingId = existingByName.get(english.toLowerCase());
    if (existingId) {
      reused++;
      skuMap.set(item.name, { id: existingId, purchasePricePerKg, salePricePerKg });
      continue;
    }

    const [sku] = await post('skus', {
      code: slugCode(english, usedCodes),
      english_name: english,
      tamil_name: tamil,
      category: inferCategory(item.name),
      size_grade: inferSizeGrade(item.name),
      notes: 'Imported from the real client spreadsheet (Weekly Report.xlsx) for development '
        + 'simulation. category/size_grade/shelf_life_hours are a best-effort guess, NOT '
        + 'confirmed by the wholesaler — verify before this data is ever treated as real.',
    });
    created++;
    skuMap.set(item.name, { id: sku.id, purchasePricePerKg, salePricePerKg });
  }
  console.log(`SKUs: ${created} created, ${reused} reused (matched an existing english_name).`);

  // ---------- 4. Vendors + customers (generic, clearly provisional) ----------
  const VENDOR_NAMES = ['Harbor Supplier A - unconfirmed', 'Harbor Supplier B - unconfirmed', 'Harbor Supplier C - unconfirmed', 'Harbor Supplier D - unconfirmed', 'Harbor Supplier E - unconfirmed'];
  const vendorIds = [];
  for (const name of VENDOR_NAMES) {
    const [existing] = await get(`vendors?select=id&name=eq.${encodeURIComponent(name)}`);
    if (existing) { vendorIds.push(existing.id); continue; }
    const [v] = await post('vendors', { name, notes: 'Generic placeholder vendor for simulated operational data.' });
    vendorIds.push(v.id);
  }

  const CUSTOMER_NAMES = ['Sample Hotel Buyer - unconfirmed', 'Sample Market Buyer - unconfirmed', 'Sample Restaurant Buyer - unconfirmed'];
  const customerIds = [];
  for (const name of CUSTOMER_NAMES) {
    const [existing] = await get(`customers?select=id&name=eq.${encodeURIComponent(name)}&warehouse_id=eq.${warehouseId}`);
    if (existing) { customerIds.push(existing.id); continue; }
    const [c] = await post('customers', { name, warehouse_id: warehouseId });
    customerIds.push(c.id);
  }
  console.log(`Vendors: ${vendorIds.length}, Customers: ${customerIds.length}`);

  // ---------- 5. Deliveries — every item with real purchase data, round-robin across vendors,
  // batched into a handful of bills (not one bill per item) ----------
  const rep = await signIn('rep@jayshankar.demo', scriptsEnv.SEED_REP_PASSWORD || 'DevPassword123!');
  const repHeaders = asHeaders(rep.access_token);

  const purchasable = itemRows.filter((r) => skuMap.get(r.name)?.purchasePricePerKg != null);
  const BILL_SIZE = 20;
  const batchByItemName = new Map(); // item name -> { batchId, kg }
  let billCount = 0;
  for (let i = 0; i < purchasable.length; i += BILL_SIZE) {
    const chunk = purchasable.slice(i, i + BILL_SIZE);
    const vendorId = vendorIds[billCount % vendorIds.length];
    const items = chunk.map((item) => {
      const sku = skuMap.get(item.name);
      // Real quantities can be large (weekly totals) -- cap a single simulated delivery's line
      // at a believable one-trip amount so this reads as "one day," not "one accounting period."
      const kg = Math.min(Math.max(item.purchQty, 1), 30);
      return { sku_id: sku.id, kg: Math.round(kg * 100) / 100, price_per_kg_paid: sku.purchasePricePerKg };
    });
    const result = await rpc('record_bill_delivery', {
      p_vendor_id: vendorId, p_location_id: locationId, p_items: items,
    }, repHeaders);
    billCount++;
    for (let j = 0; j < chunk.length; j++) {
      batchByItemName.set(chunk[j].name, { batchId: result.batches[j].batch_id, kg: Number(result.batches[j].kg) });
    }
  }
  console.log(`Deliveries: ${billCount} bills, ${batchByItemName.size} batches created.`);

  // ---------- 6. Pack roughly a third of the delivered batches into containers ----------
  const packable = [...batchByItemName.entries()].filter((_, idx) => idx % 3 === 0);
  let containerCount = 0, containerNum = 1;
  for (const [, { batchId, kg }] of packable) {
    const capacity = kg <= 5 ? 5 : kg <= 10 ? 10 : kg <= 15 ? 15 : kg <= 20 ? 20 : 25;
    try {
      await rpc('record_container_fill', {
        p_bill_id: (await get(`batches?select=bill_id&id=eq.${batchId}`))[0].bill_id,
        p_location_id: locationId,
        p_container_number: `SIM-${String(containerNum++).padStart(4, '0')}`,
        p_capacity_kg: capacity,
        p_items: [{ batch_id: batchId, kg: Math.min(kg, capacity) }],
      }, repHeaders);
      containerCount++;
    } catch (e) {
      console.log('  (skipped a pack:', e.message.slice(0, 100), ')');
    }
  }
  console.log(`Packed ${containerCount} containers.`);

  // ---------- 7. Sell a subset at the spreadsheet's own real sale price ----------
  const sellable = itemRows.filter((r) => skuMap.get(r.name)?.salePricePerKg != null && batchByItemName.has(r.name));
  let saleCount = 0;
  for (let i = 0; i < sellable.length; i += 5) {
    const item = sellable[i];
    const sku = skuMap.get(item.name);
    const { kg } = batchByItemName.get(item.name);
    const sellKg = Math.min(kg * 0.4, 10);
    if (sellKg <= 0) continue;
    const customerId = customerIds[saleCount % customerIds.length];
    try {
      await rpc('record_container_sale', {
        p_sku_id: sku.id, p_location_id: locationId,
        p_customer_name: CUSTOMER_NAMES[saleCount % CUSTOMER_NAMES.length],
        p_total_kg: Math.round(sellKg * 100) / 100,
        p_sale_price_per_kg: sku.salePricePerKg,
        p_customer_id: customerId,
      }, repHeaders);
      saleCount++;
    } catch (e) {
      console.log('  (skipped a sale:', e.message.slice(0, 100), ')');
    }
  }
  console.log(`Sales: ${saleCount}.`);

  console.log('\nDone. Warehouse:', warehouseId);
}

main().catch((e) => { console.error(e); process.exit(1); });
