#!/usr/bin/env python3
"""Generates PHOSPHOR's baked art (Pillow):
  mods/ph-boot/wordmark-glow.png       soft amber glow behind the HERDR/OS wordmark in the boot overlay
  backgrounds/phosphor-scanlines.png   static scanline texture behind terminals (layout root background)
Run from the repo root: python3 -I tools/make-boot-art.py"""
import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AMBER = (0xfa, 0xbd, 0x2f)

def glow():
    font = ImageFont.truetype(os.path.join(root, "mods/ph-kit/fonts/PHWordmark-Regular.ttf"), 46 * 2)
    W, H = 330 * 2, 92 * 2
    mask = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(mask)
    # text placed where the live wordmark sits: 24px in, vertically centred (2x scale)
    bbox = d.textbbox((0, 0), "HERDR/OS", font=font)
    th = bbox[3] - bbox[1]
    d.text((24 * 2 - bbox[0], (H - th) // 2 - bbox[1]), "HERDR/OS", font=font, fill=255)
    wide = mask.filter(ImageFilter.GaussianBlur(18))
    near = mask.filter(ImageFilter.GaussianBlur(6))
    a = Image.eval(Image.merge("L", [wide]), lambda v: v)
    out = Image.new("RGBA", (W, H), AMBER + (0,))
    alpha = Image.new("L", (W, H))
    alpha.putdata([min(255, int(w * 0.9 + n * 0.6)) for w, n in zip(wide.getdata(), near.getdata())])
    out.putalpha(alpha)
    out.save(os.path.join(root, "mods/ph-boot/wordmark-glow.png"), optimize=True)

def scanlines(w, h, period, line_alpha):
    """Dark gaps every `period` px over transparent: the image only darkens what's under it slightly.
    Fully opaque base is the pane colour so terminals keep their background."""
    base = (0x12, 0x11, 0x0e)
    dark = tuple(max(0, round(c * (1 - line_alpha))) for c in base)
    img = Image.new("RGB", (w, h), base)
    d = ImageDraw.Draw(img)
    for y in range(period - 1, h, period):
        d.line([(0, y), (w - 1, y)], fill=dark)
    return img

if __name__ == "__main__":
    glow()
    w, h = (int(x) for x in (sys.argv[1:3] if len(sys.argv) > 2 else ("5120", "1440")))
    scanlines(w, h, 3, 0.45).save(os.path.join(root, "backgrounds/phosphor-scanlines.png"), optimize=True)
    print("ok")
