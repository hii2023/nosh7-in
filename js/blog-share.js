/**
 * NOSH7 blog share (blog reading pages only, MPA-safe).
 *
 * Adds a "Share this article" bar at the end of the article and a floating
 * share button while reading. On tap it builds a beautiful branded 1080x1920
 * story card (canvas) with the article title + NOSH7 branding, then uses the
 * Web Share API so the reader can post it straight to WhatsApp Status or
 * Instagram Story, image and all. Desktop / unsupported browsers fall back to
 * a small sheet: WhatsApp, Copy link, Download image.
 *
 * Runs only on blog article pages (og:type = article, or a /blog- path).
 */
(function () {
  'use strict';

  /* ---------- gate: blog reading pages only ---------- */
  var ogType = document.querySelector('meta[property="og:type"]');
  var isArticle =
    (ogType && ogType.content === 'article') ||
    /\/blog-[^/]+\.html?$/.test(location.pathname);
  if (!isArticle) return;

  var hero = document.querySelector('.hero');
  var articleWrap = document.querySelector('.article-wrap');
  if (!hero || !articleWrap) return;

  /* ---------- gather article facts from the page ---------- */
  var titleEl = hero.querySelector('h1');
  var tagEl = hero.querySelector('.hero-tag');
  var metaEl = hero.querySelector('.hero-meta');

  var articleTitle = (titleEl ? titleEl.textContent : document.title).trim();
  var category = tagEl ? tagEl.textContent.trim() : 'NOSH7 Health Blog';

  var readTime = '';
  if (metaEl) {
    var m = metaEl.textContent.match(/(\d+)\s*min read/i);
    if (m) readTime = m[1] + ' min read';
  }

  var canonical = document.querySelector('link[rel="canonical"]');
  var ogUrl = document.querySelector('meta[property="og:url"]');
  var shareUrl =
    (canonical && canonical.href) ||
    (ogUrl && ogUrl.content) ||
    location.href.split('#')[0];

  var shareText =
    articleTitle + '\n\nRead the full article on nosh7.in:\n' + shareUrl +
    '\n\n#NOSH7 #HealthyFood #Ahmedabad';

  var reduceMotion = false;
  try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ---------- styles ---------- */
  var css = [
    '.n7sh{max-width:760px;margin:2.5rem auto 0;padding:1.4rem 1.25rem;border-top:1px solid #e0ebe0;',
      'display:flex;flex-wrap:wrap;align-items:center;gap:.85rem;font-family:inherit}',
    '.n7sh-label{font-weight:700;color:#1a3c2e;font-size:1.02rem;margin-right:auto}',
    '.n7sh-btn{display:inline-flex;align-items:center;gap:.5rem;border-radius:100px;cursor:pointer;',
      'font-family:inherit;font-weight:700;font-size:.92rem;padding:.62rem 1.1rem;border:0;',
      (reduceMotion ? '' : 'transition:transform .16s ease,box-shadow .16s ease,background .16s ease;') + '}',
    '.n7sh-btn:hover{' + (reduceMotion ? '' : 'transform:translateY(-1px);') + '}',
    '.n7sh-btn:focus-visible{outline:2px solid #1f7a3d;outline-offset:2px}',
    '.n7sh-btn svg{flex:none}',
    '.n7sh-main{background:#1f7a3d;color:#fff;box-shadow:0 4px 14px rgba(31,122,61,.28)}',
    '.n7sh-main:hover{background:#1a6a34}',
    '.n7sh-main[disabled]{opacity:.7;cursor:progress}',
    '.n7sh-icon{width:42px;height:42px;padding:0;justify-content:center;border:1.5px solid #cfe3d2;background:#fff}',
    '.n7sh-icon.wa{border-color:#bdead0;color:#128C4A}',
    '.n7sh-icon.copy{color:#1a3c2e}',
    '.n7sh-icon:hover{background:#f2f8f3}',
    /* floating share button, sits above the WhatsApp/call stack */
    '.n7sh-float{position:fixed;right:1.1rem;z-index:501;width:48px;height:48px;border-radius:50%;',
      'border:0;cursor:pointer;background:#1f7a3d;color:#fff;display:flex;align-items:center;',
      'justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,.22);',
      (reduceMotion ? '' : 'transition:transform .2s ease;') + '}',
    '.n7sh-float:hover{' + (reduceMotion ? '' : 'transform:scale(1.08);') + '}',
    '.n7sh-float:focus-visible{outline:2px solid #fff;outline-offset:2px}',
    /* toast */
    '.n7sh-toast{position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:9997;',
      'background:#1a3c2e;color:#fff;padding:.7rem 1.1rem;border-radius:100px;font-size:.9rem;',
      'font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.28);opacity:0;pointer-events:none;',
      (reduceMotion ? '' : 'transition:opacity .25s ease,transform .25s ease;') + '}',
    '.n7sh-toast.show{opacity:1;transform:translateX(-50%) translateY(-6px)}',
    /* fallback sheet */
    '.n7sh-back{position:fixed;inset:0;z-index:9998;background:rgba(10,16,8,.55);display:flex;',
      'align-items:flex-end;justify-content:center;padding:0;' + (reduceMotion ? '' : 'animation:n7shf .2s ease;') + '}',
    '@media(min-width:560px){.n7sh-back{align-items:center;padding:20px}}',
    '.n7sh-sheet{background:#fff;color:#182412;width:100%;max-width:420px;border-radius:18px 18px 0 0;',
      'padding:20px 18px calc(20px + env(safe-area-inset-bottom));font-family:inherit;',
      'box-shadow:0 -12px 40px rgba(0,0,0,.25);' + (reduceMotion ? '' : 'animation:n7shu .24s ease;') + '}',
    '@media(min-width:560px){.n7sh-sheet{border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.3)}}',
    '.n7sh-sheet h3{margin:0 0 2px;font-size:1.1rem}',
    '.n7sh-sheet p{margin:0 0 14px;font-size:.86rem;color:#5a6852;line-height:1.5}',
    '.n7sh-opt{display:flex;align-items:center;gap:.85rem;width:100%;text-align:left;border:0;',
      'background:#f6f9f5;border-radius:12px;padding:.85rem 1rem;margin-bottom:.6rem;cursor:pointer;',
      'font-family:inherit;font-size:.96rem;font-weight:600;color:#1a3c2e;text-decoration:none}',
    '.n7sh-opt:hover{background:#eaf3ea}',
    '.n7sh-opt:focus-visible{outline:2px solid #1f7a3d;outline-offset:2px}',
    '.n7sh-opt .ic{width:38px;height:38px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center}',
    '.n7sh-opt .ic.wa{background:#25D366;color:#fff}',
    '.n7sh-opt .ic.dl{background:#1f7a3d;color:#fff}',
    '.n7sh-opt .ic.cp{background:#e7f0e7;color:#1a3c2e}',
    '.n7sh-opt small{display:block;font-weight:500;font-size:.76rem;color:#7a877090}',
    '.n7sh-opt small{color:#7a8770}',
    '.n7sh-cancel{width:100%;border:0;background:none;color:#7a8770;font-weight:700;font-size:.95rem;',
      'padding:.6rem 0 .2rem;cursor:pointer;font-family:inherit;margin-top:.2rem}',
    '@keyframes n7shf{from{opacity:0}to{opacity:1}}',
    '@keyframes n7shu{from{transform:translateY(16px);opacity:.6}to{transform:translateY(0);opacity:1}}'
  ].join('');
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ---------- icons ---------- */
  var icShare =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>' +
    '<line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg>';
  var icWa =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.05 21.785h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884"/></svg>';
  var icCopy =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  var icDl =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/>' +
    '<line x1="12" y1="15" x2="12" y2="3"/></svg>';

  /* ---------- inline share bar (end of article) ---------- */
  var bar = document.createElement('section');
  bar.className = 'n7sh';
  bar.setAttribute('aria-label', 'Share this article');
  bar.innerHTML =
    '<span class="n7sh-label">Share this article</span>' +
    '<button type="button" class="n7sh-btn n7sh-main">' + icShare + 'Share</button>' +
    '<button type="button" class="n7sh-btn n7sh-icon wa" aria-label="Share on WhatsApp">' + icWa + '</button>' +
    '<button type="button" class="n7sh-btn n7sh-icon copy" aria-label="Copy link">' + icCopy + '</button>';
  articleWrap.appendChild(bar);

  var mainBtn = bar.querySelector('.n7sh-main');
  var waBtn = bar.querySelector('.n7sh-icon.wa');
  var copyBtn = bar.querySelector('.n7sh-icon.copy');

  mainBtn.addEventListener('click', function () { shareArticle(mainBtn); });
  waBtn.addEventListener('click', shareToWhatsApp);
  copyBtn.addEventListener('click', copyLink);

  /* ---------- floating share button ---------- */
  var floatBtn = document.createElement('button');
  floatBtn.type = 'button';
  floatBtn.className = 'n7sh-float';
  floatBtn.setAttribute('aria-label', 'Share this article');
  floatBtn.innerHTML = icShare;
  // sit just above the existing WhatsApp / call float stack when present
  var existingFloat = document.querySelector('.n7-float');
  floatBtn.style.bottom = existingFloat ? 'calc(1.4rem + 48px + 48px + 1.2rem)' : '1.4rem';
  floatBtn.addEventListener('click', function () { shareArticle(floatBtn); });
  document.body.appendChild(floatBtn);

  /* ---------- toast ---------- */
  var toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'n7sh-toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    requestAnimationFrame(function () { toastEl.classList.add('show'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2400);
  }

  /* ---------- main share flow ---------- */
  var busy = false;
  function shareArticle(btn) {
    if (busy) return;
    busy = true;
    if (btn === mainBtn) mainBtn.disabled = true;

    buildCard().then(function (blob) {
      var file = blob ? new File([blob], 'nosh7-article.png', { type: 'image/png' }) : null;
      var canFile = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));

      if (canFile) {
        navigator.share({ files: [file], title: articleTitle, text: shareText })
          .catch(function () { /* user dismissed, no-op */ })
          .then(finish);
      } else if (navigator.share) {
        // no image support, share text + link (still native sheet)
        navigator.share({ title: articleTitle, text: shareText, url: shareUrl })
          .catch(function () {})
          .then(finish);
      } else {
        openSheet(blob);
        finish();
      }
    }).catch(function () {
      openSheet(null);
      finish();
    });

    function finish() {
      busy = false;
      if (btn === mainBtn) mainBtn.disabled = false;
    }
  }

  function shareToWhatsApp() {
    window.open('https://wa.me/?text=' + encodeURIComponent(shareText), '_blank', 'noopener');
  }

  function copyLink() {
    var done = function () { toast('Link copied'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(done, legacyCopy);
    } else { legacyCopy(); }
    function legacyCopy() {
      try {
        var t = document.createElement('textarea');
        t.value = shareUrl; t.style.position = 'fixed'; t.style.opacity = '0';
        document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
        done();
      } catch (e) { toast('Could not copy'); }
    }
  }

  /* ---------- fallback sheet (desktop / no Web Share) ---------- */
  function openSheet(blob) {
    var back = document.createElement('div');
    back.className = 'n7sh-back';
    var imgLine = blob
      ? '<button type="button" class="n7sh-opt" data-act="dl"><span class="ic dl">' + icDl + '</span>' +
        '<span>Download story image<small>Save the card, then post it to your status or story</small></span></button>'
      : '';
    back.innerHTML =
      '<div class="n7sh-sheet" role="dialog" aria-modal="true" aria-label="Share this article">' +
        '<h3>Share this article</h3>' +
        '<p>Post it to your WhatsApp Status or Instagram Story, or copy the link.</p>' +
        '<a class="n7sh-opt" data-act="wa" href="https://wa.me/?text=' + encodeURIComponent(shareText) +
          '" target="_blank" rel="noopener"><span class="ic wa">' + icWa + '</span>' +
          '<span>WhatsApp<small>Send the link or post to your status</small></span></a>' +
        imgLine +
        '<button type="button" class="n7sh-opt" data-act="cp"><span class="ic cp">' + icCopy + '</span>' +
          '<span>Copy link<small>' + shareUrl.replace(/^https?:\/\//, '') + '</small></span></button>' +
        '<button type="button" class="n7sh-cancel">Cancel</button>' +
      '</div>';
    document.body.appendChild(back);

    var close = function () { back.remove(); document.removeEventListener('keydown', onKey, true); };
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey, true);
    back.addEventListener('click', function (e) { if (e.target === back) close(); });
    back.querySelector('.n7sh-cancel').addEventListener('click', close);

    var dlBtn = back.querySelector('[data-act="dl"]');
    if (dlBtn && blob) {
      dlBtn.addEventListener('click', function () {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = 'nosh7-article.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        toast('Image saved');
      });
    }
    back.querySelector('[data-act="cp"]').addEventListener('click', function () { copyLink(); close(); });
    back.querySelector('[data-act="wa"]').addEventListener('click', close);
  }

  /* ---------- beautiful 1080x1920 story card ---------- */
  function buildCard() {
    var W = 1080, H = 1920, PAD = 96;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');

    var fontReady = (document.fonts && document.fonts.ready)
      ? document.fonts.ready.catch(function () {}) : Promise.resolve();

    return fontReady.then(function () {
      // preload the exact weights we draw with, so IBM Plex is used not a fallback
      var loads = [];
      if (document.fonts && document.fonts.load) {
        try {
          loads.push(document.fonts.load('700 96px "IBM Plex Sans"'));
          loads.push(document.fonts.load('600 40px "IBM Plex Sans"'));
          loads.push(document.fonts.load('400 34px "IBM Plex Sans"'));
        } catch (e) {}
      }
      return Promise.all(loads).catch(function () {});
    }).then(function () {
      var FONT = '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

      // background gradient (brand greens)
      var g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#1f5133');
      g.addColorStop(0.55, '#1a3c2e');
      g.addColorStop(1, '#12261c');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // subtle decorative circles (low opacity)
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = '#95d5b2';
      ctx.beginPath(); ctx.arc(W - 60, 200, 340, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(120, H - 160, 260, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // brand wordmark
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 76px ' + FONT;
      ctx.fillText('NOSH7', PAD, 210);
      ctx.fillStyle = '#95d5b2';
      ctx.font = '500 34px ' + FONT;
      ctx.fillText('Pure Veg  ·  Ahmedabad', PAD, 262);

      // category chip
      var chip = (category || '').toUpperCase();
      ctx.font = '600 32px ' + FONT;
      var chipW = ctx.measureText(chip).width;
      var chipX = PAD, chipY = 700, chipPadX = 34, chipH = 74;
      roundRect(ctx, chipX, chipY, chipW + chipPadX * 2, chipH, 37);
      ctx.fillStyle = 'rgba(149,213,178,0.16)';
      ctx.fill();
      ctx.fillStyle = '#b7e4c7';
      ctx.fillText(chip, chipX + chipPadX, chipY + 49);

      // title (wrapped, weight 700)
      ctx.fillStyle = '#faf7f0';
      var titleSize = articleTitle.length > 90 ? 74 : (articleTitle.length > 55 ? 84 : 94);
      ctx.font = '700 ' + titleSize + 'px ' + FONT;
      var lineH = Math.round(titleSize * 1.22);
      var lines = wrapText(ctx, articleTitle, W - PAD * 2);
      var ty = chipY + chipH + 96;
      lines.forEach(function (ln) { ctx.fillText(ln, PAD, ty); ty += lineH; });

      // read time
      if (readTime) {
        ctx.fillStyle = '#95d5b2';
        ctx.font = '500 36px ' + FONT;
        ctx.fillText(readTime, PAD, ty + 24);
      }

      // divider
      var dy = H - 300;
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(PAD, dy); ctx.lineTo(W - PAD, dy); ctx.stroke();

      // footer
      ctx.fillStyle = '#e8f3ea';
      ctx.font = '400 36px ' + FONT;
      ctx.fillText('Read the full article on', PAD, dy + 78);
      ctx.fillStyle = '#7ed4a2';
      ctx.font = '700 56px ' + FONT;
      ctx.fillText('nosh7.in', PAD, dy + 146);
      ctx.fillStyle = 'rgba(232,243,234,0.72)';
      ctx.font = '400 30px ' + FONT;
      ctx.fillText('Fresh healthy meals, delivered daily in Ahmedabad', PAD, dy + 200);

      return new Promise(function (resolve) {
        if (canvas.toBlob) canvas.toBlob(function (b) { resolve(b); }, 'image/png', 0.92);
        else resolve(dataURItoBlob(canvas.toDataURL('image/png')));
      });
    });
  }

  /* ---------- canvas helpers ---------- */
  function wrapText(ctx, text, maxW) {
    var words = text.split(/\s+/), lines = [], line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = words[i]; }
      else { line = test; }
    }
    if (line) lines.push(line);
    if (lines.length > 7) { lines = lines.slice(0, 7); lines[6] = lines[6].replace(/\s+\S*$/, '') + '…'; }
    return lines;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function dataURItoBlob(dataURI) {
    var parts = dataURI.split(','), mime = parts[0].match(/:(.*?);/)[1];
    var bin = atob(parts[1]), len = bin.length, arr = new Uint8Array(len);
    for (var i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
})();
