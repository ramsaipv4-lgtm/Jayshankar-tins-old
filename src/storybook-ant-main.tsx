// Standalone entry for the Ant deck — the second review deck on its own, with nothing of the app.
//
// WHY IT EXISTS: deck 1 (src/storybook-main.tsx) built the deck as its own static site so it could be
// sent as one link with no login and no secrets. The client is now choosing a design language, so the
// same 32 chapters are built a second time in Ant Design and published the same way, as a second
// static site — `npm run build:storybook-ant` → dist-storybook-ant/.
//
// The deck is normally a route inside the app, and that route cannot be deployed alone: the app
// bundle evaluates src/lib/supabase.ts at import time and that module *throws* when
// VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are missing. So a bare deploy of the app white-
// screens at every route. This entry imports the Ant deck and only the Ant deck: no Supabase, no
// auth, no dashboards, and no environment variables at all.
//
// antd is imported here (and below it) and nowhere in the app — that is what keeps Ant Design out of
// the app bundle while D67 is still open. See src/lib/storybook/surface.ts.

import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';

// antd's own reset FIRST, then the deck's stylesheet. Order matters: storybook-ant.css deliberately
// omits `@tailwind base` so that antd owns base styling, and two resets on one document is the
// classic way to get half-styled Ant controls.
import 'antd/dist/reset.css';
import './storybook-ant.css';

import StorybookAntReview from './pages/StorybookAntReview';

// HashRouter because the deck keeps the chapter and step in the URL (?c=…&s=…) so a reviewer can
// paste an exact screen. Hash routing also means any static host serves it with no server config.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <StorybookAntReview />
    </HashRouter>
  </React.StrictMode>,
);