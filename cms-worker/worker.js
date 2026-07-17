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

    return json({ error: 'Not found' }, 404);
  }
};

const UI_HTML = '<!DOCTYPE html>\n' +
'<html lang="en">\n<head>\n' +
'<meta charset="UTF-8" />\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' +
'<meta name="robots" content="noindex, nofollow" />\n' +
'<title>NOSH7 Blog CMS</title>\n' +
'<link rel="preconnect" href="https://fonts.googleapis.com" />\n' +
'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n' +
'<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />\n' +
'<style>\n' +
':root{--green:#1a3c2e;--sage:#52b788;--cream:#faf7f0;--line:#e5e0d5;--muted:#777;--red:#c0392b;}\n' +
'*{box-sizing:border-box;margin:0;padding:0;}\n' +
'body{font-family:"IBM Plex Sans",sans-serif;background:var(--cream);color:#222;min-height:100vh;}\n' +
'.top{background:var(--green);color:#fff;padding:14px 20px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:50;}\n' +
'.top b{font-size:17px;}.top span{opacity:.7;font-size:12px;}\n' +
'.top .right{margin-left:auto;display:flex;gap:8px;}\n' +
'.wrap{max-width:860px;margin:0 auto;padding:20px 16px 80px;}\n' +
'.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:14px;}\n' +
'button{font-family:inherit;font-size:14px;font-weight:600;border:none;border-radius:10px;padding:10px 16px;cursor:pointer;}\n' +
'.btn-g{background:var(--green);color:#fff;}.btn-s{background:var(--sage);color:#fff;}\n' +
'.btn-o{background:#fff;color:var(--green);border:1.5px solid var(--line);}\n' +
'.btn-r{background:#fdf0ee;color:var(--red);border:1.5px solid #f2c9c3;}\n' +
'button:disabled{opacity:.5;cursor:not-allowed;}\n' +
'input,textarea{font-family:inherit;font-size:15px;width:100%;padding:11px 12px;border:1.5px solid var(--line);border-radius:10px;background:#fff;}\n' +
'textarea{min-height:140px;font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.5;}\n' +
'.login{max-width:360px;margin:14vh auto 0;text-align:center;}\n' +
'.login h1{color:var(--green);font-size:22px;margin-bottom:6px;}\n' +
'.login p{color:var(--muted);font-size:13px;margin-bottom:18px;}\n' +
'.login input{text-align:center;margin-bottom:10px;}\n' +
'.alist a{display:block;background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:10px;color:var(--green);font-weight:600;text-decoration:none;font-size:15px;}\n' +
'.alist a small{display:block;color:var(--muted);font-weight:400;font-size:12px;margin-top:2px;}\n' +
'.banner{background:#fff8e6;border:1px solid #f0dfa8;border-radius:12px;padding:12px 14px;font-size:13px;line-height:1.6;margin-bottom:14px;}\n' +
'.banner code{background:#f4efe2;padding:1px 6px;border-radius:6px;font-size:12px;}\n' +
'.blk{background:#fff;border:1px solid var(--line);border-radius:12px;margin-bottom:10px;overflow:hidden;}\n' +
'.blk-head{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f7f4ec;border-bottom:1px solid var(--line);}\n' +
'.blk-tag{font-size:11px;font-weight:700;letter-spacing:.5px;color:var(--sage);text-transform:uppercase;}\n' +
'.blk-head .sp{margin-left:auto;display:flex;gap:4px;}\n' +
'.blk-head button{padding:4px 9px;font-size:12px;border-radius:8px;}\n' +
'.blk-body{padding:12px 14px;font-size:14px;line-height:1.65;overflow-x:auto;}\n' +
'.blk-body h2{color:var(--green);font-size:19px;}\n' +
'.blk-body img{max-width:100%;height:auto;border-radius:10px;}\n' +
'.blk-body table{border-collapse:collapse;font-size:12px;}.blk-body td,.blk-body th{border:1px solid var(--line);padding:4px 8px;}\n' +
'.addbar{text-align:center;margin:2px 0 12px;}\n' +
'.addbar button{font-size:12px;padding:6px 12px;}\n' +
'.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:100;padding:16px;}\n' +
'.modal{background:#fff;border-radius:16px;padding:20px;width:100%;max-width:560px;max-height:88vh;overflow:auto;}\n' +
'.modal h3{color:var(--green);font-size:17px;margin-bottom:12px;}\n' +
'.modal label{display:block;font-size:12px;font-weight:600;color:var(--muted);margin:12px 0 4px;}\n' +
'.modal .row{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;}\n' +
'.imgprev{max-width:100%;max-height:220px;border-radius:10px;display:block;margin:8px auto;}\n' +
'.hint{font-size:11.5px;color:var(--muted);margin-top:4px;line-height:1.5;}\n' +
'.toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:var(--green);color:#fff;padding:11px 20px;border-radius:100px;font-size:13.5px;z-index:200;box-shadow:0 6px 20px rgba(0,0,0,.25);max-width:92vw;}\n' +
'.toast.err{background:var(--red);}\n' +
'.pubbar{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid var(--line);padding:10px 16px;display:flex;gap:10px;justify-content:center;z-index:60;}\n' +
'.crumb{font-size:13px;color:var(--muted);margin-bottom:12px;}\n' +
'.crumb a{color:var(--sage);font-weight:600;text-decoration:none;cursor:pointer;}\n' +
'</style>\n</head>\n<body>\n' +
'<div class="top"><b>NOSH7 Blog CMS</b><span>nosh7.in</span><div class="right"><button class="btn-o" id="logoutBtn" style="display:none;padding:6px 12px;font-size:12px;">Logout</button></div></div>\n' +
'<div class="wrap" id="app"></div>\n' +
'<script>\n' +
'(function(){\n' +
'var app=document.getElementById("app");\n' +
'var KEY=sessionStorage.getItem("n7cmsKey")||"";\n' +
'var state={articles:[],path:null,raw:"",pre:"",post:"",blocks:[],pending:{},tokenOk:true,dirty:false};\n' +
'function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}\n' +
'function toast(msg,err){var t=document.createElement("div");t.className="toast"+(err?" err":"");t.textContent=msg;document.body.appendChild(t);setTimeout(function(){t.remove();},err?5000:3000);}\n' +
'function api(p,opts){opts=opts||{};opts.headers=opts.headers||{};opts.headers["x-cms-key"]=KEY;if(opts.body){opts.headers["Content-Type"]="application/json";}return fetch(p,opts).then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||("HTTP "+r.status));return d;});});}\n' +
'function prettify(slug){return slug.replace(/^blog-/,"").replace(/-ahmedabad\\.html$/,"").replace(/\\.html$/,"").replace(/-/g," ").replace(/\\b\\w/g,function(c){return c.toUpperCase();});}\n' +
'\n' +
'/* ---------- LOGIN ---------- */\n' +
'function showLogin(){\n' +
'  document.getElementById("logoutBtn").style.display="none";\n' +
'  app.innerHTML=\'<div class="login card"><h1>Blog C-Panel</h1><p>Enter the admin passcode to edit nosh7.in articles.</p><input type="password" id="pc" placeholder="Passcode" autofocus /><button class="btn-g" id="go" style="width:100%;">Open Panel</button></div>\';\n' +
'  var go=function(){var v=document.getElementById("pc").value;fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({passcode:v})}).then(function(r){if(r.ok){KEY=v;sessionStorage.setItem("n7cmsKey",v);boot();}else{toast("Wrong passcode",true);}});};\n' +
'  document.getElementById("go").onclick=go;\n' +
'  document.getElementById("pc").addEventListener("keydown",function(e){if(e.key==="Enter")go();});\n' +
'}\n' +
'document.getElementById("logoutBtn").onclick=function(){sessionStorage.removeItem("n7cmsKey");KEY="";showLogin();};\n' +
'\n' +
'/* ---------- ARTICLE LIST ---------- */\n' +
'function boot(){\n' +
'  document.getElementById("logoutBtn").style.display="";\n' +
'  app.innerHTML="<p style=\\"color:#777;\\">Loading articles...</p>";\n' +
'  Promise.all([api("/api/articles"),api("/api/status")]).then(function(res){\n' +
'    state.articles=res[0].articles;state.tokenOk=res[1].tokenConfigured;showList();\n' +
'  }).catch(function(e){if(String(e.message).indexOf("Unauthorized")>-1){showLogin();}else{app.innerHTML="<div class=\\"card\\">Error: "+esc(e.message)+"</div>";}});\n' +
'}\n' +
'function showList(){\n' +
'  var h="";\n' +
'  if(!state.tokenOk){h+=\'<div class="banner"><b>Publishing is locked.</b> The GitHub token is not configured yet. You can browse and prepare edits, but Publish will fail. One-time setup: create a fine-grained GitHub token for <code>hii2023/nosh7-in</code> (Contents: read &amp; write) and run <code>npx wrangler secret put GITHUB_TOKEN</code> in the cms-worker folder.</div>\';}\n' +
'  h+=\'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;"><span class="crumb" style="margin:0;">\'+state.articles.length+\' articles &middot; tap one to edit</span><button class="btn-g" id="newArt">+ New Article</button></div><div class="alist">\';\n' +
'  state.articles.forEach(function(a){h+=\'<a data-p="\'+esc(a.path)+\'">\'+esc(prettify(a.path))+\'<small>\'+esc(a.path)+\'</small></a>\';});\n' +
'  h+="</div>";\n' +
'  app.innerHTML=h;\n' +
'  document.getElementById("newArt").onclick=newArticle;\n' +
'  Array.prototype.forEach.call(app.querySelectorAll(".alist a"),function(el){el.onclick=function(){openArticle(el.getAttribute("data-p"));};});\n' +
'}\n' +
'\n' +
'/* ---------- NEW ARTICLE ---------- */\n' +
'function counterHint(el,min,max,out){var f=function(){var n=el.value.trim().length;out.textContent=n+" chars (aim "+min+"-"+max+")";out.style.color=(n>=min&&n<=max)?"#2d6a4f":"#c0392b";};el.addEventListener("input",f);f();}\n' +
'function newArticle(){\n' +
'  var bg=modal(\'<h3>New Article</h3>\'+\n' +
'    \'<label>Article heading (H1)</label><input id="na-h1" placeholder="e.g. Best Foods for Better Sleep" />\'+\n' +
'    \'<label>File name</label><input id="na-slug" /><p class="hint">Auto-generated from the heading. This becomes the page URL.</p>\'+\n' +
'    \'<label>Browser/SEO title <span id="na-stc" style="font-weight:400;"></span></label><input id="na-st" placeholder="ends with | NOSH7" />\'+\n' +
'    \'<label>Meta description <span id="na-mdc" style="font-weight:400;"></span></label><textarea id="na-md" style="min-height:70px;font-family:inherit;font-size:14px;"></textarea>\'+\n' +
'    \'<label>Card tag (short category label)</label><input id="na-tag" placeholder="e.g. Sleep &amp; Recovery" />\'+\n' +
'    \'<label>Card description (1-2 lines for the blog listing)</label><input id="na-cd" />\'+\n' +
'    \'<label>Intro paragraph (first paragraph of the article)</label><textarea id="na-in" style="min-height:90px;font-family:inherit;font-size:14px;"></textarea>\'+\n' +
'    \'<div style="display:flex;gap:8px;flex-wrap:wrap;">\'+\n' +
'    \'<div style="flex:1;min-width:130px;"><label>Filter category</label><select id="na-cat" style="width:100%;padding:10px;border:1.5px solid var(--line);border-radius:10px;font-family:inherit;"><option value="lifestyle">Lifestyle &amp; Guides</option><option value="conditions">Health Conditions</option><option value="weightloss">Weight Loss</option><option value="protein">High Protein</option><option value="value">Value &amp; Cost</option></select></div>\'+\n' +
'    \'<div style="flex:1;min-width:130px;"><label>Colour theme</label><select id="na-acc" style="width:100%;padding:10px;border:1.5px solid var(--line);border-radius:10px;font-family:inherit;"><option value="green">Green</option><option value="orange">Orange</option><option value="teal">Teal</option><option value="pink">Pink</option></select></div>\'+\n' +
'    \'<div style="flex:1;min-width:130px;"><label>CTA plan</label><select id="na-tr" style="width:100%;padding:10px;border:1.5px solid var(--line);border-radius:10px;font-family:inherit;"><option value="healthy-fresh">Healthy Fresh</option><option value="weight-loss">Weight Loss</option><option value="low-sugar">Low Sugar</option><option value="high-protein">High Protein</option><option value="fruit-pack">Fruit Pack</option></select></div>\'+\n' +
'    \'<div style="flex:1;min-width:130px;"><label>Read time (min)</label><input id="na-mins" type="number" value="6" min="3" max="15" /></div>\'+\n' +
'    \'</div>\'+\n' +
'    \'<div class="row"><button class="btn-o" id="cxl">Cancel</button><button class="btn-g" id="crt">Create Article</button></div>\');\n' +
'  var slugTouched=false;\n' +
'  bg.querySelector("#na-slug").addEventListener("input",function(){slugTouched=true;});\n' +
'  bg.querySelector("#na-h1").addEventListener("input",function(){if(!slugTouched){bg.querySelector("#na-slug").value="blog-"+slugify(bg.querySelector("#na-h1").value)+"-ahmedabad.html";}});\n' +
'  counterHint(bg.querySelector("#na-st"),55,60,bg.querySelector("#na-stc"));\n' +
'  counterHint(bg.querySelector("#na-md"),150,160,bg.querySelector("#na-mdc"));\n' +
'  bg.querySelector("#cxl").onclick=function(){bg.remove();};\n' +
'  bg.querySelector("#crt").onclick=function(){\n' +
'    var body={h1:bg.querySelector("#na-h1").value,slug:bg.querySelector("#na-slug").value.trim(),seoTitle:bg.querySelector("#na-st").value,metaDesc:bg.querySelector("#na-md").value,tag:bg.querySelector("#na-tag").value,cardDesc:bg.querySelector("#na-cd").value,intro:bg.querySelector("#na-in").value,cat:bg.querySelector("#na-cat").value,accent:bg.querySelector("#na-acc").value,track:bg.querySelector("#na-tr").value,mins:bg.querySelector("#na-mins").value};\n' +
'    var btn=bg.querySelector("#crt");btn.disabled=true;btn.textContent="Creating...";\n' +
'    api("/api/create",{method:"POST",body:JSON.stringify(body)}).then(function(d){\n' +
'      bg.remove();toast("Article created. Site rebuilds in ~1-2 min. Now add your content and Publish.");\n' +
'      openArticle(d.slug);\n' +
'    }).catch(function(e){btn.disabled=false;btn.textContent="Create Article";toast(e.message,true);});\n' +
'  };\n' +
'}\n' +
'\n' +
'/* ---------- EDITOR ---------- */\n' +
'function openArticle(p){\n' +
'  app.innerHTML="<p style=\\"color:#777;\\">Loading "+esc(p)+"...</p>";\n' +
'  api("/api/article?path="+encodeURIComponent(p)).then(function(d){\n' +
'    var raw=d.html;\n' +
'    var m=raw.match(/(<div class="article-wrap"[^>]*>)([\\s\\S]*?)(<\\/div>\\s*<footer)/);\n' +
'    if(!m){toast("Could not find the article body in this page",true);showList();return;}\n' +
'    state.path=p;state.raw=raw;state.pending={};state.dirty=false;\n' +
'    state.pre=raw.slice(0,m.index)+m[1];\n' +
'    state.post=m[3]+raw.slice(m.index+m[0].length);\n' +
'    var host=document.createElement("div");host.innerHTML=m[2];\n' +
'    state.blocks=Array.prototype.slice.call(host.children);\n' +
'    renderEditor();\n' +
'  }).catch(function(e){toast(e.message,true);});\n' +
'}\n' +
'function tagLabel(el){\n' +
'  if(el.tagName==="H2")return "Heading";\n' +
'  if(el.tagName==="P")return el.className==="intro"?"Intro":"Paragraph";\n' +
'  if(el.tagName==="UL"||el.tagName==="OL")return "List";\n' +
'  if(el.tagName==="TABLE")return "Table";\n' +
'  if(el.tagName==="FIGURE")return "Image";\n' +
'  if(el.tagName==="DIV"){if(el.className.indexOf("cta")>-1)return "CTA";if(el.className.indexOf("related")>-1)return "Related";if(el.className.indexOf("tip")>-1)return "Tip Box";if(el.className.indexOf("pull-quote")>-1)return "Quote";return "Block";}\n' +
'  return el.tagName;\n' +
'}\n' +
'function previewHTML(el){\n' +
'  var c=el.cloneNode(true);\n' +
'  Array.prototype.forEach.call(c.querySelectorAll?c.querySelectorAll("img"):[],function(im){\n' +
'    var src=im.getAttribute("src")||"";var name=src.split("/").pop();\n' +
'    if(state.pending[name]){im.src=state.pending[name].url;}\n' +
'    else if(src.charAt(0)==="/"){im.src="https://nosh7.in"+src;}\n' +
'  });\n' +
'  return c.outerHTML;\n' +
'}\n' +
'function renderEditor(){\n' +
'  var h=\'<div class="crumb"><a id="backBtn">&larr; All articles</a> &nbsp;/&nbsp; \'+esc(state.path)+\' &nbsp;&middot;&nbsp; <a href="https://nosh7.in/\'+esc(state.path)+\'" target="_blank">view live &nearr;</a></div>\';\n' +
'  if(!state.tokenOk){h+=\'<div class="banner"><b>Publishing locked</b> until the GitHub token is configured (see article list page).</div>\';}\n' +
'  h+=\'<div class="addbar"><button class="btn-o" data-addtxt="0">+ Text here</button> <button class="btn-o" data-add="0">+ Image here</button></div>\';\n' +
'  state.blocks.forEach(function(b,i){\n' +
'    h+=\'<div class="blk"><div class="blk-head"><span class="blk-tag">\'+tagLabel(b)+\'</span><span class="sp">\'+\n' +
'      \'<button class="btn-o" data-up="\'+i+\'" title="Move up">&uarr;</button>\'+\n' +
'      \'<button class="btn-o" data-dn="\'+i+\'" title="Move down">&darr;</button>\'+\n' +
'      \'<button class="btn-o" data-ed="\'+i+\'">Edit</button>\'+\n' +
'      \'<button class="btn-r" data-del="\'+i+\'">Delete</button>\'+\n' +
'      \'</span></div><div class="blk-body">\'+previewHTML(b)+\'</div></div>\';\n' +
'    h+=\'<div class="addbar"><button class="btn-o" data-addtxt="\'+(i+1)+\'">+ Text here</button> <button class="btn-o" data-add="\'+(i+1)+\'">+ Image here</button></div>\';\n' +
'  });\n' +
'  h+=\'<div style="height:52px;"></div>\';\n' +
'  app.innerHTML=h;\n' +
'  var bar=document.createElement("div");bar.className="pubbar";\n' +
'  bar.innerHTML=\'<button class="btn-g" id="pubBtn"\'+(state.dirty?"":" disabled")+\'>Publish to nosh7.in</button>\';\n' +
'  var old=document.querySelector(".pubbar");if(old)old.remove();\n' +
'  document.body.appendChild(bar);\n' +
'  document.getElementById("backBtn").onclick=function(){if(state.dirty&&!confirm("Discard unpublished changes?"))return;var pb=document.querySelector(".pubbar");if(pb)pb.remove();showList();};\n' +
'  document.getElementById("pubBtn").onclick=publish;\n' +
'  Array.prototype.forEach.call(app.querySelectorAll("[data-ed]"),function(el){el.onclick=function(){editBlock(+el.getAttribute("data-ed"));};});\n' +
'  Array.prototype.forEach.call(app.querySelectorAll("[data-del]"),function(el){el.onclick=function(){var i=+el.getAttribute("data-del");if(confirm("Delete this block?")){state.blocks.splice(i,1);state.dirty=true;renderEditor();}};});\n' +
'  Array.prototype.forEach.call(app.querySelectorAll("[data-up]"),function(el){el.onclick=function(){var i=+el.getAttribute("data-up");if(i>0){var b=state.blocks.splice(i,1)[0];state.blocks.splice(i-1,0,b);state.dirty=true;renderEditor();}};});\n' +
'  Array.prototype.forEach.call(app.querySelectorAll("[data-dn]"),function(el){el.onclick=function(){var i=+el.getAttribute("data-dn");if(i<state.blocks.length-1){var b=state.blocks.splice(i,1)[0];state.blocks.splice(i+1,0,b);state.dirty=true;renderEditor();}};});\n' +
'  Array.prototype.forEach.call(app.querySelectorAll("[data-add]"),function(el){el.onclick=function(){addImage(+el.getAttribute("data-add"));};});\n' +
'  Array.prototype.forEach.call(app.querySelectorAll("[data-addtxt]"),function(el){el.onclick=function(){addText(+el.getAttribute("data-addtxt"));};});\n' +
'}\n' +
'\n' +
'/* ---------- ADD TEXT ---------- */\n' +
'function addText(pos){\n' +
'  var bg=modal(\'<h3>Add text block</h3><div style="display:flex;gap:6px;margin-bottom:8px;"><button class="btn-o" data-t="p">Paragraph</button><button class="btn-o" data-t="h2">Heading</button><button class="btn-o" data-t="ul">Bullet list</button></div><textarea id="thtml"></textarea><p class="hint">Write your text between the tags.</p><div class="row"><button class="btn-o" id="cxl">Cancel</button><button class="btn-g" id="ins">Add Block</button></div>\');\n' +
'  var ta=bg.querySelector("#thtml");ta.value="<p>Write your paragraph here.</p>";\n' +
'  Array.prototype.forEach.call(bg.querySelectorAll("[data-t]"),function(b){b.onclick=function(){var t=b.getAttribute("data-t");if(t==="p")ta.value="<p>Write your paragraph here.</p>";if(t==="h2")ta.value="<h2>Your Section Heading</h2>";if(t==="ul")ta.value="<ul>\\n  <li><strong>Point one:</strong> details here.</li>\\n  <li><strong>Point two:</strong> details here.</li>\\n</ul>";};});\n' +
'  bg.querySelector("#cxl").onclick=function(){bg.remove();};\n' +
'  bg.querySelector("#ins").onclick=function(){\n' +
'    var t=document.createElement("div");t.innerHTML=ta.value;\n' +
'    if(t.children.length!==1){toast("Block must be exactly one HTML element",true);return;}\n' +
'    state.blocks.splice(pos,0,t.children[0]);state.dirty=true;bg.remove();renderEditor();\n' +
'  };\n' +
'}\n' +
'\n' +
'/* ---------- EDIT BLOCK ---------- */\n' +
'function modal(inner){var bg=document.createElement("div");bg.className="modal-bg";bg.innerHTML=\'<div class="modal">\'+inner+"</div>";document.body.appendChild(bg);bg.addEventListener("click",function(e){if(e.target===bg)bg.remove();});return bg;}\n' +
'function editBlock(i){\n' +
'  var bg=modal(\'<h3>Edit block (HTML)</h3><textarea id="bhtml"></textarea><p class="hint">Edit the text between the tags. Keep the tags themselves intact.</p><div class="row"><button class="btn-o" id="cxl">Cancel</button><button class="btn-g" id="sav">Apply</button></div>\');\n' +
'  bg.querySelector("#bhtml").value=state.blocks[i].outerHTML;\n' +
'  bg.querySelector("#cxl").onclick=function(){bg.remove();};\n' +
'  bg.querySelector("#sav").onclick=function(){\n' +
'    var v=bg.querySelector("#bhtml").value;var t=document.createElement("div");t.innerHTML=v;\n' +
'    if(t.children.length!==1){toast("Block must be exactly one HTML element",true);return;}\n' +
'    state.blocks[i]=t.children[0];state.dirty=true;bg.remove();renderEditor();\n' +
'  };\n' +
'}\n' +
'\n' +
'/* ---------- ADD IMAGE ---------- */\n' +
'function slugify(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,40)||"blog-image";}\n' +
'function addImage(pos){\n' +
'  var bg=modal(\'<h3>Add image</h3><input type="file" id="imf" accept="image/*" /><img class="imgprev" id="imp" style="display:none;" /><div id="imsz" class="hint"></div><label>Alt text (required, include keyword + Ahmedabad)</label><input id="ima" placeholder="e.g. high protein salad bowl Ahmedabad" /><label>Caption (optional, shows under the image)</label><input id="imc" placeholder="optional" /><div class="row"><button class="btn-o" id="cxl">Cancel</button><button class="btn-g" id="ins" disabled>Insert Image</button></div>\');\n' +
'  var blob=null,w=0,hgt=0;\n' +
'  bg.querySelector("#cxl").onclick=function(){bg.remove();};\n' +
'  bg.querySelector("#imf").onchange=function(e){\n' +
'    var f=e.target.files[0];if(!f)return;\n' +
'    var img=new Image();\n' +
'    img.onload=function(){\n' +
'      var scale=Math.min(1,1200/img.width);\n' +
'      w=Math.round(img.width*scale);hgt=Math.round(img.height*scale);\n' +
'      var cv=document.createElement("canvas");cv.width=w;cv.height=hgt;\n' +
'      cv.getContext("2d").drawImage(img,0,0,w,hgt);\n' +
'      var qs=[0.82,0.72,0.6,0.5,0.4],qi=0;\n' +
'      (function tryQ(){\n' +
'        cv.toBlob(function(b){\n' +
'          if(!b){toast("Image conversion failed",true);return;}\n' +
'          if(b.size>200*1024&&qi<qs.length-1){qi++;tryQ();return;}\n' +
'          blob=b;\n' +
'          bg.querySelector("#imp").src=URL.createObjectURL(b);bg.querySelector("#imp").style.display="";\n' +
'          bg.querySelector("#imsz").textContent=w+"x"+hgt+" WebP, "+Math.round(b.size/1024)+" KB"+(b.size>200*1024?" (still over 200KB - consider a smaller image)":"");\n' +
'          bg.querySelector("#ins").disabled=false;\n' +
'        },"image/webp",qs[qi]);\n' +
'      })();\n' +
'    };\n' +
'    img.src=URL.createObjectURL(f);\n' +
'  };\n' +
'  bg.querySelector("#ins").onclick=function(){\n' +
'    var alt=bg.querySelector("#ima").value.trim();\n' +
'    if(!alt){toast("Alt text is required for SEO",true);return;}\n' +
'    if(!blob){toast("Choose an image first",true);return;}\n' +
'    var cap=bg.querySelector("#imc").value.trim();\n' +
'    var name="n7-"+slugify(alt)+"-"+Date.now().toString(36)+".webp";\n' +
'    var rd=new FileReader();\n' +
'    rd.onload=function(){\n' +
'      var b64=String(rd.result).split(",")[1];\n' +
'      state.pending[name]={base64:b64,url:URL.createObjectURL(blob)};\n' +
'      var fig=document.createElement("figure");\n' +
'      fig.setAttribute("style","margin:2rem 0;text-align:center;");\n' +
'      var imh=\'<img src="/assets/blog/\'+name+\'" alt="\'+esc(alt)+\'" width="\'+w+\'" height="\'+hgt+\'" loading="lazy" decoding="async" style="max-width:100%;height:auto;border-radius:14px;" />\';\n' +
'      if(cap){imh+=\'<figcaption style="font-size:.85rem;color:#777;margin-top:.55rem;">\'+esc(cap)+"</figcaption>";}\n' +
'      fig.innerHTML=imh;\n' +
'      state.blocks.splice(pos,0,fig);state.dirty=true;bg.remove();renderEditor();\n' +
'    };\n' +
'    rd.readAsDataURL(blob);\n' +
'  };\n' +
'}\n' +
'\n' +
'/* ---------- PUBLISH ---------- */\n' +
'function publish(){\n' +
'  var btn=document.getElementById("pubBtn");btn.disabled=true;btn.textContent="Publishing...";\n' +
'  var inner="\\n\\n  "+state.blocks.map(function(b){return b.outerHTML;}).join("\\n\\n  ")+"\\n\\n";\n' +
'  var html=state.pre+inner+state.post;\n' +
'  var today=new Date().toISOString().slice(0,10);\n' +
'  html=html.replace(/"dateModified":\\s*"[^"]*"/,\'"dateModified": "\'+today+\'"\');\n' +
'  var used={};state.blocks.forEach(function(b){var t=document.createElement("div");t.appendChild(b.cloneNode(true));Array.prototype.forEach.call(t.querySelectorAll("img"),function(im){used[(im.getAttribute("src")||"").split("/").pop()]=1;});});\n' +
'  var images=Object.keys(state.pending).filter(function(n){return used[n];}).map(function(n){return{name:n,base64:state.pending[n].base64};});\n' +
'  api("/api/publish",{method:"POST",body:JSON.stringify({path:state.path,html:html,images:images})}).then(function(){\n' +
'    state.dirty=false;state.pending={};\n' +
'    btn.textContent="Publish to nosh7.in";\n' +
'    toast("Published. Site rebuilds in ~1-2 min. Cached pages may take longer (or purge Cloudflare cache).");\n' +
'    renderEditor();\n' +
'  }).catch(function(e){btn.disabled=false;btn.textContent="Publish to nosh7.in";toast(e.message,true);});\n' +
'}\n' +
'\n' +
'if(KEY){boot();}else{showLogin();}\n' +
'})();\n' +
'</script>\n</body>\n</html>';
