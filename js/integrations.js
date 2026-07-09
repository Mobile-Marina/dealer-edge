/* ═══════════════════════════════════════════════════════════════
   INTEGRATIONS & DMS COMPATIBILITY  ·  js/integrations.js
   ───────────────────────────────────────────────────────────────
   Static content page on the shared de-core engine: Lenis, cursor
   glow, nav scroll state, [data-fade] reveals, section-view pushes
   and the lazy demo modal. No acts, no late-loaded partials.

   Lifecycle: registered as DE.pages.integrations, booted by the
   DE.boot('integrations') call at the bottom (see js/de-core.js).
   ─────────────────────────────────────────────────────────────── */
DE.pages.integrations = { boot() {
  'use strict';

  // shared engine (js/de-core.js): Lenis + cursor glow + nav state + fade
  const lenis = DE.createLenis();
  DE.initMobileNav(); // not shipped to the platform (DeHeader owns nav)
  DE.initLazyDemoModal(lenis);
  DE.initCursorGlow();
  DE.initNavScroll();
  DE.initFade();
  DE.initSectionViews();
} };

DE.boot('integrations');
