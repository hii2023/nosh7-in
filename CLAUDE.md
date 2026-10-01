# NOSH7.in SEO Agent

## Business
- Name: NOSH7
- Type: Salad cloud kitchen + subscription service
- City: Ahmedabad, Gujarat, India
- Main site: nosh7.com. Since 2026-10-02 it 301-redirects to https://app.nosh7.com/customer.html (the customer site: banner, all plans, login). That redirect is a Squarespace Domain Forwarding rule; the old content of nosh7.com is retired.
- This site: nosh.in (India-focused local SEO site)
- Target audience: Health-conscious working professionals in Ahmedabad

## Purchase Flow
- All CTAs must point to the order flow: https://app.nosh7.com/start.html (it replaced start.nosh7.in on 2026-10-02; start.nosh7.in now just redirects there, keeping ?track= etc.)
- Every link labelled "Plans" goes to https://app.nosh7.com/customer.html#lpPlans (the plans section of the customer site)
- No payment or checkout logic on this site
- WhatsApp fallback order link: https://wa.me/919712989498
- Replace 9712989498 with actual WhatsApp business number before going live

## SEO Goals

### Primary Keywords (English)
- salad delivery Ahmedabad
- healthy meal subscription Ahmedabad
- cloud kitchen Ahmedabad
- salad subscription Gujarat
- healthy tiffin service Ahmedabad

### Primary Keywords (Hindi)
- सलाद डिलीवरी अहमदाबाद
- स्वस्थ खाना सब्सक्रिप्शन अहमदाबाद
- हेल्दी टिफिन सर्विस गुजरात

### Schema Types Required
- LocalBusiness
- FoodEstablishment
- SubscriptionService
- Product (for salad plans)

### hreflang
- This site (nosh7.in) serves ENGLISH content, so it is labelled `en-IN` (India English). Do NOT set it back to `hi-IN` — that told Google to serve this English page to Hindi searchers (fixed 2026-08-04).
- nosh7.com is the generic English alternate (`en`).
- Convention per page: `<link hreflang="en-IN" href="[this nosh7.in page]">` + `<link hreflang="en" href="[matching nosh7.com page]">`.

## Pages to Maintain

| File | Purpose | Language |
|------|---------|----------|
| index.html | Hindi/Hinglish homepage | Hinglish |
| ahmedabad.html | Ahmedabad local SEO landing page | English + Hindi |
| subscription.html | Subscription plans detail page | Hinglish |
| sitemap.xml | XML sitemap — update when pages change | XML |
| robots.txt | Allow all crawlers | Text |

## Agent Rules
1. nosh7.com is only a redirect now (to app.nosh7.com/customer.html); do not point new content at it
2. Always git commit after changes with descriptive message
3. All CTAs and order buttons must point to https://app.nosh7.com/start.html
4. Keep sitemap.xml updated whenever pages are added or modified. After committing content changes and before pushing, run `python3 update-sitemap-lastmod.py` so every `<lastmod>` matches that page's last git commit date. Never hand-edit or invent lastmod values: once Google detects they are unreliable it ignores the signal site-wide. `--check` reports drift without writing.
5. Every page must have: title tag, meta description, canonical URL, OG tags, JSON-LD schema
6. Image alt text must include primary keyword + location (e.g., "fresh salad delivery Ahmedabad")
7. Run Lighthouse suggestions on each SEO pass
8. Meta descriptions: 150–160 characters, include "Ahmedabad" and primary keyword
9. Title tags: 55–60 characters, brand name "NOSH7" at end

## Content Tone
- Warm, friendly, health-forward
- Hinglish: mix Hindi words naturally into English sentences
- Never use overly formal Hindi — keep it conversational
- Emphasize: fresh ingredients, local Gujarat produce, convenience, health goals

## Competitor Context
- Target people searching for: zomato salad, healthy tiffin, diet food delivery Ahmedabad
- Differentiator: subscription model, BMI-goal tracking, cloud kitchen freshness

## Technical Notes
- Hosted on GitHub Pages (static site only — no server-side code)
- No JavaScript frameworks — plain HTML/CSS/JS only
- All pages must be mobile-first
- Page load target: under 2 seconds
- Images: use WebP format, max 200KB per image
