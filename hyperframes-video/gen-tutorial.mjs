// gen-tutorial.mjs — emits index.html for a tutorial video, following the exact structure
// hand-built in tutorial-purchase/index.html (title card -> real recording -> synced captions
// -> close card). Exports buildHtml() for batch use (gen-batch.mjs); also runnable directly
// against a single config JSON file for one-off / composite videos.
//
// Config shape: { dir, videoFile, videoId, rawDuration, titleKicker, titleBrand, titleTag,
//   headerKicker, headerHeadline, captions: [{text, start, dur}], closeBrand, closeTag }

import { readFileSync, writeFileSync } from 'node:fs';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildHtml(cfg) {
  const videoStart = 2.5;
  const videoEnd = +(videoStart + cfg.rawDuration).toFixed(2);
  const closeDur = 3;
  const totalDuration = +(videoEnd + closeDur).toFixed(2);

  const capDivs = cfg.captions.map((c, i) =>
    `      <div id="cap-${i + 1}" class="clip" data-start="${c.start}" data-duration="${c.dur}" data-track-index="2"><div class="caption-box">${esc(c.text)}</div></div>`
  ).join('\n');

  const capCalls = cfg.captions.map((c, i) => `      caption('cap-${i + 1}', ${c.start}, ${c.dur});`).join('\n');

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
          radial-gradient(1200px 700px at 18% 8%, rgba(99,102,241,0.32), transparent 60%),
          radial-gradient(1000px 900px at 85% 92%, rgba(56,189,248,0.14), transparent 55%),
          linear-gradient(160deg, #0b1120 0%, #10172a 55%, #0b1120 100%);
      }
      .titlecard { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
      .titlecard .kicker { font-size: 22px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #a5b4fc; }
      .titlecard .brand { font-size: 76px; font-weight: 800; color: #f8fafc; letter-spacing: -0.02em; margin-top: 14px; }
      .titlecard .tag { font-size: 26px; font-weight: 500; color: #cbd5e1; margin-top: 18px; max-width: 1200px; }

      .video-header { position: absolute; left: 160px; top: 70px; }
      .video-header .kicker { font-size: 20px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #a5b4fc; }
      .video-header .headline { font-size: 34px; font-weight: 800; color: #f8fafc; margin-top: 6px; }

      .browser-frame {
        position: absolute; left: 50%; top: 190px; transform: translateX(-50%);
        width: 1240px; border-radius: 18px; overflow: hidden;
        box-shadow: 0 40px 90px -20px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.06);
        background: #e5e7eb;
      }
      .browser-frame .chrome { height: 34px; background: #f1f5f9; display: flex; align-items: center; gap: 7px; padding: 0 14px; border-bottom: 1px solid #e2e8f0; }
      .browser-frame .chrome span { width: 11px; height: 11px; border-radius: 50%; display: inline-block; }
      .browser-frame .chrome span:nth-child(1) { background: #f87171; }
      .browser-frame .chrome span:nth-child(2) { background: #fbbf24; }
      .browser-frame .chrome span:nth-child(3) { background: #34d399; }
      .browser-frame video { display: block; width: 1240px; height: auto; }

      .caption-box {
        position: absolute; left: 50%; bottom: 56px; transform: translateX(-50%);
        background: rgba(15,15,25,0.88); border: 1px solid rgba(165,180,252,0.35);
        border-radius: 14px; padding: 18px 32px; max-width: 1200px;
        font-size: 26px; font-weight: 700; color: #f8fafc; text-align: center;
      }

      .closecard .brand { font-size: 72px; font-weight: 800; color: #f8fafc; }
      .closecard .tag { font-size: 25px; font-weight: 500; color: #a5b4fc; margin-top: 16px; max-width: 1200px; text-align: center; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${totalDuration}" data-width="1920" data-height="1080">

      <div id="bg" class="clip" data-start="0" data-duration="${totalDuration}" data-track-index="0"></div>

      <!-- Title card -->
      <div id="s-title" class="clip" data-start="0" data-duration="2.5" data-track-index="1"><div class="inner titlecard">
        <div class="kicker">${esc(cfg.titleKicker)}</div>
        <div class="brand">${esc(cfg.titleBrand)}</div>
        <div class="tag">${esc(cfg.titleTag)}</div>
      </div></div>

      <!-- The real recording -->
      <div id="s-video" class="clip" data-start="${videoStart}" data-duration="${cfg.rawDuration}" data-track-index="1"><div class="inner">
        <div class="video-header">
          <div class="kicker">${esc(cfg.headerKicker)}</div>
          <div class="headline">${esc(cfg.headerHeadline)}</div>
        </div>
        <div class="browser-frame">
          <div class="chrome"><span></span><span></span><span></span></div>
          <video id="${cfg.videoId}" src="assets/${cfg.videoFile}" muted data-start="${videoStart}" data-duration="${cfg.rawDuration}"></video>
        </div>
      </div></div>

      <!-- Captions, timed to the real recording -->
${capDivs}

      <!-- Close card -->
      <div id="s-close" class="clip" data-start="${videoEnd}" data-duration="${closeDur}" data-track-index="1"><div class="inner closecard" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
        <div class="brand">${esc(cfg.closeBrand)}</div>
        <div class="tag">${esc(cfg.closeTag)}</div>
      </div></div>

    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });

      tl.fromTo('#s-title .inner', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 0.1);
      tl.to('#s-title .inner', { autoAlpha: 0, duration: 0.4, ease: 'power2.in' }, 2.0);
      tl.set('#s-title .inner', { autoAlpha: 0 }, 2.5);

      tl.fromTo('#s-video .inner', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: 'power2.out' }, ${videoStart});

      function caption(id, start, dur) {
        tl.fromTo('#' + id + ' .caption-box', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' }, start);
        tl.to('#' + id + ' .caption-box', { autoAlpha: 0, y: -8, duration: 0.3, ease: 'power2.in' }, start + dur - 0.3);
        tl.set('#' + id + ' .caption-box', { autoAlpha: 0 }, start + dur);
      }
${capCalls}

      tl.fromTo('#s-close .brand', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out' }, ${videoEnd + 0.12});
      tl.fromTo('#s-close .tag', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out' }, ${videoEnd + 0.52});

      window.__timelines['main'] = tl;
    </script>
  </body>
</html>
`;
  return { html, totalDuration };
}

// CLI usage: node gen-tutorial.mjs <config.json>
if (process.argv[1] && process.argv[1].endsWith('gen-tutorial.mjs') && process.argv[2]) {
  const cfg = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const { html, totalDuration } = buildHtml(cfg);
  writeFileSync(`${cfg.dir}/index.html`, html);
  console.log(`wrote ${cfg.dir}/index.html (total duration ${totalDuration}s)`);
}
