# NOSH7.in — India SEO Site

Local India SEO site for NOSH7 salad cloud kitchen, Ahmedabad.
All purchases redirect to → **nosh7.com/order**

---

## File Structure

```
nosh7-in/
├── index.html          Hindi/Hinglish homepage
├── ahmedabad.html      Local Ahmedabad SEO page
├── subscription.html   Plans page (links to nosh7.com/order)
├── sitemap.xml         XML sitemap
├── robots.txt          Search crawler config
├── CLAUDE.md           Claude Code agent context
├── .claude/
│   └── settings.json   Claude Code permissions
└── assets/
    ├── og-image.jpg    (add: 1200x630 OG image)
    ├── og-ahmedabad.jpg
    └── og-plans.jpg
```

---

## Before Going Live — Checklist

- [ ] Replace `9712989498` in WhatsApp links with real number
- [ ] Replace `hello@nosh7.com` with real email
- [ ] Update prices if different from current values
- [ ] Add OG images to /assets/ folder (1200x630px, WebP)
- [ ] Update `<lastmod>` dates in sitemap.xml after any edits
- [ ] Add Google Analytics 4 tag to all pages

---

## Deploy to GitHub Pages

```bash
# 1. Create GitHub repo: nosh7-in
git init
git add .
git commit -m "Initial NOSH7.in launch"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/nosh7-in.git
git push -u origin main

# 2. Go to GitHub → Settings → Pages → Source: Deploy from main branch
# 3. Add custom domain: nosh.in
# 4. Enable HTTPS (auto via GitHub Pages)
```

---

## DNS Settings (at Registrar)

Add these records after GitHub Pages setup:

| Type  | Name | Value                   |
|-------|------|-------------------------|
| A     | @    | 185.199.108.153         |
| A     | @    | 185.199.109.153         |
| A     | @    | 185.199.110.153         |
| A     | @    | 185.199.111.153         |
| CNAME | www  | YOUR_USERNAME.github.io |

---

## After Launch

1. Add nosh.in to **Google Search Console**
2. Submit sitemap: `https://nosh7.in/sitemap.xml`
3. Add nosh.in as website URL in **Google Business Profile**
4. Add hreflang on nosh7.com pointing to nosh.in

### hreflang to add on nosh7.com `<head>`:
```html
<link rel="alternate" hreflang="hi-IN" href="https://nosh7.in/" />
<link rel="alternate" hreflang="en" href="https://www.nosh7.com/" />
```

---

## Running Claude Code SEO Agent

```bash
# Install Claude Code (one time)
npm install -g @anthropic-ai/claude-code

# Set API key (one time)
export ANTHROPIC_API_KEY=your_key_here

# Navigate to project
cd nosh7-in

# Audit only (no changes)
claude --permission-mode plan "Audit all pages for SEO issues"

# Auto-fix pass
claude "Run full SEO improvement pass per CLAUDE.md"

# Weekly cron (add to crontab)
0 9 * * 1 cd /path/to/nosh7-in && claude "Weekly SEO pass — fix issues, update sitemap lastmod, check all CTAs point to nosh7.com/order"
```
