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
