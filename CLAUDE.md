# NOSH7.in SEO Agent

## Business
- Name: NOSH7
- Type: Salad cloud kitchen + subscription service
- City: Ahmedabad, Gujarat, India
- Main site: nosh7.com (DO NOT MODIFY — read only for reference)
- This site: nosh.in (India-focused local SEO site)
- Target audience: Health-conscious working professionals in Ahmedabad

## Purchase Flow
- All CTAs must redirect to: https://www.nosh7.com/order
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
- This site: hi-IN
- Canonical English version: nosh7.com (en)

## Pages to Maintain

| File | Purpose | Language |
|------|---------|----------|
| index.html | Hindi/Hinglish homepage | Hinglish |
| ahmedabad.html | Ahmedabad local SEO landing page | English + Hindi |
| subscription.html | Subscription plans detail page | Hinglish |
| sitemap.xml | XML sitemap — update when pages change | XML |
| robots.txt | Allow all crawlers | Text |

## Agent Rules
1. NEVER modify nosh7.com in any way
2. Always git commit after changes with descriptive message
3. All CTAs and order buttons must point to https://www.nosh7.com/order
4. Keep sitemap.xml updated whenever pages are added or modified
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
