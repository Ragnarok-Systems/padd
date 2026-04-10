#!/usr/bin/env python3
"""Generate a Star Trek PADD-style app icon."""

import os
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import math


def rounded_rectangle(draw, bbox, radius, fill=None, outline=None, width=1):
    """Draw a rounded rectangle."""
    x0, y0, x1, y1 = bbox
    r = radius
    # Four corners
    draw.pieslice([x0, y0, x0 + 2*r, y0 + 2*r], 180, 270, fill=fill, outline=outline, width=width)
    draw.pieslice([x1 - 2*r, y0, x1, y0 + 2*r], 270, 360, fill=fill, outline=outline, width=width)
    draw.pieslice([x0, y1 - 2*r, x0 + 2*r, y1], 90, 180, fill=fill, outline=outline, width=width)
    draw.pieslice([x1 - 2*r, y1 - 2*r, x1, y1], 0, 90, fill=fill, outline=outline, width=width)
    # Rectangles to fill the body
    draw.rectangle([x0 + r, y0, x1 - r, y1], fill=fill)
    draw.rectangle([x0, y0 + r, x0 + r, y1 - r], fill=fill)
    draw.rectangle([x1 - r, y0 + r, x1, y1 - r], fill=fill)


def create_padd_icon(size=512):
    """Create a Star Trek PADD icon at the given size."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Scale factor
    s = size / 512.0

    # --- PADD body (outer shell) ---
    # Dark blue-gray metallic body
    body_color = (30, 35, 50)
    body_highlight = (45, 50, 65)
    body_bbox = (int(56*s), int(28*s), int(456*s), int(484*s))
    body_radius = int(40*s)
    rounded_rectangle(draw, body_bbox, body_radius, fill=body_color)

    # Subtle edge highlight (lighter border)
    edge_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    edge_draw = ImageDraw.Draw(edge_img)
    # Outer edge
    rounded_rectangle(edge_draw, body_bbox, body_radius, fill=(60, 68, 90, 180))
    # Inner cutout (slightly smaller)
    inner_edge = (int(59*s), int(31*s), int(453*s), int(481*s))
    rounded_rectangle(edge_draw, inner_edge, int(38*s), fill=(0, 0, 0, 0))
    # Composite
    img = Image.alpha_composite(img, edge_img)
    draw = ImageDraw.Draw(img)
    # Redraw body inside the edge
    rounded_rectangle(draw, inner_edge, int(38*s), fill=body_color)

    # --- LCARS top bar area ---
    # Top section with LCARS-style colored bars
    bar_top = int(48*s)
    bar_height = int(36*s)
    bar_y0 = bar_top
    bar_y1 = bar_top + bar_height

    # LCARS colors
    amber = (255, 153, 0)
    teal = (0, 200, 200)
    lavender = (180, 150, 220)
    pale_gold = (255, 207, 127)

    # Left rounded cap (amber)
    cap_r = int(18*s)
    draw.ellipse([int(72*s), bar_y0, int(72*s) + 2*cap_r, bar_y1], fill=amber)
    draw.rectangle([int(72*s) + cap_r, bar_y0, int(160*s), bar_y1], fill=amber)

    # Middle bar (teal)
    draw.rectangle([int(168*s), bar_y0, int(290*s), bar_y1], fill=teal)

    # Next bar (lavender)
    draw.rectangle([int(298*s), bar_y0, int(370*s), bar_y1], fill=lavender)

    # Right bar with rounded cap (pale gold)
    draw.rectangle([int(378*s), bar_y0, int(440*s) - cap_r, bar_y1], fill=pale_gold)
    draw.ellipse([int(440*s) - 2*cap_r, bar_y0, int(440*s), bar_y1], fill=pale_gold)

    # --- Small LCARS sidebar bars on the left ---
    sidebar_x0 = int(72*s)
    sidebar_x1 = int(104*s)
    sidebar_colors = [teal, amber, lavender]
    sidebar_starts = [int(108*s), int(160*s), int(196*s)]
    sidebar_heights = [int(40*s), int(28*s), int(24*s)]

    for i, (color, sy, sh) in enumerate(zip(sidebar_colors, sidebar_starts, sidebar_heights)):
        r = int(8*s)
        draw.ellipse([sidebar_x0, sy, sidebar_x0 + 2*r, sy + 2*r], fill=color)
        draw.ellipse([sidebar_x0, sy + sh - 2*r, sidebar_x0 + 2*r, sy + sh], fill=color)
        draw.rectangle([sidebar_x0, sy + r, sidebar_x0 + 2*r, sy + sh - r], fill=color)
        draw.rectangle([sidebar_x0 + r, sy, sidebar_x1, sy + sh], fill=color)

    # --- Main screen area ---
    screen_bbox = (int(118*s), int(100*s), int(440*s), int(420*s))
    screen_radius = int(12*s)
    screen_base = (8, 18, 32)
    rounded_rectangle(draw, screen_bbox, screen_radius, fill=screen_base)

    # Glowing screen effect - create a glow layer
    glow_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)

    # Inner glow (cyan/teal)
    glow_color = (0, 180, 200, 60)
    glow_bbox_inner = (int(126*s), int(108*s), int(432*s), int(412*s))
    rounded_rectangle(glow_draw, glow_bbox_inner, int(8*s), fill=glow_color)

    # Brighter center glow
    center_glow = (0, 220, 235, 35)
    center_bbox = (int(150*s), int(130*s), int(410*s), int(390*s))
    rounded_rectangle(glow_draw, center_bbox, int(6*s), fill=center_glow)

    # Apply gaussian blur to glow
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=int(12*s)))
    img = Image.alpha_composite(img, glow_layer)
    draw = ImageDraw.Draw(img)

    # Re-draw screen with slight transparency for the glow to show through edges
    screen_color = (10, 22, 38, 230)
    screen_overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    screen_draw = ImageDraw.Draw(screen_overlay)
    rounded_rectangle(screen_draw, screen_bbox, screen_radius, fill=screen_color)
    img = Image.alpha_composite(img, screen_overlay)
    draw = ImageDraw.Draw(img)

    # --- Screen content: LCARS-style UI elements ---
    # Horizontal scan lines (subtle)
    scan_step = max(1, int(6*s))
    for y in range(int(110*s), int(410*s), scan_step):
        line_alpha = 15
        draw.line([(int(125*s), y), (int(435*s), y)], fill=(0, 180, 210, line_alpha), width=1)

    # Screen header bar
    header_y = int(112*s)
    header_h = int(20*s)
    draw.rectangle([int(130*s), header_y, int(240*s), header_y + header_h], fill=(0, 180, 200, 140))
    draw.rectangle([int(248*s), header_y, int(320*s), header_y + header_h], fill=(255, 153, 0, 120))
    draw.rectangle([int(328*s), header_y, int(430*s), header_y + header_h], fill=(180, 150, 220, 100))

    # Data blocks on screen (simulating LCARS readouts)
    data_color_1 = (0, 160, 190, 80)
    data_color_2 = (0, 140, 170, 50)
    block_x0 = int(135*s)

    # Row of data blocks
    for row in range(4):
        by = int(150*s) + row * int(56*s)
        # Label bar
        draw.rectangle([block_x0, by, block_x0 + int(60*s), by + int(14*s)], fill=(255, 153, 0, 90))
        # Data area
        draw.rectangle([block_x0 + int(68*s), by, block_x0 + int(240*s), by + int(14*s)], fill=data_color_1)
        # Secondary line
        draw.rectangle([block_x0, by + int(20*s), block_x0 + int(180*s), by + int(32*s)], fill=data_color_2)
        # Accent dot
        draw.ellipse([block_x0 + int(250*s), by + int(2*s), block_x0 + int(262*s), by + int(12*s)],
                     fill=(0, 200, 200, 100))

    # --- Bottom section: LCARS footer bars ---
    footer_y0 = int(432*s)
    footer_y1 = int(466*s)
    footer_r = int(17*s)

    # Left rounded cap
    draw.ellipse([int(72*s), footer_y0, int(72*s) + 2*footer_r, footer_y1], fill=teal)
    draw.rectangle([int(72*s) + footer_r, footer_y0, int(200*s), footer_y1], fill=teal)

    # Middle
    draw.rectangle([int(208*s), footer_y0, int(340*s), footer_y1], fill=lavender)

    # Right with cap
    draw.rectangle([int(348*s), footer_y0, int(440*s) - footer_r, footer_y1], fill=amber)
    draw.ellipse([int(440*s) - 2*footer_r, footer_y0, int(440*s), footer_y1], fill=amber)

    # --- Outer glow effect for the whole PADD ---
    outer_glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    og_draw = ImageDraw.Draw(outer_glow)
    # Draw a slightly larger version of the body shape
    glow_expand = int(6*s)
    glow_body = (
        body_bbox[0] - glow_expand,
        body_bbox[1] - glow_expand,
        body_bbox[2] + glow_expand,
        body_bbox[3] + glow_expand,
    )
    rounded_rectangle(og_draw, glow_body, body_radius + glow_expand, fill=(0, 140, 180, 25))
    outer_glow = outer_glow.filter(ImageFilter.GaussianBlur(radius=int(10*s)))

    # Composite: glow behind, then icon on top
    final = Image.alpha_composite(outer_glow, img)

    return final


def main():
    output_dir = os.path.dirname(os.path.abspath(__file__))

    # Generate 512x512 PNG
    print("Generating 512x512 icon...")
    icon_512 = create_padd_icon(512)
    icon_512.save(f"{output_dir}/icon.png", "PNG")
    print(f"  Saved {output_dir}/icon.png")

    # Generate ICO file with multiple sizes
    print("Generating ICO file with multiple sizes...")
    ico_sizes = [16, 32, 48, 64, 128, 256]
    ico_images = []
    for s in ico_sizes:
        print(f"  Rendering {s}x{s}...")
        ico_img = create_padd_icon(s)
        # Convert to RGBA for ICO
        ico_images.append(ico_img)

    # Save ICO - render at 256 and resize down for each needed size
    # Pillow ICO works best when we provide pre-sized images
    icon_256 = create_padd_icon(256)
    ico_frames = []
    for s in ico_sizes:
        if s == 256:
            ico_frames.append(icon_256.copy())
        else:
            resized = icon_256.resize((s, s), Image.LANCZOS)
            ico_frames.append(resized)

    ico_frames[-1].save(
        f"{output_dir}/icon.ico",
        format="ICO",
        append_images=ico_frames[:-1],
    )
    print(f"  Saved {output_dir}/icon.ico")

    # Generate 1024x1024 for macOS (icns typically needs this)
    print("Generating 1024x1024 PNG for macOS...")
    icon_1024 = create_padd_icon(1024)
    icon_1024.save(f"{output_dir}/icon_1024.png", "PNG")
    print(f"  Saved {output_dir}/icon_1024.png")

    # Try to generate icns if possible
    try:
        # macOS icns requires specific sizes, we'll try png2icns or just note it
        import subprocess
        result = subprocess.run(["which", "png2icns"], capture_output=True, text=True)
        if result.returncode == 0:
            # Generate all needed sizes for icns
            icns_sizes = [16, 32, 128, 256, 512, 1024]
            icns_files = []
            for s in icns_sizes:
                fname = f"{output_dir}/icon_{s}x{s}.png"
                img = create_padd_icon(s)
                img.save(fname, "PNG")
                icns_files.append(fname)
            subprocess.run(["png2icns", f"{output_dir}/icon.icns"] + icns_files)
            # Clean up temp files
            for f in icns_files:
                import os
                os.remove(f)
            print(f"  Saved {output_dir}/icon.icns")
        else:
            print("  png2icns not available - use icon_1024.png for macOS icns conversion")
    except Exception as e:
        print(f"  Could not generate icns: {e}")
        print("  Use icon_1024.png for macOS icns conversion")

    print("\nDone! Generated icon files:")
    print(f"  - {output_dir}/icon.png (512x512)")
    print(f"  - {output_dir}/icon.ico (multi-size: {ico_sizes})")
    print(f"  - {output_dir}/icon_1024.png (1024x1024 for macOS)")


if __name__ == "__main__":
    main()
