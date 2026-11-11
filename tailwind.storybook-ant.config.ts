import type { Config } from 'tailwindcss';
import base from './tailwind.config';

// Tailwind config for deck 2 (the Ant Design review deck) ONLY — loaded by src/storybook-ant.css with
// `@config`. The app and deck 1 keep tailwind.config.ts exactly as it is.
//
// WHY THIS EXISTS: deck 2 must not load Tailwind's preflight (a CSS reset), because antd ships its own
// and two resets on one document half-style Ant controls. The obvious way to skip it — leaving out
// `@tailwind base` — also drops the `--tw-*` custom-property defaults that Tailwind 3 emits as part of
// that same layer. Every `translate-*`, `scale-*`, `rotate-*`, `shadow-*` and `ring-*` utility reads
// those variables, so without them `-translate-x-1/2 scale-[0.9]` computes to `transform: none`: the
// phone frame was never centred or scaled (half a frame off to the right on desktop, overflowing the
// screen on a phone) and the magnify toggle did nothing visible.
//
// THE FIX: keep `@tailwind base` (it emits the variable defaults) but switch preflight off here, so the
// base layer contains only the defaults and antd still owns the reset.
export default {
  ...base,
  corePlugins: { ...(base.corePlugins ?? {}), preflight: false },
} satisfies Config;
