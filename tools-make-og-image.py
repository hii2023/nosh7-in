#!/usr/bin/env python3
"""Compose the 1200x630 Open Graph card for nosh7.in.

Layout: brand-green gradient panel on the left carrying the wordmark, headline,
price line and trust row; the salad artwork placed as a large circle that bleeds
off the right edge, its plate rim forming a clean arc against the panel.

To swap in a real photo later: point SOURCE at it. If the new image is a plain
rectangular photo rather than a centred circular plate, set CIRCLE = False so it
is pasted as a bleeding rectangle instead.
"""
from PIL import Image, ImageDraw, ImageFont
import math
import sys

SOURCE = '/Users/altafsimavatwala/Downloads/doodle-bg.png'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/og-draft.png'
CIRCLE = True

W, H = 1200, 630
GREEN_TOP = (26, 60, 46)      # #1a3c2e
GREEN_BOT = (10, 26, 18)      # #0a1a12
CREAM = (249, 245, 239)       # #f9f5ef
SAGE = (168, 197, 160)        # #a8c5a0
SAFFRON = (214, 150, 100)
BODY = (206, 219, 208)

TTC = '/System/Library/Fonts/Helvetica.ttc'
REG, BOLD = 0, 1
font = lambda size, face=REG: ImageFont.truetype(TTC, size, index=face)


def content_box(im, tol=245):
    g = im.convert('L')
    m = g.point(lambda p: 0 if p >= tol else 255)
    return m.getbbox()


def star(draw, cx, cy, r, fill):
    pts = []
    for i in range(10):
        a = math.radians(-90 + i * 36)
        rad = r if i % 2 == 0 else r * 0.42
        pts.append((cx + rad * math.cos(a), cy + rad * math.sin(a)))
    draw.polygon(pts, fill=fill)


def bg_gradient(size):
    w, h = size
    g = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(g)
    for y in range(h):
        t = y / (h - 1)
        d.line([(0, y), (w, y)], fill=tuple(
            int(GREEN_TOP[i] + (GREEN_BOT[i] - GREEN_TOP[i]) * t) for i in range(3)))
    return g


def main():
    card = bg_gradient((W, H))

    src = Image.open(SOURCE).convert('RGB')
    box = content_box(src)
    src = src.crop(box)

    if CIRCLE:
        # Square-crop to the plate, render as a circle ~1.5x the canvas height,
        # centre pushed off the right edge so a tall clean arc faces the panel.
        side = min(src.size)
        sx = (src.width - side) // 2
        sy = (src.height - side) // 2
        disc = src.crop((sx, sy, sx + side, sy + side))
        D = int(H * 1.62)
        disc = disc.resize((D, D), Image.LANCZOS)
        mask = Image.new('L', (D, D), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, D - 1, D - 1), fill=255)
        cx, cy = int(W * 0.94), H // 2          # circle centre, past right edge
        card.paste(disc, (cx - D // 2, cy - D // 2), mask)
    else:
        art_h = int(H * 1.2)
        art_w = int(src.width * art_h / src.height)
        art = src.resize((art_w, art_h), Image.LANCZOS)
        card.paste(art, (W - art_w + 20, (H - art_h) // 2))

    d = ImageDraw.Draw(card)
    x = 64

    d.text((x, 54), 'NOSH7', font=font(42, BOLD), fill=CREAM)
    d.text((x + 158, 67), 'AHMEDABAD', font=font(17, BOLD), fill=SAGE)

    y = 140
    for line in ['Healthy Meal', 'Delivery in', 'Ahmedabad']:
        d.text((x, y), line, font=font(60, BOLD), fill=CREAM)
        y += 68

    y += 22
    d.text((x, y), 'Fresh pure veg bowls, high protein,', font=font(24), fill=BODY)
    tail = 'delivered daily. From '
    d.text((x, y + 33), tail, font=font(24), fill=BODY)
    w = d.textlength(tail, font=font(24))
    d.text((x + w, y + 33), '₹200/day', font=font(24, BOLD), fill=SAFFRON)

    ty = H - 72
    star(d, x + 9, ty + 12, 11, SAFFRON)
    d.text((x + 26, ty), '4.6', font=font(22, BOLD), fill=SAFFRON)
    d.text((x + 70, ty), '1,000+ reviews   ·   FSSAI Licensed',
           font=font(22), fill=SAGE)

    card.save(OUT, 'PNG')
    print('wrote %s  %dx%d' % (OUT, card.width, card.height))


if __name__ == '__main__':
    main()
