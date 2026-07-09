// ─── CURSOR GLOW ───
(function () {
  const glow = document.getElementById('cursor-glow');
  if (!glow) return;
  let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
  let currentX = mouseX, currentY = mouseY;
  window.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; glow.classList.add('visible'); }, { passive: true });
  window.addEventListener('mouseleave', () => glow.classList.remove('visible'));
  function tick() {
    currentX += (mouseX - currentX) * 0.1;
    currentY += (mouseY - currentY) * 0.1;
    glow.style.transform = `translate(${currentX - 300}px, ${currentY - 300}px)`;
    requestAnimationFrame(tick);
  }
  tick();
}());

// ─── READING PROGRESS BAR ───
function updateReadingProgress() {
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  if (docHeight <= 0) return;
  const pct = Math.min(100, (window.scrollY / docHeight) * 100);
  const bar = document.getElementById('csd-progress-bar');
  if (bar) bar.style.width = pct + '%';
}
window.addEventListener('scroll', updateReadingProgress, { passive: true });
updateReadingProgress();

// ─── NAVBAR ───
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => { navbar.classList.toggle('scrolled', window.scrollY > 40); }, { passive: true });

// ─── PAGE BEHAVIOR (content is static in case-study.html — the Premier
//     Watersports numbers live in markup, not here, so the platform export
//     and the AI knowledge base see the real copy) ───
window.addEventListener('DOMContentLoaded', () => {
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  function animateNumber(el, from, to, duration, render, done) {
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      render(from + ((to - from) * easeOutCubic(t)));
      if (t < 1) requestAnimationFrame(frame);
      else done?.();
    }
    requestAnimationFrame(frame);
  }
  function observeOnce(el, fn, options = { threshold: 0.16, rootMargin: '0px 0px -8% 0px' }) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      fn();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      fn();
    }, options);
    observer.observe(el);
  }

  // Custom cursor
  const cursor = document.getElementById('custom-cursor');
  if (cursor) {
    window.addEventListener('mousemove', (e) => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top  = e.clientY + 'px';
    }, { passive: true });
  }

  // Hero
  const heroImg = document.getElementById('csd-hero-img');
  sessionStorage.removeItem('csd-from-transition');
  document.documentElement.classList.remove('csd-from-transition');

  // ─── HERO PARALLAX ───
  if (heroImg && !window.matchMedia('(max-width: 768px)').matches) {
    const updateHeroParallax = () => {
      const hero = document.querySelector('.csd-hero');
      if (!hero) return;
      const rect = hero.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, -rect.top / Math.max(1, rect.height)));
      heroImg.style.transform = `translateY(${-30 * progress}%)`;
    };
    window.addEventListener('scroll', updateHeroParallax, { passive: true });
    window.addEventListener('resize', updateHeroParallax, { passive: true });
    updateHeroParallax();
  }

  // ─── STAT COUNTERS + BARS ───
  // Each .csd-stat-num holds its final value in markup (static ground truth);
  // data-count-to drives the count-up animation on scroll.
  document.querySelectorAll('.csd-stats-section').forEach(section => {
    observeOnce(section, () => {
      section.querySelectorAll('.csd-stat-num[data-count-to]').forEach(el => {
        const raw = el.dataset.countTo;
        const to = parseFloat(raw);
        if (!isFinite(to)) return;
        const decimals = (raw.split('.')[1] || '').length;
        const original = el.textContent;
        el.textContent = decimals ? (0).toFixed(decimals) : '0';
        animateNumber(el, 0, to, 1800, (v) => {
          el.textContent = decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString('en-US');
        }, () => { el.textContent = original; });
      });
      section.querySelectorAll('.csd-stat-bar[data-fill]').forEach(bar => {
        bar.style.width = `${bar.dataset.fill}%`;
      });
    });
  });

  // ─── ENTRANCE ANIMATION ───
  document.querySelector('.csd-hero-logo-wrap')?.classList.add('is-visible');
  document.getElementById('csd-hero-headline')?.classList.add('is-visible');

  // Scroll-triggered fade-ins
  document.querySelectorAll('[data-csd-fade]').forEach(el => {
    const delay = parseFloat(el.dataset.delay || 0);
    observeOnce(el, () => {
      if (delay) el.style.transitionDelay = `${delay}s`;
      el.classList.add('is-visible');
    }, { threshold: 0.01, rootMargin: '0px 0px -13% 0px' });
  });

  // ─── TESTIMONIAL WORD REVEAL ───
  // Quote text is static in markup; wrap words at runtime for the reveal.
  (function initTestimonialReveal() {
    const section     = document.getElementById('csd-section-testimonial');
    const quoteMark   = section?.querySelector('.csd-quote-mark');
    const quoteEl     = document.getElementById('csd-quote');
    const attribution = document.getElementById('csd-attribution');
    if (!section || !quoteEl) return;

    quoteEl.innerHTML = quoteEl.textContent.trim().split(/\s+/)
      .map(w => `<span class="csd-quote-word">${w}</span>`).join(' ');
    const words = quoteEl.querySelectorAll('.csd-quote-word');
    if (!words.length) return;

    observeOnce(section, () => quoteMark?.classList.add('is-visible'), { threshold: 0.01, rootMargin: '0px 0px -22% 0px' });
    const updateWords = () => {
      const rect = section.getBoundingClientRect();
      const start = window.innerHeight * 0.6;
      const end = window.innerHeight * 0.4;
      const progress = Math.max(0, Math.min(1, (start - rect.top) / Math.max(1, start - end)));
      const litCount = Math.floor(progress * words.length);
      words.forEach((w, i) => w.classList.toggle('is-lit', i < litCount));
      if (rect.top < end) words.forEach(w => w.classList.add('is-lit'));
    };
    window.addEventListener('scroll', updateWords, { passive: true });
    window.addEventListener('resize', updateWords, { passive: true });
    updateWords();
    observeOnce(section, () => attribution?.classList.add('is-visible'), { threshold: 0.25 });
  }());

});

// ─── LAZY DEMO MODAL (shared js/demo-modal.js — same pattern as roi.js) ───
(function initLazyDemoModal() {
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
}());
