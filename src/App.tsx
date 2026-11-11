// App — the role-based router. Reads session from useSession, then routes:
//   no session            → /signin (SignInForm)
//   signed in             → wraps the user in Layout, renders the role's shell
//
// W3 adds the 4 mutation routes: /deliver, /sell, /transfer, /spoil. Each is
// role-gated (vendor-rep for delivery+sale, worker OR vendor-rep for transfer+spoil).
// The role drives the shell — the URL is a bookmark, not a hard requirement.

import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Role, useSession } from './lib/auth';
import { useEnsureCheckedIn } from './lib/tasks';
import SignInForm from './components/SignInForm';
import AcceptInvite from './pages/AcceptInvite';
import Layout from './components/Layout';
import AdminDashboard from './pages/AdminDashboard';
import RepDashboard from './pages/RepDashboard';
import FloorDashboard from './pages/FloorDashboard';
import VendorManagement from './pages/VendorManagement';
import DeliveryForm from './pages/DeliveryForm';
import DeliveryConfirmation from './pages/DeliveryConfirmation';
import SaleForm from './pages/SaleForm';
import TransferForm from './pages/TransferForm';
import SpoilageForm from './pages/SpoilageForm';
import RepackForm from './pages/RepackForm';
import AuditLog from './pages/AuditLog';
import SkuManagement from './pages/SkuManagement';
import WarehouseManagement from './pages/WarehouseManagement';
import TeamManagement from './pages/TeamManagement';
import CustomerManagement from './pages/CustomerManagement';
import PaymentManagement from './pages/PaymentManagement';
import ReversalRequests from './pages/ReversalRequests';
import PackContainerForm from './pages/PackContainerForm';
import BillsManagement from './pages/BillsManagement';
import Search from './pages/Search';
import FishCard from './pages/FishCard';
import CustomerCard from './pages/CustomerCard';
import VendorCard from './pages/VendorCard';
import EmployeeCard from './pages/EmployeeCard';
import MyTasks from './pages/MyTasks';
import TaskDelegation from './pages/TaskDelegation';
import Complaints from './pages/Complaints';
import TutorialLibrary from './pages/TutorialLibrary';
import Storybook from './pages/Storybook';
import StorybookReview from './pages/StorybookReview';

const KNOWN_ROLES: Role[] = ['admin', 'co-admin', 'vendor-rep', 'worker', 'super-worker'];

function defaultRouteFor(role: Role): string {
  switch (role) {
    case 'admin':
    case 'co-admin': return '/admin';
    case 'vendor-rep': return '/rep';
    case 'worker':
    case 'super-worker': return '/floor';
  }
}

export default function App() {
  const { session, user, loading, error } = useSession();

  // No manual "check in" button anywhere (decision #70) — the first time an operational-role
  // user's session resolves, this fires once and is idempotent per IST calendar day
  // server-side. Safe to call unconditionally here (before the loading/error/signed-out
  // branches below) since the hook itself no-ops until `user` exists and has the right role.
  useEnsureCheckedIn(user);

  // Wires the Android hardware/gesture back button to real navigation. Found on a real device
  // (Poco X6 Pro): without this, there is no way out of a sub-page like /admin/audit-log other
  // than the on-screen back link — the web build relies entirely on the browser's own back
  // button/gesture, which a Capacitor-wrapped native app has none of. canGoBack reflects the
  // WebView's real browser history (HashRouter route changes push real history entries, same
  // mechanism window.history.back() reads), so this correctly steps back through in-app
  // navigation and only exits the app once there's truly nowhere left to go. No-ops entirely
  // on web/PWA (Capacitor.isNativePlatform() is false there) — the browser's own back
  // button/gesture already works correctly and this must not interfere with it.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listenerPromise = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        CapacitorApp.exitApp();
      }
    });
    return () => { listenerPromise.then((l) => l.remove()); };
  }, []);

  // Checked BEFORE the normal signed-in/signed-out branch, deliberately (D38): verifyOtp()
  // inside AcceptInvite establishes a real session before the person has set a password, and
  // the normal router below would otherwise treat that session as "done" and route straight to
  // a role dashboard, skipping the password step entirely.
  if (window.location.hash.startsWith('#/accept-invite')) {
    return <AcceptInvite />;
  }

  // Public design-review build of the storybook (see StorybookReview.tsx). Checked here — above
  // loading/error/session — for the same reason as accept-invite, and one more: the reviewer
  // opening this link has no account, so there is nothing for the session machinery to resolve and
  // no bell or sign-out for them to hit. The deck is static sample data, so nothing is exposed.
  if (window.location.hash.startsWith('#/review')) {
    return <StorybookReview />;
  }

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full flex items-center justify-center p-4">
        <div role="alert" className="max-w-md bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (!session || !user) {
    return <SignInForm />;
  }

  return (
    <Layout user={user}>
      <Routes>
        <Route path="/" element={<Navigate to={defaultRouteFor(user.role)} replace />} />

        {/* Role shells */}
        <Route path="/admin" element={<Shell role={user.role} expected={['admin', 'co-admin']}><AdminDashboard /></Shell>} />
        <Route path="/admin/audit-log" element={<Shell role={user.role} expected={['admin', 'co-admin']}><AuditLog /></Shell>} />
        <Route path="/admin/skus" element={<Shell role={user.role} expected={['admin', 'co-admin']}><SkuManagement /></Shell>} />
        <Route path="/admin/warehouses" element={<Shell role={user.role} expected={['admin', 'co-admin']}><WarehouseManagement /></Shell>} />
        {/* Found in the V1 frontend/backend parity audit: vendors_insert_admin/vendors_update_
            admin RLS policies have existed since migration 0001 with no frontend at all --
            VendorSelect (FormFields.tsx) is read-only. Same gap shape as D49/decision #49's
            SKU/warehouse fixes, just never caught until this pass. */}
        <Route path="/admin/vendors" element={<Shell role={user.role} expected={['admin', 'co-admin']}><VendorManagement /></Shell>} />
        <Route path="/admin/team" element={<Shell role={user.role} expected={['admin', 'co-admin']}><TeamManagement /></Shell>} />
        {/* Customers: routed under /customers, not /admin/customers -- RLS deliberately allows
            admin/co-admin/vendor-rep/super-worker to manage customers (broader than the
            admin-only pattern skus/warehouses/team use), since reps are the ones actually
            meeting buyers day to day. */}
        <Route path="/customers" element={<Shell role={user.role} expected={['admin', 'co-admin', 'vendor-rep', 'super-worker']}><CustomerManagement /></Shell>} />
        <Route path="/payments" element={<Shell role={user.role} expected={['admin', 'co-admin', 'vendor-rep', 'super-worker']}><PaymentManagement /></Shell>} />
        <Route path="/reversals" element={<Shell role={user.role} expected={['admin', 'co-admin', 'vendor-rep', 'super-worker']}><ReversalRequests /></Shell>} />
        {/* Bills' own RLS SELECT policy is open to every authenticated role (bills_select_
            authenticated, migration 0006) -- gated here to the same 4 roles as record_
            container_fill's own role check, not plain 'worker', since this is a purchasing/
            receiving-oversight screen a floor worker has no reason to open. */}
        <Route path="/bills" element={<Shell role={user.role} expected={['admin', 'co-admin', 'vendor-rep', 'super-worker']}><BillsManagement /></Shell>} />
        <Route path="/rep"   element={<Shell role={user.role} expected="vendor-rep"><RepDashboard /></Shell>} />
        <Route path="/floor" element={<Shell role={user.role} expected={['worker', 'super-worker']}><FloorDashboard /></Shell>} />

        {/* W3 mutation forms (role-gated). /deliver and /sell found narrowed to plain
            'vendor-rep' only, while record_bill_delivery/record_container_sale's own role
            checks have always accepted admin/co-admin/vendor-rep/super-worker (confirmed
            directly in the migration, not assumed) -- the /pack comment below even already
            claimed to match /deliver's scope "exactly," which was never actually true. Widened
            to match the RPCs for real, same pass as adding /deliveries/confirm below (its own
            RPC uses this identical 4-role set, so leaving /deliver narrower than its own
            confirm-arrival counterpart would have been its own new inconsistency). */}
        <Route path="/deliver"  element={<Shell role={user.role} expected={['admin', 'co-admin', 'vendor-rep', 'super-worker']}><DeliveryForm /></Shell>} />
        <Route path="/sell"     element={<Shell role={user.role} expected={['admin', 'co-admin', 'vendor-rep', 'super-worker']}><SaleForm /></Shell>} />
        {/* Admin/co-admin only — D29 repurposed transfer as a cross-warehouse-only, admin-tier
            action, no longer a routine worker/rep task (matches rls-policies.sql's own
            movements INSERT policy comment exactly). Found live: this route had been left at
            its pre-D29 role scope, meaning no role could actually submit a transfer through the
            UI at all — the RPC would reject every one of them. */}
        <Route path="/transfer" element={<Shell role={user.role} expected={['admin', 'co-admin']}><TransferForm /></Shell>} />
        {/* Both widened to admin/co-admin (V1 frontend/backend parity pass) -- record_container_
            spoilage and record_repack have always accepted admin/co-admin too; the route just
            never matched. Not a lockout like /transfer's or /deliver's (worker/super-worker/
            vendor-rep could already reach both), but the same class of drift all the same. */}
        <Route path="/spoil"    element={<Shell role={user.role} expected={['admin', 'co-admin', 'worker', 'super-worker', 'vendor-rep']}><SpoilageForm /></Shell>} />
        <Route path="/repack"   element={<Shell role={user.role} expected={['admin', 'co-admin', 'worker', 'super-worker', 'vendor-rep']}><RepackForm /></Shell>} />
        {/* Packing a container is a receiving-side operation, same 4 roles as record_
            container_fill's own role check (migration 0007) -- not plain 'worker', matching
            /deliver's own scope exactly (receiving isn't a worker task; repack is, above). */}
        <Route path="/pack"     element={<Shell role={user.role} expected={['admin', 'co-admin', 'vendor-rep', 'super-worker']}><PackContainerForm /></Shell>} />
        {/* Confirm-arrival half of the in-transit workflow (migration 0031/0032) — same 4 roles
            as confirm_delivery_arrival's own role check, matching /deliver above exactly. */}
        <Route path="/deliveries/confirm" element={<Shell role={user.role} expected={['admin', 'co-admin', 'vendor-rep', 'super-worker']}><DeliveryConfirmation /></Shell>} />

        {/* Search — same 4 roles as Customers/Payments/Reversals' broader CRM scope, not plain
            'worker': payments/vendor_payments' own SELECT policies already exclude that role,
            so a card built from them would show confusing partial-empty sections to a worker. */}
        <Route path="/search"                element={<Shell role={user.role} expected={['admin', 'co-admin', 'vendor-rep', 'super-worker']}><Search /></Shell>} />
        <Route path="/search/fish/:skuId"     element={<Shell role={user.role} expected={['admin', 'co-admin', 'vendor-rep', 'super-worker']}><FishCard /></Shell>} />
        <Route path="/search/customer/:customerId" element={<Shell role={user.role} expected={['admin', 'co-admin', 'vendor-rep', 'super-worker']}><CustomerCard /></Shell>} />
        <Route path="/search/vendor/:vendorId"     element={<Shell role={user.role} expected={['admin', 'co-admin', 'vendor-rep', 'super-worker']}><VendorCard /></Shell>} />
        <Route path="/search/employee/:userId"     element={<Shell role={user.role} expected={['admin', 'co-admin', 'vendor-rep', 'super-worker']}><EmployeeCard /></Shell>} />

        {/* Tasks — my-tasks is for whoever can actually hold one (the 3 operational roles,
            matches OPERATIONAL_ROLES in lib/tasks.ts); delegation is admin/co-admin only,
            matches create_task/create_task_round_robin's own role check (migration 0024/0025). */}
        <Route path="/my-tasks" element={<Shell role={user.role} expected={['vendor-rep', 'worker', 'super-worker']}><MyTasks /></Shell>} />
        <Route path="/admin/tasks" element={<Shell role={user.role} expected={['admin', 'co-admin']}><TaskDelegation /></Shell>} />
        {/* Complaints — filing matches who can record a sale in the first place (file_customer_
            complaint's own role check); resolving is admin/co-admin only inside the component,
            same boundary reversal decisions already use since it touches both stock and money. */}
        <Route path="/complaints" element={<Shell role={user.role} expected={['admin', 'co-admin', 'vendor-rep', 'super-worker']}><Complaints /></Shell>} />

        {/* Learn — pure static content (video library + role tags), not RLS-scoped like Search,
            so every role gets it, plain 'worker' included. */}
        <Route path="/learn" element={<Shell role={user.role} expected={['admin', 'co-admin', 'vendor-rep', 'worker', 'super-worker']}><TutorialLibrary /></Shell>} />

        {/* Storybook — the animated workflow picture book (Phase A follow-on, T10). Like /learn it
            is static content: every screen is a literal in src/lib/storybook/chapters/, it reads no
            table and navigates nowhere, so it is deliberately open to every role. The client
            reviews it; it is not part of the operator's daily path. */}
        <Route path="/storybook" element={<Shell role={user.role} expected={['admin', 'co-admin', 'vendor-rep', 'worker', 'super-worker']}><Storybook /></Shell>} />

        <Route path="/signin" element={<Navigate to={defaultRouteFor(user.role)} replace />} />
        <Route path="*"        element={<Navigate to={defaultRouteFor(user.role)} replace />} />
      </Routes>
    </Layout>
  );
}

function Shell({ role, expected, children }: { role: Role; expected: Role | Role[]; children: React.ReactNode }) {
  const expectedList = Array.isArray(expected) ? expected : [expected];
  if (expectedList.includes(role)) {
    return <>{children}</>;
  }
  if (KNOWN_ROLES.includes(role)) {
    return <Navigate to={defaultRouteFor(role)} replace />;
  }
  return <NotAllowed expected={expectedList.join(' or ')} actual={role} />;
}

function NotAllowed({ expected, actual }: { expected: string; actual: string }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
      <strong>Not allowed.</strong> This page is for <code>{expected}</code>; you are signed in as <code>{actual}</code>.
      Sign out and sign in with the correct account.
    </div>
  );
}
