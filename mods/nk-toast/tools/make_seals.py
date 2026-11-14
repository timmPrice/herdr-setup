#!/usr/bin/env python3
"""Builds the hanko seal SVGs (seal-*.svg) from DotGothic16 glyph outlines.

Usage: python3 -I make_seals.py <DotGothic16-Regular.ttf> <out dir>
Herdr's SVG renderer may not see app fonts, so the kanji are baked in as paths.
The ink edge is a deterministic jittered rounded square plus a few paper specks.
"""
import math, random, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

SEALS = {"done": "完了", "warn": "警告", "info": "通知"}
RED, CREAM = "#fb4934", "#fbf1c7"
V = 100  # viewBox size

def ink_edge(seed):
    rnd = random.Random(seed)
    m, r, pts = 3.0, 14.0, []
    # rounded square traced by angle; corner arcs + straight edges, radius jittered
    corners = [(V - m - r, V - m - r), (m + r, V - m - r), (m + r, m + r), (V - m - r, m + r)]
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
        t = rnd.uniform(18, 82)
        d = rnd.uniform(4.5, 8)
        x, y = [(t, d), (V - d, t), (t, V - d), (d, t)][side]
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
        p1 = glyph_path(font, text[0], 17, 10, 66, 42)
        p2 = glyph_path(font, text[1], 17, 49, 66, 42)
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {V} {V}" width="{V}" height="{V}">'
               f'<path d="{ink_edge(i + 3)}" fill="{RED}"/>'
               f'<path d="{p1} {p2}" fill="{CREAM}"/>{specks(i + 3)}</svg>\n')
        with open(f"{out}/seal-{name}.svg", "w") as f:
            f.write(svg)
        print(f"{out}/seal-{name}.svg", len(svg))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
