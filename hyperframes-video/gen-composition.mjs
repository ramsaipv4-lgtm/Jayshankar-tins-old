#!/usr/bin/env node
// gen-composition.mjs — generates a HyperFrames index.html from a scene list, reusing the exact
// visual template proven out in jayshankar-walkthrough (browser-chrome frame, kicker/headline/
// subline captions, GSAP fade-up transitions with hard-kills, WCAG-AA-safe title chips). Avoids
// re-deriving the same lint/contrast fixes by hand for every new video.

import { writeFileSync } from 'node:fs';

const [, , configPath] = process.argv;
const config = JSON.parse(await import('node:fs/promises').then((fs) => fs.readFile(configPath, 'utf8')));
const { outFile, title, tagline, chips, closeTag, scenes } = config;

const SCENE_START = 3.4;
const SCENE_GAP = 0; // scenes are back-to-back; each scene's own duration includes its hold
let t = SCENE_START;
const timed = scenes.map((s) => {
  const start = t;
  t += s.duration;
  return { ...s, start };
});
const totalDuration = t + 4.6;

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

const sceneDivs = timed.map((s, i) => `
      <!-- ${i + 2}. ${esc(s.headline)} -->
      <div id="s-${i}" class="clip" data-start="${s.start.toFixed(2)}" data-duration="${s.duration}" data-track-index="1"><div class="inner">
        <div class="kicker">${esc(s.kicker)}</div>
        <div class="headline">${esc(s.headline)}</div>
        <div class="subline">${esc(s.subline)}</div>
        <div class="browser-frame"><div class="chrome"><span></span><span></span><span></span></div><img src="assets/${s.image}" /></div>
      </div></div>`).join('\n');

const sceneJs = timed.map((s, i) => `      fadeScene('s-${i}', ${s.start.toFixed(2)}, ${s.duration}); fadeFrame('s-${i}', ${s.start.toFixed(2)});`).join('\n');

const html = `<!doctype html>
<html lang="en" data-resolution="landscape">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #0b1120; }
      body { font-family: "Inter", sans-serif; }
      .clip { position: absolute; inset: 0; }
      .inner { position: absolute; inset: 0; }
      #bg {
        background:
          radial-gradient(1200px 700px at 18% 10%, rgba(99,102,241,0.35), transparent 60%),
          radial-gradient(1000px 900px at 85% 90%, rgba(56,189,248,0.16), transparent 55%),
          linear-gradient(160deg, #0b1120 0%, #10172a 55%, #0b1120 100%);
      }
      .browser-frame {
        position: absolute; left: 50%; top: 300px; transform: translateX(-50%);
        width: 1200px; border-radius: 18px; overflow: hidden;
        box-shadow: 0 40px 90px -20px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.06);
        background: #e5e7eb;
      }
      .browser-frame .chrome { height: 34px; background: #f1f5f9; display: flex; align-items: center; gap: 7px; padding: 0 14px; border-bottom: 1px solid #e2e8f0; }
      .browser-frame .chrome span { width: 11px; height: 11px; border-radius: 50%; display: inline-block; }
      .browser-frame .chrome span:nth-child(1) { background: #f87171; }
      .browser-frame .chrome span:nth-child(2) { background: #fbbf24; }
      .browser-frame .chrome span:nth-child(3) { background: #34d399; }
      .browser-frame img { display: block; width: 1200px; height: auto; }
      .kicker { position: absolute; left: 160px; top: 96px; font-size: 22px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #a5b4fc; }
      .headline { position: absolute; left: 160px; top: 130px; font-size: 46px; font-weight: 800; color: #f8fafc; max-width: 1400px; line-height: 1.15; }
      .subline { position: absolute; left: 160px; top: 200px; font-size: 22px; font-weight: 500; color: #cbd5e1; max-width: 1300px; }
      .titlecard { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
      .titlecard .brand { font-size: 96px; font-weight: 800; color: #f8fafc; letter-spacing: -0.02em; }
      .titlecard .subtitle { font-size: 40px; font-weight: 700; color: #a5b4fc; margin-top: 10px; }
      .titlecard .tag { font-size: 28px; font-weight: 500; color: #cbd5e1; margin-top: 22px; max-width: 1200px; }
      .titlecard .chip-row { display: flex; gap: 14px; margin-top: 46px; flex-wrap: wrap; justify-content: center; max-width: 1400px; }
      .titlecard .chip { font-size: 18px; font-weight: 700; color: #eef2ff; border: 1px solid rgba(165,180,252,0.5); border-radius: 999px; padding: 10px 22px; background: rgba(49,46,129,0.85); }
      .closecard .brand { font-size: 76px; font-weight: 800; color: #f8fafc; }
      .closecard .tag { font-size: 26px; font-weight: 500; color: #a5b4fc; margin-top: 18px; max-width: 1100px; text-align: center; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${totalDuration.toFixed(1)}" data-width="1920" data-height="1080">

      <div id="bg" class="clip" data-start="0" data-duration="${totalDuration.toFixed(1)}" data-track-index="0"></div>

      <!-- 1. Title card -->
      <div id="s-title" class="clip" data-start="0" data-duration="${SCENE_START}" data-track-index="1"><div class="inner titlecard">
        <div class="brand">Jayshankar</div>
        <div class="subtitle">${esc(title)}</div>
        <div class="tag">${esc(tagline)}</div>
        <div class="chip-row">
          ${chips.map((c) => `<div class="chip">${esc(c)}</div>`).join('\n          ')}
        </div>
      </div></div>
${sceneDivs}

      <!-- Close card -->
      <div id="s-close" class="clip" data-start="${t.toFixed(2)}" data-duration="4.6" data-track-index="1"><div class="inner closecard" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
        <div class="brand">Jayshankar</div>
        <div class="tag">${esc(closeTag)}</div>
      </div></div>

    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });

      function fadeScene(id, start, dur) {
        const inD = 0.5, outD = 0.5;
        tl.fromTo('#' + id + ' .inner', { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: inD, ease: 'power2.out' }, start);
        tl.to('#' + id + ' .inner', { autoAlpha: 0, y: -12, duration: outD, ease: 'power2.in' }, start + dur - outD);
        tl.set('#' + id + ' .inner', { autoAlpha: 0 }, start + dur);
      }
      function fadeFrame(id, start) {
        tl.fromTo('#' + id + ' .browser-frame', { autoAlpha: 0, scale: 0.97 }, { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'power3.out' }, start + 0.15);
      }

      tl.fromTo('#s-title .brand', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out' }, 0.1);
      tl.fromTo('#s-title .subtitle', { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power2.out' }, 0.45);
      tl.fromTo('#s-title .tag', { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power2.out' }, 0.75);
      tl.fromTo('#s-title .chip', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.06, ease: 'power2.out' }, 1.05);
      tl.to('#s-title .inner', { autoAlpha: 0, duration: 0.5, ease: 'power2.in' }, ${(SCENE_START - 0.5).toFixed(2)});
      tl.set('#s-title .inner', { autoAlpha: 0 }, ${SCENE_START});

${sceneJs}

      tl.fromTo('#s-close .brand', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out' }, ${(t + 0.2).toFixed(2)});
      tl.fromTo('#s-close .tag', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power2.out' }, ${(t + 0.7).toFixed(2)});

      window.__timelines['main'] = tl;
    </script>
  </body>
</html>
`;

writeFileSync(outFile, html);
console.log(`Wrote ${outFile} (${totalDuration.toFixed(1)}s, ${scenes.length} scenes)`);
