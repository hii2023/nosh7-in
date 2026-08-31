/**
 * NOSH7 Blog CMS - Cloudflare Worker
 * Serves a passcode-gated admin UI to edit nosh7.in blog articles
 * (text blocks + inline images) and publishes by committing to
 * github.com/hii2023/nosh7-in via the GitHub Contents API.
 *
 * Secrets required:
 *   CMS_PASSCODE - passcode for the panel
 *   GITHUB_TOKEN - fine-grained PAT, repo hii2023/nosh7-in, Contents: read+write
 */

const REPO = 'hii2023/nosh7-in';
const BRANCH = 'main';
const SITE = 'https://nosh7.in';
const ARTICLE_RE = /^blog-[a-z0-9-]+\.html$/;
const IMG_NAME_RE = /^[a-z0-9][a-z0-9._-]*\.(webp|jpe?g|png)$/;
const INDEXNOW_KEY = '9d861722dd3c9d64dd74b588ba61d096';

const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
// Pages that carry the month name / menu artwork. Order matters only for reporting.
const MENU_PAGES = ['menu/index.html', 'subscription.html', 'index.html'];
const MENU_URLS = [SITE + '/', SITE + '/menu/', SITE + '/subscription.html'];

const ACCENTS = {
  green:  { hero1: '#14532d', hero2: '#16a34a', tint: '#86efac', card1: '#d1fae5', card2: '#6ee7b7', accent: '#059669' },
  orange: { hero1: '#431407', hero2: '#9a3412', tint: '#fdba74', card1: '#ffedd5', card2: '#fdba74', accent: '#c2410c' },
  teal:   { hero1: '#134e4a', hero2: '#0d9488', tint: '#5eead4', card1: '#ccfbf1', card2: '#5eead4', accent: '#0d9488' },
  pink:   { hero1: '#831843', hero2: '#db2777', tint: '#f9a8d4', card1: '#fce7f3', card2: '#f9a8d4', accent: '#db2777' }
};

function b64decode(b64) {
  const bin = atob(String(b64).replace(/\n/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// Strip characters that could break HTML attributes or JSON-LD; no em dashes on this site
function cleanText(s) {
  return String(s || '').replace(/[<>"]/g, '').replace(/—/g, '-').replace(/\s+/g, ' ').trim();
}

function fillTpl(tpl, map) {
  let out = tpl;
  for (const k in map) out = out.split('{{' + k + '}}').join(map[k]);
  return out;
}

const CARD_TPL = `    <a href="https://nosh7.in/{{SLUG}}" data-cat="{{CAT}}" class="blog-card">
      <div class="blog-card-top" style="color:{{ACCENT}}; background: linear-gradient(135deg, {{CARD1}}, {{CARD2}});"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg></div>
      <div class="blog-card-body">
        <div class="blog-card-tag">{{TAG}}</div>
        <div class="blog-card-title">{{H1_SHORT}}</div>
        <div class="blog-card-desc">{{CARD_DESC}}</div>
        <div class="blog-card-meta"><span>{{MONTH_YEAR}}</span><span>{{MINS}} min read</span></div>
      </div>
    </a>
`;

const SITEMAP_TPL = `  <url>
    <loc>https://nosh7.in/{{SLUG}}</loc>
    <lastmod>{{DATE}}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
`;

const PAGE_TPL = `<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-4GXXKEPDFF"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-4GXXKEPDFF');
  </script>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{SEO_TITLE}}</title>
  <meta name="description" content="{{META_DESC}}" />
  <meta name="keywords" content="{{TAG}} Ahmedabad, healthy meal delivery Ahmedabad, NOSH7 {{TAG}}" />
  <link rel="canonical" href="https://nosh7.in/{{SLUG}}" />
  <link rel="alternate" hreflang="en" href="https://www.nosh7.com/" />
  <link rel="alternate" hreflang="hi-IN" href="https://nosh7.in/{{SLUG}}" />
  <script type="application/ld+json">
  {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "Home", "item": "https://nosh7.in/"}, {"@type": "ListItem", "position": 2, "name": "Health Blog", "item": "https://nosh7.in/blog.html"}, {"@type": "ListItem", "position": 3, "name": "{{H1_SHORT}}", "item": "https://nosh7.in/{{SLUG}}"}]}
  </script>
  <meta property="og:type" content="article" />
  <meta property="og:url" content="https://nosh7.in/{{SLUG}}" />
  <meta property="og:title" content="{{SEO_TITLE}}" />
  <meta property="og:description" content="{{META_DESC}}" />
  <meta property="og:image" content="https://nosh7.in/assets/nosh7-healthy-salad-meal-ahmedabad-og.jpg" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" href="/assets/logo.svg" type="image/svg+xml">
  <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  <link rel="icon" type="image/png" href="/assets/logo.png" />
  <link rel="apple-touch-icon" href="/assets/logo.png" />

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "{{H1}}",
    "description": "{{META_DESC}}",
    "author": {"@type": "Organization", "name": "NOSH7"},
    "publisher": {"@type": "Organization", "name": "NOSH7", "logo": {"@type": "ImageObject", "url": "https://nosh7.in/assets/logo.png"}},
    "url": "https://nosh7.in/{{SLUG}}",
    "datePublished": "{{DATE}}",
    "dateModified": "{{DATE}}"
  }
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://events.nosh7.in" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap" rel="preload" as="style" onload="this.onload=null;this.rel='stylesheet'" />
  <link rel="stylesheet" href="/assets/blog.css?v=2026-06-25" />
  <style>
    .hero { background: linear-gradient(135deg, {{HERO1}}, {{HERO2}}); }
    .hero-tag { color: {{TINT}}; }
    .hero-meta { color: {{TINT}}; }
  </style>
<style id="n7-nav-enh">
.n7-nav-right{display:flex;align-items:center;gap:1.1rem}
.n7-links{display:flex;align-items:center;gap:1.1rem}
.n7-links a{color:#1a3c2e;font-weight:600;font-size:.88rem;white-space:nowrap;text-decoration:none}
.n7-links a:hover{color:#52b788}
.n7-login{display:inline-flex;align-items:center;gap:.35rem;border:1.5px solid #b7e4c7;border-radius:100px;padding:.32rem .85rem;background:rgba(45,106,79,.08);color:#1a3c2e;font-weight:700;font-size:.82rem;text-decoration:none;white-space:nowrap}
.n7-login:hover{background:#1a3c2e;color:#faf7f0}
.n7-login svg{flex:none}
@media(max-width:820px){.n7-links{display:none}.n7-nav-right{gap:.6rem}}
.n7-float{position:fixed;bottom:1.4rem;right:1.1rem;z-index:500;display:flex;flex-direction:column;gap:.6rem}
.n7-float a{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,.22);transition:transform .2s}
.n7-float a:hover{transform:scale(1.08)}
.n7-float .wa{background:#25D366}.n7-float .call{background:#1a3c2e}
</style>
</head>
<body>

<nav>
  <a class="nav-logo" href="/">
    <img decoding="async" src="/assets/logo.webp" alt="NOSH7 logo" />
    <div class="nav-logo-text">NOSH7<span>Pure Veg &middot; Ahmedabad</span></div>
  </a><div class="n7-nav-right"><div class="n7-links"><a href="/#plans">Plans</a><a href="/#menu">Menu</a><a href="/blog.html">Blog</a><a href="/bmi-calculator-ahmedabad.html">BMI</a><a href="/fruit-bowl-pack-ahmedabad.html">Fruit</a><a href="/office-lunch-ahmedabad.html">Office</a></div><a class="n7-login" href="https://www.nosh7.com" target="_blank" rel="noopener"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Login</a></div>
  <a class="nav-back" href="/blog.html">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
    All Articles
  </a>
</nav>

<div class="hero">
  <span class="hero-tag">{{TAG}}</span>
  <h1>{{H1}}</h1>
  <p class="hero-meta">By NOSH7 Kitchen &amp; Nutrition Team &middot; {{MONTH_YEAR}} &middot; {{MINS}} min read</p>
</div>

<div class="article-wrap" role="main">

  <p class="intro">{{INTRO}}</p>

  <p>Start writing your article here. In the CMS, tap Edit on this block to replace this text, or delete it and add your own text and image blocks.</p>

  <div class="cta-block">
    <h3>Fresh, Balanced Meals Delivered in Ahmedabad</h3>
    <p>20g+ protein, high fibre, controlled calories - designed by the NOSH7 kitchen for the way we live now. Start with a 5-day trial at ₹1,250 (code Healthy = ₹1,100).</p>
    <a href="https://start.nosh7.in/?track={{TRACK}}" class="cta-btn" target="_blank" rel="noopener">Start Your Trial &rarr;</a>
  </div>

  <div class="related">
    <h3>Related Articles</h3>
    <div class="related-links">
      <a href="/blog-7-essential-nutrients-ahmedabad.html">The 7 Essential Nutrients Every Complete Meal Needs &rarr;</a>
      <a href="/blog-weight-loss-science-ahmedabad.html">The Science of Weight Loss for Indian Vegetarians &rarr;</a>
      <a href="/blog.html">View All Health Articles &rarr;</a>
    </div>
  </div>

</div>

<footer>
  &copy; 2026 NOSH7 &middot; Ahmedabad ka Pure Veg Salad Cloud Kitchen
</footer>

<!-- 100% privacy-first analytics -->
<script>
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog && window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="Mi Ri init Vi Gi Rr Wi Ji Bi capture calculateEventProperties tn register register_once register_for_session unregister unregister_for_session an getFeatureFlag getFeatureFlagPayload getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey displaySurvey cancelPendingSurvey canRenderSurvey canRenderSurveyAsync un identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset setIdentity clearIdentity get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException addExceptionStep captureLog startExceptionAutocapture stopExceptionAutocapture loadToolbar get_property getSessionProperty nn Xi createPersonProfile setInternalOrTestUser sn Hi cn opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing get_explicit_consent_status is_capturing clear_opt_in_out_capturing Ki debug Lr rn getPageViewId captureTraceFeedback captureTraceMetric Di".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    posthog.init('phc_AZPE2NqJmbnWMwMKgGBmFkdpXr7P3ixKZMQZHeYo3Z7C', {
        api_host: 'https://events.nosh7.in',
        ui_host: 'https://us.posthog.com',
        defaults: '2026-01-30',
        person_profiles: 'identified_only',
    })
</script>
<div class="n7-float" role="complementary" aria-label="Quick contact"><a class="wa" href="https://wa.me/919712989498?text=Hi+Team+Nosh7" target="_blank" rel="noopener" aria-label="Chat on WhatsApp"><svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a><a class="call" href="tel:+919712989498" aria-label="Call NOSH7"><svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg></a></div>
<script src="/js/site-nav.js" defer></script>
</body>
</html>
`;

function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'X-Robots-Tag': 'noindex, nofollow' }
  });
}

async function gh(env, method, path, body) {
  const res = await fetch('https://api.github.com' + path, {
    method: method,
    headers: {
      'Authorization': 'Bearer ' + env.GITHUB_TOKEN,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'nosh7-cms-worker',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(function () { return {}; });
  return { ok: res.ok, status: res.status, data: data };
}


function titleCase(m) { return m.charAt(0).toUpperCase() + m.slice(1); }

function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/**
 * Swap every menu-month reference on a page from one month to another.
 * Anchored patterns only, so unrelated prose that happens to contain a month
 * name is left alone. Returns the new text plus a per-rule hit count.
 */
function rewriteMenuMonth(text, oldM, oldY, newM, newY) {
  const OM = titleCase(oldM), NM = titleCase(newM);
  let hits = 0;
  function sub(re, rep) {
    text = text.replace(re, function () { hits++; return rep; });
  }
  // 1. artwork + full-res filenames
  sub(new RegExp('nosh7-salad-meal-menu-' + oldM + '-' + oldY + '-ahmedabad', 'g'),
      'nosh7-salad-meal-menu-' + newM + '-' + newY + '-ahmedabad');
  // 2. social share image filename
  sub(new RegExp('nosh7-menu-og-' + oldM + '-' + oldY, 'g'),
      'nosh7-menu-og-' + newM + '-' + newY);
  // 3. "September 2026" in titles, meta, alt text, JSON-LD, h1, section tags
  sub(new RegExp(escRe(OM) + ' ' + oldY, 'g'), NM + ' ' + newY);
  // 4. WhatsApp prefill: "I saw the September menu"
  sub(new RegExp('%20' + escRe(OM) + '%20menu', 'g'), '%20' + NM + '%20menu');
  // 5. homepage button: "View September Menu"
  sub(new RegExp('View ' + escRe(OM) + ' Menu', 'g'), 'View ' + NM + ' Menu');
  return { text: text, hits: hits };
}

// The artwork's aspect ratio changes month to month, so keep the declared
// sizes honest: wrong width/height attributes cause layout shift.
function patchMenuDims(text, d) {
  let t = text;
  t = t.replace(/(<meta property="og:image:width" content=")\d+(")/, '$1' + d.ogW + '$2');
  t = t.replace(/(<meta property="og:image:height" content=")\d+(")/, '$1' + d.ogH + '$2');
  t = t.replace(/(<img src="\/assets\/nosh7-salad-meal-menu-[a-z]+-\d{4}-ahmedabad\.webp"[\s\S]{0,400}?)width="\d+" height="\d+"/,
                '$1width="' + d.w + '" height="' + d.h + '"');
  return t;
}

function bumpSitemap(xml, urls, date) {
  let hits = 0;
  for (const u of urls) {
    const re = new RegExp('(<loc>' + escRe(u) + '</loc>\\s*\\n\\s*<lastmod>)\\d{4}-\\d{2}-\\d{2}(</lastmod>)');
    xml = xml.replace(re, function (m, a, c) { hits++; return a + date + c; });
  }
  return { xml: xml, hits: hits };
}

// Contents API refuses to return the body of files over 1MB, but we only need
// the sha to overwrite. Fall back to the directory listing when that happens.
async function ghSha(env, filePath) {
  const cur = await gh(env, 'GET', '/repos/' + REPO + '/contents/' + filePath + '?ref=' + BRANCH);
  if (cur.ok && cur.data && cur.data.sha) return cur.data.sha;
  const slash = filePath.lastIndexOf('/');
  const dir = slash === -1 ? '' : filePath.slice(0, slash);
  const name = filePath.slice(slash + 1);
  const list = await gh(env, 'GET', '/repos/' + REPO + '/contents/' + dir + '?ref=' + BRANCH);
  if (list.ok && Array.isArray(list.data)) {
    for (const e of list.data) if (e.name === name) return e.sha;
  }
  return null;
}

async function ghPutFile(env, filePath, contentB64, message) {
  const body = { message: message, content: contentB64, branch: BRANCH };
  const sha = await ghSha(env, filePath);
  if (sha) body.sha = sha;
  return gh(env, 'PUT', '/repos/' + REPO + '/contents/' + filePath, body);
}

// Optional: only runs if CF_ZONE_ID + CF_API_TOKEN secrets are set.
async function purgeCloudflare(env, urls) {
  if (!env.CF_ZONE_ID || !env.CF_API_TOKEN) return { skipped: true };
  try {
    const r = await fetch('https://api.cloudflare.com/client/v4/zones/' + env.CF_ZONE_ID + '/purge_cache', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + env.CF_API_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: urls })
    });
    const d = await r.json().catch(function () { return {}; });
    return { ok: r.ok && d.success !== false };
  } catch (e) { return { ok: false }; }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === '/') {
      return new Response(UI_HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' }
      });
    }

    if (!path.startsWith('/api/')) return json({ error: 'Not found' }, 404);
    if (!env.CMS_PASSCODE) return json({ error: 'CMS_PASSCODE secret not set' }, 503);

    if (path === '/api/login' && req.method === 'POST') {
      const body = await req.json().catch(function () { return {}; });
      if (body.passcode === env.CMS_PASSCODE) return json({ ok: true });
      return json({ error: 'Wrong passcode' }, 401);
    }

    // Everything below requires the passcode header
    if (req.headers.get('x-cms-key') !== env.CMS_PASSCODE) {
      return json({ error: 'Unauthorized' }, 401);
    }

    if (path === '/api/status') {
      return json({ tokenConfigured: !!env.GITHUB_TOKEN });
    }

    if (path === '/api/articles') {
      // Public repo: list articles from the live sitemap (no token needed)
      const res = await fetch(SITE + '/sitemap.xml', { headers: { 'User-Agent': 'nosh7-cms-worker' } });
      const xml = await res.text();
      const locs = xml.match(/<loc>[^<]+<\/loc>/g) || [];
      const articles = [];
      for (const l of locs) {
        const u = l.replace(/<\/?loc>/g, '');
        const name = u.split('/').pop();
        if (ARTICLE_RE.test(name)) articles.push({ path: name, url: u });
      }
      return json({ articles: articles });
    }

    if (path === '/api/article') {
      const p = url.searchParams.get('path') || '';
      if (!ARTICLE_RE.test(p)) return json({ error: 'Invalid article path' }, 400);
      // Public repo: read raw file without a token
      const res = await fetch('https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/' + p, {
        headers: { 'User-Agent': 'nosh7-cms-worker' }
      });
      if (res.ok) return json({ html: await res.text() });
      // Fallback (raw CDN can lag right after a create): authenticated contents API
      if (env.GITHUB_TOKEN) {
        const cur = await gh(env, 'GET', '/repos/' + REPO + '/contents/' + p + '?ref=' + BRANCH);
        if (cur.ok && cur.data.content) return json({ html: b64decode(cur.data.content) });
      }
      return json({ error: 'Could not load article (' + res.status + ')' }, 502);
    }

    if (path === '/api/create' && req.method === 'POST') {
      if (!env.GITHUB_TOKEN) return json({ error: 'GITHUB_TOKEN secret not set. Publishing is locked.' }, 503);
      const b = await req.json().catch(function () { return null; });
      if (!b) return json({ error: 'Bad request' }, 400);

      const slug = String(b.slug || '').trim();
      if (!/^blog-[a-z0-9-]{3,70}-ahmedabad\.html$/.test(slug)) {
        return json({ error: 'File name must look like blog-your-topic-ahmedabad.html (lowercase letters, numbers, hyphens)' }, 400);
      }
      const h1 = cleanText(b.h1);
      const seoTitle = cleanText(b.seoTitle);
      const metaDesc = cleanText(b.metaDesc);
      const tag = cleanText(b.tag);
      const cardDesc = cleanText(b.cardDesc);
      const intro = cleanText(b.intro);
      if (!h1 || !seoTitle || !metaDesc || !tag || !cardDesc || !intro) return json({ error: 'All fields are required' }, 400);
      if (h1.length > 140 || seoTitle.length > 70 || metaDesc.length > 175 || tag.length > 30 || cardDesc.length > 200 || intro.length > 800) {
        return json({ error: 'One of the fields is too long' }, 400);
      }
      const cat = ['conditions', 'weightloss', 'protein', 'value', 'lifestyle'].indexOf(b.cat) > -1 ? b.cat : 'lifestyle';
      const acc = ACCENTS[b.accent] || ACCENTS.green;
      const track = ['healthy-fresh', 'weight-loss', 'low-sugar', 'high-protein', 'fruit-pack'].indexOf(b.track) > -1 ? b.track : 'healthy-fresh';
      const mins = Math.min(15, Math.max(3, parseInt(b.mins, 10) || 6));

      // Slug collision check
      const head = await fetch('https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/' + slug, {
        method: 'HEAD', headers: { 'User-Agent': 'nosh7-cms-worker' }
      });
      if (head.ok) return json({ error: 'An article with this file name already exists' }, 409);

      const now = new Date();
      const date = now.toISOString().slice(0, 10);
      const monthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const h1Short = h1.length > 60 ? h1.slice(0, 57).replace(/\s+\S*$/, '') + '...' : h1;
      const map = {
        SLUG: slug, H1: h1, H1_SHORT: h1Short, SEO_TITLE: seoTitle, META_DESC: metaDesc,
        TAG: tag, CAT: cat, CARD_DESC: cardDesc, INTRO: intro, TRACK: track,
        MINS: String(mins), DATE: date, MONTH_YEAR: monthYear,
        HERO1: acc.hero1, HERO2: acc.hero2, TINT: acc.tint,
        CARD1: acc.card1, CARD2: acc.card2, ACCENT: acc.accent
      };
      const page = fillTpl(PAGE_TPL, map);
      const card = fillTpl(CARD_TPL, map);
      const smEntry = fillTpl(SITEMAP_TPL, map);

      if (b.dryRun) return json({ ok: true, dryRun: true, page: page, card: card, sitemapEntry: smEntry });

      // 1. Commit the new article page
      const putPage = await gh(env, 'PUT', '/repos/' + REPO + '/contents/' + slug, {
        message: 'CMS: new article ' + slug, content: b64encode(page), branch: BRANCH
      });
      if (!putPage.ok) return json({ error: 'Could not create page: ' + (putPage.data.message || putPage.status) }, 502);

      // 2. Add to sitemap.xml
      const sm = await gh(env, 'GET', '/repos/' + REPO + '/contents/sitemap.xml?ref=' + BRANCH);
      if (!sm.ok) return json({ error: 'Page created, but could not read sitemap.xml: ' + (sm.data.message || sm.status) }, 502);
      const smText = b64decode(sm.data.content);
      if (smText.indexOf('</urlset>') === -1) return json({ error: 'Page created, but sitemap.xml looks unexpected; not touched' }, 502);
      const newSm = smText.replace('</urlset>', smEntry + '</urlset>');
      const putSm = await gh(env, 'PUT', '/repos/' + REPO + '/contents/sitemap.xml', {
        message: 'CMS: sitemap entry for ' + slug, content: b64encode(newSm), sha: sm.data.sha, branch: BRANCH
      });
      if (!putSm.ok) return json({ error: 'Page created, but sitemap update failed: ' + (putSm.data.message || putSm.status) }, 502);

      // 3. Add card to blog.html listing (newest first) + bump the visible count
      const bl = await gh(env, 'GET', '/repos/' + REPO + '/contents/blog.html?ref=' + BRANCH);
      if (!bl.ok) return json({ error: 'Page + sitemap done, but could not read blog.html: ' + (bl.data.message || bl.status) }, 502);
      let blText = b64decode(bl.data.content);
      const anchor = '<div class="blog-grid">';
      if (blText.indexOf(anchor) === -1) return json({ error: 'Page + sitemap done, but blog.html grid anchor not found; card not added' }, 502);
      blText = blText.replace(anchor, anchor + '\n' + card);
      blText = blText.replace(/>(\d+) articles</, function (m, n) { return '>' + (parseInt(n, 10) + 1) + ' articles<'; });
      const putBl = await gh(env, 'PUT', '/repos/' + REPO + '/contents/blog.html', {
        message: 'CMS: blog listing card for ' + slug, content: b64encode(blText), sha: bl.data.sha, branch: BRANCH
      });
      if (!putBl.ok) return json({ error: 'Page + sitemap done, but blog.html update failed: ' + (putBl.data.message || putBl.status) }, 502);

      // 4. Tell search engines (best effort)
      try {
        await fetch('https://api.indexnow.org/indexnow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ host: 'nosh7.in', key: INDEXNOW_KEY, keyLocation: SITE + '/' + INDEXNOW_KEY + '.txt', urlList: [SITE + '/' + slug, SITE + '/blog.html', SITE + '/sitemap.xml'] })
        });
      } catch (e) { /* non-fatal */ }

      return json({ ok: true, slug: slug });
    }

    if (path === '/api/publish' && req.method === 'POST') {
      if (!env.GITHUB_TOKEN) return json({ error: 'GITHUB_TOKEN secret not set. Publishing is locked.' }, 503);
      const body = await req.json().catch(function () { return null; });
      if (!body || !ARTICLE_RE.test(body.path || '')) return json({ error: 'Invalid article path' }, 400);
      const html = body.html || '';
      if (html.length < 5000 || html.indexOf('<div class="article-wrap"') === -1 || html.indexOf('</html>') === -1) {
        return json({ error: 'Refusing to save: HTML looks incomplete/broken' }, 400);
      }

      // 1. Upload any new images to assets/blog/
      const images = Array.isArray(body.images) ? body.images : [];
      if (images.length > 10) return json({ error: 'Too many images in one publish' }, 400);
      for (const img of images) {
        if (!IMG_NAME_RE.test(img.name || '')) return json({ error: 'Invalid image name: ' + img.name }, 400);
        if (!img.base64 || img.base64.length > 1400000) return json({ error: 'Image too large (max ~1MB)' }, 400);
        const put = await gh(env, 'PUT', '/repos/' + REPO + '/contents/assets/blog/' + img.name, {
          message: 'CMS: add blog image ' + img.name,
          content: img.base64,
          branch: BRANCH
        });
        if (!put.ok && put.status !== 422) {
          return json({ error: 'Image upload failed: ' + (put.data.message || put.status) }, 502);
        }
        // 422 = already exists with same name; treat as OK (timestamped names make this rare)
      }

      // 2. Get current sha of the article
      const cur = await gh(env, 'GET', '/repos/' + REPO + '/contents/' + body.path + '?ref=' + BRANCH);
      if (!cur.ok) return json({ error: 'Could not read article sha: ' + (cur.data.message || cur.status) }, 502);

      // 3. Commit the updated HTML
      const put = await gh(env, 'PUT', '/repos/' + REPO + '/contents/' + body.path, {
        message: 'CMS: update ' + body.path,
        content: b64encode(html),
        sha: cur.data.sha,
        branch: BRANCH
      });
      if (!put.ok) return json({ error: 'Commit failed: ' + (put.data.message || put.status) }, 502);
      return json({ ok: true, commit: put.data.commit && put.data.commit.sha });
    }

    if (path === '/api/delete' && req.method === 'POST') {
      if (!env.GITHUB_TOKEN) return json({ error: 'GITHUB_TOKEN secret not set. Deleting is locked.' }, 503);
      const body = await req.json().catch(function () { return null; });
      const slug = body && body.path;
      if (!slug || !ARTICLE_RE.test(slug)) return json({ error: 'Invalid article path' }, 400);

      // 1. Delete the article page itself
      const cur = await gh(env, 'GET', '/repos/' + REPO + '/contents/' + slug + '?ref=' + BRANCH);
      if (!cur.ok) return json({ error: 'Could not find the post to delete: ' + (cur.data.message || cur.status) }, 502);
      const del = await gh(env, 'DELETE', '/repos/' + REPO + '/contents/' + slug, {
        message: 'CMS: delete article ' + slug, sha: cur.data.sha, branch: BRANCH
      });
      if (!del.ok) return json({ error: 'Could not delete the post: ' + (del.data.message || del.status) }, 502);

      const slugRe = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // 2. Remove its entry from sitemap.xml (best effort)
      const sm = await gh(env, 'GET', '/repos/' + REPO + '/contents/sitemap.xml?ref=' + BRANCH);
      if (sm.ok && sm.data.content) {
        const smText = b64decode(sm.data.content);
        const smRe = new RegExp('\\s*<url>\\s*<loc>https://nosh7\\.in/' + slugRe + '</loc>[\\s\\S]*?</url>', 'i');
        const newSm = smText.replace(smRe, '');
        if (newSm !== smText) {
          await gh(env, 'PUT', '/repos/' + REPO + '/contents/sitemap.xml', {
            message: 'CMS: remove sitemap entry for ' + slug, content: b64encode(newSm), sha: sm.data.sha, branch: BRANCH
          });
        }
      }

      // 3. Remove its card from blog.html + decrement the visible count (best effort)
      const bl = await gh(env, 'GET', '/repos/' + REPO + '/contents/blog.html?ref=' + BRANCH);
      if (bl.ok && bl.data.content) {
        const blText = b64decode(bl.data.content);
        const cardRe = new RegExp('\\s*<a href="https://nosh7\\.in/' + slugRe + '"[\\s\\S]*?</a>', 'i');
        let newBl = blText.replace(cardRe, '');
        if (newBl !== blText) {
          newBl = newBl.replace(/>(\d+) articles</, function (m, n) { return '>' + Math.max(0, parseInt(n, 10) - 1) + ' articles<'; });
          await gh(env, 'PUT', '/repos/' + REPO + '/contents/blog.html', {
            message: 'CMS: remove blog listing card for ' + slug, content: b64encode(newBl), sha: bl.data.sha, branch: BRANCH
          });
        }
      }

      // 4. Tell search engines the list + sitemap changed (best effort)
      try {
        await fetch('https://api.indexnow.org/indexnow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ host: 'nosh7.in', key: INDEXNOW_KEY, keyLocation: SITE + '/' + INDEXNOW_KEY + '.txt', urlList: [SITE + '/blog.html', SITE + '/sitemap.xml'] })
        });
      } catch (e) { /* non-fatal */ }

      return json({ ok: true });
    }

    /* ---------- MONTHLY MENU ---------- */

    if (path === '/api/menu/state') {
      const res = await fetch('https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/menu/index.html?t=' + Date.now(),
        { headers: { 'User-Agent': 'nosh7-cms-worker' } });
      if (!res.ok) return json({ error: 'Could not read the menu page (' + res.status + ')' }, 502);
      const html = await res.text();
      const m = html.match(/nosh7-salad-meal-menu-([a-z]+)-(\d{4})-ahmedabad/);
      if (!m) return json({ error: 'Could not work out which month is live on /menu/. The page may have been edited by hand.' }, 500);
      return json({
        month: m[1],
        year: m[2],
        tokenConfigured: !!env.GITHUB_TOKEN,
        purgeConfigured: !!(env.CF_ZONE_ID && env.CF_API_TOKEN)
      });
    }

    if (path === '/api/menu/publish' && req.method === 'POST') {
      if (!env.GITHUB_TOKEN) return json({ error: 'GITHUB_TOKEN secret not set. Publishing is locked.' }, 503);
      const b = await req.json().catch(function () { return null; });
      if (!b) return json({ error: 'Bad request' }, 400);

      const newM = String(b.month || '').toLowerCase();
      const newY = String(b.year || '');
      if (MONTHS.indexOf(newM) === -1) return json({ error: 'Pick a valid month' }, 400);
      if (!/^20\d{2}$/.test(newY)) return json({ error: 'Pick a valid year' }, 400);

      const parts = [['full-size image', b.jpg], ['fast web image', b.webp], ['share image', b.og]];
      for (const pair of parts) {
        const v = pair[1];
        if (!v || !v.base64) return json({ error: 'The ' + pair[0] + ' is missing. Choose the menu picture again.' }, 400);
        if (!/^[A-Za-z0-9+/=]+$/.test(v.base64)) return json({ error: 'The ' + pair[0] + ' is not valid image data' }, 400);
        if (v.base64.length > 4000000) return json({ error: 'The ' + pair[0] + ' is too large. Try a smaller picture.' }, 400);
      }
      const w = parseInt(b.w, 10), h = parseInt(b.h, 10);
      const ogW = parseInt(b.ogW, 10), ogH = parseInt(b.ogH, 10);
      if (!(w > 200 && h > 200 && ogW > 200 && ogH > 200)) return json({ error: 'The picture is too small to use as a menu' }, 400);

      // --- Which month is live right now? ---
      const curRes = await fetch('https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/menu/index.html?t=' + Date.now(),
        { headers: { 'User-Agent': 'nosh7-cms-worker' } });
      if (!curRes.ok) return json({ error: 'Could not read the menu page (' + curRes.status + ')' }, 502);
      const curMatch = (await curRes.text()).match(/nosh7-salad-meal-menu-([a-z]+)-(\d{4})-ahmedabad/);
      if (!curMatch) return json({ error: 'Could not work out which month is live on /menu/.' }, 500);
      const oldM = curMatch[1], oldY = curMatch[2];

      const base = 'nosh7-salad-meal-menu-' + newM + '-' + newY + '-ahmedabad';
      const ogName = 'nosh7-menu-og-' + newM + '-' + newY + '.jpg';
      const dims = { w: w, h: h, ogW: ogW, ogH: ogH };

      // --- Phase 1: work out every page edit BEFORE committing anything, so a
      // page that no longer matches aborts the run instead of half-applying it.
      const edits = [];
      for (const pg of MENU_PAGES) {
        const cur = await gh(env, 'GET', '/repos/' + REPO + '/contents/' + pg + '?ref=' + BRANCH);
        if (!cur.ok || !cur.data.content) return json({ error: 'Could not read ' + pg + ': ' + (cur.data.message || cur.status) }, 502);
        const orig = b64decode(cur.data.content);
        const r = rewriteMenuMonth(orig, oldM, oldY, newM, newY);
        let text = pg === 'menu/index.html' ? patchMenuDims(r.text, dims) : r.text;
        if (r.hits === 0) {
          return json({ error: 'Nothing on ' + pg + ' matched the ' + titleCase(oldM) + ' ' + oldY + ' menu, so nothing was changed. The page may have been edited by hand - ask the developer to check it.' }, 409);
        }
        if (text.indexOf('</html>') === -1 || text.length < 2000) {
          return json({ error: 'Refusing to save ' + pg + ': the result looks broken' }, 500);
        }
        edits.push({ path: pg, sha: cur.data.sha, text: text, hits: r.hits, changed: text !== orig });
      }

      const label = titleCase(newM) + ' ' + newY;

      // --- Phase 2: images first, so the pages never point at a missing file.
      const uploads = [
        { name: 'assets/' + base + '.jpg', b64: b.jpg.base64 },
        { name: 'assets/' + base + '.webp', b64: b.webp.base64 },
        { name: 'assets/' + ogName, b64: b.og.base64 }
      ];
      for (const u of uploads) {
        const put = await ghPutFile(env, u.name, u.b64, 'CMS: ' + label + ' menu artwork (' + u.name.split('/').pop() + ')');
        if (!put.ok) return json({ error: 'Upload of ' + u.name + ' failed: ' + (put.data.message || put.status) }, 502);
      }

      // --- Phase 3: the pages.
      const updated = [];
      for (const e of edits) {
        if (!e.changed) continue;
        const put = await gh(env, 'PUT', '/repos/' + REPO + '/contents/' + e.path, {
          message: 'CMS: show ' + label + ' menu on ' + e.path,
          content: b64encode(e.text), sha: e.sha, branch: BRANCH
        });
        if (!put.ok) return json({ error: 'Saving ' + e.path + ' failed: ' + (put.data.message || put.status) + '. The pictures uploaded fine - try publishing again.' }, 502);
        updated.push({ path: e.path, hits: e.hits });
      }

      // --- Phase 4: sitemap freshness (best effort).
      let sitemapOk = false;
      const sm = await gh(env, 'GET', '/repos/' + REPO + '/contents/sitemap.xml?ref=' + BRANCH);
      if (sm.ok && sm.data.content) {
        const today = new Date().toISOString().slice(0, 10);
        const res2 = bumpSitemap(b64decode(sm.data.content), MENU_URLS, today);
        if (res2.hits > 0) {
          const put = await gh(env, 'PUT', '/repos/' + REPO + '/contents/sitemap.xml', {
            message: 'CMS: sitemap lastmod for ' + label + ' menu',
            content: b64encode(res2.xml), sha: sm.data.sha, branch: BRANCH
          });
          sitemapOk = put.ok;
        }
      }

      // --- Phase 5: tell search engines + drop the CDN cache (both best effort).
      try {
        await fetch('https://api.indexnow.org/indexnow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            host: 'nosh7.in', key: INDEXNOW_KEY, keyLocation: SITE + '/' + INDEXNOW_KEY + '.txt',
            urlList: MENU_URLS.concat([SITE + '/sitemap.xml'])
          })
        });
      } catch (e) { /* non-fatal */ }

      const purge = await purgeCloudflare(env, MENU_URLS);

      return json({
        ok: true, month: newM, year: newY, label: label,
        replaced: titleCase(oldM) + ' ' + oldY,
        pages: updated, sitemap: sitemapOk, purge: purge,
        sameMonth: (oldM === newM && oldY === newY)
      });
    }

    return json({ error: 'Not found' }, 404);
  }
};

const UI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex, nofollow" />
<title>NOSH7 Site Editor</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
:root{--green:#1a3c2e;--sage:#52b788;--cream:#faf7f0;--line:#e5e0d5;--muted:#777;--red:#c0392b;}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:"IBM Plex Sans",sans-serif;background:var(--cream);color:#222;min-height:100vh;}
.top{background:var(--green);color:#fff;padding:14px 20px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:50;}
.top b{font-size:17px;}.top span{opacity:.7;font-size:12px;}
.top .right{margin-left:auto;display:flex;gap:8px;}
.wrap{max-width:760px;margin:0 auto;padding:20px 16px 110px;}
.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:14px;}
button{font-family:inherit;font-size:14px;font-weight:600;border:none;border-radius:10px;padding:10px 16px;cursor:pointer;}
.btn-g{background:var(--green);color:#fff;}.btn-s{background:var(--sage);color:#fff;}
.btn-o{background:#fff;color:var(--green);border:1.5px solid var(--line);}
.btn-r{background:#fdf0ee;color:var(--red);border:1.5px solid #f2c9c3;}
button:disabled{opacity:.5;cursor:not-allowed;}
input,textarea,select{font-family:inherit;font-size:15px;width:100%;padding:11px 12px;border:1.5px solid var(--line);border-radius:10px;background:#fff;color:#222;}
textarea{line-height:1.6;resize:vertical;overflow:hidden;}
.login{max-width:380px;margin:12vh auto 0;text-align:center;}
.login h1{color:var(--green);font-size:24px;margin-bottom:6px;}
.login p{color:var(--muted);font-size:14px;margin-bottom:20px;line-height:1.5;}
.login input{text-align:center;margin-bottom:12px;font-size:17px;}
.hero-cta{background:var(--green);color:#fff;border-radius:16px;padding:20px;margin-bottom:16px;display:flex;align-items:center;gap:16px;}
.hero-cta div{flex:1;}
.hero-cta h2{font-size:18px;margin-bottom:3px;}
.hero-cta p{font-size:13px;opacity:.85;}
.hero-cta button{background:#fff;color:var(--green);white-space:nowrap;font-size:15px;padding:12px 20px;}
.alist a{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:10px;color:var(--green);font-weight:600;text-decoration:none;font-size:15px;cursor:pointer;}
.alist a:hover{border-color:var(--sage);}
.alist a .ttl{flex:1;}
.alist a small{display:block;color:var(--muted);font-weight:400;font-size:12px;margin-top:2px;}
.alist a .go{color:var(--sage);font-size:13px;font-weight:600;}
.banner{background:#fff8e6;border:1px solid #f0dfa8;border-radius:12px;padding:12px 14px;font-size:13px;line-height:1.6;margin-bottom:14px;}
.banner code{background:#f4efe2;padding:1px 6px;border-radius:6px;font-size:12px;}
.crumb{font-size:13px;color:var(--muted);margin-bottom:14px;}
.crumb a{color:var(--sage);font-weight:600;text-decoration:none;cursor:pointer;}
.titlefield{margin-bottom:6px;}
.titlefield input{font-size:22px;font-weight:600;padding:14px;border:1.5px solid var(--line);border-radius:12px;}
.subnote{font-size:12.5px;color:var(--muted);margin:0 2px 16px;line-height:1.5;}
.cblk{background:#fff;border:1px solid var(--line);border-radius:12px;margin-bottom:12px;overflow:hidden;}
.cblk-head{display:flex;align-items:center;gap:8px;padding:7px 10px 7px 14px;background:#f7f4ec;border-bottom:1px solid var(--line);}
.cblk-tag{font-size:11px;font-weight:700;letter-spacing:.5px;color:var(--sage);text-transform:uppercase;}
.cblk-head .sp{margin-left:auto;display:flex;gap:4px;}
.cblk-head button{padding:5px 9px;font-size:12px;border-radius:8px;line-height:1;}
.cblk-body{padding:12px 14px;}
.cblk-body label{display:block;font-size:11.5px;font-weight:600;color:var(--muted);margin-bottom:5px;}
.cblk-body .hint{font-size:11.5px;color:var(--muted);margin-top:5px;line-height:1.4;}
.cblk-body img{max-width:100%;height:auto;border-radius:10px;display:block;margin-bottom:10px;}
.cblk-intro .cblk-head{background:#eef7f0;}
.cblk-intro .cblk-tag{color:var(--green);}
.cblk-locked .cblk-body{color:var(--muted);font-size:13px;}
.addrow{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:18px 0 4px;}
.addrow button{font-size:13px;padding:9px 14px;}
.adv{background:#fff;border:1px solid var(--line);border-radius:12px;margin-top:16px;padding:0;}
.adv summary{padding:14px 16px;cursor:pointer;font-weight:600;color:var(--green);font-size:14px;list-style:none;}
.adv summary::-webkit-details-marker{display:none;}
.adv[open] summary{border-bottom:1px solid var(--line);}
.adv-body{padding:14px 16px;}
.adv-body label{display:block;font-size:12px;font-weight:600;color:var(--muted);margin:12px 0 5px;}
.adv-body .grid{display:flex;gap:10px;flex-wrap:wrap;}
.adv-body .grid>div{flex:1;min-width:150px;}
.imgprev{max-width:100%;max-height:220px;border-radius:10px;display:block;margin:8px auto;}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:100;padding:16px;}
.modal{background:#fff;border-radius:16px;padding:20px;width:100%;max-width:520px;max-height:88vh;overflow:auto;}
.modal h3{color:var(--green);font-size:17px;margin-bottom:12px;}
.modal label{display:block;font-size:12px;font-weight:600;color:var(--muted);margin:12px 0 4px;}
.modal .row{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;}
.hint{font-size:11.5px;color:var(--muted);margin-top:4px;line-height:1.5;}
.toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--green);color:#fff;padding:12px 20px;border-radius:100px;font-size:13.5px;z-index:200;box-shadow:0 6px 20px rgba(0,0,0,.25);max-width:92vw;text-align:center;}
.toast.err{background:var(--red);}
.pubbar{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid var(--line);padding:12px 16px;display:flex;gap:10px;justify-content:center;align-items:center;z-index:60;}
.pubbar .btn-g{min-width:220px;}
.nav2{display:flex;gap:8px;margin-bottom:16px;}
.nav2 button{flex:1;background:#fff;color:var(--muted);border:1.5px solid var(--line);}
.nav2 button.on{background:var(--green);color:#fff;border-color:var(--green);}
.mnow{display:flex;align-items:center;gap:14px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:14px;}
.mnow img{width:62px;height:auto;border-radius:8px;border:1px solid var(--line);display:block;}
.mnow .t{font-size:12px;color:var(--muted);}
.mnow .v{font-size:17px;font-weight:700;color:var(--green);}
.mgrid{display:flex;gap:10px;flex-wrap:wrap;}
.mgrid>div{flex:1;min-width:130px;}
.drop{border:2px dashed var(--line);border-radius:14px;padding:26px 16px;text-align:center;background:#fff;cursor:pointer;transition:border-color .15s;}
.drop:hover,.drop.over{border-color:var(--sage);}
.drop .big{font-size:15px;font-weight:600;color:var(--green);margin-bottom:4px;}
.drop .sm{font-size:12.5px;color:var(--muted);}
.mprev{display:flex;gap:14px;align-items:flex-start;margin-top:14px;}
.mprev img{width:120px;height:auto;border-radius:10px;border:1px solid var(--line);display:block;}
.mprev .meta{font-size:12.5px;color:var(--muted);line-height:1.7;}
.mprev .meta b{color:#222;}
.steps{font-size:12.5px;color:var(--muted);line-height:1.9;margin-top:6px;}
.steps li{margin-left:16px;}
</style>
</head>
<body>
<div class="top"><b>NOSH7 Site Editor</b><span>nosh7.in</span><div class="right"><button class="btn-o" id="logoutBtn" style="display:none;padding:6px 12px;font-size:12px;">Log out</button></div></div>
<div class="wrap" id="app"></div>
<script>
(function(){
var app=document.getElementById("app");
var KEY=localStorage.getItem("n7cmsKey")||"";
var state={articles:[],tokenOk:true,comp:null,pending:{}};

function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function collapse(t){return String(t==null?"":t).replace(/\\s+/g," ").trim();}
function toast(msg,err){var t=document.createElement("div");t.className="toast"+(err?" err":"");t.textContent=msg;document.body.appendChild(t);setTimeout(function(){t.remove();},err?5000:3200);}
function api(p,opts){opts=opts||{};opts.headers=opts.headers||{};opts.headers["x-cms-key"]=KEY;if(opts.body){opts.headers["Content-Type"]="application/json";}return fetch(p,opts).then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||("HTTP "+r.status));return d;});});}
function slugify(s){return String(s||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,50)||"blog-post";}
function prettify(slug){return slug.replace(/^blog-/,"").replace(/-ahmedabad\\.html$/,"").replace(/\\.html$/,"").replace(/-/g," ").replace(/\\b\\w/g,function(c){return c.toUpperCase();});}
function modal(inner){var bg=document.createElement("div");bg.className="modal-bg";bg.innerHTML='<div class="modal">'+inner+"</div>";document.body.appendChild(bg);bg.addEventListener("click",function(e){if(e.target===bg)bg.remove();});return bg;}
function ag(t){t.style.height="auto";t.style.height=(t.scrollHeight+2)+"px";}
function growAll(){Array.prototype.forEach.call(app.querySelectorAll("textarea"),function(t){ag(t);});}

/* ---------- LOGIN ---------- */
function showLogin(){
  document.getElementById("logoutBtn").style.display="none";
  app.innerHTML='<div class="login card"><h1>Welcome</h1><p>Enter the password to update the monthly menu and blog posts on nosh7.in</p><input type="password" id="pc" placeholder="Password" autofocus /><button class="btn-g" id="go" style="width:100%;font-size:16px;padding:13px;">Log in</button></div>';
  var go=function(){var v=document.getElementById("pc").value;fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({passcode:v})}).then(function(r){if(r.ok){KEY=v;localStorage.setItem("n7cmsKey",v);boot();}else{toast("Wrong password",true);}});};
  document.getElementById("go").onclick=go;
  document.getElementById("pc").addEventListener("keydown",function(e){if(e.key==="Enter")go();});
}
document.getElementById("logoutBtn").onclick=function(){localStorage.removeItem("n7cmsKey");KEY="";showLogin();};

/* ---------- NAV ---------- */
function navHTML(active){
  return '<div class="nav2"><button class="'+(active==="posts"?"on":"")+'" data-nav="posts">Blog posts</button>'
       + '<button class="'+(active==="menu"?"on":"")+'" data-nav="menu">Monthly menu</button></div>';
}
function wireNav(){
  Array.prototype.forEach.call(app.querySelectorAll("[data-nav]"),function(el){
    el.onclick=function(){
      var n=el.getAttribute("data-nav");
      if(n==="posts"){location.hash="";showList();}else{location.hash="menu";showMenu();}
    };
  });
}

/* ---------- LIST ---------- */
function boot(){
  document.getElementById("logoutBtn").style.display="";
  app.innerHTML='<p style="color:#777;">Loading your posts...</p>';
  Promise.all([api("/api/articles"),api("/api/status")]).then(function(res){
    state.articles=res[0].articles;state.tokenOk=res[1].tokenConfigured;
    if(location.hash==="#menu"){showMenu();}else{showList();}
  }).catch(function(e){if(String(e.message).indexOf("Unauthorized")>-1){showLogin();}else{app.innerHTML='<div class="card">Error: '+esc(e.message)+'</div>';}});
}
function showList(){
  var pb=document.querySelector(".pubbar");if(pb)pb.remove();
  var h=navHTML("posts");
  if(!state.tokenOk){h+='<div class="banner"><b>Publishing is locked.</b> The GitHub token is not set yet, so posts cannot be saved online. One-time setup needed by the developer.</div>';}
  h+='<div class="hero-cta"><div><h2>Write a new post</h2><p>Just add a title, write, and publish. Everything else is automatic.</p></div><button id="newBtn">Start writing</button></div>';
  h+='<div class="crumb">Your posts &middot; tap any post to edit it</div><div class="alist">';
  state.articles.forEach(function(a){h+='<a data-p="'+esc(a.path)+'"><span class="ttl">'+esc(prettify(a.path))+'<small>'+esc(a.path)+'</small></span><span class="go">Edit &rarr;</span></a>';});
  h+="</div>";
  app.innerHTML=h;
  wireNav();
  document.getElementById("newBtn").onclick=newPost;
  Array.prototype.forEach.call(app.querySelectorAll(".alist a"),function(el){el.onclick=function(){openArticle(el.getAttribute("data-p"));};});
}

/* ---------- MONTHLY MENU ---------- */
var MONTH_NAMES=["January","February","March","April","May","June","July","August","September","October","November","December"];
var menuState={file:null,assets:null,busy:false};

function webpSupported(){
  var c=document.createElement("canvas");c.width=c.height=2;
  try{return c.toDataURL("image/webp").indexOf("data:image/webp")===0;}catch(e){return false;}
}

// Try each quality until the file fits the budget, then hand back base64.
function encodeCanvas(cv,type,qs,budget,cb,onerr){
  var i=0;
  (function go(){
    cv.toBlob(function(bb){
      if(!bb){onerr("Your browser could not create the "+type+" version of the picture");return;}
      if(bb.size>budget&&i<qs.length-1){i++;go();return;}
      var rd=new FileReader();
      rd.onerror=function(){onerr("Could not read the converted picture");};
      rd.onload=function(){cb({b64:String(rd.result).split(",")[1],size:bb.size,url:URL.createObjectURL(bb)});};
      rd.readAsDataURL(bb);
    },type,qs[i]);
  })();
}

// One upload becomes three files: full-size JPG, fast WebP, and a share image.
function buildMenuAssets(file,cb,onerr){
  var img=new Image();
  img.onerror=function(){onerr("That file could not be opened as a picture. Use a JPG or PNG.");};
  img.onload=function(){
    if(img.width<400||img.height<400){onerr("That picture is too small to read as a menu");return;}
    function paint(tw){
      var th=Math.round(img.height*(tw/img.width));
      var cv=document.createElement("canvas");cv.width=tw;cv.height=th;
      var cx=cv.getContext("2d");
      cx.fillStyle="#ffffff";cx.fillRect(0,0,tw,th);
      cx.drawImage(img,0,0,tw,th);
      return {cv:cv,w:tw,h:th};
    }
    var full=paint(Math.min(1400,img.width));
    var og=paint(Math.min(1200,img.width));
    encodeCanvas(full.cv,"image/jpeg",[0.85,0.78,0.7,0.62],1000*1024,function(jpg){
      encodeCanvas(full.cv,"image/webp",[0.85,0.78,0.7,0.62],550*1024,function(webp){
        encodeCanvas(og.cv,"image/jpeg",[0.7,0.62,0.55],500*1024,function(share){
          cb({w:full.w,h:full.h,ogW:og.w,ogH:og.h,jpg:jpg,webp:webp,og:share,srcW:img.width,srcH:img.height});
        },onerr);
      },onerr);
    },onerr);
  };
  img.src=URL.createObjectURL(file);
}

function showMenu(){
  var pb=document.querySelector(".pubbar");if(pb)pb.remove();
  menuState={file:null,assets:null,busy:false};
  app.innerHTML=navHTML("menu")+'<p style="color:#777;">Checking which menu is live...</p>';
  wireNav();
  api("/api/menu/state").then(renderMenu).catch(function(e){
    if(String(e.message).indexOf("Unauthorized")>-1){showLogin();return;}
    app.innerHTML=navHTML("menu")+'<div class="card">Could not load: '+esc(e.message)+'</div>';
    wireNav();
  });
}

function renderMenu(st){
  // Default to the month after whatever is live, which is what you normally upload.
  var li=MONTH_NAMES.map(function(m){return m.toLowerCase();}).indexOf(st.month);
  var ny=parseInt(st.year,10),ni=li+1;
  if(ni>11){ni=0;ny=ny+1;}
  var liveLabel=MONTH_NAMES[li>-1?li:0]+" "+st.year;

  var h=navHTML("menu");
  if(!st.tokenConfigured){h+='<div class="banner"><b>Publishing is locked.</b> The GitHub token is not set, so the menu cannot be updated. One-time setup needed by the developer.</div>';}
  h+='<div class="mnow"><img src="https://nosh7.in/assets/nosh7-salad-meal-menu-'+esc(st.month)+'-'+esc(st.year)+'-ahmedabad.webp" alt="" /><div><div class="t">Live on the website right now</div><div class="v">'+esc(liveLabel)+'</div></div></div>';

  h+='<div class="card"><label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px;">Which month is this menu for?</label><div class="mgrid"><div><select id="mm">';
  for(var i=0;i<12;i++){h+='<option value="'+MONTH_NAMES[i].toLowerCase()+'"'+(i===ni?" selected":"")+'>'+MONTH_NAMES[i]+'</option>';}
  h+='</select></div><div><select id="my">';
  for(var y=ny-1;y<=ny+2;y++){h+='<option value="'+y+'"'+(y===ny?" selected":"")+'>'+y+'</option>';}
  h+='</select></div></div></div>';

  h+='<div class="card"><div class="drop" id="drop"><div class="big">Choose the menu picture</div><div class="sm">Tap here, or drag the image in. JPG or PNG straight from Canva is fine.</div></div>';
  h+='<input type="file" id="mf" accept="image/*" style="display:none;" />';
  h+='<div id="mprev"></div></div>';

  h+='<div class="card"><div style="font-size:13px;font-weight:600;color:var(--green);margin-bottom:4px;">What Publish does</div><ol class="steps">';
  h+='<li>Saves the picture in three sizes (full, fast, social preview)</li>';
  h+='<li>Updates the menu page, the subscription page and the homepage</li>';
  h+='<li>Refreshes the titles, alt text, Google data and WhatsApp message</li>';
  h+='<li>Tells search engines the pages changed</li>';
  h+='</ol>';
  if(!st.purgeConfigured){h+='<div class="hint" style="margin-top:8px;">Note: the website is cached, so the new menu can take a few minutes to show for everyone.</div>';}
  h+='</div>';

  app.innerHTML=h;
  wireNav();

  var drop=document.getElementById("drop"),mf=document.getElementById("mf");
  drop.onclick=function(){mf.click();};
  drop.addEventListener("dragover",function(e){e.preventDefault();drop.classList.add("over");});
  drop.addEventListener("dragleave",function(){drop.classList.remove("over");});
  drop.addEventListener("drop",function(e){
    e.preventDefault();drop.classList.remove("over");
    if(e.dataTransfer.files&&e.dataTransfer.files[0])takeMenuFile(e.dataTransfer.files[0]);
  });
  mf.onchange=function(e){if(e.target.files[0])takeMenuFile(e.target.files[0]);};

  var bar=document.createElement("div");
  bar.className="pubbar";
  bar.innerHTML='<button class="btn-g" id="mpub" disabled>Publish this menu</button>';
  document.body.appendChild(bar);
  document.getElementById("mpub").onclick=publishMenu;
  if(!st.tokenConfigured)document.getElementById("mpub").disabled=true;
  menuState.tokenOk=st.tokenConfigured;
}

function takeMenuFile(f){
  if(menuState.busy)return;
  if(!webpSupported()){toast("This browser cannot prepare the fast web image. Please use Chrome, Edge or Safari.",true);return;}
  menuState.busy=true;menuState.file=f;menuState.assets=null;
  var btn=document.getElementById("mpub");if(btn)btn.disabled=true;
  document.getElementById("mprev").innerHTML='<div class="hint" style="margin-top:12px;">Preparing the picture...</div>';
  buildMenuAssets(f,function(a){
    menuState.busy=false;menuState.assets=a;
    var kb=function(n){return Math.round(n/1024)+" KB";};
    document.getElementById("mprev").innerHTML=
      '<div class="mprev"><img src="'+a.webp.url+'" alt="menu preview" /><div class="meta">'
      +'<b>'+a.srcW+' x '+a.srcH+'</b> uploaded<br />'
      +'Full size: '+a.w+' x '+a.h+', '+kb(a.jpg.size)+'<br />'
      +'Fast web version: '+kb(a.webp.size)+'<br />'
      +'Social preview: '+a.ogW+' x '+a.ogH+', '+kb(a.og.size)
      +'</div></div>';
    if(btn&&menuState.tokenOk)btn.disabled=false;
  },function(err){
    menuState.busy=false;menuState.file=null;
    document.getElementById("mprev").innerHTML="";
    toast(err,true);
  });
}

function publishMenu(){
  var btn=document.getElementById("mpub");
  var a=menuState.assets;
  if(!a){toast("Choose the menu picture first",true);return;}
  var mo=document.getElementById("mm").value,yr=document.getElementById("my").value;
  var label=mo.charAt(0).toUpperCase()+mo.slice(1)+" "+yr;
  if(!confirm("Publish this as the "+label+" menu?\\n\\nIt will replace the menu on the homepage, the menu page and the subscription page."))return;
  btn.disabled=true;btn.textContent="Publishing...";
  api("/api/menu/publish",{method:"POST",body:JSON.stringify({
    month:mo,year:yr,w:a.w,h:a.h,ogW:a.ogW,ogH:a.ogH,
    jpg:{base64:a.jpg.b64},webp:{base64:a.webp.b64},og:{base64:a.og.b64}
  })}).then(function(d){
    btn.textContent="Published";
    var msg=d.sameMonth?("Menu picture for "+d.label+" replaced"):(d.label+" menu is live, replacing "+d.replaced);
    toast(msg+". It can take a few minutes to appear.");
    setTimeout(showMenu,2600);
  }).catch(function(e){
    btn.disabled=false;btn.textContent="Publish this menu";
    toast(e.message,true);
  });
}

/* ---------- BODY PARSING ---------- */
function parseBody(html){
  var m=html.match(/(<div class="article-wrap"[^>]*>)([\\s\\S]*?)(<\\/div>\\s*<footer)/);
  if(!m)return null;
  var pre=html.slice(0,m.index)+m[1];
  var post=m[3]+html.slice(m.index+m[0].length);
  var host=document.createElement("div");host.innerHTML=m[2];
  return {pre:pre,post:post,els:Array.prototype.slice.call(host.children)};
}
function lockedLabel(el){
  var c=el.className||"";
  if(c.indexOf("cta")>-1)return "Call to action (kept)";
  if(c.indexOf("related")>-1)return "Related links (kept)";
  if(el.tagName==="TABLE")return "Table (kept)";
  if(c.indexOf("tip")>-1)return "Tip box (kept)";
  if(c.indexOf("quote")>-1)return "Quote (kept)";
  return "Extra block (kept)";
}
function mapEl(el){
  var tag=el.tagName,html=el.outerHTML;
  if(tag==="P"&&(el.className||"").indexOf("intro")>-1)return {type:"intro",text:el.textContent,html:html,edited:false};
  if(tag==="P")return {type:"p",text:el.textContent,html:html,edited:false};
  if(tag==="H2")return {type:"h2",text:el.textContent,html:html,edited:false};
  if(tag==="UL"||tag==="OL"){var items=[];Array.prototype.forEach.call(el.querySelectorAll("li"),function(li){items.push(li.textContent);});return {type:"ul",ordered:tag==="OL",items:items,html:html,edited:false};}
  if(tag==="FIGURE"||tag==="IMG"){var im=tag==="IMG"?el:el.querySelector("img");var fc=el.querySelector?el.querySelector("figcaption"):null;var src=im?(im.getAttribute("src")||""):"";return {type:"img",edited:false,html:html,img:{finalSrc:src,alt:im?(im.getAttribute("alt")||""):"",cap:fc?fc.textContent:"",w:im?im.getAttribute("width"):"",h:im?im.getAttribute("height"):"",displaySrc:src.charAt(0)==="/"?"https://nosh7.in"+src:src}};}
  return {type:"locked",label:lockedLabel(el),html:html};
}

/* ---------- NEW POST ---------- */
function newPost(){
  state.comp={isNew:true,title:"",path:null,pre:"",post:"",blocks:[
    {type:"intro",text:"",edited:true},
    {type:"p",text:"",edited:true}
  ]};
  state.pending={};
  renderComposer();
}

/* ---------- DELETE ---------- */
function deleteArticle(path){
  var bg=modal('<h3>Delete this post?</h3><p class="hint" style="font-size:13px;line-height:1.6;margin-bottom:2px;">This permanently removes <b>'+esc(path)+'</b> from nosh7.in, the blog list and the sitemap. This cannot be undone.</p><div class="row"><button class="btn-o" id="dx">Cancel</button><button class="btn-r" id="dok">Delete permanently</button></div>');
  bg.querySelector("#dx").onclick=function(){bg.remove();};
  bg.querySelector("#dok").onclick=function(){var b=bg.querySelector("#dok");b.disabled=true;b.textContent="Deleting...";api("/api/delete",{method:"POST",body:JSON.stringify({path:path})}).then(function(){bg.remove();var pb=document.querySelector(".pubbar");if(pb)pb.remove();toast("Post deleted. The blog updates in about 1-2 minutes.");boot();}).catch(function(e){b.disabled=false;b.textContent="Delete permanently";toast(e.message,true);});};
}

/* ---------- EDIT EXISTING ---------- */
function openArticle(p){
  app.innerHTML='<p style="color:#777;">Loading '+esc(p)+'...</p>';
  api("/api/article?path="+encodeURIComponent(p)).then(function(d){
    var parsed=parseBody(d.html);
    if(!parsed){toast("Could not read this post's content",true);showList();return;}
    state.comp={isNew:false,title:"",path:p,pre:parsed.pre,post:parsed.post,blocks:parsed.els.map(mapEl)};
    state.pending={};
    renderComposer();
  }).catch(function(e){toast(e.message,true);showList();});
}

/* ---------- COMPOSER ---------- */
function renderComposer(){
  var c=state.comp;
  var h='<div class="crumb"><a id="backBtn">&larr; Back to posts</a>'+(c.path?' &nbsp;/&nbsp; <a href="https://nosh7.in/'+esc(c.path)+'" target="_blank">view live &nearr;</a> &nbsp;&middot;&nbsp; <a id="delBtn" style="color:var(--red);">Delete post</a>':'')+'</div>';
  if(!state.tokenOk){h+='<div class="banner"><b>Publishing locked</b> until the GitHub token is set by the developer. You can write, but Publish will fail.</div>';}
  if(c.isNew){
    h+='<div class="titlefield"><input id="ct-title" placeholder="Post title (e.g. Best Foods for Better Sleep)" value="'+esc(c.title)+'" /></div>';
    h+='<p class="subnote">This becomes your headline and page address. The web address, SEO title and description are created for you automatically.</p>';
  }else{
    h+='<p class="subnote" style="margin-top:0;">Editing this post. Change any text below, or add paragraphs, headings, lists and photos. The title and settings stay the same.</p>';
  }
  c.blocks.forEach(function(b,i){h+=blockCard(b,i,c.blocks.length);});
  h+='<div class="addrow"><button class="btn-o" data-add="p">+ Paragraph</button><button class="btn-o" data-add="h2">+ Heading</button><button class="btn-o" data-add="ul">+ Bullet list</button><button class="btn-o" data-add="img">+ Photo</button></div>';
  if(c.isNew){
    h+='<details class="adv"><summary>Advanced options (optional)</summary><div class="adv-body">'+
      '<p class="hint">These are filled in automatically. Only change them if you want to.</p>'+
      '<label>SEO / browser title</label><input id="adv-st" placeholder="Auto from your title" />'+
      '<label>Search description (meta)</label><textarea id="adv-md" placeholder="Auto from your intro" style="min-height:60px;"></textarea>'+
      '<div class="grid">'+
      '<div><label>Card tag</label><input id="adv-tag" placeholder="Healthy Eating" /></div>'+
      '<div><label>Read time (min)</label><input id="adv-mins" type="number" min="3" max="15" placeholder="auto" /></div>'+
      '</div><div class="grid">'+
      '<div><label>Category</label><select id="adv-cat"><option value="lifestyle">Lifestyle &amp; Guides</option><option value="conditions">Health Conditions</option><option value="weightloss">Weight Loss</option><option value="protein">High Protein</option><option value="value">Value &amp; Cost</option></select></div>'+
      '<div><label>Colour theme</label><select id="adv-acc"><option value="green">Green</option><option value="orange">Orange</option><option value="teal">Teal</option><option value="pink">Pink</option></select></div>'+
      '<div><label>CTA plan</label><select id="adv-tr"><option value="healthy-fresh">Healthy Fresh</option><option value="weight-loss">Weight Loss</option><option value="low-sugar">Low Sugar</option><option value="high-protein">High Protein</option><option value="fruit-pack">Fruit Pack</option></select></div>'+
      '</div></div></details>';
  }
  app.innerHTML=h;

  var old=document.querySelector(".pubbar");if(old)old.remove();
  var bar=document.createElement("div");bar.className="pubbar";
  bar.innerHTML='<button class="btn-g" id="pubBtn">'+(c.isNew?"Publish post":"Save changes")+'</button>';
  document.body.appendChild(bar);
  document.getElementById("pubBtn").onclick=publishComposer;

  document.getElementById("backBtn").onclick=function(){if(!confirm("Leave without publishing? Unsaved changes will be lost."))return;var pb=document.querySelector(".pubbar");if(pb)pb.remove();showList();};
  var delb=document.getElementById("delBtn");if(delb)delb.onclick=function(){deleteArticle(c.path);};

  var tt=document.getElementById("ct-title");if(tt)tt.addEventListener("input",function(){state.comp.title=tt.value;});

  Array.prototype.forEach.call(app.querySelectorAll("[data-tx]"),function(el){el.addEventListener("input",function(){var i=+el.getAttribute("data-tx");state.comp.blocks[i].text=el.value;state.comp.blocks[i].edited=true;if(el.tagName==="TEXTAREA")ag(el);});});
  Array.prototype.forEach.call(app.querySelectorAll("[data-ul]"),function(el){el.addEventListener("input",function(){var i=+el.getAttribute("data-ul");state.comp.blocks[i].items=el.value.split("\\n");state.comp.blocks[i].edited=true;ag(el);});});
  Array.prototype.forEach.call(app.querySelectorAll("[data-alt]"),function(el){el.addEventListener("input",function(){var i=+el.getAttribute("data-alt");state.comp.blocks[i].img.alt=el.value;state.comp.blocks[i].edited=true;});});
  Array.prototype.forEach.call(app.querySelectorAll("[data-cap]"),function(el){el.addEventListener("input",function(){var i=+el.getAttribute("data-cap");state.comp.blocks[i].img.cap=el.value;state.comp.blocks[i].edited=true;});});
  Array.prototype.forEach.call(app.querySelectorAll("[data-rep]"),function(el){el.onclick=function(){var i=+el.getAttribute("data-rep");pickPhoto(function(im){state.comp.blocks[i].img=im;state.comp.blocks[i].edited=true;renderComposer();});};});
  Array.prototype.forEach.call(app.querySelectorAll("[data-del]"),function(el){el.onclick=function(){var i=+el.getAttribute("data-del");if(confirm("Remove this block?")){state.comp.blocks.splice(i,1);renderComposer();}};});
  Array.prototype.forEach.call(app.querySelectorAll("[data-up]"),function(el){el.onclick=function(){var i=+el.getAttribute("data-up");if(i>0){var b=state.comp.blocks.splice(i,1)[0];state.comp.blocks.splice(i-1,0,b);renderComposer();}};});
  Array.prototype.forEach.call(app.querySelectorAll("[data-dn]"),function(el){el.onclick=function(){var i=+el.getAttribute("data-dn");if(i<state.comp.blocks.length-1){var b=state.comp.blocks.splice(i,1)[0];state.comp.blocks.splice(i+1,0,b);renderComposer();}};});
  Array.prototype.forEach.call(app.querySelectorAll("[data-add]"),function(el){el.onclick=function(){addBlock(el.getAttribute("data-add"));};});
  growAll();
}

function blockCard(b,i,n){
  var name={intro:"Intro",p:"Paragraph",h2:"Heading",ul:"Bullet list",img:"Photo",locked:(b.label||"Kept block")}[b.type]||"Block";
  var ctrls='<span class="sp">'+
    (i>0?'<button class="btn-o" data-up="'+i+'" title="Move up">&uarr;</button>':'')+
    (i<n-1?'<button class="btn-o" data-dn="'+i+'" title="Move down">&darr;</button>':'')+
    '<button class="btn-r" data-del="'+i+'">Delete</button></span>';
  var body="";
  if(b.type==="intro"){body='<label>Short intro shown at the top of the post</label><textarea data-tx="'+i+'" placeholder="One or two sentences that sum up the post.">'+esc(b.text)+'</textarea>';}
  else if(b.type==="p"){body='<textarea data-tx="'+i+'" placeholder="Write your paragraph here.">'+esc(b.text)+'</textarea>';}
  else if(b.type==="h2"){body='<input data-tx="'+i+'" placeholder="Section heading" value="'+esc(b.text)+'" />';}
  else if(b.type==="ul"){body='<textarea data-ul="'+i+'" placeholder="One point per line">'+esc((b.items||[]).join("\\n"))+'</textarea><p class="hint">Write one bullet point per line.</p>';}
  else if(b.type==="img"){body='<img src="'+esc(b.img.displaySrc||b.img.finalSrc)+'" alt="" /><label>Describe the photo (alt text, good for SEO)</label><input data-alt="'+i+'" value="'+esc(b.img.alt)+'" /><label>Caption (optional)</label><input data-cap="'+i+'" value="'+esc(b.img.cap)+'" /><div style="margin-top:8px;"><button class="btn-o" data-rep="'+i+'">Replace photo</button></div>';}
  else {body='This part of the post is kept exactly as it is.';}
  return '<div class="cblk cblk-'+b.type+'"><div class="cblk-head"><span class="cblk-tag">'+name+'</span>'+ctrls+'</div><div class="cblk-body">'+body+'</div></div>';
}

function addBlock(type){
  if(type==="img"){pickPhoto(function(im){state.comp.blocks.push({type:"img",img:im,edited:true});renderComposer();});return;}
  if(type==="p")state.comp.blocks.push({type:"p",text:"",edited:true});
  if(type==="h2")state.comp.blocks.push({type:"h2",text:"",edited:true});
  if(type==="ul")state.comp.blocks.push({type:"ul",items:[""],ordered:false,edited:true});
  renderComposer();
}

/* ---------- PHOTO ---------- */
function processImageFile(file,cb){
  var img=new Image();
  img.onload=function(){
    var scale=Math.min(1,1200/img.width);
    var w=Math.round(img.width*scale),hgt=Math.round(img.height*scale);
    var cv=document.createElement("canvas");cv.width=w;cv.height=hgt;
    cv.getContext("2d").drawImage(img,0,0,w,hgt);
    var qs=[0.82,0.72,0.6,0.5,0.4],qi=0;
    (function tryQ(){
      cv.toBlob(function(bb){
        if(!bb){toast("Image conversion failed",true);return;}
        if(bb.size>200*1024&&qi<qs.length-1){qi++;tryQ();return;}
        var rd=new FileReader();
        rd.onload=function(){cb({b64:String(rd.result).split(",")[1],w:w,h:hgt,objurl:URL.createObjectURL(bb),size:bb.size});};
        rd.readAsDataURL(bb);
      },"image/webp",qs[qi]);
    })();
  };
  img.src=URL.createObjectURL(file);
}
function pickPhoto(cb){
  var bg=modal('<h3>Add a photo</h3><input type="file" id="pf" accept="image/*" /><img class="imgprev" id="pp" style="display:none;" /><div id="psz" class="hint"></div><label>Describe the photo (required)</label><input id="pa" placeholder="e.g. fresh protein salad bowl Ahmedabad" /><label>Caption (optional, shows under the photo)</label><input id="pcap" /><div class="row"><button class="btn-o" id="px">Cancel</button><button class="btn-g" id="pi" disabled>Add photo</button></div>');
  var data=null;
  bg.querySelector("#px").onclick=function(){bg.remove();};
  bg.querySelector("#pf").onchange=function(e){var f=e.target.files[0];if(!f)return;processImageFile(f,function(d){data=d;var pp=bg.querySelector("#pp");pp.src=d.objurl;pp.style.display="";bg.querySelector("#psz").textContent=d.w+"x"+d.h+" WebP, "+Math.round(d.size/1024)+" KB"+(d.size>200*1024?" (a bit large, a smaller photo loads faster)":"");bg.querySelector("#pi").disabled=false;});};
  bg.querySelector("#pi").onclick=function(){var alt=bg.querySelector("#pa").value.trim();if(!alt){toast("Please describe the photo",true);return;}if(!data){toast("Choose a photo first",true);return;}var cap=bg.querySelector("#pcap").value.trim();var nm="n7-"+slugify(alt)+"-"+Date.now().toString(36)+".webp";state.pending[nm]=data.b64;bg.remove();cb({name:nm,alt:alt,cap:cap,w:data.w,h:data.h,finalSrc:"/assets/blog/"+nm,displaySrc:data.objurl});};
}

/* ---------- SERIALIZE + PUBLISH ---------- */
function imgHTML(b){
  var wh=(b.img.w?' width="'+b.img.w+'"':'')+(b.img.h?' height="'+b.img.h+'"':'');
  var im='<img src="'+b.img.finalSrc+'" alt="'+esc(b.img.alt||"")+'"'+wh+' loading="lazy" decoding="async" style="max-width:100%;height:auto;border-radius:14px;" />';
  var cap=b.img.cap?'<figcaption style="font-size:.85rem;color:#777;margin-top:.55rem;">'+esc(b.img.cap)+'</figcaption>':'';
  return '<figure style="margin:2rem 0;text-align:center;">'+im+cap+'</figure>';
}
function blockHTML(b){
  if(b.type==="intro"){var t=collapse(b.text);return t?'<p class="intro">'+esc(t)+'</p>':'';}
  if(b.type==="p"){if(!b.edited)return b.html;var t=collapse(b.text);return t?'<p>'+esc(t)+'</p>':'';}
  if(b.type==="h2"){if(!b.edited)return b.html;var t=collapse(b.text);return t?'<h2>'+esc(t)+'</h2>':'';}
  if(b.type==="ul"){if(!b.edited)return b.html;var items=(b.items||[]).map(function(x){return collapse(x);}).filter(Boolean);if(!items.length)return '';var tag=b.ordered?"ol":"ul";return '<'+tag+'>\\n'+items.map(function(x){return '  <li>'+esc(x)+'</li>';}).join("\\n")+'\\n</'+tag+'>';}
  if(b.type==="img"){return b.edited?imgHTML(b):b.html;}
  return b.html;
}
function computeFields(){
  var c=state.comp;var title=collapse(c.title);var introText="",words=0;
  c.blocks.forEach(function(b){
    if((b.type==="intro"||b.type==="p")&&b.text){var t=collapse(b.text);if(!introText&&t)introText=t;words+=t.split(/\\s+/).filter(Boolean).length;}
    if(b.type==="h2"&&b.text)words+=collapse(b.text).split(/\\s+/).filter(Boolean).length;
    if(b.type==="ul"&&b.items)b.items.forEach(function(x){words+=collapse(x).split(/\\s+/).filter(Boolean).length;});
  });
  if(!introText)introText=title;
  if(introText.length>800)introText=introText.slice(0,797)+"...";
  var mins=Math.min(15,Math.max(3,Math.round(words/200)||3));
  var core=slugify(title);if(core.length<3)core=core+"-post";if(core.length>60)core=core.slice(0,60).replace(/-+$/,"");
  var slug="blog-"+core+"-ahmedabad.html";
  var suffix=" | NOSH7",st=title;if((st+suffix).length>70)st=st.slice(0,70-suffix.length).replace(/\\s+\\S*$/,"").trim();var seoTitle=st+suffix;
  var md=introText;if(md.length>175)md=md.slice(0,172).replace(/\\s+\\S*$/,"").trim()+"...";
  var cd=introText;if(cd.length>200)cd=cd.slice(0,197).replace(/\\s+\\S*$/,"").trim()+"...";
  var g=function(id){var e=document.getElementById(id);return e?e.value.trim():"";};
  var tag=g("adv-tag")||"Healthy Eating";
  var cat=g("adv-cat")||"lifestyle";
  var acc=g("adv-acc")||"green";
  var tr=g("adv-tr")||"healthy-fresh";
  var am=g("adv-mins");if(am)mins=Math.min(15,Math.max(3,parseInt(am,10)||mins));
  var ast=g("adv-st");if(ast)seoTitle=ast.slice(0,70);
  var amd=g("adv-md");if(amd)md=amd.slice(0,175);
  return {h1:title,slug:slug,seoTitle:seoTitle,metaDesc:md,tag:tag.slice(0,30),cardDesc:cd,intro:introText,cat:cat,accent:acc,track:tr,mins:String(mins)};
}
function doPublish(path,btn){
  var parts=[];state.comp.blocks.forEach(function(b){var s=blockHTML(b);if(s)parts.push(s);});
  var html=state.comp.pre+"\\n\\n  "+parts.join("\\n\\n  ")+"\\n\\n"+state.comp.post;
  var today=new Date().toISOString().slice(0,10);
  html=html.replace(/"dateModified":\\s*"[^"]*"/,'"dateModified": "'+today+'"');
  var used={};state.comp.blocks.forEach(function(b){if(b.type==="img"&&b.img&&b.img.finalSrc){var n=b.img.finalSrc.split("/").pop();if(state.pending[n])used[n]=1;}});
  var images=Object.keys(used).map(function(n){return {name:n,base64:state.pending[n]};});
  return api("/api/publish",{method:"POST",body:JSON.stringify({path:path,html:html,images:images})}).then(function(){
    toast("Published! Your post is live in about 1-2 minutes.");
    var pb=document.querySelector(".pubbar");if(pb)pb.remove();
    boot();
  });
}
function publishComposer(){
  var btn=document.getElementById("pubBtn");
  var reset=function(t){btn.disabled=false;btn.textContent=t;};
  if(state.comp.isNew){
    var title=collapse(state.comp.title);
    if(!title){toast("Please add a title",true);return;}
    if(title.length>140){toast("Title is too long (max 140 characters)",true);return;}
    var fields=computeFields();
    if(!fields.intro||fields.intro===title){/* intro allowed to equal title as fallback */}
    if(!collapse(fields.intro)){toast("Please write a short intro or a paragraph",true);return;}
    btn.disabled=true;btn.textContent="Publishing...";
    api("/api/create",{method:"POST",body:JSON.stringify(fields)}).then(function(d){
      return api("/api/article?path="+encodeURIComponent(d.slug)).then(function(a){
        var parsed=parseBody(a.html);
        if(!parsed)throw new Error("Post created but its layout could not be read");
        state.comp.pre=parsed.pre;state.comp.post=parsed.post;state.comp.path=d.slug;state.comp.isNew=false;
        parsed.els.forEach(function(el){var c=el.className||"";if(c.indexOf("cta")>-1)state.comp.blocks.push({type:"locked",label:"Call to action (kept)",html:el.outerHTML});else if(c.indexOf("related")>-1)state.comp.blocks.push({type:"locked",label:"Related links (kept)",html:el.outerHTML});});
        return doPublish(d.slug,btn);
      });
    }).catch(function(e){reset("Publish post");toast(e.message,true);});
  }else{
    btn.disabled=true;btn.textContent="Saving...";
    doPublish(state.comp.path,btn).catch(function(e){reset("Save changes");toast(e.message,true);});
  }
}

if(KEY){boot();}else{showLogin();}
})();
</script>
</body>
</html>`;
