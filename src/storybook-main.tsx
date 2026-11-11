// Standalone entry for the picture book — the deck on its own, with nothing of the app around it.
//
// WHY THIS EXISTS (and why #/review was not enough): the deck is normally a route inside the app
// (src/pages/Storybook.tsx). That route cannot simply be deployed on its own, because the app
// bundle evaluates src/lib/supabase.ts at import time and that module *throws* when
// VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are missing. So a bare deploy of the app shows
// a white screen at every route, #/review included.
//
// This entry imports the deck and only the deck: no Supabase, no auth, no dashboards, and no
// environment variables at all. That is what makes it hostable anywhere static — GitHub Pages
// included — with no secrets to configure.
//
//   npm run build:storybook   →  dist-storybook/   (deploy that folder as the whole site)

import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';

import './index.css';
import StorybookReview from './pages/StorybookReview';

// HashRouter because the deck keeps the chapter and step in the URL (?c=…&s=…) so a reviewer can
// paste an exact screen. Hash routing also means any static host serves it with no server config.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <StorybookReview />
    </HashRouter>
  </React.StrictMode>,
);
