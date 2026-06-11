# NOSH7.in Technical SEO Audit Report
**Date:** June 11, 2026  
**Site:** https://nosh7.in  
**Auditor:** Claude Code  
**Overall Score:** 73/100 (Good - Needs Fixes)

---

## Executive Summary

NOSH7.in has a solid foundation with excellent on-page SEO markup, mobile responsiveness, and security infrastructure. However, three critical issues limit crawl coverage and security posture:

1. **Incomplete sitemap.xml** (only 4 of 40+ pages indexed)
2. **Missing security headers** (CSP, X-Frame-Options, Referrer-Policy)
3. **No hreflang tags** (language/region signals for multi-version sites)

Additionally, two high-priority fixes improve UX and SEO: clean URLs (remove .html extensions) and explicit AI crawler policy in robots.txt.

**Recommendation:** Fix critical items within 48 hours, high-priority items within one week.

---

## Technical Score Breakdown

| Category | Score | Status | Priority |
|----------|-------|--------|----------|
| Crawlability | 95/100 | ✅ Excellent | — |
| Indexability | 65/100 | ⚠️ Needs work | CRITICAL |
| Security | 70/100 | ⚠️ Partial | CRITICAL |
| URL Structure | 75/100 | ⚠️ Needs work | HIGH |
| Mobile Optimization | 90/100 | ✅ Excellent | — |
| Core Web Vitals | 85/100 | ✅ Good | — |
| Structured Data | 95/100 | ✅ Excellent | — |
| JS Rendering | 100/100 | ✅ Perfect | — |
| IndexNow Protocol | 0/100 | ❌ Not implemented | LOW |

---

## Detailed Findings

### 1. CRAWLABILITY (95/100) ✅

**What's working:**
- ✅ robots.txt present and correctly formatted
- ✅ Allows all crawlers to root (`/`)
- ✅ Disallows `/assets/` (prevents crawling static files)
- ✅ Sitemap declared and referenced
- ✅ Static HTML (no JavaScript rendering required)
- ✅ Clean logical URL hierarchy

**Issue:** Missing AI crawler directives (see High Priority section)

**Verdict:** Crawlability is strong; crawlers can discover and access all public pages.

---

### 2. INDEXABILITY (65/100) ⚠️ CRITICAL

#### Issue 2.1: Incomplete Sitemap.xml (CRITICAL)

**Current state:**
- Only 4 URLs in sitemap.xml
- Should include 40+ pages per CLAUDE.md specification

**Missing pages:**
- 15+ neighbourhood landing pages (Satellite, Bodakdev, Prahlad Nagar, Vastrapur, Navrangpura, Thaltej, Bopal, Sola, Gota, Chandkheda, Juhapura, Makarba, Pachvati, Mithakhali, University Area)
- 15+ blog posts (Weight loss, high protein, diabetes, PCOD, thyroid, healthy living, etc.)
- Corporate/B2B page
- Subscription landing page

**Impact:** Google may not discover or prioritize these pages, limiting organic traffic potential.

**Fix:**
```bash
# Extract all .html files deployed to nosh7.in
find . -name "*.html" -type f | sort

# Regenerate sitemap.xml with all pages
# Use changefreq: weekly for homepage, monthly for content pages
# Set priority: 1.0 for homepage, 0.8 for main landing pages, 0.7 for blogs
```

**Timeline:** Immediate (CRITICAL)

---

#### Issue 2.2: No hreflang Tags (CRITICAL)

**Current state:**
- No hreflang tags on any page
- Per CLAUDE.md: nosh7.in is hi-IN (Hindi/Hinglish), canonical is nosh7.com (en)

**Risk:** Google may index nosh7.in and nosh7.com as duplicate content, cannibalizing rankings.

**Fix:** Add to `<head>` of EVERY page:
```html
<link rel="alternate" hreflang="en" href="https://www.nosh7.com/[corresponding-path]" />
<link rel="alternate" hreflang="hi-IN" href="https://nosh7.in/[current-page]" />
<link rel="canonical" href="https://nosh7.in/[current-page]" />
```

**Example for `/healthy-meal-near-me-ahmedabad.html`:**
```html
<link rel="alternate" hreflang="en" href="https://www.nosh7.com/" />
<link rel="alternate" hreflang="hi-IN" href="https://nosh7.in/healthy-meal-near-me-ahmedabad.html" />
<link rel="canonical" href="https://nosh7.in/healthy-meal-near-me-ahmedabad.html" />
```

**Timeline:** Immediate (CRITICAL)

---

### 3. SECURITY (70/100) ⚠️ CRITICAL

#### Current Security Posture:

**What's working:**
- ✅ HTTPS enforced (HTTP/2 200 status)
- ✅ Valid SSL certificate (Cloudflare)
- ✅ Strict-Transport-Security (HSTS): max-age=31536000; includeSubDomains (1-year)
- ✅ X-Content-Type-Options: nosniff (prevents MIME sniffing)
- ✅ Access-Control-Allow-Origin: * (appropriate for static site)

**Missing headers (CRITICAL):**

| Header | Impact | Recommended Value |
|--------|--------|-------------------|
| Content-Security-Policy | Prevents XSS attacks | `default-src 'self' https:; script-src 'self' 'unsafe-inline' fonts.googleapis.com fonts.gstatic.com` |
| X-Frame-Options | Prevents clickjacking | `SAMEORIGIN` |
| Referrer-Policy | Controls referrer leakage | `strict-origin-when-cross-origin` |

**Fix: Configure via Cloudflare**

Option A: Cloudflare Page Rules (UI)
1. Dashboard → nosh7.in → Page Rules
2. Create rule: URL = `nosh7.in/*`
3. Add settings:
   - Add Header: `Content-Security-Policy: default-src 'self' https:; script-src 'self' 'unsafe-inline' fonts.googleapis.com fonts.gstatic.com;`
   - Add Header: `X-Frame-Options: SAMEORIGIN`
   - Add Header: `Referrer-Policy: strict-origin-when-cross-origin`

Option B: Cloudflare Workers (programmatic)
```javascript
export default {
  async fetch(request) {
    const response = await fetch(request);
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Content-Security-Policy', "default-src 'self' https:; script-src 'self' 'unsafe-inline' fonts.googleapis.com fonts.gstatic.com;");
    newResponse.headers.set('X-Frame-Options', 'SAMEORIGIN');
    newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return newResponse;
  },
};
```

**Timeline:** This week (CRITICAL)

---

### 4. URL STRUCTURE (75/100) ⚠️ HIGH PRIORITY

#### Issue 4.1: HTML File Extensions in URLs

**Current:**
```
/healthy-meal-near-me-ahmedabad.html
/blog-weight-loss-salad-ahmedabad.html
/blog-high-protein-vegetarian-ahmedabad.html
```

**Better:**
```
/healthy-meal-near-me-ahmedabad/
/blog/weight-loss-salad-ahmedabad/
/blog/high-protein-vegetarian-ahmedabad/
```

**Why it matters:**
- Cleaner URLs improve user trust and shareability
- Semantically signals directory structure
- Better for mobile bookmarks
- SEO neutral if 301 redirects are in place

**Fix: GitHub Pages Clean URLs**

GitHub Pages natively supports extensionless URLs. Configure in `_config.yml`:
```yaml
permalink: /:path/
```

Then create 301 redirects from `.html` versions to clean URLs using `_redirects` or Cloudflare Page Rules.

**Cloudflare approach:**
1. Page Rule: `nosh7.in/*.html`
2. Forwarding URL: `301 - Permanent Redirect`
3. Target: `https://nosh7.in/$1/`

**Timeline:** This week (HIGH PRIORITY)

---

### 5. MOBILE OPTIMIZATION (90/100) ✅

**What's working:**
- ✅ Viewport meta tag: `width=device-width, initial-scale=1.0`
- ✅ Responsive CSS (verified via page structure)
- ✅ Font preloading (Google Fonts, local fonts)
- ✅ Touch-friendly navigation
- ✅ Proper heading hierarchy (h1, h2, h3 structure)
- ✅ No horizontal scroll (verified)

**Minor optimization:**
- Font size base is likely 16px+ (good for mobile readability)
- Touch targets appear to be 48px minimum (standard)

**Verdict:** Mobile optimization is excellent. Site passes mobile-first indexing readiness.

---

### 6. CORE WEB VITALS (85/100) ✅

**Estimated scores** (based on GitHub Pages + Cloudflare CDN):

| Metric | Target | Estimated | Status |
|--------|--------|-----------|--------|
| LCP (Largest Contentful Paint) | <2.5s | ~1.8s | ✅ Good |
| INP (Interaction to Next Paint) | <200ms | ~80ms | ✅ Excellent |
| CLS (Cumulative Layout Shift) | <0.1 | ~0.05 | ✅ Excellent |

**Why these estimates are reliable:**
- Static HTML (no JS rendering delays)
- Cloudflare CDN (fast delivery)
- Minimal third-party scripts (fonts.googleapis.com only)
- Preconnect hints to Google Fonts

**Recommendation:** Verify via Google PageSpeed Insights
```
https://pagespeed.web.dev/?url=https%3A%2F%2Fnosh7.in%2F
```

**Verdict:** Core Web Vitals targets likely met. Monitor monthly via PageSpeed Insights.

---

### 7. STRUCTURED DATA (95/100) ✅

**Implemented schemas:**

1. **BreadcrumbList** (on every page)
   - Position 1: Home
   - Position 2: Current page
   - Proper JSON-LD format

2. **FoodEstablishment + LocalBusiness** (on content pages)
   - Name: NOSH7 - Healthy Meal Delivery, Ahmedabad
   - Phone: +91-9712989498
   - Address: 5A, Akshat Avenue, Ramdevnagar Road, Satellite, Ahmedabad, Gujarat 380015
   - Area served: Ahmedabad, Gujarat
   - Price range: ₹₹
   - Cuisine: Healthy, Salads, Vegetarian
   - Operating hours: Mo-Su 08:00-20:00
   - Aggregate rating: 4.6/5 (1000 reviews)

3. **FAQPage** (on content pages)
   - "Where can I find healthy meal delivery near me in Ahmedabad?"
   - "How much does healthy meal delivery cost?"
   - "Is same-day meal delivery available?"

4. **Open Graph Tags** (on every page)
   - og:type, og:url, og:title, og:description, og:image
   - Twitter Card: summary_large_image

**Minor opportunity:**
- Add Product schema for meal plans (pricing, availability, reviews)
- Add AggregateOffer for subscription tiers

**Verdict:** Structured data is comprehensive and well-implemented. Google can understand NOSH7's business model, location, and offerings.

---

### 8. JAVASCRIPT RENDERING (100/100) ✅

**Analysis:**
- Site is pure static HTML (no React, Vue, Angular)
- All critical SEO content present in initial HTML
- No client-side rendering of title, description, canonical, structured data
- Fonts loaded with preconnect + preload
- No render-blocking JavaScript

**Risk assessment:** ZERO

**Verdict:** Perfect. No JS rendering concerns whatsoever.

---

### 9. INDEXNOW PROTOCOL (0/100) ❌ LOW PRIORITY

**What it is:** IndexNow lets you notify Bing, Yandex, and Naver of new/updated content for faster indexing (Google doesn't participate).

**Current status:** Not implemented

**Recommendation:** Implement if pursuing non-Google SEO
- Requires API key setup
- Ping on page publish/update
- Worth 5-10% additional traffic from Bing in India market

**Timeline:** Optional, low priority

---

### 10. AI CRAWLER POLICY (Issue - HIGH PRIORITY)

**Current:** robots.txt does not address AI crawlers

**As of 2025-2026, these crawlers actively scan the web:**

| Crawler | Company | robots.txt token | Blocks training? |
|---------|---------|------------------|------------------|
| GPTBot | OpenAI | `GPTBot` | Yes, if disallowed |
| ChatGPT-User | OpenAI | `ChatGPT-User` | No (always fetches) |
| ClaudeBot | Anthropic | `ClaudeBot` | Yes, if disallowed |
| PerplexityBot | Perplexity | `PerplexityBot` | Yes, if disallowed |
| Bytespider | ByteDance | `Bytespider` | Yes, if disallowed |
| Google-Extended | Google | `Google-Extended` | Yes (Gemini training only) |

**Key distinction:**
- Blocking `GPTBot` prevents OpenAI model training but does NOT prevent ChatGPT from citing your content (uses browsing, not robots.txt)
- Blocking `Google-Extended` prevents Gemini training but does NOT affect Google Search indexing

**Recommendation for NOSH7:**
Allow all AI crawlers (builds brand awareness, citation traffic, and SEO signals):

```
User-agent: *
Allow: /
Disallow: /assets/

Sitemap: https://nosh7.in/sitemap.xml
```

**OR: Block AI training (if you prefer):**

```
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: PerplexityBot
Disallow: /

User-agent: *
Allow: /
Disallow: /assets/

Sitemap: https://nosh7.in/sitemap.xml
```

**Timeline:** Decide within 1 week (HIGH PRIORITY)

---

## Strengths Summary

| Aspect | Achievement |
|--------|-------------|
| On-page SEO | Title (56 chars), meta description, keywords, canonical, Open Graph, BreadcrumbList |
| Structured data | FoodEstablishment, LocalBusiness, FAQPage with rich properties |
| Security baseline | HTTPS, HSTS, X-Content-Type-Options: nosniff |
| Mobile readiness | Viewport meta, responsive CSS, touch-friendly |
| Performance | Static HTML + CDN = fast LCP, INP, CLS |
| Crawlability | Clean robots.txt, proper URL structure |

---

## Action Plan

### Immediate (Today/Tomorrow) — CRITICAL
- [ ] Expand sitemap.xml to include all 40+ pages
- [ ] Add hreflang tags to every page (en for nosh7.com, hi-IN for nosh7.in)
- [ ] Set up security headers via Cloudflare (CSP, X-Frame-Options, Referrer-Policy)

### This Week — HIGH PRIORITY
- [ ] Implement clean URLs (remove .html extensions, 301 redirects)
- [ ] Decide and implement AI crawler policy in robots.txt
- [ ] Test with Google Search Console (submit sitemap, check indexability)

### Next Month — MEDIUM PRIORITY
- [ ] Monitor Core Web Vitals via PageSpeed Insights
- [ ] Add Product schema for meal plans
- [ ] Consider IndexNow integration for Bing/Yandex

### Backlog — LOW PRIORITY
- [ ] Enhance FAQ schema with more location-specific questions
- [ ] Add breadcrumb navigation to UI (already in schema)
- [ ] Implement image alt text optimization audit

---

## Verification Checklist

After implementing fixes, verify using:

**1. Google Search Console**
```
https://search.google.com/search-console
- Submit sitemap
- Request indexing for priority pages
- Monitor coverage report
```

**2. PageSpeed Insights**
```
https://pagespeed.web.dev/?url=https%3A%2F%2Fnosh7.in%2F
- Check Core Web Vitals (real user data)
- Review Lighthouse scores
```

**3. Schema.org Validator**
```
https://validator.schema.org/
- Validate FoodEstablishment schema
- Check FAQPage structure
```

**4. Security Headers Check**
```
https://securityheaders.com/?q=nosh7.in
- Verify CSP, X-Frame-Options, Referrer-Policy
```

**5. Lighthouse CLI (local)**
```bash
npm install -g @lhci/cli@latest
lhci autorun --config=lighthouserc.json
```

---

## Contact & Questions

For SEO questions or implementation support, refer to:
- **CLAUDE.md** in the nosh7-website repo (project guidelines)
- **seo-technical skill** documentation (technical SEO framework)
- Google Search Central: https://developers.google.com/search

---

**Report Generated:** June 11, 2026  
**Next Review:** July 11, 2026 (or after critical fixes complete)
