/* Pricing page bootstrap.
   Keeps shared polish without loading the homepage canvas/frame sequence. */
(function () {
  function initPricingReveals() {
    const items = [...document.querySelectorAll('[data-animation]')];
    if (!items.length) return;
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const delay = parseFloat(entry.target.getAttribute('data-delay') || '0');
        if (delay) entry.target.style.transitionDelay = `${delay}s`;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
    items.forEach((el) => observer.observe(el));
  }

  function initPricingModal() {
    const backdrop = document.getElementById('modal-backdrop');
    const closeBtn = document.getElementById('modal-close');
    const nameInput = document.getElementById('ms-name');
    const emailInput = document.getElementById('ms-email');
    const phoneInput = document.getElementById('ms-phone');
    if (!backdrop || !nameInput || !emailInput || !phoneInput) return false;

    const steps = [1, 2, 3, 4, 5].map((n) => document.getElementById(`ms-step-${n}`));
    const dots = Array.from(document.querySelectorAll('[data-dot]'));
    const nameDisplay = document.getElementById('ms-name-display');
    const confirmText = document.getElementById('ms-confirm-text');
    const calendar = document.getElementById('ms-calendar');
    const times = document.getElementById('ms-times');
    let selectedDate = '';
    let selectedTime = '';

    function showStep(n) {
      steps.forEach((step, index) => step?.classList.toggle('ms-step--hidden', index + 1 !== n));
      dots.forEach((dot) => dot.classList.toggle('is-active', Number(dot.dataset.dot) === Math.min(n, 3)));
    }

    function closeModal() {
      backdrop.classList.remove('is-open');
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    function openModal(e) {
      e?.preventDefault();
      nameInput.value = '';
      emailInput.value = '';
      phoneInput.value = '';
      selectedDate = '';
      selectedTime = '';
      showStep(1);
      backdrop.classList.add('is-open');
      backdrop.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      setTimeout(() => nameInput.focus(), 120);
    }

    function submitLead(wantsCalendar) {
      const name = nameInput.value.trim();
      const email = emailInput.value.trim();
      const phone = phoneInput.value.trim();
      const bridge = document.querySelector('[data-de-page]');
      if (bridge) {
        fetch(bridge.dataset.leadsEndpoint || '/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitor_id: bridge.dataset.visitorId || undefined,
            form_type: 'pricing_request',
            form_data: { name, email, phone, wantsCalendar, selectedDate, selectedTime },
            page_url: window.location.pathname,
          }),
        }).catch(() => {});
      }
      if (confirmText) {
        confirmText.textContent = selectedDate && selectedTime
          ? `Thanks, ${name}. You're booked for ${selectedDate} at ${selectedTime}.`
          : `Thanks, ${name}. We'll reach out at ${email} or ${phone} within one business day.`;
      }
      showStep(5);
    }

    function renderCalendar() {
      if (!calendar || !times) return;
      const dayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const dates = Array.from({ length: 5 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() + index + 1);
        return dayFormatter.format(date);
      });
      calendar.innerHTML = dates.map((date, index) => (
        `<button type="button" class="ms-date${index === 0 ? ' is-active' : ''}" data-date="${date}">${date}</button>`
      )).join('');
      selectedDate = dates[0] || '';
      times.innerHTML = ['9:30 AM', '11:00 AM', '1:30 PM', '3:00 PM'].map((time) => (
        `<button type="button" class="ms-time" data-time="${time}">${time}</button>`
      )).join('');
    }

    document.querySelectorAll('.js-modal').forEach((btn) => btn.addEventListener('click', openModal));
    closeBtn?.addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && backdrop.classList.contains('is-open')) closeModal();
    });

    document.getElementById('ms-next-1')?.addEventListener('click', () => {
      if (!nameInput.value.trim()) return nameInput.focus();
      if (nameDisplay) nameDisplay.textContent = nameInput.value.trim().split(/\s+/)[0];
      showStep(2);
      setTimeout(() => emailInput.focus(), 80);
    });

    document.getElementById('ms-next-2')?.addEventListener('click', () => {
      if (!emailInput.value.trim()) return emailInput.focus();
      if (!phoneInput.value.trim()) return phoneInput.focus();
      showStep(3);
    });

    document.getElementById('ms-yes')?.addEventListener('click', () => {
      renderCalendar();
      showStep(4);
    });
    document.getElementById('ms-no')?.addEventListener('click', () => submitLead(false));
    document.getElementById('ms-done')?.addEventListener('click', closeModal);

    calendar?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-date]');
      if (!btn) return;
      selectedDate = btn.dataset.date;
      calendar.querySelectorAll('[data-date]').forEach((dateBtn) => dateBtn.classList.toggle('is-active', dateBtn === btn));
    });
    times?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-time]');
      if (!btn) return;
      selectedTime = btn.dataset.time;
      submitLead(true);
    });

    return true;
  }

  function initPricingScrollHint() {
    if (document.querySelector('.de-scroll-hint')) return;
    const hint = document.createElement('div');
    hint.className = 'de-scroll-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.innerHTML = '<span class="de-scroll-hint__label">Scroll</span><span class="de-scroll-hint__chevron"></span>';
    document.body.appendChild(hint);

    let idleMs = 0;
    const hide = () => hint.classList.remove('is-visible');
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
      if (idleMs >= 1000) hint.classList.add('is-visible');
    }, 500);
  }

  function boot() {
    'use strict';

    const navbar = document.getElementById('navbar');
    if (navbar) {
      const onNavScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 40);
      window.addEventListener('scroll', onNavScroll, { passive: true });
      onNavScroll();
    }

    initPricingReveals();

    if (!initPricingModal() && typeof initDemoModal === 'function') initDemoModal(null);
    if (typeof initMobileNav === 'function') initMobileNav();
    initPricingScrollHint();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}());
