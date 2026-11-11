// invite-user — Supabase Edge Function. SPEC.md §4.3.12 / D34; D35 for the deferred OTP phone
// design; D36 for the email link; D37 for the active phone mechanism.
//
// The one piece of server-side logic in this project that can't live in a Postgres SECURITY
// DEFINER function: creating an auth.users row needs the Supabase Auth Admin API, which needs
// the service-role key — a key that must never reach the client (SPEC.md §4.1: "the publishable
// key is the only thing shipped in the JS bundle. The secret key never leaves the server").
//
// Two Supabase clients, deliberately:
//   1. A client scoped to the CALLER's own JWT — used only to verify who's calling, by reading
//      their own public.users row exactly the way current_user_role()/RLS already would. This
//      reuses the existing authorization boundary rather than re-implementing it.
//   2. A client built from the service-role key — constructed only after the caller is verified,
//      never returned to the caller, never logged. Used for the rest of this function.
//
// Email (D36) and phone (D37) now go through the SAME underlying mechanism -- generateLink({
// type: 'invite' }), which creates the account and hands back a link but SENDS NOTHING; the
// admin shares it themselves. Phone has no native link-generation support in Supabase (it only
// knows how to anchor a link to an email identity), so the phone branch generates the link
// against a SYNTHETIC email the person never sees (`<digits>@phone.invalid`), then attaches the
// REAL phone number to that same account, then corrects public.users directly -- see the phone
// branch below and D37 for exactly why each step is there (verified live before writing this,
// not assumed -- skipping the correction step leaks the synthetic email into the UI).
//
// D35's OTP design (admin.createUser + phone_confirm: true, no password ever, sign-in via a
// fresh SMS OTP every time) is NOT implemented here -- it's the deferred "full implementation",
// specified in SPEC.md but not the active path, until there's an actual SMS provider budget/need.
//
// SITE_URL is a manually-configured Edge Function secret (Supabase Dashboard → Edge Functions →
// invite-user → Secrets), NOT one of the auto-injected ones — set it to the deployed web app's
// URL once that exists (D36's real prerequisite: this app has no deployed web URL yet as of
// writing). Until it's set, both paths fall back to Supabase's own default Site URL rather than
// failing outright.
//
// Deployed via the Supabase Dashboard's Edge Functions UI (paste this file, deploy) or the
// Supabase CLI — either works. SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are
// injected automatically into every Edge Function's environment; no manual secret configuration
// needed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ROLES = ['admin', 'co-admin', 'vendor-rep', 'worker', 'super-worker'];
const E164_RE = /^\+[1-9]\d{6,14}$/;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// D38 -- build OUR OWN link into the app's own accept-invite page, rather than handing back
// Supabase's own action_link (which points at Supabase's own /auth/v1/verify redirect
// endpoint). Found live: this app uses hash-based routing (SPEC.md D36/§3.1), and Supabase's
// own redirect delivers session tokens in the URL FRAGMENT too -- the same '#' the router reads
// as a route, a real collision. Sidestepped entirely by never sending anyone to Supabase's own
// verify URL at all: this link points straight at our own hash route with token_hash/type as an
// ordinary query string (which HashRouter parses correctly, same as any router), and
// AcceptInvite.tsx calls verifyOtp({ token_hash, type }) itself, client-side -- the OTP
// verification path, not an OAuth code exchange, so it works the same regardless of whichever
// auth flow (implicit/PKCE) this Supabase project is configured for.
function ownInviteLink(siteUrl: string | undefined, hashedToken: string, fallbackActionLink: string): string {
  if (!siteUrl) return fallbackActionLink; // no SITE_URL configured yet -- better than nothing
  return `${siteUrl.replace(/\/$/, '')}/#/accept-invite?token_hash=${encodeURIComponent(hashedToken)}&type=invite`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    // Should never happen -- Supabase injects these automatically -- but fail loudly rather
    // than silently proceeding with an undefined key if the environment is ever misconfigured.
    return json({ error: 'Server misconfiguration: missing Supabase environment variables' }, 500);
  }
  // D36 -- manually-configured secret, not auto-injected. Not required: without it, generateLink
  // falls back to the Supabase project's own default Site URL, which is a degraded-but-working
  // state, not a hard failure.
  const siteUrl = Deno.env.get('SITE_URL');

  // ============================================================
  // Step 1: verify the caller, using THEIR OWN JWT, not the service-role key.
  // ============================================================
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authErr } = await callerClient.auth.getUser();
  if (authErr || !authData?.user) {
    return json({ error: 'Not authenticated' }, 401);
  }

  const { data: callerRow, error: callerRowErr } = await callerClient
    .from('users')
    .select('role')
    .eq('id', authData.user.id)
    .single();

  if (callerRowErr || !callerRow || !['admin', 'co-admin'].includes(callerRow.role)) {
    return json({ error: 'Only admin or co-admin can invite new users' }, 403);
  }

  // ============================================================
  // Step 2: validate the request body. Exactly one of email/phone (D35) -- never both, never
  // neither, matching the database's users_identity_present CHECK (migration 0014).
  // ============================================================
  let body: { email?: string; phone?: string; role?: string; display_name?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const email = body.email?.trim();
  const phone = body.phone?.trim();
  const role = body.role?.trim();
  const displayName = body.display_name?.trim();

  if (!role || !displayName) {
    return json({ error: 'role and display_name are required' }, 400);
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return json({ error: `role must be one of: ${ALLOWED_ROLES.join(', ')}` }, 400);
  }
  if (!email && !phone) {
    return json({ error: 'Provide either email or phone' }, 400);
  }
  if (email && phone) {
    return json({ error: 'Provide only one of email or phone, not both' }, 400);
  }
  if (phone && !E164_RE.test(phone)) {
    return json({ error: 'phone must be in E.164 format, e.g. +919876543210' }, 400);
  }

  // ============================================================
  // Step 3: only now construct the service-role client. Never returned, never logged.
  // ============================================================
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // ============================================================
  // Step 4: branch on which identifier was supplied. Both now produce a shareable link (D36 for
  // email, D37 for phone) -- the function's job ends at handing the link back; the admin's UI
  // does the actual sharing.
  // ============================================================
  if (email) {
    // D36 -- generateLink creates the account exactly like inviteUserByEmail did, but SENDS
    // NOTHING. The link comes back to the caller, who shares it themselves. This is the whole
    // point: no dependency on Supabase's own sending reputation/spam filtering any more.
    const { data: linked, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        data: { role, display_name: displayName },
        ...(siteUrl ? { redirectTo: siteUrl } : {}),
      },
    });
    if (linkErr) {
      return json({ error: linkErr.message }, 400);
    }
    const inviteLink = ownInviteLink(siteUrl, linked.properties.hashed_token, linked.properties.action_link);
    return json({ user_id: linked.user.id, email: linked.user.email, invite_link: inviteLink }, 200);
  }

  // ============================================================
  // D40 -- phone, via the same link mechanism as email, anchored to a synthetic email the person
  // never sees. .invalid is the IANA/RFC 2606-reserved TLD for "guaranteed never a real
  // address" -- confirmed live (before writing this) that Supabase's own email validation
  // accepts it.
  //
  // Order matters and is NOT arbitrary (D40): create the account with BOTH the synthetic email
  // AND the real phone set in ONE call, THEN generate the link for that already-existing user
  // -- never mutate the account again afterward. Found live, the hard way (D37's original
  // sequence generated the link FIRST, then attached the phone via a separate updateUserById
  // call): that second write silently invalidates the very link just generated -- Supabase
  // treats a token issued against a user's old state as no longer valid the moment that user
  // record changes again, a real and sensible security behaviour, but one D37's original
  // sequence tripped over itself, on every single phone invite, unconditionally. Confirmed by
  // isolating it precisely: the email path (no second write, ever) verifies clean every time;
  // the OLD phone sequence failed every time; this NEW sequence (one write, then a link, then
  // nothing) verifies clean too.
  // ============================================================
  const phoneDigits = phone.replace(/^\+/, '');
  const syntheticEmail = `${phoneDigits}@phone.invalid`;

  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email: syntheticEmail,
    phone,
    phone_confirm: true,
    user_metadata: { role, display_name: displayName },
  });
  if (createErr) {
    return json({ error: createErr.message }, 400);
  }
  const userId = created.user.id;

  const { data: linked, error: linkErr } = await adminClient.auth.admin.generateLink({
    type: 'invite',
    email: syntheticEmail,
    options: {
      ...(siteUrl ? { redirectTo: siteUrl } : {}),
    },
  });
  if (linkErr) {
    return json({ error: linkErr.message }, 400);
  }

  // handle_new_user() ran at the createUser step, using the synthetic email -- correct
  // public.users directly -- NOT optional: skipping this leaks the synthetic email into every
  // display surface in the app (the Team list, the header, the audit log).
  const { error: fixErr } = await adminClient
    .from('users')
    .update({ email: null, phone: phoneDigits })
    .eq('id', userId);
  if (fixErr) {
    return json({ error: fixErr.message }, 400);
  }

  const inviteLink = ownInviteLink(siteUrl, linked.properties.hashed_token, linked.properties.action_link);
  return json({ user_id: userId, phone: phoneDigits, invite_link: inviteLink }, 200);
});
