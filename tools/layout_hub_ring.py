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
    ("assigned",       "My Assigned Courses",               136, 13.5, ""),
    ("eventshub",      "Events Hub",                        128, 14,   ""),
    ("standalone",     "Standalone Assessment",             136, 13.5, "assess"),
    ("peervalidation", "Peer Validation",                   132, 14,   ""),
    ("cap",            "Comprehensive Assessment Program",  136, 13,   "assess"),
    ("pathway",        "Learning Pathway",                  128, 14,   ""),
    ("course",         "Course",                            130, 15,   ""),
    ("search",         "Search",                             128, 15,   ""),
    ("aicbp",          "AI CBP Tool",                        136, 13.5, ""),
    ("curated",        "Curated Program",                   132, None, ""),
    ("aiassessment",   "AI Assessment Tool",                 128, 13,   ""),
    ("marketplace",    "Marketplace",                        128, 14,   ""),
    ("unenroll",       "Unenrollment of Courses",            132, 12,   ""),
    ("moderatedcontent", "Moderated Content",                 95, 13,   ""),
    ("useronboarding", "User Onboarding",                     128, 14,   ""),
    ("spvregistration", "SPV &amp; Admin Registration",       128, 13,   ""),
]

# ─── Geometry constants ──────────────────────────────────────────────
CX = 720                    # hub center x. Fixed -- the ring is symmetric
                            # left/right and SAFE_X has plenty of headroom
                            # at every feature count tried so far.
HUB_R = 102                 # hub bubble radius (204px width / 2)
BASE_COUNT = 12             # the original design's bubble count
BASE_RADIUS = 310           # ...and its radius, at BASE_COUNT bubbles
START_ANGLE_DEG = 0         # matches the original design's first bubble (bharatkalp, due right of center)

# The template's own JS (`fit()`) CSS-scales the 1440x900 "#stage" box to
# fit the viewport on BOTH axes and disables scrolling on desktop -- so
# every bubble must land inside these margins. The bottom bound is set to
# clear the ".hint" text band (bottom:24px, ~18-20px tall -> occupies
# roughly y=856-876), not just the raw 900px canvas edge -- a bubble can
# be "on canvas" and still visually collide with that text.
SAFE_X = (55, 1410)
SAFE_Y = (65, 848)


def ring_radius(n):
    """Radius for a ring of n evenly-spaced bubbles. Grows with sqrt(n)
    rather than linearly -- gentler growth buys noticeably more headroom
    before the ring reaches the canvas edge -- anchored so BASE_COUNT
    bubbles reproduce the original design's 310px radius exactly."""
    return BASE_RADIUS * math.sqrt(n / BASE_COUNT)


def _feasible_cy_range(r, n):
    """Range of hub-center y values (CY) for which every bubble on a ring
    of the given radius clears SAFE_Y, given the current FEATURES sizes
    and the (fixed) angular spacing. Returns (lo, hi); infeasible iff
    lo > hi."""
    lo, hi = -math.inf, math.inf
    for i, (fid, label, size, fs, extra) in enumerate(FEATURES):
        theta = math.radians(START_ANGLE_DEG + i * 360 / n)
        rel_by = r * math.sin(theta)
        rad = size / 2
        lo = max(lo, SAFE_Y[0] - rel_by + rad)
        hi = min(hi, SAFE_Y[1] - rel_by - rad)
    return lo, hi


def _worst_gap(r, shrink, n):
    """Smallest clearance between any two adjacent bubbles on the ring,
    after subtracting `shrink` px from every bubble's diameter."""
    worst = math.inf
    for i in range(n):
        j = (i + 1) % n
        size_i = FEATURES[i][2] - shrink
        size_j = FEATURES[j][2] - shrink
        d = 2 * r * math.sin(math.pi / n) - (size_i / 2 + size_j / 2)
        worst = min(worst, d)
    return worst


def compute_positions():
    """Picks the largest radius (up to the sqrt-growth target) for which
    some hub-center y still clears every bubble's SAFE_Y margin, then
    centers the ring in that feasible band. The hub center is NOT a fixed
    constant: at BASE_COUNT bubbles it lands at the original design's 468
    (verified below), but it has to shift as bubbles are added/resized,
    since a fixed center can't stay centered in a shrinking feasible
    range forever.

    That Y-fit radius is sometimes too small for all bubbles to keep their
    full FEATURES size without touching a neighbor (this starts happening
    once there are enough bubbles that the safe vertical band, not the
    overlap check, is the binding constraint). Rather than hand-shrinking
    individual entries every time this happens, every bubble's diameter is
    uniformly trimmed by the smallest amount that clears all overlaps --
    a few px is imperceptible per bubble and keeps FEATURES as the single
    source of truth for "ideal" sizes."""
    n = len(FEATURES)
    r = ring_radius(n)
    lo, hi = _feasible_cy_range(r, n)
    while lo > hi:
        r -= 1
        lo, hi = _feasible_cy_range(r, n)
    cy = (lo + hi) / 2

    shrink = 0
    while _worst_gap(r, shrink, n) < 0:
        shrink += 1
        if shrink > 60:
            raise SystemExit("Can't fit these bubbles on one ring even after "
                              "shrinking -- add fewer features per pass, or "
                              "shrink some FEATURES sizes by hand first.")

    pts = []
    for i, (fid, label, size, fs, extra) in enumerate(FEATURES):
        size -= shrink
        theta = math.radians(START_ANGLE_DEG + i * 360 / n)
        bx = CX + r * math.cos(theta)
        by = cy + r * math.sin(theta)
        pts.append(dict(id=fid, label=label, size=size, fs=fs, extra=extra,
                         bx=bx, by=by, rad=size / 2))
    return r, cy, pts


def check_geometry(pts, cy):
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
        d = math.hypot(p["bx"] - CX, p["by"] - cy) - (HUB_R + p["rad"])
        if d < 0:
            problems.append(f'{p["id"]} overlaps the center hub by {-d:.1f}px')
    return problems


def worst_clearance(pts, cy):
    worst = min(math.hypot(p["bx"] - CX, p["by"] - cy) - (HUB_R + p["rad"]) for p in pts)
    for i in range(len(pts)):
        for j in range(i + 1, len(pts)):
            a, b = pts[i], pts[j]
            d = math.hypot(a["bx"] - b["bx"], a["by"] - b["by"]) - (a["rad"] + b["rad"])
            worst = min(worst, d)
    return worst


def render_block(radius, cy, pts):
    lines, buttons = [], []
    for p in pts:
        bx, by = round(p["bx"]), round(p["by"])
        left, top = round(p["bx"] - p["size"] / 2), round(p["by"] - p["size"] / 2)
        lines.append(
            f'      <line x1="{CX}" y1="{round(cy)}" x2="{bx}" y2="{by}" '
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
    hub_top = round(cy) - HUB_R
    parts = [
        "    <!-- HUB-RING:BEGIN — generated by tools/layout_hub_ring.py, do not hand-edit.",
        "         To add/remove a feature, edit the FEATURES list in that script and re-run it;",
        "         it rewrites everything between these two markers (lines + buttons + count). -->",
        '    <svg class="orbitbg" width="1440" height="900" fill="none">',
        *lines,
        f'      <circle cx="{CX}" cy="{round(cy)}" r="{round(radius)}" stroke="#1B4CA126" stroke-width="1.5" stroke-dasharray="5 7"/>',
        "    </svg>",
        "",
        f'    <div class="bub center" style="left:618px; top:{hub_top}px; width:204px; height:204px;">',
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

    radius, cy, pts = compute_positions()
    problems = check_geometry(pts, cy)
    if problems:
        raise SystemExit(
            "Layout has problems, fix FEATURES/constants and re-run:\n  " + "\n  ".join(problems)
        )

    new_block = render_block(radius, cy, pts)

    html = TEMPLATE.read_text()
    if not MARKER_RE.search(html):
        raise SystemExit("HUB-RING:BEGIN/END markers not found in the template.")
    updated = MARKER_RE.sub(lambda _: new_block, html, count=1)

    if not LANDING_COUNT_RE.search(updated):
        raise SystemExit("Landing page's Learning Hub feature-count span not found.")
    updated = LANDING_COUNT_RE.sub(rf"\g<1>{len(pts)}\g<2>", updated, count=1)

    print(f"laid out {len(pts)} features on one ring, radius={radius:.1f}px, cy={cy:.1f}, "
          f"worst clearance={worst_clearance(pts, cy):.1f}px")

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
