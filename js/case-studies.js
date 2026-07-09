// ─── CURSOR GLOW ───
(function () {
  const glow = document.getElementById('cursor-glow');
  if (!glow) return;
  let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
  let currentX = mouseX, currentY = mouseY;
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX; mouseY = e.clientY;
    glow.classList.add('visible');
  }, { passive: true });
  window.addEventListener('mouseleave', () => glow.classList.remove('visible'));
  function tick() {
    currentX += (mouseX - currentX) * 0.1;
    currentY += (mouseY - currentY) * 0.1;
    glow.style.transform = `translate(${currentX - 300}px, ${currentY - 300}px)`;
    requestAnimationFrame(tick);
  }
  tick();
}());

// ─── NAVBAR ───
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

// ─── INIT ───
window.addEventListener('DOMContentLoaded', () => {
  function hydrateDeferredCardMedia(card) {
    if (!card || card.dataset.mediaHydrated === 'true') return;
    card.dataset.mediaHydrated = 'true';
    card.querySelectorAll('source[data-srcset]').forEach(source => {
      source.srcset = source.dataset.srcset;
      source.removeAttribute('data-srcset');
    });
    card.querySelectorAll('img[data-src]').forEach(img => {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    });
  }

  (function initDeferredCardMedia() {
    const cards = Array.from(document.querySelectorAll('[data-defer-card-media]'))
      .map(media => media.closest('.csp-card'))
      .filter(Boolean);
    if (!cards.length) return;
    const check = () => {
      cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        if (rect.top < window.innerHeight + 120 && rect.bottom > -120) hydrateDeferredCardMedia(card);
      });
    };
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          hydrateDeferredCardMedia(entry.target);
          observer.unobserve(entry.target);
        });
      }, { rootMargin: '120px 0px' });
      cards.forEach(card => observer.observe(card));
    }
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check, { passive: true });
    check();
  }());

  // Custom cursor
  const cursor = document.getElementById('custom-cursor');
  if (cursor) {
    window.addEventListener('mousemove', (e) => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top  = e.clientY + 'px';
    }, { passive: true });

    // Journey cursor + page transition only for cards that link somewhere
    // (OEM pedigree cards are plain <article>s with no detail page).
    document.querySelectorAll('a.csp-card[href]').forEach(card => {
      card.addEventListener('mouseenter', () => cursor.classList.add('journey-active'));
      card.addEventListener('mouseleave', () => cursor.classList.remove('journey-active'));
      card.addEventListener('click', (e) => {
        hydrateDeferredCardMedia(card);
        const img = card.querySelector('.csp-card-img');
        if (!img) return; // text-only card: native navigation
        e.preventDefault();
        const rect = img.getBoundingClientRect();
        const overlay = document.createElement('div');
        overlay.style.cssText = `position:fixed;z-index:9998;background-image:url('${img.currentSrc || img.src}');background-size:cover;background-position:center;border-radius:20px;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;`;
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
        overlay.style.transition = 'top 0.6s cubic-bezier(0.22, 1, 0.36, 1), left 0.6s cubic-bezier(0.22, 1, 0.36, 1), width 0.6s cubic-bezier(0.22, 1, 0.36, 1), height 0.6s cubic-bezier(0.22, 1, 0.36, 1), border-radius 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
        requestAnimationFrame(() => {
          overlay.style.top = '0';
          overlay.style.left = '0';
          overlay.style.width = '100vw';
          overlay.style.height = '100vh';
          overlay.style.borderRadius = '0';
        });
        overlay.addEventListener('transitionend', () => {
          sessionStorage.setItem('csd-from-transition', '1');
          window.location.href = card.getAttribute('href');
        }, { once: true });
      });
    });
  }

  // Scroll fade-in for [data-fade] elements
  const fadeEls = Array.from(document.querySelectorAll('[data-fade]'));
  if ('IntersectionObserver' in window) {
    const fadeObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const delay = parseFloat(entry.target.dataset.delay || 0);
        entry.target.style.transitionDelay = `${delay}s`;
        entry.target.classList.add('is-visible');
        fadeObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });
    fadeEls.forEach(el => fadeObserver.observe(el));
  } else {
    fadeEls.forEach(el => el.classList.add('is-visible'));
  }

  // ─── CONTACT MODAL ───
  (function initModal() {
    const backdrop = document.getElementById('modal-backdrop');
    const modal    = document.getElementById('modal');
    const closeBtn = document.getElementById('modal-close');
    if (!backdrop || !modal) return;

    let userData = {};

    const DOT_STEPS = { 1: 1, 2: 2, 3: 3, 4: 3 };
    const dots = modal.querySelectorAll('.ms-dot');

    function showStep(n) {
      modal.querySelectorAll('.ms-step').forEach((s, i) => {
        s.classList.toggle('ms-step--hidden', i + 1 !== n);
      });
      const active = DOT_STEPS[n] || n;
      dots.forEach((d, i) => {
        const dotN = i + 1;
        d.classList.remove('is-active', 'is-done');
        if (dotN === active) d.classList.add('is-active');
        else if (dotN < active) d.classList.add('is-done');
      });
      modal.querySelector('#ms-dots').style.display = n === 5 ? 'none' : 'flex';
      setTimeout(() => modal.querySelector('.ms-step:not(.ms-step--hidden) input')?.focus(), 80);
    }

    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    const TIMES  = ['9:00 AM','9:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','2:00 PM','2:30 PM','3:00 PM','3:30 PM','4:00 PM'];
    let calView = new Date(); calView.setDate(1);

    function renderCal() {
      const el = document.getElementById('ms-calendar');
      const today = new Date(); today.setHours(0,0,0,0);
      const y = calView.getFullYear(), m = calView.getMonth();
      const firstDay = new Date(y, m, 1).getDay();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      let html = `<div class="cal-header">
        <button class="cal-nav" id="cal-prev">&#8592;</button>
        <span class="cal-month">${MONTHS[m]} ${y}</span>
        <button class="cal-nav" id="cal-next">&#8594;</button>
      </div><div class="cal-grid">
        ${DAYS.map(d => `<div class="cal-day-name">${d}</div>`).join('')}
        ${Array(firstDay).fill('<div></div>').join('')}`;
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(y, m, d);
        const past = date < today, weekend = date.getDay() === 0 || date.getDay() === 6;
        const sel  = userData.date && userData.date.toDateString() === date.toDateString();
        html += `<button class="cal-day${sel ? ' cal-day--selected' : ''}" data-ts="${date.getTime()}" ${past || weekend ? 'disabled' : ''}>${d}</button>`;
      }
      html += '</div>';
      el.innerHTML = html;
      el.querySelector('#cal-prev').addEventListener('click', () => { calView.setMonth(calView.getMonth() - 1); renderCal(); });
      el.querySelector('#cal-next').addEventListener('click', () => { calView.setMonth(calView.getMonth() + 1); renderCal(); });
      el.querySelectorAll('.cal-day:not(:disabled)').forEach(btn => {
        btn.addEventListener('click', () => { userData.date = new Date(+btn.dataset.ts); userData.time = null; renderCal(); renderTimes(); });
      });
    }

    function renderTimes() {
      const el = document.getElementById('ms-times');
      if (!userData.date) { el.innerHTML = ''; return; }
      el.innerHTML = TIMES.map(t => `<button class="ms-time-btn${userData.time === t ? ' ms-time-btn--selected' : ''}" data-time="${t}">${t}</button>`).join('');
      el.querySelectorAll('.ms-time-btn').forEach(btn => {
        btn.addEventListener('click', () => { userData.time = btn.dataset.time; renderTimes(); setTimeout(() => showConfirm(), 380); });
      });
    }

    function showConfirm() {
      const el = document.getElementById('ms-confirm-text');
      if (userData.wantsSchedule && userData.date && userData.time) {
        const dateStr = userData.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        el.textContent = `You're booked for ${dateStr} at ${userData.time}. We'll send a confirmation to ${userData.email}.`;
      } else {
        el.textContent = `Thanks, ${userData.name}! Our team will reach out to ${userData.email} within one business day.`;
      }
      showStep(5);
    }

    modal.querySelector('#ms-next-1').addEventListener('click', () => {
      const val = modal.querySelector('#ms-name').value.trim();
      if (!val) return modal.querySelector('#ms-name').focus();
      userData.name = val;
      document.getElementById('ms-name-display').textContent = val;
      showStep(2);
    });
    modal.querySelector('#ms-next-2').addEventListener('click', () => {
      const email = modal.querySelector('#ms-email').value.trim();
      if (!email) return modal.querySelector('#ms-email').focus();
      userData.email = email;
      userData.phone = modal.querySelector('#ms-phone').value.trim();
      showStep(3);
    });
    modal.querySelector('#ms-yes').addEventListener('click', () => { userData.wantsSchedule = true; userData.date = null; userData.time = null; renderCal(); renderTimes(); showStep(4); });
    modal.querySelector('#ms-no').addEventListener('click',  () => { userData.wantsSchedule = false; showConfirm(); });
    modal.querySelector('#ms-done').addEventListener('click', closeModal);
    modal.querySelector('#ms-name').addEventListener('keydown',  e => { if (e.key === 'Enter') modal.querySelector('#ms-next-1').click(); });
    modal.querySelector('#ms-email').addEventListener('keydown', e => { if (e.key === 'Enter') modal.querySelector('#ms-phone').focus(); });
    modal.querySelector('#ms-phone').addEventListener('keydown', e => { if (e.key === 'Enter') modal.querySelector('#ms-next-2').click(); });

    function openModal(e) {
      e.preventDefault();
      userData = {};
      modal.querySelectorAll('input').forEach(i => i.value = '');
      showStep(1);
      backdrop.classList.add('is-open');
      backdrop.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      setTimeout(() => modal.querySelector('#ms-name')?.focus(), 320);
    }

    function closeModal() {
      backdrop.classList.remove('is-open');
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    document.querySelectorAll('.js-modal').forEach(btn => btn.addEventListener('click', openModal));
    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && backdrop.classList.contains('is-open')) closeModal(); });
  }());

});
