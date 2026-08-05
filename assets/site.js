// ── SITE LANGUAGE ──
  // English-only site. Multi-language support removed.
  // Clear any language preference saved by older versions of this script.
  window.toggleSiteLang = function() {};
  try { localStorage.removeItem('nosh7-lang'); } catch (e) {}

  // Nav scroll shadow
  const nav = document.getElementById('mainNav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });

  // Hamburger menu
  const ham = document.getElementById('ham');
  const mob = document.getElementById('navMob');
  ham.addEventListener('click', () => {
    const isOpen = mob.classList.toggle('open');
    ham.classList.toggle('open', isOpen);
    ham.setAttribute('aria-expanded', isOpen);
  });
  mob.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    mob.classList.remove('open');
    ham.classList.remove('open');
    ham.setAttribute('aria-expanded', false);
  }));
  document.addEventListener('click', (e) => {
    if (!ham.contains(e.target) && !mob.contains(e.target)) {
      mob.classList.remove('open');
      ham.classList.remove('open');
      ham.setAttribute('aria-expanded', false);
    }
  });

  // ── STAT COUNTER ANIMATION ──
  const statEls = document.querySelectorAll('.stat-num[data-target]');
  let statsAnimated = false;

  function animateStats() {
    if (statsAnimated) return;
    statsAnimated = true;
    statEls.forEach(el => {
      const target  = +el.dataset.target;
      const dir     = el.dataset.dir;
      const prefix  = el.dataset.prefix  || '';
      const suffix  = el.dataset.suffix  || '';
      const from    = el.dataset.from ? +el.dataset.from : (dir === 'down' ? target * 5 : 0);
      const duration = 1800;
      const steps   = 60;
      const interval = duration / steps;
      let current = from;
      const step = (target - from) / steps;

      if (target === 0) { el.textContent = prefix + '0' + suffix; return; }

      const fmt = n => n >= 1000 ? n.toLocaleString('en-IN') : n;
      const timer = setInterval(() => {
        current += step;
        const done = dir === 'down' ? current <= target : current >= target;
        if (done) { clearInterval(timer); el.textContent = prefix + fmt(target) + suffix; return; }
        el.textContent = prefix + fmt(Math.round(current)) + suffix;
      }, interval);
    });
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) animateStats(); });
  }, { threshold: 0.3 });
  const statsBar = document.getElementById('statsBar');
  if (statsBar) observer.observe(statsBar);

  // Mobile nav accordion
  function toggleMobGroup(id) {
    const group = document.getElementById(id);
    group.classList.toggle('open');
  }

  // FAQ icon toggle
  document.querySelectorAll('details').forEach(d => {
    d.addEventListener('toggle', () => {
      const icon = d.querySelector('.faq-icon');
      if (icon) icon.style.transform = d.open ? 'rotate(45deg)' : '';
    });
  });

  // ── SCROLL REVEAL ── (details fade + lift in as they scroll into view)
  (function () {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    const targets = document.querySelectorAll([
      'section:not(.hero) .section-tag',
      'section:not(.hero) .section-title',
      'section:not(.hero) .section-sub',
      '.plans-grid > *',
      '.why-grid > *',
      '.feat-grid > *',
      '.health-grid > *',
      '.blog-grid > *',
      '.df-grid > *',
      '.location-inner > *'
    ].join(','));
    if (!targets.length) return;

    // Hide only once JS is confirmed — no-JS visitors keep everything visible.
    document.documentElement.classList.add('reveal-ready');

    // Stagger: each element gets a small delay based on its position among siblings.
    const perParent = new Map();
    targets.forEach(el => {
      const p = el.parentElement;
      const i = perParent.get(p) || 0;
      perParent.set(p, i + 1);
      el.classList.add('rv');
      el.style.transitionDelay = Math.min(i * 90, 450) + 'ms';
    });

    let ioFired = false;
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          ioFired = true;
          e.target.classList.add('rv-in');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    targets.forEach(el => io.observe(el));

    function revealAll() {
      document.querySelectorAll('.rv:not(.rv-in)').forEach(el => el.classList.add('rv-in'));
    }

    // Failsafe: if the observer never delivers (throttled/unsupported), don't leave
    // content invisible — reveal everything after a short grace period.
    setTimeout(function () { if (!ioFired) revealAll(); }, 2500);
  })();
