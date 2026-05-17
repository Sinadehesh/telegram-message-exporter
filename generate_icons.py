#!/usr/bin/env python3
"""
Run this script once to generate PNG icons from the SVG source.
Requires: pip install cairosvg
"""
try:
    import cairosvg
    import os

    with open('icons/icon.svg') as f:
        svg = f.read()

    os.makedirs('icons', exist_ok=True)
    for size in [16, 48, 128]:
        cairosvg.svg2png(bytestring=svg.encode(), write_to=f'icons/icon{size}.png', output_width=size, output_height=size)
        print(f'Generated icons/icon{size}.png')
    print('Done!')
except ImportError:
    print('Install cairosvg: pip install cairosvg')
    print('Or manually create 16x16, 48x48, 128x128 PNG icons from icons/icon.svg')
