#!/usr/bin/env python3
"""Builds the hanko seal SVGs (seal-*.svg) from Kosugi Maru glyph outlines.

Usage: python3 -I make_seals.py <KosugiMaru .ttf> <out dir>
  e.g. python3 -I mods/nk-toast/tools/make_seals.py mods/nk-pane/fonts/KosugiMaru-nk.ttf mods/nk-toast
(the nk-pane subset has 完了警告通知). The em box (hhea ascent+descent) is stretched onto each half.
Herdr's SVG renderer may not see app fonts, so the kanji are baked in as paths.
The ink edge is a deterministic jittered rounded square plus a few paper specks.
"""
import math, random, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

VERSION = 4  # bump when the art changes: Herdr caches images by path
SEALS = {"done": "完了", "warn": "警告", "info": "通知"}
RED, CREAM = "#fb4934", "#fbf1c7"
W, V = 72, 100  # viewBox: a tall seal, two kanji stacked

def ink_edge(seed):
    rnd = random.Random(seed)
    m, r, pts = 2.5, 11.0, []
    # rounded square traced by angle; corner arcs + straight edges, radius jittered
    corners = [(W - m - r, V - m - r), (m + r, V - m - r), (m + r, m + r), (W - m - r, m + r)]
    for ci, (cx, cy) in enumerate(corners):
        a0 = ci * math.pi / 2
        for k in range(7):
            a = a0 + k * (math.pi / 2) / 6
            j = rnd.uniform(-0.9, 0.9)
            pts.append((cx + (r + j) * math.cos(a), cy + (r + j) * math.sin(a)))
        # wobble along the straight edge to the next corner
        nx, ny = corners[(ci + 1) % 4]
        a = a0 + math.pi / 2
        sx, sy = cx + r * math.cos(a), cy + r * math.sin(a)
        ex, ey = nx + r * math.cos(a), ny + r * math.sin(a)
        for k in range(1, 6):
            t = k / 6
            j = rnd.uniform(-1.1, 0.7)
            pts.append((sx + (ex - sx) * t + j * math.cos(a), sy + (ey - sy) * t + j * math.sin(a)))
    return "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts) + " Z"

def specks(seed):
    rnd = random.Random(seed * 7 + 1)
    out = []
    for _ in range(5):
        side = rnd.randrange(4)
        d = rnd.uniform(4.5, 7)
        tx, ty = rnd.uniform(16, W - 16), rnd.uniform(16, V - 16)
        x, y = [(tx, d), (W - d, ty), (tx, V - d), (d, ty)][side]
        out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rnd.uniform(0.6, 1.4):.1f}" fill="{CREAM}" opacity="{rnd.uniform(.5, .9):.2f}"/>')
    return "".join(out)

def glyph_path(font, ch, x, y, w, h):
    gs, cmap = font.getGlyphSet(), font.getBestCmap()
    upm = font["head"].unitsPerEm
    asc = font["hhea"].ascent
    desc = -font["hhea"].descent
    pen = SVGPathPen(gs)
    sx, sy = w / upm, h / (asc + desc)
    # font y-up -> svg y-down; map [-desc, asc] onto [y+h, y]
    tp = TransformPen(pen, (sx, 0, 0, -sy, x, y + asc * sy))
    gs[cmap[ord(ch)]].draw(tp)
    return pen.getCommands()

def main(ttf, out):
    font = TTFont(ttf)
    for i, (name, text) in enumerate(SEALS.items()):
        # two characters stacked vertically (tategaki), each stretched to fill its half
        p1 = glyph_path(font, text[0], 9, 8, 54, 44)
        p2 = glyph_path(font, text[1], 9, 49, 54, 44)
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {V}" width="{W}" height="{V}">'
               f'<path d="{ink_edge(i + 3)}" fill="{RED}"/>'
               f'<path d="{p1} {p2}" fill="{CREAM}" stroke="{CREAM}" stroke-width="0.7" stroke-linejoin="round"/>{specks(i + 3)}</svg>\n')
        with open(f"{out}/seal-{name}-v{VERSION}.svg", "w") as f:
            f.write(svg)
        print(f"{out}/seal-{name}-v{VERSION}.svg", len(svg))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
