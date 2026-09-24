#!/usr/bin/env python3
"""
Generates the Learning Hub's hub-ring bubble layout (connector lines,
bubble positions, feature count) using a golden-angle phyllotaxis spiral,
and writes it into karmayogi-docs-explorer.template.html.

Why a spiral instead of hand-placed pixel coordinates: the previous layout
hardcoded exactly 12 bubbles evenly spaced 30 degrees apart around a fixed
ring. The moment a 13th feature was added there was no room left on that
ring at the same radius, which is what caused the Competency Hub bubble to
visually float outside the ring's guide circle.

A phyllotaxis spiral (the golden-angle pattern sunflower seeds use) gives
every index a closed-form position that never collides with any other
index, for any N. Concretely: existing bubbles never move when a new one
is appended -- so adding a feature is just adding one line to FEATURES
below and re-running this script, forever. No manual coordinate math, no
re-eyeballing an already-placed bubble.

Usage:
    python3 tools/layout_hub_ring.py            # rewrite the template
    python3 tools/layout_hub_ring.py --check     # verify only, exit 1 on drift

After running, re-build the explorer as usual:
    python3 tools/build_docs_explorer.py
"""
import math
import re
import sys
from pathlib import Path

TEMPLATE = Path(__file__).resolve().parent.parent / "karmayogi-docs-explorer.template.html"

# ─── The feature list ────────────────────────────────────────────────
# Add a new Learning Hub feature by appending one tuple here, then run
# this script. Append at the end -- existing bubbles keep their position
# along the spiral only if their relative order doesn't change.
#
# (id, label, size_px, font_size_px_or_None, extra)
#   id        -- must match the fdoc's data-fdoc="..." and openFeature('...')
#   label     -- visible text
#   size_px   -- bubble diameter; tune per label length (existing values
#                span 128-144px)
#   font_size -- None to use the button's default font-size
#   extra     -- "" | "assess" (adds the amber "assessment" styling) |
#                an attribute string like 'id="blended"' if some other
#                script needs to target this bubble by id
FEATURES = [
    ("course",         "Course",                           130, 15,    ""),
    ("curated",        "Curated Program",                  136, None,  ""),
    ("blended",        "Blended Program",                  136, None,  'id="blended"'),
    ("assigned",       "My Assigned Courses",               136, 13.5, ""),
    ("standalone",     "Standalone Assessment",             136, 13.5, "assess"),
    ("cap",            "Comprehensive Assessment Program",  144, 13,   "assess"),
    ("pathway",        "Learning Pathway",                  128, 14,   ""),
    ("bharatkalp",     "Bharat Kalp",                       128, 14,   ""),
    ("peervalidation", "Peer Validation",                   136, 14,   ""),
    ("chs",            "CHS",                               128, 14,   ""),
    ("aicbp",          "AI CBP Tool",                       136, 13.5, ""),
    ("eventshub",      "Events Hub",                        128, 14,   ""),
    ("competencyhub",  "Competency Hub",                    136, 13.5, ""),
]

# ─── Geometry constants ──────────────────────────────────────────────
CX, CY = 720, 505   # hub center -- matches .bub.center's box in the template
HUB_R = 102          # hub bubble radius (204px width / 2)
GOLDEN_ANGLE = math.pi * (3 - math.sqrt(5))  # ~137.5077 deg, in radians

# The template's own JS (`fit()`) CSS-scales the 1440x900 "#stage" box to
# fit the viewport on BOTH axes and disables scrolling on desktop -- so
# every bubble must land inside these margins, not just avoid overlapping
# other bubbles. (Top margin clears the search bar/back-pill; bottom
# margin clears the "Every feature is documented..." hint text.)
SAFE_X = (55, 1410)
SAFE_Y = (65, 885)
MIN_CLEARANCE = 16  # minimum required gap, in px, between any two circles


def layout(base_r, b, xscale, yscale):
    """Position every feature along a golden-angle spiral of radius
    base_r + b*sqrt(index-1), stretched by (xscale, yscale) to suit the
    canvas's wide-short aspect ratio (an isotropic spiral doesn't fit;
    see README below the solve() docstring)."""
    pts = []
    for i, (fid, label, size, fs, extra) in enumerate(FEATURES, start=1):
        r = base_r + b * math.sqrt(i - 1)
        theta = i * GOLDEN_ANGLE
        bx = CX + r * xscale * math.cos(theta)
        by = CY + r * yscale * math.sin(theta)
        pts.append(dict(id=fid, label=label, size=size, fs=fs, extra=extra,
                         bx=bx, by=by, rad=size / 2))
    return pts


def fits_canvas(pts):
    for p in pts:
        if not (SAFE_X[0] <= p["bx"] - p["rad"] and p["bx"] + p["rad"] <= SAFE_X[1]
                and SAFE_Y[0] <= p["by"] - p["rad"] and p["by"] + p["rad"] <= SAFE_Y[1]):
            return False
    return True


def worst_clearance(pts):
    worst = min(
        math.hypot(p["bx"] - CX, p["by"] - CY) - (HUB_R + p["rad"])
        for p in pts
    )
    for i in range(len(pts)):
        for j in range(i + 1, len(pts)):
            a, b_ = pts[i], pts[j]
            d = math.hypot(a["bx"] - b_["bx"], a["by"] - b_["by"]) - (a["rad"] + b_["rad"])
            worst = min(worst, d)
    return worst


def solve():
    """Search (base_r, b, xscale, yscale) for a spiral that clears every
    bubble from the hub and from each other by MIN_CLEARANCE, and fits
    inside SAFE_X/SAFE_Y -- picking the tightest (smallest-footprint) fit
    among those found. This runs fresh every time the script executes:
    there is no fixed constant to keep in sync by hand as FEATURES grows."""
    best = None
    for xi in range(0, 26):
        xscale = round(0.90 + 0.02 * xi, 2)
        for yi in range(0, 13):
            yscale = round(0.50 + 0.02 * yi, 2)
            for base_r in range(150, 230, 3):
                for b in range(40, 130, 3):
                    pts = layout(base_r, b, xscale, yscale)
                    if not fits_canvas(pts):
                        continue
                    w = worst_clearance(pts)
                    if w < MIN_CLEARANCE:
                        continue
                    xs = [p["bx"] - p["rad"] for p in pts] + [p["bx"] + p["rad"] for p in pts]
                    ys = [p["by"] - p["rad"] for p in pts] + [p["by"] + p["rad"] for p in pts]
                    footprint = (max(xs) - min(xs)) * (max(ys) - min(ys))
                    cand = (footprint, base_r, b, xscale, yscale, w)
                    if best is None or cand[0] < best[0]:
                        best = cand
    if best is None:
        raise SystemExit(
            f"No spiral parameters found that fit all {len(FEATURES)} bubbles on the "
            f"1440x900 canvas with >= {MIN_CLEARANCE}px clearance. Likely too many/too "
            "large features for this canvas -- consider trimming bubble sizes in "
            "FEATURES, lowering MIN_CLEARANCE slightly, or widening SAFE_X/SAFE_Y."
        )
    _, base_r, b, xscale, yscale, w = best
    return base_r, b, xscale, yscale, w


def render_block(pts):
    lines, buttons = [], []
    for p in pts:
        bx, by = round(p["bx"]), round(p["by"])
        left, top = round(p["bx"] - p["size"] / 2), round(p["by"] - p["size"] / 2)
        lines.append(
            f'      <line x1="{CX}" y1="{CY}" x2="{bx}" y2="{by}" '
            f'stroke="#1B4CA138" stroke-width="1.5" stroke-dasharray="4 6"/>'
        )
        cls = "bub item assess" if p["extra"] == "assess" else "bub item"
        extra_attr = f' {p["extra"]}' if p["extra"] and p["extra"] != "assess" else ""
        fs = f' font-size:{p["fs"]}px' if p["fs"] else ""
        buttons.append(
            f'    <button class="{cls}"{extra_attr} style="left:{left}px; top:{top}px; '
            f'width:{p["size"]}px; height:{p["size"]}px;{fs}" '
            f"onclick=\"openFeature('{p['id']}')\">{p['label']}</button>"
        )

    n = len(pts)
    parts = [
        "    <!-- HUB-RING:BEGIN — generated by tools/layout_hub_ring.py, do not hand-edit.",
        "         To add/remove a feature, edit the FEATURES list in that script and re-run it;",
        "         it rewrites everything between these two markers (lines + buttons + count). -->",
        '    <svg class="orbitbg" width="1440" height="900" fill="none">',
        *lines,
        f'      <circle cx="{CX}" cy="{CY}" r="310" stroke="#1B4CA126" stroke-width="1.5" stroke-dasharray="5 7"/>',
        "    </svg>",
        "",
        '    <div class="bub center" style="left:618px; top:403px; width:204px; height:204px;">',
        '      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5.5h7a2 2 0 0 1 2 2V20a2.5 2.5 0 0 0-2.5-2H3z"/><path d="M21 5.5h-7a2 2 0 0 0-2 2V20a2.5 2.5 0 0 1 2.5-2H21z"/></svg>',
        '      <div style="font-weight:900; font-size:18px; letter-spacing:-0.02em">Learning Hub</div>',
        f'      <div class="sub">{n} features</div>',
        "    </div>",
        "",
        *buttons,
        "    <!-- HUB-RING:END -->",
    ]
    return "\n".join(parts)


MARKER_RE = re.compile(
    r"    <!-- HUB-RING:BEGIN.*?HUB-RING:END -->",
    re.S,
)
LANDING_COUNT_RE = re.compile(
    r'(<button class="bub hub" id="learn-hub"[^>]*>\s*Learning Hub<span class="sub">)\d+( features</span>)'
)


def main():
    check_only = "--check" in sys.argv

    base_r, b, xscale, yscale, clearance = solve()
    pts = layout(base_r, b, xscale, yscale)
    new_block = render_block(pts)

    html = TEMPLATE.read_text()
    if not MARKER_RE.search(html):
        raise SystemExit("HUB-RING:BEGIN/END markers not found in the template.")
    updated = MARKER_RE.sub(new_block.replace("\\", "\\\\"), html, count=1)

    if not LANDING_COUNT_RE.search(updated):
        raise SystemExit("Landing page's Learning Hub feature-count span not found.")
    updated = LANDING_COUNT_RE.sub(rf"\g<1>{len(pts)}\g<2>", updated, count=1)

    print(
        f"solved: base_r={base_r} b={b} xscale={xscale} yscale={yscale} "
        f"-> worst clearance {clearance:.1f}px across {len(pts)} bubbles"
    )

    if check_only:
        if updated != html:
            sys.stderr.write(
                "template is out of date with FEATURES -- run "
                "`python3 tools/layout_hub_ring.py` and commit the result.\n"
            )
            sys.exit(1)
        print("template matches freshly computed layout.")
        return

    TEMPLATE.write_text(updated)
    print(f"wrote {TEMPLATE.name}")


if __name__ == "__main__":
    main()
