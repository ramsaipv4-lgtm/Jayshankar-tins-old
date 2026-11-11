// Standalone entry for "The Run", the third review deck, on its own with nothing of the app.
//
// Like decks 1 and 2 it is a static site: no Supabase, no auth, no environment variables. Unlike them it imports
// NOTHING from the other decks — not their chapter data, not their renderers, not antd, not Tailwind — so it is a
// genuinely independent design to compare, and a bug in one deck cannot reach another.
//
// `npm run build:storybook-run` → dist-storybook-run/.

import React from 'react';
import ReactDOM from 'react-dom/client';
import './storybook-run.css';
import RunApp from './components/storybook-run/RunApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RunApp />
  </React.StrictMode>,
);
