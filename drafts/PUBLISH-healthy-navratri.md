# Publish instructions: Healthy Navratri Fasting article

Publish the pre-written article that is staged at
`drafts/blog-healthy-navratri-fasting-ahmedabad.html` onto the live NOSH7 site.
Do NOT rewrite the article content. Work on branch `main`.

Repo rules: never use an em dash anywhere; all CTAs point to
https://start.nosh7.in/ ; commit then push to `main` (GitHub Pages auto-deploys).
If a direct push to `main` is rejected for permissions, create a branch and open a
PR instead, then stop and report that a PR is awaiting merge.

## Step 1 — Guard against double-publish
If `drafts/blog-healthy-navratri-fasting-ahmedabad.html` does NOT exist, the article
was already published. Stop and report that, do nothing else.

## Step 2 — Move the article into the site root
Run: `git mv drafts/blog-healthy-navratri-fasting-ahmedabad.html blog-healthy-navratri-fasting-ahmedabad.html`

## Step 3 — Add the card to blog.html
In `blog.html`, find the line containing `<div class="blog-grid">` and insert the
following block on a new line IMMEDIATELY AFTER it, so this card becomes the first
card in the grid. Insert verbatim:

```html
    <a href="https://nosh7.in/blog-healthy-navratri-fasting-ahmedabad.html" data-cat="lifestyle" class="blog-card">
      <div class="blog-card-top" style="color:#be185d; background: linear-gradient(135deg, #fce7f3, #f9a8d4);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.09 4.26L19 8l-3.5 3.2.9 4.8L12 13.9 7.6 16l.9-4.8L5 8l4.91-.74L12 3z"/></svg></div>
      <div class="blog-card-body">
        <div class="blog-card-tag">Festive &amp; Seasonal</div>
        <div class="blog-card-title">A Healthy Navratri: How to Fast Without Wrecking Your Diet</div>
        <div class="blog-card-desc">Navratri fasting should feel light, not heavy and fried. Skip the farali trap, fast smart, and stay energetic for all nine nights of garba with clean food and fresh fruit.</div>
        <div class="blog-card-meta"><span>7 min read</span></div>
      </div>
    </a>
```

## Step 4 — Bump the article count
In `blog.html` find `<p class="blog-count" id="blogCount">N articles</p>` (N is a
number) and replace N with N+1.

## Step 5 — Add the sitemap entry
In `sitemap.xml`, insert this block on a new line immediately before the closing
`</urlset>` tag (verbatim):

```xml
  <url>
    <loc>https://nosh7.in/blog-healthy-navratri-fasting-ahmedabad.html</loc>
    <lastmod>2026-09-11</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
```

## Step 6 — Remove this instruction file
Run: `git rm drafts/PUBLISH-healthy-navratri.md`

## Step 7 — Commit and push
Stage everything (`git add -A`), commit with message
`blog: publish 'A Healthy Navratri'`, then run
`python3 update-sitemap-lastmod.py` to refresh lastmod values, `git add sitemap.xml`,
and amend or add a follow-up commit. Then `git push` to `main`.

## Step 8 — Verify live
Wait for the GitHub Pages deploy to finish. If `gh` is available and authenticated
you may poll with `gh run list --repo hii2023/nosh7-in --workflow "Deploy to GitHub Pages" --limit 1`.
If `gh` is missing or not authenticated, do NOT block on it: simply re-run the curl
check below every 30 seconds for up to 6 minutes until it returns 200. Then:
- `curl -s -o /dev/null -w "%{http_code}" "https://nosh7.in/blog-healthy-navratri-fasting-ahmedabad.html?cb=$RANDOM"` must be 200.
- Confirm the card is live: `curl -s "https://nosh7.in/blog.html?cb=$RANDOM" | grep -c blog-healthy-navratri-fasting-ahmedabad.html` is at least 1.

## Step 9 — Ping IndexNow
Run `./indexnow-submit.sh` (expect `HTTP 200`).

## Step 10 — Report
Report: the live URL, HTTP status, that the card and sitemap entry are live, and the
IndexNow result. If anything failed, say exactly what and at which step.
