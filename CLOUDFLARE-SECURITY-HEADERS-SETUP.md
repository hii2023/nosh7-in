# Cloudflare Security Headers Setup for nosh7.in

## Overview
This guide walks you through configuring three critical security headers via Cloudflare to improve nosh7.in's security posture.

**Headers to add:**
1. Content-Security-Policy (CSP) — Prevents XSS attacks
2. X-Frame-Options — Prevents clickjacking
3. Referrer-Policy — Controls referrer leakage

---

## Prerequisites
- Access to nosh7.in Cloudflare dashboard
- Admin or Editor role in Cloudflare account

---

## Method 1: Using Cloudflare Page Rules (UI - Recommended for beginners)

### Step 1: Log in to Cloudflare
1. Go to https://dash.cloudflare.com
2. Select the nosh7.in domain

### Step 2: Create Page Rules
1. Navigate to **Rules** (left sidebar) → **Page Rules**
2. Click **Create Page Rule**
3. Set URL pattern: `nosh7.in/*`
4. Click **Add a Setting**

### Step 3: Add Custom Headers
For each header below, click **Add a Setting** and select **Add Custom Header**:

**Header 1: Content-Security-Policy**
- Header: `Content-Security-Policy`
- Value:
```
default-src 'self' https:; script-src 'self' 'unsafe-inline' fonts.googleapis.com fonts.gstatic.com; style-src 'self' 'unsafe-inline' fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' fonts.gstatic.com; connect-src 'self' https:; base-uri 'self'; form-action 'self'
```

**Header 2: X-Frame-Options**
- Header: `X-Frame-Options`
- Value: `SAMEORIGIN`

**Header 3: Referrer-Policy**
- Header: `Referrer-Policy`
- Value: `strict-origin-when-cross-origin`

### Step 4: Save
Click **Save and Deploy** at the bottom of the page.

---

## Method 2: Using Cloudflare Workers (Recommended for advanced users)

Cloudflare Workers allow programmatic control with no setup required.

### Step 1: Create a Worker Script
1. Go to **Workers & Pages** → **Workers**
2. Click **Create** → **Create Worker**
3. Replace the default code with:

```javascript
export default {
  async fetch(request) {
    // Fetch the original response
    const response = await fetch(request);
    
    // Clone the response so we can modify headers
    const newResponse = new Response(response.body, response);
    
    // Add security headers
    newResponse.headers.set(
      'Content-Security-Policy',
      "default-src 'self' https:; script-src 'self' 'unsafe-inline' fonts.googleapis.com fonts.gstatic.com; style-src 'self' 'unsafe-inline' fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' fonts.gstatic.com; connect-src 'self' https:; base-uri 'self'; form-action 'self'"
    );
    newResponse.headers.set('X-Frame-Options', 'SAMEORIGIN');
    newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    return newResponse;
  },
};
```

### Step 2: Deploy the Worker
1. Click **Deploy**
2. Give the worker a name (e.g., `nosh7-security-headers`)

### Step 3: Route the Worker to nosh7.in
1. Go to **Workers & Pages** → **Overview**
2. Click the worker you just created
3. Go to **Triggers** → **Routes**
4. Click **Add route**
5. Set:
   - Route: `nosh7.in/*`
   - Zone: nosh7.in
6. Click **Save**

---

## Method 3: Using Cloudflare Transform Rules (Newest approach)

### Step 1: Go to Transform Rules
1. Navigate to **Rules** → **Transform Rules** → **Modify response header**
2. Click **Create rule**

### Step 2: Create Rules for Each Header
For each header, create a new rule:

**Rule 1: Content-Security-Policy**
- Rule name: `Add CSP Header`
- When incoming requests match: `URI Path contains /*`
- Modify response header:
  - Header name: `Content-Security-Policy`
  - Value: `default-src 'self' https:; script-src 'self' 'unsafe-inline' fonts.googleapis.com fonts.gstatic.com; style-src 'self' 'unsafe-inline' fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' fonts.gstatic.com; connect-src 'self' https:; base-uri 'self'; form-action 'self'`
- Click **Deploy**

**Rule 2: X-Frame-Options**
- Rule name: `Add X-Frame-Options Header`
- When incoming requests match: `URI Path contains /*`
- Modify response header:
  - Header name: `X-Frame-Options`
  - Value: `SAMEORIGIN`
- Click **Deploy**

**Rule 3: Referrer-Policy**
- Rule name: `Add Referrer-Policy Header`
- When incoming requests match: `URI Path contains /*`
- Modify response header:
  - Header name: `Referrer-Policy`
  - Value: `strict-origin-when-cross-origin`
- Click **Deploy**

---

## Verification

### Check Headers via Browser DevTools
1. Open https://nosh7.in in Chrome/Firefox
2. Open DevTools (F12 → Network tab)
3. Reload the page
4. Click on the HTML response
5. Go to **Response Headers** tab
6. Look for:
   - `Content-Security-Policy`
   - `X-Frame-Options`
   - `Referrer-Policy`

### Check Headers via Command Line
```bash
curl -I https://nosh7.in
```

Should output:
```
Content-Security-Policy: default-src 'self' https:; ...
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin
```

### Check via Security Headers API
Visit https://securityheaders.com/?q=nosh7.in and verify:
- Content-Security-Policy: ✅
- X-Frame-Options: ✅
- Referrer-Policy: ✅

---

## Header Explanations

### Content-Security-Policy (CSP)
**What it does:** Restricts where scripts, styles, images, and other resources can be loaded from.

**Breakdown:**
- `default-src 'self' https:` — Only allow same-origin and HTTPS resources by default
- `script-src 'self' 'unsafe-inline' fonts.googleapis.com fonts.gstatic.com` — Allow inline scripts and Google Fonts
- `style-src 'self' 'unsafe-inline' fonts.googleapis.com` — Allow inline styles and Google Fonts
- `img-src 'self' data: https:` — Allow images from same origin, data URIs, and HTTPS
- `font-src 'self' fonts.gstatic.com` — Allow fonts from same origin and Google's CDN
- `connect-src 'self' https:` — Only allow same-origin API calls and HTTPS connections
- `base-uri 'self'` — Restrict base URL to same origin
- `form-action 'self'` — Only allow form submissions to same origin

**Why it matters:** Prevents inline script injection (XSS attacks), the most common web vulnerability.

### X-Frame-Options
**What it does:** Prevents the site from being embedded in iframes on other domains (clickjacking protection).

**Values:**
- `SAMEORIGIN` — Allow embedding only from same domain
- `DENY` — Don't allow embedding anywhere
- `ALLOW-FROM uri` — Allow embedding only from specified domain (deprecated)

**For nosh7.in:** Use `SAMEORIGIN` to prevent malicious sites from embedding your pages in hidden iframes.

### Referrer-Policy
**What it does:** Controls what referrer information is leaked when users click links away from nosh7.in.

**Values:**
- `strict-origin-when-cross-origin` (Recommended) — Send full referrer (path) for same-origin, only origin for cross-origin
- `no-referrer` — Never send referrer
- `same-origin` — Only send referrer for same-origin navigation
- `strict-origin` — Only send origin (not path) when navigating away

**For nosh7.in:** Use `strict-origin-when-cross-origin` to balance privacy and analytics.

---

## Testing the CSP Header

If you want to be more permissive while testing, temporarily use CSP in **report-only** mode:

```
Content-Security-Policy-Report-Only: default-src 'self' https:; ...
```

This logs violations to the console but doesn't block resources. Once you're confident, switch to the regular `Content-Security-Policy` header.

---

## Troubleshooting

### Headers not appearing
1. **Clear browser cache** (Cmd+Shift+Delete)
2. **Wait 1-2 minutes** for Cloudflare rules to propagate
3. **Check Cloudflare status** — ensure rule is active (toggle should be ON)
4. **Verify domain** — confirm rule is applied to nosh7.in (not a subdomain)

### CSP blocks legitimate resources
1. Open browser console (DevTools → Console)
2. Look for CSP violations like: `Refused to load the script 'https://...' because it violates the Content-Security-Policy directive`
3. Add the blocked domain to the appropriate directive (e.g., add to `script-src` if a script is blocked)

### Workers route not active
1. Go to **Workers & Pages** → [Worker Name] → **Triggers**
2. Confirm route shows `nosh7.in/*` with status "Active"
3. If it shows "Pending", wait a few minutes and refresh

---

## Best Practices

1. **Test before deploying** — Use CSP-Report-Only for a few days to catch issues
2. **Document exceptions** — Comment any `'unsafe-inline'` usage and plan to remove it
3. **Monitor violations** — Check browser console regularly for CSP violations
4. **Update quarterly** — Review which domains are actually needed and remove unnecessary ones
5. **Remove 'unsafe-inline' eventually** — Use nonces or hashes for inline styles/scripts instead

---

## Next Steps

After setting up these headers:
1. ✅ Run Google PageSpeed Insights to check impact
2. ✅ Verify sitemap.xml submission in Google Search Console
3. ✅ Monitor Core Web Vitals for any performance regressions

---

**Created:** June 11, 2026  
**Related:** TECHNICAL-SEO-AUDIT-2026-06-11.md
