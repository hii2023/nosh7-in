#!/usr/bin/env python3
"""Rewrite <lastmod> in sitemap.xml from each page's last git commit date.

Run this AFTER committing content changes and BEFORE pushing, so the sitemap
reports dates Google can trust. Stale or invented lastmod values get the whole
signal ignored, which is worse than having none.

    python3 update-sitemap-lastmod.py          # rewrite sitemap.xml
    python3 update-sitemap-lastmod.py --check   # report drift, change nothing

Exits non-zero in --check mode if any entry is stale (useful in CI).
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SITEMAP = os.path.join(ROOT, 'sitemap.xml')
SITE = 'https://nosh7.in'


def last_commit_dates():
    """One git pass: {path: YYYY-MM-DD of most recent commit touching it}."""
    out = subprocess.run(
        ['git', 'log', '--format=%cs', '--name-only', '--', '*.html'],
        cwd=ROOT, capture_output=True, text=True, check=True).stdout
    dates, current = {}, None
    for line in out.splitlines():
        line = line.strip()
        if re.fullmatch(r'\d{4}-\d{2}-\d{2}', line):
            current = line
        elif line.endswith('.html') and line not in dates:
            dates[line] = current
    return dates


def path_for(loc):
    """Map a sitemap URL to its source file. Directory URLs serve index.html."""
    rel = loc.replace(SITE, '').lstrip('/')
    if not rel:
        return 'index.html'
    if rel.endswith('/'):
        return rel + 'index.html'
    return rel


def main():
    check_only = '--check' in sys.argv
    dates = last_commit_dates()
    xml = open(SITEMAP, encoding='utf-8').read()
    changed, missing = [], []

    def fix(block):
        loc = re.search(r'<loc>(.*?)</loc>', block).group(1)
        path = path_for(loc)
        new = dates.get(path)
        if not new:
            if os.path.exists(os.path.join(ROOT, path)):
                missing.append(path)
            return block
        old_m = re.search(r'<lastmod>(.*?)</lastmod>', block)
        if not old_m:
            return block
        if old_m.group(1) != new:
            changed.append((path, old_m.group(1), new))
            return block.replace('<lastmod>%s</lastmod>' % old_m.group(1),
                                 '<lastmod>%s</lastmod>' % new)
        return block

    updated = re.sub(r'<url>.*?</url>', lambda m: fix(m.group(0)), xml, flags=re.S)

    for path, old, new in changed:
        print('%-46s %s -> %s' % (path, old, new))
    if missing:
        print('\nno git history (left untouched): %s' % ', '.join(missing))

    if check_only:
        print('\n%d entr%s stale' % (len(changed), 'y' if len(changed) == 1 else 'ies'))
        return 1 if changed else 0

    if changed:
        open(SITEMAP, 'w', encoding='utf-8').write(updated)
        print('\nsitemap.xml updated: %d entries' % len(changed))
    else:
        print('sitemap.xml already current')
    return 0


if __name__ == '__main__':
    sys.exit(main())
