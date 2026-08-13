# NOSH7 Schema.org / JSON-LD Audit and Rebuild

**Site:** www.nosh7.in  **Date:** 2026-08-14  **Reviewer role:** Senior Technical SEO + Schema.org

This audit is based on the actual deployed markup in this repository (index.html, ~40 location pages, ~25 blog pages, subscription.html, blog.html, product pages, bmi-calculator, diet-services, menu). It lists what already works, then the defects ranked by SEO impact, why each one weakens machine understanding, and production-ready JSON-LD to replace the current blocks.

---

## 1. What is already correct (keep it)

You are far past "no schema". The site already ships:

- `FoodEstablishment` + `LocalBusiness` on the homepage and location pages, with address, opening hours, `sameAs`, reviews.
- `WebSite` on the homepage.
- `BreadcrumbList` on nearly every inner page.
- `Article` on blog posts (with publisher, datePublished, dateModified).
- `Product` + `Offer` on product/pack pages.
- `FAQPage` very widely (this is your biggest current rich-result win).
- `Service` on the diet-services page, `WebApplication` on the BMI calculator, `Menu` on the menu page, `Blog` on blog.html.

The problems below are not "you are missing schema". They are **entity fragmentation, policy-risk on ratings, and missing connective fields** that stop Google from merging all of this into one confident business entity.

---

## 2. Issues ranked by SEO impact

### P0-A. `aggregateRating` is a policy-manual-action risk (highest priority)

**Found:** the exact same block appears on the homepage, on every location page, and on every Product page:

```json
"aggregateRating": { "ratingValue": "4.6", "bestRating": "5", "worstRating": "1", "reviewCount": "1000" }
```

**Why this hurts machine understanding and rankings:**
- A round `reviewCount: "1000"` cloned identically across ~50 URLs looks machine-generated, not real. This is exactly the pattern Google's "Spammy structured markup" manual action targets.
- Putting `aggregateRating` on each `Product` when there are **no product-specific reviews on that page** violates the [merchant/product review-snippet policy](https://developers.google.com/search/docs/appearance/structured-data/review-snippet). Self-serving ratings on Product are the most-penalised case.
- Cloning the same rating onto 40 location `FoodEstablishment` nodes tells Google "these are 40 businesses each with 1000 reviews", which is not true (they are one kitchen). It dilutes the signal instead of strengthening it.

**Fix (do all three):**
1. Use the **real** Google Business Profile numbers (e.g. actual review count, actual average). Update them when they change.
2. Attach `aggregateRating` to **one** business entity (`#organization`/`#business`), not to every page and not to individual Products unless that product genuinely has on-page reviews.
3. On location and product pages, reference the business by `@id` instead of re-declaring the rating.

---

### P0-B. No entity consolidation: ~50 disconnected "NOSH7" nodes

**Found:** every page re-declares NOSH7 as a fresh node. The homepage uses `@id: https://nosh7.in/#business`, but article `publisher`, product `brand`, and location `provider` are all bare `{"@type":"Organization","name":"NOSH7"}` with **no `@id`**.

**Why this hurts:** Google builds a knowledge entity by merging nodes that share an `@id`. Right now it sees dozens of unrelated "NOSH7" strings. Your `sameAs` links (Instagram, Zomato, Swiggy, Google), your rating, and your address are scattered instead of pooling onto one entity. This is the single biggest reason a site with lots of schema still fails to earn a Knowledge Panel or brand entity.

**Fix:** Define the Organization **once** with a stable `@id` (`https://nosh7.in/#organization`). Every other node (publisher, brand, provider, business) references it by `{"@id": "..."}` instead of repeating the data. See the templates in section 3.

---

### P0-C. All ~40 location pages use the same physical address = doorway / duplicate LocalBusiness

**Found:** 40 location pages (`satellite-ahmedabad`, `bopal-ahmedabad`, `thaltej-ahmedabad`, ...) all carry a `FoodEstablishment` with the **identical** address `5A, Akshat Avenue, Ramdevnagar Road, Satellite`. There is only one kitchen.

**Why this hurts:** Declaring 40 `LocalBusiness` entities at one address is a duplicate/doorway pattern. Google can treat it as spam or simply pick one and ignore the rest, and it undermines the trust of your one real GBP listing.

**Fix:** These are **service-area** pages, not branch pages. Model them as one `Service` (or the single business) with `areaServed`, not a fresh `LocalBusiness` per suburb. Keep exactly **one** true `LocalBusiness`/`FoodEstablishment` node (referenced by `@id`) that carries the real address, and let each location page add a `WebPage` + `Service`/`areaServed` describing the delivery zone. See template 3.5.

---

### P1-A. No `geo` coordinates anywhere

**Found:** `geo` latitude/longitude appears on **zero** pages.

**Why this hurts:** For local-pack and "near me" ranking, `LocalBusiness.geo` is one of the strongest structured signals. Without it Google relies only on the text address.

**Fix:** Add `geo` (lat/lng of the Satellite kitchen) to the one canonical business node. Add `hasMap` pointing to your Google Maps `g.page` URL.

---

### P1-B. No `WebPage` nodes and no `isPartOf` linking to the WebSite

**Found:** No page declares a `WebPage`/`CollectionPage`. `BreadcrumbList` exists but floats unconnected. `WebSite` exists only on the homepage and nothing references it.

**Why this hurts:** `WebPage` + `isPartOf: WebSite` + `breadcrumb` is the connective tissue that tells Google "this URL is a page belonging to this site, in this language, with this primary image, and this breadcrumb". Without it, each URL's schema is an island. It also feeds `inLanguage`, `datePublished`, and `primaryImageOfPage`.

**Fix:** Add a `WebPage` node per page inside a single `@graph`, linked to `#website` and to the page's `#breadcrumb`. See templates.

---

### P1-C. `WebSite` has no `SearchAction` (sitelinks search box)

**Fix:** Add `potentialAction: SearchAction` to the `WebSite` node so you are eligible for the sitelinks search box, and reference the same `#website` node from every page via `isPartOf`.

---

### P2-A. Article schema is thin (blocks Article rich results and Discover)

**Found on blog posts:** no `image`, no `mainEntityOfPage`, `author` is `Organization` (not a Person), no `articleSection`/`keywords`, no `inLanguage`.

**Why this hurts:** Article rich results and Google Discover eligibility effectively require a high-res `image`. `mainEntityOfPage` disambiguates the canonical URL. A named `author` (Person, ideally with `url`) is an E-E-A-T signal for YMYL health content, which all your diabetes/PCOD/thyroid posts are.

**Fix:** Upgrade to the Article template in 3.4: add `image` (1200px+), `mainEntityOfPage`, `author` as a Person with a bio page, `publisher` by `@id`, `inLanguage: en-IN`.

---

### P2-B. Product schema will be rejected for merchant listings

**Found on pack pages:** `image` is just the logo (not a product photo); no `sku`; `offers` has no `priceValidUntil`, `shippingDetails`, `hasMerchantReturnPolicy`, or `itemCondition`; plus the cloned `aggregateRating` from P0-A.

**Why this hurts:** Google product/merchant rich results now expect real product imagery and shipping/return data. A logo as the product image is commonly ignored or rejected. Missing `priceValidUntil` triggers a "non-critical" warning; missing shipping/returns loses eligibility for the richer merchant experience.

**Fix:** Use the Product template in 3.6: real dish photo, `sku`, `priceValidUntil`, `shippingDetails`, `hasMerchantReturnPolicy`, `itemCondition`, brand and reviews by `@id`.

---

### P3 (polish)

- `servesCuisine` is a string (`"Pure Vegetarian, Salads"`). Make it an **array**: `["Pure Vegetarian", "Salads", "Health Food"]`.
- `suitableForDiet` should be the enum URL: `"https://schema.org/VegetarianDiet"`.
- `inLanguage` is inconsistent (homepage only). Set `"en-IN"` everywhere via the `WebPage`/`WebSite` nodes.
- Link the homepage `FoodEstablishment` to the menu page with `"hasMenu": "https://nosh7.in/menu/"`.
- `priceRange: "₹₹"` is valid but `"₹200-₹400"` is clearer to users in the snippet.
- Add `contactPoint` (customer service) and `foundingDate` / `areaServed` to the Organization.

---

## 3. Production-ready JSON-LD (copy/paste)

**Rule of thumb:** one `<script type="application/ld+json">` per page containing a single `@graph`, so every node can cross-link by `@id`. Replace ALL example values (geo, phone, review counts, dates, image URLs, author) with real ones before shipping. Note: no em dashes anywhere per house style.

### 3.1 Canonical Organization + WebSite (put on EVERY page, identical)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://nosh7.in/#organization",
      "name": "NOSH7",
      "url": "https://nosh7.in/",
      "logo": {
        "@type": "ImageObject",
        "@id": "https://nosh7.in/#logo",
        "url": "https://nosh7.in/assets/logo.png",
        "width": 512,
        "height": 512,
        "caption": "NOSH7"
      },
      "image": { "@id": "https://nosh7.in/#logo" },
      "description": "Pure-veg salad meal kitchen in Ahmedabad. Fresh salad subscriptions, health drinks and superfood seeds delivered daily.",
      "foundingDate": "2023",
      "areaServed": { "@type": "City", "name": "Ahmedabad" },
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+91-9712989498",
        "contactType": "customer service",
        "areaServed": "IN",
        "availableLanguage": ["en", "hi", "gu"]
      },
      "sameAs": [
        "https://www.nosh7.com",
        "https://www.instagram.com/nosh7salad",
        "https://link.zomato.com/xqzv/rshare?id=4824355730563e1b",
        "https://www.swiggy.com/city/ahmedabad/nosh-7-vastrapur-rest1152457",
        "https://g.page/r/CeuSXgSA4qXEEBE"
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://nosh7.in/#website",
      "url": "https://nosh7.in/",
      "name": "NOSH7",
      "publisher": { "@id": "https://nosh7.in/#organization" },
      "inLanguage": "en-IN",
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://nosh7.in/?s={search_term_string}"
        },
        "query-input": "required name=search_term_string"
      }
    }
  ]
}
</script>
```

> If the site has no search endpoint, drop the `potentialAction` block rather than pointing it at a page that does not search.

### 3.2 The one true business (homepage only): FoodEstablishment

This is the ONLY page that should carry the address, hours, geo, and aggregateRating. Add these nodes into the homepage `@graph` alongside 3.1.

```json
{
  "@type": ["FoodEstablishment", "LocalBusiness"],
  "@id": "https://nosh7.in/#business",
  "name": "NOSH7",
  "parentOrganization": { "@id": "https://nosh7.in/#organization" },
  "url": "https://nosh7.in/",
  "image": { "@id": "https://nosh7.in/#logo" },
  "telephone": "+91-9712989498",
  "priceRange": "₹200-₹400",
  "servesCuisine": ["Pure Vegetarian", "Salads", "Health Food"],
  "suitableForDiet": "https://schema.org/VegetarianDiet",
  "hasMenu": "https://nosh7.in/menu/",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "5A, Akshat Avenue, Opposite Revtri Tower, Ramdevnagar Road, Satellite",
    "addressLocality": "Ahmedabad",
    "addressRegion": "Gujarat",
    "postalCode": "380015",
    "addressCountry": "IN"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "23.0300",
    "longitude": "72.5100"
  },
  "hasMap": "https://g.page/r/CeuSXgSA4qXEEBE",
  "openingHoursSpecification": {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
    "opens": "08:00",
    "closes": "20:00"
  },
  "sameAs": [ "https://www.instagram.com/nosh7salad" ],
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.6",
    "bestRating": "5",
    "worstRating": "1",
    "reviewCount": "REAL_GBP_COUNT"
  },
  "review": [
    {
      "@type": "Review",
      "author": { "@type": "Person", "name": "Jael Das" },
      "reviewRating": { "@type": "Rating", "ratingValue": "5", "bestRating": "5" },
      "reviewBody": "Weekly offer was worth every penny. Portion control, freshness and taste are 5/5."
    }
  ]
}
```

> Replace `REAL_GBP_COUNT` and the geo values with the actual numbers from your Google Business Profile. Get exact lat/lng from the `g.page` listing.

### 3.3 WebPage + BreadcrumbList (every inner page)

Add to each inner page's `@graph` (together with 3.1). Change `@id`, `name`, `url`, breadcrumb items, and dates per page.

```json
{
  "@type": "WebPage",
  "@id": "https://nosh7.in/satellite-ahmedabad.html#webpage",
  "url": "https://nosh7.in/satellite-ahmedabad.html",
  "name": "Healthy Salad Meal Delivery in Satellite, Ahmedabad | NOSH7",
  "isPartOf": { "@id": "https://nosh7.in/#website" },
  "about": { "@id": "https://nosh7.in/#organization" },
  "primaryImageOfPage": { "@id": "https://nosh7.in/#logo" },
  "inLanguage": "en-IN",
  "datePublished": "2026-05-01",
  "dateModified": "2026-08-14",
  "breadcrumb": { "@id": "https://nosh7.in/satellite-ahmedabad.html#breadcrumb" }
},
{
  "@type": "BreadcrumbList",
  "@id": "https://nosh7.in/satellite-ahmedabad.html#breadcrumb",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://nosh7.in/" },
    { "@type": "ListItem", "position": 2, "name": "Ahmedabad", "item": "https://nosh7.in/ahmedabad.html" },
    { "@type": "ListItem", "position": 3, "name": "Satellite" }
  ]
}
```

### 3.4 Article (blog posts)

```json
{
  "@type": "Article",
  "@id": "https://nosh7.in/blog-diabetes-ahmedabad.html#article",
  "isPartOf": { "@id": "https://nosh7.in/blog-diabetes-ahmedabad.html#webpage" },
  "mainEntityOfPage": { "@id": "https://nosh7.in/blog-diabetes-ahmedabad.html#webpage" },
  "headline": "Low-Glycaemic Meal Delivery in Ahmedabad for Diabetics",
  "description": "Managing diabetes through diet in Ahmedabad: low-GI, high-fibre vegetarian meals delivered fresh daily by NOSH7, with zero added sugar and no refined carbs.",
  "image": [
    "https://nosh7.in/assets/blog/diabetes-meal-1200x675.jpg"
  ],
  "author": {
    "@type": "Person",
    "name": "Sapna Ram",
    "url": "https://nosh7.in/about",
    "jobTitle": "Founder, NOSH7"
  },
  "publisher": { "@id": "https://nosh7.in/#organization" },
  "datePublished": "2026-04-22",
  "dateModified": "2026-05-19",
  "inLanguage": "en-IN",
  "articleSection": "Diabetes",
  "keywords": "diabetic meal delivery ahmedabad, low GI meals, sugar-free tiffin"
}
```

> `image` must be a real photo, ideally 1200x675 or larger. Author should be a real named person for these health (YMYL) posts.

### 3.5 Location / service-area pages (replace the per-suburb FoodEstablishment)

Do NOT declare a new `LocalBusiness` here. Use `Service` with `areaServed` and reference the one business:

```json
{
  "@type": "Service",
  "@id": "https://nosh7.in/satellite-ahmedabad.html#service",
  "serviceType": "Healthy salad meal subscription delivery",
  "provider": { "@id": "https://nosh7.in/#business" },
  "areaServed": {
    "@type": "Place",
    "name": "Satellite, Ahmedabad",
    "geo": { "@type": "GeoCoordinates", "latitude": "23.0300", "longitude": "72.5100" }
  },
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "NOSH7 subscription plans",
    "itemListElement": [
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Weekly salad subscription" } }
    ]
  }
}
```

Keep the existing `FAQPage` on these pages, and add the 3.3 WebPage + Breadcrumb. This removes the 40-duplicate-business problem while keeping local relevance via `areaServed` + `geo`.

### 3.6 Product / pack pages

```json
{
  "@type": "Product",
  "@id": "https://nosh7.in/fruit-bowl-pack-ahmedabad.html#product",
  "name": "NOSH7 Fruit Bowl Pack",
  "description": "Fresh-cut seasonal fruit bowls topped with superfood seeds and nuts, delivered daily across Ahmedabad. 5-day trial pack.",
  "sku": "N7-FRUITBOWL-5D",
  "brand": { "@id": "https://nosh7.in/#organization" },
  "image": [ "https://nosh7.in/assets/products/fruit-bowl-1200.jpg" ],
  "offers": {
    "@type": "Offer",
    "price": "1250",
    "priceCurrency": "INR",
    "priceValidUntil": "2026-12-31",
    "availability": "https://schema.org/InStock",
    "itemCondition": "https://schema.org/NewCondition",
    "url": "https://start.nosh7.in/",
    "seller": { "@id": "https://nosh7.in/#organization" },
    "shippingDetails": {
      "@type": "OfferShippingDetails",
      "shippingRate": { "@type": "MonetaryAmount", "value": "0", "currency": "INR" },
      "shippingDestination": { "@type": "DefinedRegion", "addressCountry": "IN", "addressRegion": "Gujarat" },
      "deliveryTime": {
        "@type": "ShippingDeliveryTime",
        "handlingTime": { "@type": "QuantitativeValue", "minValue": 0, "maxValue": 1, "unitCode": "DAY" },
        "transitTime": { "@type": "QuantitativeValue", "minValue": 0, "maxValue": 1, "unitCode": "DAY" }
      }
    },
    "hasMerchantReturnPolicy": {
      "@type": "MerchantReturnPolicy",
      "applicableCountry": "IN",
      "returnPolicyCategory": "https://schema.org/MerchantReturnNotPermitted"
    }
  }
}
```

> Only add `aggregateRating`/`review` to a Product if that product actually shows reviews on the page. Fresh food is typically non-returnable, hence `MerchantReturnNotPermitted`; adjust to your real policy. Use a real dish photo, not the logo.

### 3.7 Keep as-is (already fine, just add `@id` links)

- `FAQPage`: correct and valuable. Just make sure each page's FAQ answers real on-page questions.
- `WebApplication` (BMI calculator): fine. Add `"isPartOf": {"@id": "https://nosh7.in/#website"}`.
- `Menu` (menu page): fine. Reference it from the homepage business via `hasMenu` (done in 3.2).
- `Blog` (blog.html): add `"publisher": {"@id": "https://nosh7.in/#organization"}` and `"isPartOf": {"@id": "https://nosh7.in/#website"}`.

---

## 4. Implementation order (highest ROI first)

1. **P0-A ratings:** replace `reviewCount: "1000"` with real GBP numbers; remove `aggregateRating` from Product/location pages that have no on-page reviews. (Removes manual-action risk. Do first.)
2. **P0-B + 3.1:** ship the shared Organization + WebSite `@graph` on every page; change all `publisher`/`brand`/`provider` to `{"@id": "https://nosh7.in/#organization"}`. (Consolidates the entity.)
3. **P0-C + 3.5:** convert the 40 location `FoodEstablishment` nodes to `Service` + `areaServed`; keep one real business node on the homepage (3.2). (Removes doorway risk, adds geo relevance.)
4. **P1 + 3.3:** add `WebPage` + `isPartOf` + link the existing breadcrumbs, plus `geo` on the business.
5. **P2:** upgrade Article (3.4) and Product (3.6).
6. **P3:** array `servesCuisine`, enum `suitableForDiet`, `en-IN`, `hasMenu`, `contactPoint`.

**Validate every change** in the [Rich Results Test](https://search.google.com/test/rich-results) and [Schema Markup Validator](https://validator.schema.org/) before pushing, then watch Google Search Console > Enhancements for FAQ / Product / Breadcrumb / Merchant listings and Experience > Manual actions for any structured-data flags.

Because these pages are largely template-generated, make the change once in the generator/template and re-emit all pages so the `@graph` stays consistent site-wide.
