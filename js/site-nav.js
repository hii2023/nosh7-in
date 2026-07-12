/**
 * NOSH7 site navigation helpers (shared on every page, MPA-safe).
 *
 * 1) In-site Back button: small round button, fixed top-left, mobile only.
 *    Hidden on the homepage. Goes history.back() only when the previous
 *    page is on this same host, otherwise jumps to the homepage, so Back
 *    never closes the tab or leaves the site.
 *
 * 2) Confirm-before-leaving guard: armed ONLY when this page was reached
 *    from off-site (external referrer or none). Adds one history trap
 *    entry; pressing the browser Back button then shows a "Leave this
 *    site?" modal instead of exiting. Never armed for in-site navigation,
 *    so it never interrupts normal browsing. (Browsers do not allow
 *    custom UI on tab close; this guards the Back button only.)
 */
(function () {
  'use strict';

  var HOME = '/';
  var path = location.pathname.replace(/\/+$/, '') || '/';
  var isHome = path === '/' || path === '/index.html';

  var refHost = '';
  try { if (document.referrer) refHost = new URL(document.referrer).host; } catch (e) {}
  var cameFromInside = refHost !== '' && refHost === location.host;

  var reduceMotion = false;
  try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ---------- shared styles ---------- */
  var css =
    '.n7-back{position:fixed;bottom:18px;left:14px;z-index:9990;width:44px;height:44px;border-radius:50%;' +
      'border:1px solid #dbe5d3;background:rgba(255,255,255,.94);color:#1f7a3d;cursor:pointer;' +
      'display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(20,40,15,.14);' +
      (reduceMotion ? '' : 'transition:transform .18s ease,box-shadow .18s ease;') + '}' +
    '.n7-back:hover{transform:scale(1.06);box-shadow:0 6px 18px rgba(20,40,15,.2);}' +
    '.n7-back:focus-visible{outline:2px solid #1f7a3d;outline-offset:2px;}' +
    '.n7-back svg{width:20px;height:20px;display:block;}' +
    '@media (min-width:900px){.n7-back{display:none;}}' +
    '.n7-leave-backdrop{position:fixed;inset:0;z-index:9998;background:rgba(10,16,8,.55);' +
      'display:flex;align-items:center;justify-content:center;padding:20px;' +
      (reduceMotion ? '' : 'animation:n7fade .2s ease;') + '}' +
    '.n7-leave-modal{background:#ffffff;color:#182412;border-radius:16px;max-width:340px;width:100%;' +
      'padding:22px 20px 18px;box-shadow:0 24px 60px rgba(0,0,0,.3);font-family:inherit;' +
      (reduceMotion ? '' : 'animation:n7pop .22s ease;') + '}' +
    '.n7-leave-modal h2{margin:0 0 6px;font-size:18px;}' +
    '.n7-leave-modal p{margin:0 0 16px;font-size:13.5px;color:#5a6852;line-height:1.5;}' +
    '.n7-leave-row{display:flex;gap:10px;}' +
    '.n7-leave-row button{flex:1;padding:11px 0;border-radius:10px;font-size:14px;font-weight:700;' +
      'cursor:pointer;font-family:inherit;}' +
    '.n7-stay{border:0;background:#1f7a3d;color:#fff;}' +
    '.n7-go{border:1.5px solid #d4dccb;background:#fff;color:#5a6852;}' +
    '.n7-stay:focus-visible,.n7-go:focus-visible{outline:2px solid #1f7a3d;outline-offset:2px;}' +
    '@keyframes n7fade{from{opacity:0}to{opacity:1}}' +
    '@keyframes n7pop{from{transform:scale(.94);opacity:0}to{transform:scale(1);opacity:1}}';

  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ---------- 1) in-site back button (every page except home) ---------- */
  if (!isHome) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'n7-back';
    btn.setAttribute('aria-label', 'Go back');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M15 18l-6-6 6-6"/></svg>';
    btn.addEventListener('click', function () {
      if (cameFromInside && history.length > 1) history.back();
      else location.href = HOME;
    });
    document.body.appendChild(btn);
  }

  /* ---------- 2) leave-site guard (only when arriving from OFF-site) ---------- */
  if (!cameFromInside) {
    var leaving = false;
    var modalWrap = null;
    var lastFocus = null;

    history.pushState({}, '');

    window.addEventListener('popstate', function () {
      if (leaving) return;
      history.pushState({}, '');   // hold position while we ask
      showModal();
    });

    var showModal = function () {
      if (modalWrap) return;
      lastFocus = document.activeElement;

      modalWrap = document.createElement('div');
      modalWrap.className = 'n7-leave-backdrop';
      modalWrap.innerHTML =
        '<div class="n7-leave-modal" role="dialog" aria-modal="true" aria-labelledby="n7LeaveTitle">' +
          '<h2 id="n7LeaveTitle">Leave this site?</h2>' +
          '<p>You are about to leave nosh7.in. Fresh healthy meals are just a tap away.</p>' +
          '<div class="n7-leave-row">' +
            '<button type="button" class="n7-stay">Stay</button>' +
            '<button type="button" class="n7-go">Leave</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modalWrap);

      var stayBtn = modalWrap.querySelector('.n7-stay');
      var goBtn = modalWrap.querySelector('.n7-go');

      var close = function () {
        if (!modalWrap) return;
        modalWrap.remove();
        modalWrap = null;
        document.removeEventListener('keydown', onKey, true);
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      };

      var onKey = function (e) {
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        else if (e.key === 'Tab') {
          // minimal focus trap between the two buttons
          e.preventDefault();
          (document.activeElement === stayBtn ? goBtn : stayBtn).focus();
        }
      };

      stayBtn.addEventListener('click', close);
      goBtn.addEventListener('click', function () {
        leaving = true;
        close();
        history.go(-2);   // past the trap entry and the original entry
      });
      modalWrap.addEventListener('click', function (e) {
        if (e.target === modalWrap) close();   // backdrop click = stay
      });
      document.addEventListener('keydown', onKey, true);
      stayBtn.focus();
    };
  }
})();
