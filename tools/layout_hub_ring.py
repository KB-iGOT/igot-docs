#!/usr/bin/env python3
"""
Generates the Learning Hub's hub-ring bubble layout (connector lines,
bubble positions, feature count) as ONE ring whose radius grows with the
feature count, and writes it into karmayogi-docs-explorer.template.html.

Why: the original layout hardcoded exactly 12 bubbles evenly spaced 30
degrees apart at a fixed radius (310px) -- a 13th bubble had nowhere to
go without overlapping a neighbor. Two other approaches were tried and
both looked wrong once rendered: a golden-angle spiral (mathematically
non-overlapping, but at only 13 points it just reads as scattered, not
elegant -- that pattern only looks intentional with dozens of points),
and pinning the original 12 in place with new features orbiting on a
second, much larger ring (technically correct, but the 13th bubble read
as a bolted-on appendage rather than a real spoke of the same wheel).

The fix that actually looks right: keep it ONE ring, and let its radius
scale proportionally with however many features there are --
    radius(N) = BASE_RADIUS * N / BASE_COUNT
-- anchored so that N = BASE_COUNT (the original 12) reproduces the
original 310px radius exactly. All N bubbles are evenly spaced around
that one ring (360/N degrees apart), so the wheel stays symmetric at any
size; it just grows a little with each feature, the same way the
original design already implied it should. The trade-off, stated
plainly: existing bubbles DO nudge a few degrees (and the ring grows a
little) every time a feature is added or removed, because 360/N changes.
That's judged an acceptable, minor cost for staying visually a single,
always-symmetric wheel -- which is what actually reads as "right" here.

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
# (id, label, size_px, font_size_px_or_None, extra)
#   id        -- must match the fdoc's data-fdoc="..." and openFeature('...')
#   label     -- visible text
#   size_px   -- bubble diameter; tune per label length (existing values
#                span 128-144px)
#   font_size -- None to use the button's default font-size
#   extra     -- "" | "assess" (adds the amber "assessment" styling) |
#                an attribute string like 'id="blended"' if some other
#                script needs to target this bubble by id
#
# To add a feature: append one tuple at the end, then run this script.
# Order determines position around the ring (item i sits at
# i/N * 360 degrees) -- appending at the end keeps the *relative* order
# of everything else the same, even though the ring itself regrows.
FEATURES = [
    ("bharatkalp",     "Bharat Kalp",                       128, 14,   ""),
    ("blended",        "Blended Program",                   136, None, 'id="blended"'),
    ("chs",            "CHS",                               128, 14,   ""),
    ("assigned",       "My Assigned Courses",               136, 13.5, ""),
    ("eventshub",      "Events Hub",                        128, 14,   ""),
    ("standalone",     "Standalone Assessment",             136, 13.5, "assess"),
    ("peervalidation", "Peer Validation",                   136, 14,   ""),
    ("cap",            "Comprehensive Assessment Program",  144, 13,   "assess"),
    ("pathway",        "Learning Pathway",                  128, 14,   ""),
    ("course",         "Course",                            130, 15,   ""),
    ("aicbp",          "AI CBP Tool",                        136, 13.5, ""),
    ("curated",        "Curated Program",                   136, None, ""),
    ("competencyhub",  "Competency Hub",                    136, 13.5, ""),
]

# ─── Geometry constants ──────────────────────────────────────────────
CX, CY = 720, 480          # hub center. CY is nudged up from the original
                            # design's 505: the 1440x900 canvas gives the
                            # hub far less room below it (900-505=395px)
                            # than above it (505px) at the original center,
                            # so growing the ring at CY=505 hits the bottom
                            # edge almost immediately. CY=480 balances that
                            # (roughly 415px on both sides) while staying
                            # clear of the top search bar/back button.
HUB_R = 102                 # hub bubble radius (204px width / 2)
HUB_TOP = CY - 102          # .bub.center's "top" style (its own 204px height / 2)
BASE_COUNT = 12             # the original design's bubble count
BASE_RADIUS = 310           # ...and its radius, at BASE_COUNT bubbles
START_ANGLE_DEG = 0         # matches the original design's first bubble (bharatkalp, due right of center)

# The template's own JS (`fit()`) CSS-scales the 1440x900 "#stage" box to
# fit the viewport on BOTH axes and disables scrolling on desktop -- so
# every bubble must land inside these margins.
SAFE_X = (55, 1410)
SAFE_Y = (65, 895)


def ring_radius(n):
    """Radius for a ring of n evenly-spaced bubbles. Grows with sqrt(n)
    rather than linearly -- gentler growth buys noticeably more headroom
    before the ring reaches the canvas edge (see the module docstring's
    reasoning for CY) -- anchored so BASE_COUNT bubbles reproduce the
    original design's 310px radius exactly."""
    return BASE_RADIUS * math.sqrt(n / BASE_COUNT)


def compute_positions():
    n = len(FEATURES)
    r = ring_radius(n)
    pts = []
    for i, (fid, label, size, fs, extra) in enumerate(FEATURES):
        theta = math.radians(START_ANGLE_DEG + i * 360 / n)
        bx = CX + r * math.cos(theta)
        by = CY + r * math.sin(theta)
        pts.append(dict(id=fid, label=label, size=size, fs=fs, extra=extra,
                         bx=bx, by=by, rad=size / 2))
    return r, pts


def check_geometry(pts):
    problems = []
    for p in pts:
        if not (SAFE_X[0] <= p["bx"] - p["rad"] and p["bx"] + p["rad"] <= SAFE_X[1]
                and SAFE_Y[0] <= p["by"] - p["rad"] and p["by"] + p["rad"] <= SAFE_Y[1]):
            problems.append(f'{p["id"]} falls outside the safe canvas margins')
    for i in range(len(pts)):
        for j in range(i + 1, len(pts)):
            a, b = pts[i], pts[j]
            d = math.hypot(a["bx"] - b["bx"], a["by"] - b["by"]) - (a["rad"] + b["rad"])
            if d < 0:
                problems.append(f'{a["id"]} overlaps {b["id"]} by {-d:.1f}px')
    for p in pts:
        d = math.hypot(p["bx"] - CX, p["by"] - CY) - (HUB_R + p["rad"])
        if d < 0:
            problems.append(f'{p["id"]} overlaps the center hub by {-d:.1f}px')
    return problems


def worst_clearance(pts):
    worst = min(math.hypot(p["bx"] - CX, p["by"] - CY) - (HUB_R + p["rad"]) for p in pts)
    for i in range(len(pts)):
        for j in range(i + 1, len(pts)):
            a, b = pts[i], pts[j]
            d = math.hypot(a["bx"] - b["bx"], a["by"] - b["by"]) - (a["rad"] + b["rad"])
            worst = min(worst, d)
    return worst


def render_block(radius, pts):
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
        f'      <circle cx="{CX}" cy="{CY}" r="{round(radius)}" stroke="#1B4CA126" stroke-width="1.5" stroke-dasharray="5 7"/>',
        "    </svg>",
        "",
        f'    <div class="bub center" style="left:618px; top:{HUB_TOP}px; width:204px; height:204px;">',
        '      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5.5h7a2 2 0 0 1 2 2V20a2.5 2.5 0 0 0-2.5-2H3z"/><path d="M21 5.5h-7a2 2 0 0 0-2 2V20a2.5 2.5 0 0 1 2.5-2H21z"/></svg>',
        '      <div style="font-weight:900; font-size:18px; letter-spacing:-0.02em">Learning Hub</div>',
        f'      <div class="sub">{n} features</div>',
        "    </div>",
        "",
        *buttons,
        "    <!-- HUB-RING:END -->",
    ]
    return "\n".join(parts)


MARKER_RE = re.compile(r"    <!-- HUB-RING:BEGIN.*?HUB-RING:END -->", re.S)
LANDING_COUNT_RE = re.compile(
    r'(<button class="bub hub" id="learn-hub"[^>]*>\s*Learning Hub<span class="sub">)\d+( features</span>)'
)


def main():
    check_only = "--check" in sys.argv

    radius, pts = compute_positions()
    problems = check_geometry(pts)
    if problems:
        raise SystemExit(
            "Layout has problems, fix FEATURES/constants and re-run:\n  " + "\n  ".join(problems)
        )

    new_block = render_block(radius, pts)

    html = TEMPLATE.read_text()
    if not MARKER_RE.search(html):
        raise SystemExit("HUB-RING:BEGIN/END markers not found in the template.")
    updated = MARKER_RE.sub(lambda _: new_block, html, count=1)

    if not LANDING_COUNT_RE.search(updated):
        raise SystemExit("Landing page's Learning Hub feature-count span not found.")
    updated = LANDING_COUNT_RE.sub(rf"\g<1>{len(pts)}\g<2>", updated, count=1)

    print(f"laid out {len(pts)} features on one ring, radius={radius:.1f}px, "
          f"worst clearance={worst_clearance(pts):.1f}px")

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
