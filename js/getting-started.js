/* ═══════════════════════════════════════════════════════════════
   GETTING STARTED / ONBOARDING TIMELINE  ·  js/getting-started.js
   ───────────────────────────────────────────────────────────────
   A focused content page (not a scroll-pinned act page), same
   standalone-island pattern as roi.js: cursor glow, navbar scroll
   state, [data-fade] reveals, section_view analytics, scroll hint,
   and the lazy-loaded shared demo modal. The one page-specific
   behavior is the timeline rail: a green fill that grows as the
   reader scrolls Day 1 → Day 30, lighting each step's dot and time
   chip as it passes.
   ─────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initCursorGlow() {
    const cursor = document.getElementById('custom-cursor');
    const glow = document.getElementById('cursor-glow');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!finePointer || (!cursor && !glow)) return;
    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let gx = mx;
    let gy = my;
    document.addEventListener('mousemove', (e) => {
      mx = e.clientX;
      my = e.clientY;
      if (cursor) cursor.style.transform = `translate(${mx}px, ${my}px)`;
      glow?.classList.add('visible');
    }, { passive: true });
    document.addEventListener('mouseleave', () => glow?.classList.remove('visible'));
    function tick() {
      gx += (mx - gx) * 0.1;
      gy += (my - gy) * 0.1;
      glow.style.transform = `translate(${gx}px, ${gy}px) translate(-50%, -50%)`;
      requestAnimationFrame(tick);
    }
    if (glow) tick();
  }

  function initNavScroll() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;
    const onScroll = () => navbar.classList.toggle('is-scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initFade() {
    const faders = document.querySelectorAll('[data-fade]');
    if (!faders.length) return;
    if (!('IntersectionObserver' in window)) {
      faders.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const delay = parseFloat(entry.target.dataset.delay || 0);
        if (delay) entry.target.style.transitionDelay = `${delay}s`;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
    faders.forEach((el) => obs.observe(el));
  }

  /* [data-section] → dataLayer `section_view` push on first scroll-into-view.
     Getting Started is a standalone island (no de-core.js), so this mirrors
     DE.initSectionViews locally, same as roi.js. */
  function initSectionViews() {
    const sections = document.querySelectorAll('[data-section]');
    if (!sections.length || !('IntersectionObserver' in window)) return;
    window.dataLayer = window.dataLayer || [];
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        obs.unobserve(entry.target);
        const name = entry.target.getAttribute('data-section');
        if (name) window.dataLayer.push({ event: 'section_view', section_name: name });
      });
    }, { threshold: 0, rootMargin: '0px 0px -30% 0px' });
    sections.forEach((el) => obs.observe(el));
  }

  function initScrollHint() {
    if (document.querySelector('.de-scroll-hint')) return;
    const el = document.createElement('div');
    el.className = 'de-scroll-hint';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<span class="de-scroll-hint__label">Scroll</span><span class="de-scroll-hint__chevron"></span>';
    document.body.appendChild(el);
    let idleMs = 0;
    const hide = () => el.classList.remove('is-visible');
    const blocked = () => {
      const vh = window.innerHeight;
      const atBottom = (vh + window.scrollY) >= (document.documentElement.scrollHeight - vh);
      return atBottom
        || document.getElementById('modal-backdrop')?.classList.contains('is-open');
    };
    window.addEventListener('scroll', () => { idleMs = 0; hide(); }, { passive: true });
    setInterval(() => {
      if (blocked()) { hide(); return; }
      idleMs += 500;
      if (idleMs >= 1000) el.classList.add('is-visible');
    }, 500);
  }

  function initLazyDemoModal() {
    const triggers = [...document.querySelectorAll('.js-modal')];
    if (!triggers.length) return;

    const src = 'js/demo-modal.min.js?v=20260707a';
    let loading = null;
    let initialized = false;

    const load = () => {
      if (!loading) {
        loading = new Promise((resolve) => {
          const existing = document.querySelector(`script[src="${src}"]`);
          if (existing) {
            existing.addEventListener('load', resolve, { once: true });
            existing.addEventListener('error', resolve, { once: true });
            return;
          }
          const script = document.createElement('script');
          script.src = src;
          script.defer = true;
          script.onload = resolve;
          script.onerror = resolve;
          document.head.appendChild(script);
        });
      }

      return loading.then(() => {
        if (!initialized && typeof initDemoModal === 'function') {
          initialized = true;
          initDemoModal(null);
        }
      });
    };

    triggers.forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        if (initialized) return;
        event.preventDefault();
        load().then(() => trigger.click());
      }, { once: true });
    });

    ['pointerenter', 'focus'].forEach((eventName) => {
      triggers.forEach((trigger) => trigger.addEventListener(eventName, load, { once: true, passive: true }));
    });
  }

  /* Timeline rail: fill the track down to a reading anchor (~60% of the
     viewport) and mark every step whose dot the anchor has passed. With
     reduced motion the rail renders fully lit — no scroll choreography. */
  function initTimelineRail() {
    const wrap = document.querySelector('[data-gs-timeline]');
    if (!wrap) return;
    const fill = wrap.querySelector('.gs-rail-fill');
    const steps = [...wrap.querySelectorAll('.gs-step')];
    if (!fill || !steps.length) return;

    if (reduceMotion) {
      fill.style.height = '100%';
      steps.forEach((step) => step.classList.add('is-done'));
      return;
    }

    let ticking = false;
    const update = () => {
      ticking = false;
      const rect = wrap.getBoundingClientRect();
      const anchor = window.innerHeight * 0.6;
      const h = Math.max(0, Math.min(rect.height, anchor - rect.top));
      fill.style.height = `${h}px`;
      steps.forEach((step) => {
        const dot = step.querySelector('.gs-step-dot span') || step;
        step.classList.toggle('is-done', dot.getBoundingClientRect().top <= anchor);
      });
    };
    const request = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request, { passive: true });
    update();
  }

  function boot() {
    if (typeof initMobileNav === 'function') initMobileNav(); // not shipped to the platform (DeHeader owns nav)
    initLazyDemoModal();
    initCursorGlow();
    initNavScroll();
    initScrollHint();
    initFade();
    initSectionViews();
    initTimelineRail();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
